package http

import (
	"net/http"

	"github.com/google/uuid"

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
			merged.Results = append(merged.Results, c)
		}
	}

	writeJSON(w, http.StatusOK, merged)
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
