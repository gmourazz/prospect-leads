// Package emailfinder collects every public email address it can find for a
// business, from several independent sources. It exists because the whole
// product targets businesses WITHOUT a website — so scraping "their site"
// finds nothing for most leads, and the address, when it exists at all,
// lives on a directory listing, a social page, or the Receita registry.
//
// Everything here is best-effort and low-precision by nature: it returns
// what it found and where it came from, and never invents an address. When
// it finds nothing the caller leaves the lead without email rather than
// guessing one from the company name.
package emailfinder

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/geovanna/prospect/backend/internal/domain/company"
)

// Source names, stored alongside each address so the UI can say where it
// came from and so a bad source can be purged later without touching the
// others.
const (
	SourceOSM       = "osm"
	SourceWebsite   = "website"
	SourceWebSearch = "web_search"
	SourceCNPJ      = "cnpj"
	SourceManual    = "manual"
)

type Query struct {
	CompanyName string
	City        string
	State       string
	Website     string
	CNPJ        string
}

type Found struct {
	Email  string
	Source string
}

type Finder struct {
	client *http.Client

	// Google Programmable Search credentials. Scraping a search engine was
	// tried first and does not work: DuckDuckGo answers scripted requests
	// with an anti-bot page, and Bing serves results for a completely
	// different query. Without these two set, web search is simply skipped
	// rather than pretending to run.
	searchKey string
	searchCX  string

	// Even with the official API, queries serialize through this gate: the
	// free tier is 100 queries a day and burning it in one burst helps
	// nobody.
	searchGate sync.Mutex
	lastSearch time.Time
}

func New(searchKey, searchCX string) *Finder {
	return &Finder{
		client:    &http.Client{Timeout: 12 * time.Second},
		searchKey: searchKey,
		searchCX:  searchCX,
	}
}

// SearchEnabled reports whether the web-search source is usable at all, so
// the UI can explain why coverage is limited instead of leaving the user
// guessing.
func (f *Finder) SearchEnabled() bool { return f.searchKey != "" && f.searchCX != "" }

const searchInterval = 1200 * time.Millisecond
const maxBodyBytes = 500_000
const maxPagesPerSearch = 3

// browserUA matters: a default Go user agent gets an empty page from most
// of these hosts.
const browserUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

var emailPattern = regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)

// junkDomains never belong to the business itself — they're platform,
// analytics or template placeholder addresses that appear in page source.
var junkDomains = []string{
	"sentry.io", "wixpress.com", "wix.com", "godaddy.com", "cloudflare.com",
	"w3.org", "schema.org", "example.com", "example.org", "gstatic.com",
	"google.com", "googlemail.com", "facebook.com", "instagram.com",
	"duckduckgo.com", "wikipedia.org", "wikimedia.org", "placeholder.com",
	"yourdomain.com", "seudominio.com", "seuemail.com", "domain.com",
	"email.com", "sentry-next.wixpress.com", "jquery.com", "wordpress.org",
	"squarespace.com", "shopify.com", "mailchimp.com", "cdn.com",
	// Hosting sandboxes: the same inbox answers on the provider's preview
	// domain, but writing to it reaches nobody at the business.
	"hostingersite.com", "cloudezapp.io", "netlify.app", "vercel.app",
	"herokuapp.com", "github.io", "azurewebsites.net", "appspot.com",
	"cloudfront.net", "temp-dns.com", "kinsta.cloud", "wpengine.com",
	"ngrok.io", "onrender.com", "railway.app", "webflow.io",
	"umbler.net", "locaweb.com.br", "hostgator.com.br",
}

var junkSubstrings = []string{
	".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js",
	"@2x", "@3x", "example@", "seuemail@", "email@email", "nome@",
	"usuario@", "user@", "test@", "teste@", "noreply@", "no-reply@",
	"donotreply@", "abuse@", "postmaster@", "webmaster@wix",
}

// contactPaths are the pages most likely to carry an address on a business
// site. Kept short: this runs per lead and must not become a crawl.
var contactPaths = []string{"", "/contato", "/contact", "/fale-conosco", "/sobre"}

// Find runs every source and returns the union, deduplicated, ordered by
// how trustworthy the source is. Sources that fail are skipped silently —
// one dead website must not cost us the address the Receita has.
//
// The order matters beyond ranking: pages read along the way are also
// scanned for a CNPJ, because the official registries hold an email for
// almost every company but can only be queried by CNPJ, which none of our
// lead sources provide. A CNPJ printed in a site footer is therefore worth
// as much as an address found directly.
func (f *Finder) Find(ctx context.Context, q Query) []Found {
	found, _ := f.FindWithCNPJ(ctx, q)
	return found
}

// FoundCNPJ reports a CNPJ discovered while looking for addresses, so the
// caller can store it on the company: it is useful well beyond email.
func (f *Finder) FindWithCNPJ(ctx context.Context, q Query) ([]Found, string) {
	var all []Found
	cnpj := onlyDigits(q.CNPJ)

	if q.Website != "" {
		found, siteCNPJ := f.fromWebsite(ctx, q.Website)
		all = append(all, found...)
		if cnpj == "" {
			cnpj = siteCNPJ
		}
	}
	if q.CompanyName != "" {
		found, searchCNPJ := f.fromWebSearch(ctx, q)
		all = append(all, found...)
		if cnpj == "" {
			cnpj = searchCNPJ
		}
	}
	if cnpj != "" {
		all = append(all, f.fromCNPJ(ctx, cnpj)...)
	}
	return dedupe(all), cnpj
}

// ------------------------------------------------------------- website

func (f *Finder) fromWebsite(ctx context.Context, website string) ([]Found, string) {
	base := normalizeBase(website)
	if base == "" {
		return nil, ""
	}
	var out []Found
	var cnpj string
	for _, path := range contactPaths {
		body, err := f.fetch(ctx, base+path)
		if err != nil {
			continue
		}
		for _, email := range extractEmails(body) {
			out = append(out, Found{Email: email, Source: SourceWebsite})
		}
		if cnpj == "" {
			cnpj = extractCNPJ(body)
		}
	}
	return out, cnpj
}

// ---------------------------------------------------------------- CNPJ

// fromCNPJ reads the address the business itself registered with the
// Receita Federal, exposed by BrasilAPI. It's the single most reliable
// source we have — it just requires knowing the CNPJ, which most collected
// leads don't carry.
func (f *Finder) fromCNPJ(ctx context.Context, cnpj string) []Found {
	digits := onlyDigits(cnpj)
	if len(digits) != 14 {
		return nil
	}

	var out []Found
	seen := map[string]bool{}
	add := func(raw string) {
		email := strings.ToLower(strings.TrimSpace(raw))
		if email == "" || isJunk(email) || seen[email] {
			return
		}
		seen[email] = true
		out = append(out, Found{Email: email, Source: SourceCNPJ})
	}

	// Two independent mirrors of the same Receita registry. They disagree
	// often enough — one updated, one stale — that asking both is worth the
	// extra request.
	if body, err := f.fetch(ctx, "https://brasilapi.com.br/api/cnpj/v1/"+digits); err == nil {
		var payload struct {
			Email string `json:"email"`
		}
		if json.Unmarshal([]byte(body), &payload) == nil {
			add(payload.Email)
		}
	}
	if body, err := f.fetch(ctx, "https://open.cnpja.com/office/"+digits); err == nil {
		var payload struct {
			Emails []struct {
				Address string `json:"address"`
			} `json:"emails"`
		}
		if json.Unmarshal([]byte(body), &payload) == nil {
			for _, e := range payload.Emails {
				add(e.Address)
			}
		}
	}
	return out
}

// cnpjPattern matches the formatted and bare shapes a CNPJ is printed in.
var cnpjPattern = regexp.MustCompile(`\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b`)

// extractCNPJ pulls a CNPJ out of page text — a business site footer almost
// always carries one, and it is the key that unlocks the official registry.
func extractCNPJ(html string) string {
	text := stripTags(html)
	for _, m := range cnpjPattern.FindAllString(text, -1) {
		digits := onlyDigits(m)
		if len(digits) == 14 && isValidCNPJ(digits) {
			return digits
		}
	}
	return ""
}

// isValidCNPJ checks the two verification digits, so a random 14-digit
// number in a page (an order id, a phone list) is not mistaken for one.
func isValidCNPJ(digits string) bool {
	if len(digits) != 14 || strings.Count(digits, string(digits[0])) == 14 {
		return false
	}
	weights1 := []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	weights2 := []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}

	check := func(weights []int) int {
		sum := 0
		for i, w := range weights {
			sum += int(digits[i]-'0') * w
		}
		rest := sum % 11
		if rest < 2 {
			return 0
		}
		return 11 - rest
	}
	d1 := check(weights1)
	d2 := check(weights2)
	return int(digits[12]-'0') == d1 && int(digits[13]-'0') == d2
}

// ---------------------------------------------------------- web search

// fromWebSearch is the only source that finds anything for a business with
// no website at all: it asks a search engine for the company by name and
// city, reads the addresses straight out of the results page, then opens
// the top few results and reads those too.
//
// Precision guard: an address found on a third-party page only counts if
// that page actually mentions the company. Directory listings show dozens
// of unrelated businesses, and mailing the wrong one is worse than mailing
// nobody.
func (f *Finder) fromWebSearch(ctx context.Context, q Query) ([]Found, string) {
	if !f.SearchEnabled() {
		return nil, ""
	}
	query := `"` + q.CompanyName + `" ` + q.City + ` email contato CNPJ`
	results, err := f.search(ctx, query)
	if err != nil {
		return nil, ""
	}

	nameKey := company.NameKey(q.CompanyName)
	var out []Found
	var cnpj string

	// The snippet often carries the address straight in the result text,
	// which costs nothing extra to read.
	for _, item := range results {
		for _, email := range extractEmails(item.Title + " " + item.Snippet) {
			out = append(out, Found{Email: email, Source: SourceWebSearch})
		}
	}

	for i, item := range results {
		if i >= maxPagesPerSearch {
			break
		}
		body, err := f.fetch(ctx, item.Link)
		if err != nil {
			continue
		}
		if !mentionsCompany(body, nameKey) {
			continue
		}
		for _, email := range extractEmails(body) {
			out = append(out, Found{Email: email, Source: SourceWebSearch})
		}
		if cnpj == "" {
			cnpj = extractCNPJ(body)
		}
	}
	return out, cnpj
}

type searchResult struct {
	Title   string `json:"title"`
	Link    string `json:"link"`
	Snippet string `json:"snippet"`
}

func (f *Finder) search(ctx context.Context, query string) ([]searchResult, error) {
	f.searchGate.Lock()
	if gap := time.Since(f.lastSearch); gap < searchInterval {
		select {
		case <-time.After(searchInterval - gap):
		case <-ctx.Done():
			f.searchGate.Unlock()
			return nil, ctx.Err()
		}
	}
	f.lastSearch = time.Now()
	f.searchGate.Unlock()

	endpoint := "https://www.googleapis.com/customsearch/v1?key=" + url.QueryEscape(f.searchKey) +
		"&cx=" + url.QueryEscape(f.searchCX) +
		"&num=5&q=" + url.QueryEscape(query)

	body, err := f.fetch(ctx, endpoint)
	if err != nil {
		return nil, err
	}
	var payload struct {
		Items []searchResult `json:"items"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return nil, err
	}
	return payload.Items, nil
}

func mentionsCompany(body, nameKey string) bool {
	if nameKey == "" {
		return false
	}
	haystack := company.NameKey(stripTags(body))
	// A short generic name ("studio") would match half the internet, so
	// require the whole normalized name to appear.
	return strings.Contains(haystack, nameKey)
}

// -------------------------------------------------------------- helpers

func (f *Finder) fetch(ctx context.Context, target string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.8")

	resp, err := f.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", errStatus
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

type statusError struct{}

func (statusError) Error() string { return "unexpected status" }

var errStatus = statusError{}

var tagPattern = regexp.MustCompile(`<[^>]*>`)

func stripTags(html string) string {
	return tagPattern.ReplaceAllString(html, " ")
}

func extractEmails(text string) []string {
	seen := map[string]bool{}
	var out []string
	for _, raw := range emailPattern.FindAllString(text, -1) {
		email := strings.ToLower(strings.Trim(raw, ".-_"))
		if isJunk(email) || seen[email] {
			continue
		}
		seen[email] = true
		out = append(out, email)
	}
	return out
}

func isJunk(email string) bool {
	if len(email) > 120 {
		return true
	}
	at := strings.LastIndex(email, "@")
	if at < 1 {
		return true
	}
	domain := email[at+1:]
	for _, d := range junkDomains {
		if domain == d || strings.HasSuffix(domain, "."+d) {
			return true
		}
	}
	for _, sub := range junkSubstrings {
		if strings.Contains(email, sub) {
			return true
		}
	}
	// A host that is literally an IP address, or a provider subdomain built
	// from one, belongs to the server rather than to the business.
	if strings.HasPrefix(domain, "ip-") || ipHostPattern.MatchString(domain) {
		return true
	}
	return false
}

var ipHostPattern = regexp.MustCompile(`\d{1,3}[.-]\d{1,3}[.-]\d{1,3}[.-]\d{1,3}`)

// sourceRank orders the sources by how much we trust them, so the address
// promoted to primary is the one most likely to be read by a human.
var sourceRank = map[string]int{
	SourceManual:    0,
	SourceCNPJ:      1,
	SourceWebsite:   2,
	SourceOSM:       3,
	SourceWebSearch: 4,
}

// localPartRank prefers a business inbox over whatever else turned up.
func localPartRank(email string) int {
	local := email[:strings.LastIndex(email, "@")]
	switch {
	case strings.HasPrefix(local, "contato"), strings.HasPrefix(local, "contact"):
		return 0
	case strings.HasPrefix(local, "comercial"), strings.HasPrefix(local, "vendas"):
		return 1
	case strings.HasPrefix(local, "atendimento"), strings.HasPrefix(local, "sac"):
		return 2
	case strings.HasPrefix(local, "info"), strings.HasPrefix(local, "faleconosco"):
		return 3
	default:
		return 4
	}
}

// Rank sorts a discovered set so the best candidate comes first. Exported
// because the caller decides which one becomes the primary address.
func Rank(found []Found) []Found {
	out := append([]Found(nil), found...)
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && less(out[j], out[j-1]); j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

func less(a, b Found) bool {
	if sourceRank[a.Source] != sourceRank[b.Source] {
		return sourceRank[a.Source] < sourceRank[b.Source]
	}
	if ra, rb := localPartRank(a.Email), localPartRank(b.Email); ra != rb {
		return ra < rb
	}
	return a.Email < b.Email
}

func dedupe(found []Found) []Found {
	seen := map[string]bool{}
	var out []Found
	for _, f := range Rank(found) {
		if seen[f.Email] {
			continue
		}
		seen[f.Email] = true
		out = append(out, f)
	}
	return out
}

func normalizeBase(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	if !strings.Contains(s, "://") {
		s = "https://" + s
	}
	return strings.TrimRight(s, "/")
}

func onlyDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
