package application

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/enrichment/emailfinder"
	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/company"
	"github.com/geovanna/prospect/backend/internal/domain/contact"
	"github.com/geovanna/prospect/backend/internal/domain/sourcing"
	"github.com/geovanna/prospect/backend/internal/observability"
)

// googleFreeMonthlyCalls is the free-tier ceiling for the Places API (New)
// "Pro" SKU (Text Search included) as of the pricing Google published after
// retiring the old pooled $200/month credit. Calls above this are billed at
// $32 per 1,000 — this constant exists purely so the UI can warn before that
// happens, not to enforce anything.
const googleFreeMonthlyCalls = 5000

// stateSearchPace is the gap between provider calls in a state-wide search.
// Deliberately gentle: hundreds of cities means hundreds (or, with several
// segments, thousands) of calls, and nothing about a background job needs
// them to fire as fast as the provider allows.
const stateSearchPace = 1500 * time.Millisecond

type SourcingService struct {
	store     *postgres.Store
	companies *postgres.CompanyRepo
	contacts  *postgres.ContactRepo
	segments  *postgres.SegmentRepo
	leads     *postgres.LeadRepo
	usage     *postgres.SearchUsageRepo
	quota     *postgres.ProviderQuotaRepo
	provider  sourcing.Provider
	emails    *emailfinder.Finder

	// Only one enrichment run at a time: the finder paces its own search
	// queries, and two runs racing would double the request rate against
	// the same hosts for no gain.
	enriching sync.Mutex

	// Discovery runs in the background for minutes at a time, so the UI
	// needs something to poll: without it the user clicks the button and
	// stares at an unchanged list wondering if anything is happening.
	progressMu sync.RWMutex
	progress   EnrichmentProgress

	// Same idea for a state-wide search: it can walk hundreds of cities, so
	// it runs in the background, paced, with a cancel switch. Only one at a
	// time — nothing gained from racing two against the same provider.
	stateSearching  sync.Mutex
	stateProgressMu sync.RWMutex
	stateProgress   StateSearchProgress
	stateCancel     context.CancelFunc
}

// EnrichmentProgress is the live state of the current (or last) discovery
// run, shaped for the screen that polls it.
type EnrichmentProgress struct {
	Running     bool   `json:"running"`
	Total       int    `json:"total"`
	Processed   int    `json:"processed"`
	Remaining   int    `json:"remaining"`
	WithEmail   int    `json:"leads_with_email"`
	EmailsFound int    `json:"emails_found"`
	StartedAt   string `json:"started_at,omitempty"`
	FinishedAt  string `json:"finished_at,omitempty"`
}

// StateSearchProgress is the live state of the current (or last) state-wide
// search, shaped for the screen that polls it.
//
// The failure counters matter as much as LeadsFound: every way this run can
// come up empty — the provider rejecting every call, results arriving without
// a usable phone, a city failing to import — is survivable by design, so
// without them the screen reports a clean "finished, 0 leads" for causes as
// different as a dead API key and a genuinely empty region.
type StateSearchProgress struct {
	Running         bool   `json:"running"`
	State           string `json:"state"`
	TotalCities     int    `json:"total_cities"`
	ProcessedCities int    `json:"processed_cities"`
	CurrentCity     string `json:"current_city"`
	LeadsFound      int    `json:"leads_found"`
	FailedCalls     int    `json:"failed_calls"`
	NoPhone         int    `json:"no_phone"`
	Filtered        int    `json:"filtered"`
	FailedCities    int    `json:"failed_cities"`
	LastError       string `json:"last_error,omitempty"`
	Cancelled       bool   `json:"cancelled"`
	StartedAt       string `json:"started_at,omitempty"`
	FinishedAt      string `json:"finished_at,omitempty"`
}

// StateSearchStatus reports how far the background state-wide search got.
func (s *SourcingService) StateSearchStatus() StateSearchProgress {
	s.stateProgressMu.RLock()
	defer s.stateProgressMu.RUnlock()
	return s.stateProgress
}

// CancelStateSearch stops the run after its current provider call returns —
// there's no way to interrupt an in-flight HTTP request to the provider, so
// "cancelled" means "stops picking up new cities," not "stops instantly."
func (s *SourcingService) CancelStateSearch() error {
	s.stateProgressMu.Lock()
	defer s.stateProgressMu.Unlock()
	if s.stateCancel == nil {
		return domain.NotFound("busca por estado em andamento")
	}
	s.stateCancel()
	return nil
}

// SearchState walks every city it's given, one at a time, searching the
// wanted segment(s) in each and auto-importing whatever comes back — the
// same "results land straight in Leads" behavior as a single-city search,
// just paced across a background run instead of one request. Returns the
// number of cities queued; the run itself continues after this returns.
func (s *SourcingService) SearchState(ctx context.Context, state string, cities []string, segmentID string, limit int, filters SearchFilters) (int, error) {
	if state == "" {
		return 0, domain.Validation("estado é obrigatório")
	}
	if len(cities) == 0 {
		return 0, domain.Validation("nenhuma cidade informada")
	}
	if !s.stateSearching.TryLock() {
		return 0, domain.New(domain.CodeConflict, "já existe uma busca por estado em andamento")
	}

	segments, err := s.segments.List(ctx)
	if err != nil {
		s.stateSearching.Unlock()
		return 0, err
	}
	var wanted []domain.Segment
	if segmentID == "" || segmentID == "all" {
		for _, seg := range segments {
			if seg.IsActive {
				wanted = append(wanted, seg)
			}
		}
	} else {
		id, err := uuid.Parse(segmentID)
		if err != nil {
			s.stateSearching.Unlock()
			return 0, domain.Validation("segment_id inválido")
		}
		for _, seg := range segments {
			if seg.ID == id {
				wanted = append(wanted, seg)
			}
		}
	}
	if len(wanted) == 0 {
		s.stateSearching.Unlock()
		return 0, domain.NotFound("segmento")
	}

	bg, cancel := context.WithCancel(context.Background())
	s.stateProgressMu.Lock()
	s.stateCancel = cancel
	s.stateProgress = StateSearchProgress{
		Running: true, State: state, TotalCities: len(cities),
		StartedAt: time.Now().Format(time.RFC3339),
	}
	s.stateProgressMu.Unlock()

	logger := observability.FromContext(ctx)
	go s.runStateSearch(bg, logger, state, cities, wanted, limit, filters)
	return len(cities), nil
}

func (s *SourcingService) runStateSearch(
	ctx context.Context, logger *slog.Logger, state string, cities []string, segments []domain.Segment, limit int,
	filters SearchFilters,
) {
	defer s.stateSearching.Unlock()
	defer func() {
		s.stateProgressMu.Lock()
		s.stateProgress.Running = false
		s.stateProgress.FinishedAt = time.Now().Format(time.RFC3339)
		s.stateCancel = nil
		s.stateProgressMu.Unlock()
	}()

	for i, city := range cities {
		if ctx.Err() != nil {
			s.stateProgressMu.Lock()
			s.stateProgress.Cancelled = true
			s.stateProgressMu.Unlock()
			return
		}

		s.stateProgressMu.Lock()
		s.stateProgress.CurrentCity = city
		s.stateProgressMu.Unlock()

		merged := SearchOutcome{}
		seen := map[string]bool{}
		for _, seg := range segments {
			outcome, err := s.Search(ctx, seg.Slug, seg.Name, city, state, limit)
			if err != nil {
				logger.Error("state search: segment failed", "segment", seg.Name, "city", city, "error", err)
				s.stateProgressMu.Lock()
				s.stateProgress.FailedCalls++
				s.stateProgress.LastError = err.Error()
				s.stateProgressMu.Unlock()

				// The provider itself just said "no more calls today" —
				// continuing would only burn through the rest of the city
				// list racking up the same rejection, city after city.
				var quotaErr *sourcing.QuotaExceededError
				if errors.As(err, &quotaErr) {
					s.stateProgressMu.Lock()
					s.stateProgress.LastError = "cota diária do provedor esgotada — busca interrompida em " + city
					s.stateProgressMu.Unlock()
					logger.Warn("state search: stopping early, provider quota exhausted",
						"action", "sourcing.state_search.quota_exhausted",
						"city", city, "processed_cities", i)
					return
				}
			} else {
				merged.Provider = outcome.Provider
				for _, c := range outcome.Results {
					key := c.ExternalID
					if key == "" {
						key = c.CompanyName + "|" + c.PhoneDisplay
					}
					if seen[key] {
						continue
					}
					seen[key] = true
					c.SegmentID = seg.ID.String()
					c.SegmentName = seg.Name
					merged.Results = append(merged.Results, c)
				}
			}

			select {
			case <-ctx.Done():
				s.stateProgressMu.Lock()
				s.stateProgress.Cancelled = true
				s.stateProgressMu.Unlock()
				return
			case <-time.After(stateSearchPace):
			}
		}

		var candidates []SearchCandidateInput
		noPhone, filtered := 0, 0
		for _, c := range merged.Results {
			if c.Invalid {
				noPhone++
				continue
			}
			if !filters.Keep(c) {
				filtered++
				continue
			}
			var segID *uuid.UUID
			if c.SegmentID != "" {
				if id, err := uuid.Parse(c.SegmentID); err == nil {
					segID = &id
				}
			}
			candidates = append(candidates, SearchCandidateInput{
				SegmentID: segID, CompanyName: c.CompanyName, Phone: c.PhoneDisplay,
				City: c.City, State: c.State, Website: c.Website, Email: c.Email,
				OpeningHours: c.OpeningHours,
			})
		}
		if len(candidates) > 0 {
			result, err := s.ImportSelected(ctx, ImportSelectedCommand{Provider: merged.Provider, Candidates: candidates})
			if err != nil {
				logger.Error("state search: import failed", "city", city, "error", err)
				s.stateProgressMu.Lock()
				s.stateProgress.FailedCities++
				s.stateProgress.LastError = err.Error()
				s.stateProgressMu.Unlock()
			} else {
				s.stateProgressMu.Lock()
				s.stateProgress.LeadsFound += result.Created + result.Merged
				s.stateProgressMu.Unlock()
			}
		}

		s.stateProgressMu.Lock()
		s.stateProgress.NoPhone += noPhone
		s.stateProgress.Filtered += filtered
		s.stateProgress.ProcessedCities = i + 1
		s.stateProgressMu.Unlock()
	}

	final := s.StateSearchStatus()
	logger.Info("state search finished", "action", "sourcing.state_search.done",
		"state", state, "cities", len(cities), "leads_found", final.LeadsFound,
		"failed_calls", final.FailedCalls, "no_phone", final.NoPhone,
		"filtered", final.Filtered, "failed_cities", final.FailedCities,
		"last_error", final.LastError)
}

// EnrichmentStatus reports how far the background discovery got.
func (s *SourcingService) EnrichmentStatus(ctx context.Context) (EnrichmentProgress, error) {
	s.progressMu.RLock()
	p := s.progress
	s.progressMu.RUnlock()

	// Remaining leads without an email is a database question, not a
	// progress-counter one: it stays right even across restarts.
	pending, err := s.leads.CountLeadsMissingEmail(ctx)
	if err != nil {
		return p, err
	}
	p.Remaining = pending
	return p, nil
}

func NewSourcingService(
	store *postgres.Store,
	companies *postgres.CompanyRepo,
	contacts *postgres.ContactRepo,
	segments *postgres.SegmentRepo,
	leads *postgres.LeadRepo,
	usage *postgres.SearchUsageRepo,
	quota *postgres.ProviderQuotaRepo,
	provider sourcing.Provider,
	emails *emailfinder.Finder,
) *SourcingService {
	return &SourcingService{
		store: store, companies: companies, contacts: contacts,
		segments: segments, leads: leads, usage: usage, quota: quota,
		provider: provider, emails: emails,
	}
}

type UsageStatus struct {
	Provider  string `json:"provider"`
	YearMonth string `json:"year_month"`
	CallCount int    `json:"call_count"`
	FreeQuota int    `json:"free_quota"`
	IsBilled  bool   `json:"is_billed"`
}

// DailyQuota reports today's real quota state for whichever provider is
// active — distinct from Usage, which is a monthly count that only tracks
// calls that succeeded. This is the one that actually predicts whether the
// next search will work: Google's daily reset is what silently turns "0
// leads" into the normal outcome once the day's calls run out.
func (s *SourcingService) DailyQuota(ctx context.Context) (postgres.DailyQuotaStatus, error) {
	return s.quota.Today(ctx, s.provider.Name())
}

// Usage reports this month's call count for whichever provider is active, so
// the search page can warn before an accidental spike turns into a bill.
// OpenStreetMap has no fixed quota — FreeQuota is 0 and IsBilled is false.
func (s *SourcingService) Usage(ctx context.Context) (UsageStatus, error) {
	status, err := s.usage.Current(ctx, s.provider.Name())
	if err != nil {
		return UsageStatus{}, err
	}
	out := UsageStatus{Provider: status.Provider, YearMonth: status.YearMonth, CallCount: status.CallCount}
	if s.provider.Name() == "google_places" {
		out.FreeQuota = googleFreeMonthlyCalls
		out.IsBilled = true
	}
	return out, nil
}

type SearchCandidate struct {
	ExternalID  string `json:"external_id"`
	CompanyName string `json:"company_name"`
	// Set when the search covered every segment at once, so each result
	// still knows which one it answered for.
	SegmentID        string `json:"segment_id"`
	SegmentName      string `json:"segment_name"`
	PhoneDisplay     string `json:"phone_display"`
	City             string `json:"city"`
	State            string `json:"state"`
	Website          string `json:"website"`
	Email            string `json:"email"`
	OpeningHours     string `json:"opening_hours"`
	AlreadyContacted bool   `json:"already_contacted"`
	ExistingCompany  bool   `json:"existing_company"`
	IsMobile         bool   `json:"is_mobile"`
	IsBlocked        bool   `json:"is_blocked"`
	Invalid          bool   `json:"invalid"`
}

type SearchOutcome struct {
	Provider string            `json:"provider"`
	IsDemo   bool              `json:"is_demo"`
	Results  []SearchCandidate `json:"results"`
}

// SearchFilters are the toggles shown above the search form. They live here,
// rather than inline in the handler, because the single-city search and the
// state-wide run have to agree on what each one means — a toggle that quietly
// applies to one path and not the other is worse than no toggle at all.
type SearchFilters struct {
	OnlyWithoutSite bool
	SkipExisting    bool
	RequireMobile   bool
	IncludeBlocked  bool
}

// Keep reports whether a candidate survives the toggles.
func (f SearchFilters) Keep(c SearchCandidate) bool {
	if c.Website != "" && f.OnlyWithoutSite {
		return false
	}
	if c.ExistingCompany && f.SkipExisting {
		return false
	}
	if !c.IsMobile && !c.Invalid && f.RequireMobile {
		return false
	}
	if c.IsBlocked && !f.IncludeBlocked {
		return false
	}
	return true
}

// Search calls the configured provider and immediately annotates each
// candidate with what the database already knows about it — whether the
// phone was already messaged, whether the company already exists — so the
// selection screen shows that BEFORE the user picks anyone, exactly like the
// board does for collected leads.
func (s *SourcingService) Search(ctx context.Context, segmentSlug, segmentName, city, state string, limit int) (SearchOutcome, error) {
	providerName := s.provider.Name()
	if err := s.quota.RecordCall(ctx, providerName); err != nil {
		observability.FromContext(ctx).Error("failed to record provider call", "error", err)
	}

	result, err := s.provider.Search(ctx, sourcing.SearchQuery{
		Segment: segmentName, City: city, State: state, Limit: limit,
	})
	if err != nil {
		var quotaErr *sourcing.QuotaExceededError
		if errors.As(err, &quotaErr) {
			if qerr := s.quota.RecordQuotaExceeded(ctx, providerName); qerr != nil {
				observability.FromContext(ctx).Error("failed to record quota exceeded", "error", qerr)
			}
		}
		return SearchOutcome{}, domain.Wrap(domain.CodeProviderUnavailable,
			"não foi possível buscar leads agora", err)
	}

	// Counted even though nothing failed downstream from here: the provider
	// call already happened, and for Google that call is what gets billed —
	// the count must reflect what was actually spent, not what was usable.
	if err := s.usage.Increment(ctx, result.Provider); err != nil {
		observability.FromContext(ctx).Error("failed to record search usage", "error", err)
	}

	out := SearchOutcome{Provider: result.Provider, IsDemo: result.IsDemo}
	for _, raw := range result.Leads {
		candidate := SearchCandidate{
			ExternalID: raw.ExternalID, CompanyName: raw.Name,
			City: raw.City, State: raw.State, Website: raw.Website,
			Email: raw.Email, OpeningHours: raw.OpeningHours,
		}

		n, err := contact.Parse(raw.Phone, "BR")
		if err != nil {
			candidate.Invalid = true
			out.Results = append(out.Results, candidate)
			continue
		}
		candidate.PhoneDisplay = n.Display()
		candidate.IsMobile = n.IsMobile()

		if id, found, err := s.contacts.Resolve(ctx, n); err == nil && found {
			if contacted, err := s.contacts.HasBeenContacted(ctx, id); err == nil {
				candidate.AlreadyContacted = contacted
			}
			if state, err := s.contacts.State(ctx, id); err == nil {
				candidate.IsBlocked = state.IsSuppressed
			}
		}

		match, err := s.companies.Resolve(ctx, postgres.CompanyInput{
			TradeName: raw.Name, NameKey: company.NameKey(raw.Name),
			City: raw.City, CityKey: company.CityKey(raw.City), State: company.NormalizeState(raw.State),
		})
		if err == nil && match.Matched {
			candidate.ExistingCompany = true
		}

		out.Results = append(out.Results, candidate)
	}
	return out, nil
}

type ImportSelectedCommand struct {
	SegmentID *uuid.UUID
	// Provider records which source actually produced these candidates
	// (e.g. "openstreetmap", "google_places") so the lead's origin is
	// attributed accurately instead of a hardcoded guess.
	Provider   string
	Candidates []SearchCandidateInput
}

type SearchCandidateInput struct {
	SegmentID    *uuid.UUID
	CompanyName  string
	Phone        string
	City         string
	State        string
	Website      string
	Email        string
	OpeningHours string
}

type ImportSelectedResult struct {
	Created          int `json:"created"`
	Merged           int `json:"merged"`
	AlreadyContacted int `json:"already_contacted"`
	Invalid          int `json:"invalid"`
}

// ImportSelected runs each hand-picked candidate through the exact same
// resolve/dedupe/upsert path as CSV import and manual creation — a search
// result is just another source, never a shortcut around history.
func (s *SourcingService) ImportSelected(ctx context.Context, cmd ImportSelectedCommand) (ImportSelectedResult, error) {
	var out ImportSelectedResult

	// Collected during the loop and used AFTER the transaction commits:
	// discovery is network I/O and must never run inside an open database
	// transaction.
	var lookups []postgres.EnrichmentTarget

	err := s.store.WithTx(ctx, func(ctx context.Context) error {
		for _, c := range cmd.Candidates {
			n, err := contact.Parse(c.Phone, "BR")
			if err != nil {
				out.Invalid++
				continue
			}

			segmentID := cmd.SegmentID
			if c.SegmentID != nil {
				segmentID = c.SegmentID
			}

			contactID, _, err := s.contacts.Upsert(ctx, n)
			if err != nil {
				return err
			}
			if contacted, err := s.contacts.HasBeenContacted(ctx, contactID); err == nil && contacted {
				out.AlreadyContacted++
			}

			input := postgres.CompanyInput{
				TradeName: c.CompanyName, NameKey: company.NameKey(c.CompanyName),
				SegmentID: segmentID, City: c.City,
				CityKey: company.CityKey(c.City), State: company.NormalizeState(c.State),
				OpeningHours: c.OpeningHours,
			}
			match, err := s.companies.Resolve(ctx, input)
			if err != nil {
				return err
			}

			var companyID uuid.UUID
			if match.Matched {
				companyID = match.CompanyID
				if err := s.companies.Merge(ctx, companyID, input); err != nil {
					return err
				}
				out.Merged++
			} else {
				companyID, err = s.companies.Create(ctx, input)
				if err != nil {
					return err
				}
				out.Created++
			}

			if err := s.companies.LinkContact(ctx, companyID, contactID, true); err != nil {
				return err
			}

			// An address the source itself published (an OSM contact:email
			// tag) is stored right away — no network round trip needed for
			// something already in hand.
			if c.Email != "" {
				if _, err := s.contacts.AddEmails(ctx, contactID,
					[]postgres.EmailInput{{Email: c.Email, Source: emailfinder.SourceOSM}}); err != nil {
					return err
				}
			}

			ownSite := ""
			if c.Website != "" {
				if kind, host, urlKey, ok := company.ClassifyURL(c.Website); ok {
					if err := s.companies.AddPresence(ctx, companyID, c.Website, host, urlKey, kind); err != nil {
						return err
					}
					if kind == company.PresenceOwnSite {
						ownSite = c.Website
					}
				}
			}
			// Every imported lead gets a discovery pass, not just the ones
			// with a site: for a business without one, a search engine is
			// the only place an address can turn up at all.
			lookups = append(lookups, postgres.EnrichmentTarget{
				ContactPointID: contactID,
				CompanyID:      companyID,
				CompanyName:    c.CompanyName,
				City:           c.City,
				State:          c.State,
				Website:        ownSite,
			})
			if err := s.companies.RefreshWebsiteStatus(ctx, companyID); err != nil {
				return err
			}
			source := cmd.Provider
			if source == "" {
				source = "manual"
			}
			if _, _, err := s.companies.UpsertLead(ctx, companyID, segmentID, &contactID, source, nil); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return out, err
	}

	// Best-effort, fire-and-forget: the import already succeeded, and slow or
	// failed discovery must never make the HTTP response wait or fail. Runs
	// on a context detached from the request so it isn't canceled the moment
	// the response is written.
	if len(lookups) > 0 {
		logger := observability.FromContext(ctx)
		go s.enrichEmails(logger, lookups)
	}
	return out, nil
}

// EnrichMissingEmails goes back over leads that still have no address and
// runs discovery on them. It's the backfill counterpart to the pass that
// runs at import: leads collected before discovery existed, or ones where
// the first attempt came up empty, get another chance without reimporting.
//
// Returns how many leads were queued. The work itself continues in the
// background — with search queries deliberately paced, a few hundred leads
// take minutes, and no HTTP request should be held open for that.
func (s *SourcingService) EnrichMissingEmails(ctx context.Context, limit int) (int, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	targets, err := s.leads.LeadsMissingEmail(ctx, limit)
	if err != nil {
		return 0, err
	}
	if len(targets) == 0 {
		return 0, nil
	}
	logger := observability.FromContext(ctx)
	go s.enrichEmails(logger, targets)
	return len(targets), nil
}

// enrichEmails runs discovery for a batch of contacts and stores everything
// it finds. Concurrency is modest on purpose: the finder serializes its own
// search queries anyway, and hammering third-party sites from a personal
// tool is both rude and the fastest way to get blocked.
func (s *SourcingService) enrichEmails(logger *slog.Logger, targets []postgres.EnrichmentTarget) {
	s.enriching.Lock()
	defer s.enriching.Unlock()

	s.progressMu.Lock()
	s.progress = EnrichmentProgress{
		Running: true, Total: len(targets),
		StartedAt: time.Now().Format(time.RFC3339),
	}
	s.progressMu.Unlock()
	defer func() {
		s.progressMu.Lock()
		s.progress.Running = false
		s.progress.FinishedAt = time.Now().Format(time.RFC3339)
		s.progressMu.Unlock()
	}()

	// Generous: a paced search per lead plus a few page fetches adds up.
	timeout := time.Duration(len(targets))*20*time.Second + time.Minute
	if timeout > 30*time.Minute {
		timeout = 30 * time.Minute
	}
	bg, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	sem := make(chan struct{}, 3)
	var wg sync.WaitGroup
	var found, withEmail int
	var mu sync.Mutex

	for _, t := range targets {
		if bg.Err() != nil {
			break
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(t postgres.EnrichmentTarget) {
			defer wg.Done()
			defer func() { <-sem }()
			defer func() {
				s.progressMu.Lock()
				s.progress.Processed++
				s.progressMu.Unlock()
			}()

			results, cnpj := s.emails.FindWithCNPJ(bg, emailfinder.Query{
				CompanyName: t.CompanyName,
				City:        t.City,
				State:       t.State,
				Website:     t.Website,
				CNPJ:        t.CNPJ,
			})
			// Worth keeping even when no email came out of it: with a CNPJ
			// on file the official registry can be queried directly next
			// time, and it identifies the business beyond its trade name.
			if cnpj != "" && t.CNPJ == "" && t.CompanyID != uuid.Nil {
				if err := s.companies.SetCNPJIfEmpty(bg, t.CompanyID, cnpj); err != nil {
					logger.Error("failed to save discovered cnpj", "error", err)
				}
			}
			if len(results) == 0 {
				return
			}
			inputs := make([]postgres.EmailInput, len(results))
			for i, r := range results {
				inputs[i] = postgres.EmailInput{Email: r.Email, Source: r.Source}
			}
			added, err := s.contacts.AddEmails(bg, t.ContactPointID, inputs)
			if err != nil {
				logger.Error("failed to save discovered emails",
					"contact_point_id", t.ContactPointID, "error", err)
				return
			}
			mu.Lock()
			found += added
			withEmail++
			mu.Unlock()

			s.progressMu.Lock()
			s.progress.EmailsFound += added
			s.progress.WithEmail++
			s.progressMu.Unlock()
		}(t)
	}
	wg.Wait()

	logger.Info("email discovery finished", "action", "enrichment.emails.done",
		"leads_processed", len(targets), "leads_with_email", withEmail,
		"emails_found", found)
}
