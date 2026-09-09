package company

import (
	"net/url"
	"strings"
)

type PresenceKind string

const (
	PresenceOwnSite        PresenceKind = "own_site"
	PresenceInstagram      PresenceKind = "instagram"
	PresenceFacebook       PresenceKind = "facebook"
	PresenceLinktree       PresenceKind = "linktree"
	PresenceMarketplace    PresenceKind = "marketplace"
	PresenceWhatsAppLink   PresenceKind = "whatsapp_link"
	PresenceGoogleBusiness PresenceKind = "google_business"
	PresenceOther          PresenceKind = "other"
)

type WebsiteStatus string

const (
	StatusHasWebsite     WebsiteStatus = "has_website"
	StatusNoWebsite      WebsiteStatus = "no_website"
	StatusUnknown        WebsiteStatus = "unknown"
	StatusReviewRequired WebsiteStatus = "review_required"
)

// hostKinds maps a known host suffix to what it actually is. None of these
// count as the business having its own website — which is the whole point of
// the product.
var hostKinds = map[string]PresenceKind{
	"instagram.com":     PresenceInstagram,
	"instagr.am":        PresenceInstagram,
	"facebook.com":      PresenceFacebook,
	"fb.com":            PresenceFacebook,
	"fb.me":             PresenceFacebook,
	"m.me":              PresenceFacebook,
	"linktr.ee":         PresenceLinktree,
	"beacons.ai":        PresenceLinktree,
	"bio.link":          PresenceLinktree,
	"linkbio.co":        PresenceLinktree,
	"linktree.com":      PresenceLinktree,
	"wa.me":             PresenceWhatsAppLink,
	"api.whatsapp.com":  PresenceWhatsAppLink,
	"whatsapp.com":      PresenceWhatsAppLink,
	"chat.whatsapp.com": PresenceWhatsAppLink,
	"g.page":            PresenceGoogleBusiness,
	"goo.gl":            PresenceGoogleBusiness,
	"maps.app.goo.gl":   PresenceGoogleBusiness,
	"business.site":     PresenceGoogleBusiness,
	"negocio.site":      PresenceGoogleBusiness,
	"ifood.com.br":      PresenceMarketplace,
	"doctoralia.com.br": PresenceMarketplace,
	"booksy.com":        PresenceMarketplace,
	"trinks.com":        PresenceMarketplace,
	"agendei.com.br":    PresenceMarketplace,
	"gympass.com":       PresenceMarketplace,
	"boaconsulta.com":   PresenceMarketplace,
	"tiktok.com":        PresenceOther,
	"youtube.com":       PresenceOther,
	"twitter.com":       PresenceOther,
	"x.com":             PresenceOther,
	"linkedin.com":      PresenceOther,
	// Free site builders on a shared subdomain: the business does not own it.
	"wixsite.com":      PresenceOther,
	"wordpress.com":    PresenceOther,
	"blogspot.com":     PresenceOther,
	"webnode.com.br":   PresenceOther,
	"mysite.com":       PresenceOther,
	"canva.site":       PresenceOther,
	"sites.google.com": PresenceOther,
}

// ClassifyURL decides what a URL is. Social, marketplaces and link-in-bio
// pages are never own_site — that distinction is the product's core filter.
func ClassifyURL(raw string) (kind PresenceKind, host string, normalized string, ok bool) {
	s := strings.TrimSpace(strings.ToLower(raw))
	if s == "" {
		return PresenceOther, "", "", false
	}
	if !strings.Contains(s, "://") {
		s = "https://" + s
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" {
		return PresenceOther, "", "", false
	}

	host = strings.TrimPrefix(u.Host, "www.")
	if !strings.Contains(host, ".") {
		return PresenceOther, "", "", false
	}

	normalized = host + strings.TrimSuffix(u.Path, "/")

	for suffix, k := range hostKinds {
		if host == suffix || strings.HasSuffix(host, "."+suffix) {
			return k, host, normalized, true
		}
	}
	return PresenceOwnSite, host, normalized, true
}

// DeriveWebsiteStatus turns the set of known presences into the single status
// shown in the table. It never guesses "has_website" from a social profile.
func DeriveWebsiteStatus(kinds []PresenceKind) WebsiteStatus {
	if len(kinds) == 0 {
		return StatusUnknown
	}
	for _, k := range kinds {
		if k == PresenceOwnSite {
			return StatusHasWebsite
		}
	}
	return StatusNoWebsite
}
