package http

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/application"
	"github.com/geovanna/prospect/backend/internal/domain"
)

// searchLeads powers "Buscar leads": a segment + city goes out to the
// configured provider (Google Places, or the demo fallback when no API key is
// set) and comes back already annotated with what the database knows —
// already contacted, company already exists — before anyone selects a row.
func (a *API) searchLeads(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SegmentID string `json:"segment_id"`
		City      string `json:"city"`
		State     string `json:"state"`
		Limit     int    `json:"limit"`
		// Pointers so an older client that omits them keeps the previous
		// behaviour instead of silently turning every filter off.
		OnlyWithoutSite *bool `json:"only_without_site"`
		SkipExisting    *bool `json:"skip_existing"`
		RequireMobile   *bool `json:"require_mobile"`
		IncludeBlocked  *bool `json:"include_blocked"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if body.City == "" {
		writeError(w, r, domain.Validation("cidade é obrigatória"))
		return
	}

	segments, err := a.Segments.List(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}

	// An empty segment_id means "todos": the provider is queried once per
	// segment and the results are merged. Each segment is a separate,
	// billable provider call, which is why the usage counter (and the quota
	// warning on the screen) counts them individually.
	var wanted []domain.Segment
	if body.SegmentID == "" || body.SegmentID == "all" {
		for _, seg := range segments {
			if seg.IsActive {
				wanted = append(wanted, seg)
			}
		}
	} else {
		segmentID, err := uuid.Parse(body.SegmentID)
		if err != nil {
			writeError(w, r, domain.Validation("segment_id inválido"))
			return
		}
		for _, seg := range segments {
			if seg.ID == segmentID {
				wanted = append(wanted, seg)
			}
		}
	}
	if len(wanted) == 0 {
		writeError(w, r, domain.NotFound("segmento"))
		return
	}

	merged := application.SearchOutcome{}
	seen := map[string]bool{}
	for _, seg := range wanted {
		outcome, err := a.Sourcing.Search(r.Context(), seg.Slug, seg.Name, body.City, body.State, body.Limit)
		if err != nil {
			// One segment failing (a provider hiccup, an odd category) must
			// not throw away everything the others already found.
			a.Logger.Error("segment search failed", "segment", seg.Name, "error", err)
			continue
		}
		merged.Provider = outcome.Provider
		merged.IsDemo = outcome.IsDemo
		for _, c := range outcome.Results {
			// The same business can answer for two segments (a clinic that
			// is also a dentist); show it once.
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

			if c.Website != "" && boolOr(body.OnlyWithoutSite, true) {
				continue
			}
			if c.ExistingCompany && boolOr(body.SkipExisting, true) {
				continue
			}
			if !c.IsMobile && !c.Invalid && boolOr(body.RequireMobile, false) {
				continue
			}
			if c.IsBlocked && !boolOr(body.IncludeBlocked, false) {
				continue
			}

			merged.Results = append(merged.Results, c)
		}
	}

	segmentLabel := "Todos os segmentos"
	var segmentID *uuid.UUID
	if len(wanted) == 1 && body.SegmentID != "" && body.SegmentID != "all" {
		segmentLabel = wanted[0].Name
		id := wanted[0].ID
		segmentID = &id
	}
	if err := a.SearchRuns.Record(r.Context(), postgres.SearchRun{
		SegmentID: segmentID, SegmentLabel: segmentLabel,
		City: body.City, State: body.State, LeadsFound: len(merged.Results),
	}); err != nil {
		a.Logger.Error("failed to record search run", "error", err)
	}

	writeJSON(w, http.StatusOK, merged)
}

func boolOr(v *bool, fallback bool) bool {
	if v == nil {
		return fallback
	}
	return *v
}

// recentSearches powers the "Buscas recentes" list: one entry per
// segment+city pair, newest first, so a search can be repeated in one click.
func (a *API) recentSearches(w http.ResponseWriter, r *http.Request) {
	runs, err := a.SearchRuns.Recent(r.Context(), 5)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": runs})
}

// importSearchResults creates leads for exactly the candidates the user
// checked — never the whole result set — reusing the same dedupe and
// history-preserving path as CSV import.
func (a *API) importSearchResults(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SegmentID  string `json:"segment_id"`
		Provider   string `json:"provider"`
		Candidates []struct {
			CompanyName  string `json:"company_name"`
			Phone        string `json:"phone_display"`
			City         string `json:"city"`
			State        string `json:"state"`
			Website      string `json:"website"`
			Email        string `json:"email"`
			SegmentID    string `json:"segment_id"`
			OpeningHours string `json:"opening_hours"`
		} `json:"candidates"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if len(body.Candidates) == 0 {
		writeError(w, r, domain.Validation("selecione ao menos um resultado"))
		return
	}
	// The 10-per-action cap belongs to SENDING (never message more than a
	// small batch without another explicit click) — creating a lead sends
	// nothing and carries no duplicate-contact risk, so importing every
	// result from a search (including "todos os segmentos", which easily
	// exceeds 30) is fine. This upper bound only guards against a
	// malformed request, not normal usage.
	if len(body.Candidates) > 1000 {
		writeError(w, r, domain.Validation("no máximo 1000 leads por importação"))
		return
	}

	cmd := application.ImportSelectedCommand{Provider: body.Provider}
	if body.SegmentID != "" {
		if id, err := uuid.Parse(body.SegmentID); err == nil {
			cmd.SegmentID = &id
		}
	}
	for _, c := range body.Candidates {
		in := application.SearchCandidateInput{
			CompanyName: c.CompanyName, Phone: c.Phone, City: c.City, State: c.State,
			Website: c.Website, Email: c.Email, OpeningHours: c.OpeningHours,
		}
		// With "todos os segmentos" each result carries its own, which beats
		// the single segment picked for the whole import.
		if c.SegmentID != "" {
			if id, err := uuid.Parse(c.SegmentID); err == nil {
				in.SegmentID = &id
			}
		}
		cmd.Candidates = append(cmd.Candidates, in)
	}

	result, err := a.Sourcing.ImportSelected(r.Context(), cmd)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

// searchUsage reports this month's call count for the active provider, so the
// UI can warn before an accidental spike turns into a bill.
func (a *API) searchUsage(w http.ResponseWriter, r *http.Request) {
	status, err := a.Sourcing.Usage(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

// searchState kicks off a background search across every city it's given —
// "buscar em todo o estado" — paced so it doesn't blow through the provider
// quota or hold the request open for what can be a very long run. The city
// list comes from the client (already fetching IBGE's municipality list for
// the picker) rather than the backend re-fetching it.
func (a *API) searchState(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SegmentID string   `json:"segment_id"`
		State     string   `json:"state"`
		Cities    []string `json:"cities"`
		Limit     int      `json:"limit"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	queued, err := a.Sourcing.SearchState(r.Context(), body.State, body.Cities, body.SegmentID, body.Limit)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"queued": queued})
}

// searchStateProgress is polled while a state-wide search runs so the screen
// can show which city it's on instead of an unchanging spinner.
func (a *API) searchStateProgress(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, a.Sourcing.StateSearchStatus())
}

// cancelSearchState stops the run after its current provider call returns.
func (a *API) cancelSearchState(w http.ResponseWriter, r *http.Request) {
	if err := a.Sourcing.CancelStateSearch(); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelling"})
}
