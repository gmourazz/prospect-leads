package http

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/application"
	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/outreach"
)

type API struct {
	Leads       *postgres.LeadRepo
	Contacts    *postgres.ContactRepo
	Segments    *postgres.SegmentRepo
	Templates   *postgres.TemplateRepo
	Analytics   *postgres.AnalyticsRepo
	Outreach    *application.OutreachService
	WhatsApp    *application.WhatsAppAgentService
	LeadService *application.LeadService
	Sourcing    *application.SourcingService
	Imports     *application.ImportService
	Companies   *postgres.CompanyRepo
	Users       *postgres.UserRepo
	Attachments *postgres.AttachmentRepo
	SearchRuns  *postgres.SearchRunRepo
	Settings    *postgres.SettingsRepo
	Logger      *slog.Logger
	CORS        string
	SenderEmail string
	JWTSecret   string
	UploadsDir  string
}

func (a *API) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(RequestID, Recover, Logging(a.Logger), CORS(a.CORS))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Uploaded template images, served publicly (no auth) for convenience —
	// the email gateway reads attachments straight from disk instead.
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(a.UploadsDir))))

	r.Route("/api/v1", func(r chi.Router) {
		// Login is the only route that does not require an existing session.
		r.Post("/auth/login", a.login)

		r.Group(func(r chi.Router) {
			r.Use(RequireAuth([]byte(a.JWTSecret)))
			r.Get("/auth/me", a.me)

			a.mountProtectedRoutes(r)
		})
	})

	return r
}

func (a *API) mountProtectedRoutes(r chi.Router) {
	r.Route("/segments", func(r chi.Router) {
		r.Get("/", a.listSegments)
		r.Post("/", a.createSegment)
		r.Patch("/{id}", a.updateSegment)
	})

	r.Route("/leads", func(r chi.Router) {
		r.Get("/", a.listLeads)
		r.Post("/", a.createLead)
		r.Get("/cities", a.listCities)
		r.Post("/selection", a.resolveSelection)
		r.Get("/{id}", a.getLead)
		r.Patch("/{id}", a.updateLead)
		r.Delete("/{id}", a.deleteLead)
		// Second step of the funnel: hand-sent WhatsApp for leads that got
		// the email and never answered.
		r.Post("/{id}/followup", a.prepareFollowup)
	})

	r.Get("/awaiting-reply", a.listAwaitingReply)

	r.Route("/followups", func(r chi.Router) {
		r.Post("/{id}/confirm", a.confirmFollowup)
		r.Post("/{id}/cancel", a.cancelFollowup)
	})

	r.Route("/contact-points", func(r chi.Router) {
		r.Post("/lookup", a.lookupPhone)
		r.Get("/{id}", a.getContact)
		r.Patch("/{id}", a.updateContactEmail)
		r.Get("/{id}/events", a.contactEvents)
		r.Post("/{id}/suppressions", a.suppressContact)
		r.Delete("/{id}/suppressions", a.unsuppressContact)
		r.Post("/{id}/interest", a.markInterested)
		r.Delete("/{id}/interest", a.unmarkInterested)
		r.Post("/{id}/recontact-approvals", a.approveRecontact)
		r.Post("/{id}/replied", a.markReplied)
	})

	r.Get("/suppressions", a.listSuppressions)
	r.Post("/suppressions", a.blockPhone)

	r.Get("/interested", a.listInterested)

	r.Route("/templates", func(r chi.Router) {
		r.Get("/", a.listTemplates)
		r.Post("/", a.createTemplate)
		r.Get("/variables", a.templateVariables)
		r.Post("/attachments", a.uploadAttachment)
		r.Get("/{id}", a.getTemplate)
		r.Post("/{id}/versions", a.newTemplateVersion)
		r.Delete("/{id}", a.deleteTemplate)
	})

	r.Route("/campaigns", func(r chi.Router) {
		r.Get("/", a.listCampaigns)
		r.Post("/", a.createCampaign)
		r.Get("/{id}", a.getCampaign)
		r.Get("/{id}/targets", a.listTargets)
		r.Get("/{id}/batches", a.listBatches)
		r.Post("/{id}/batches", a.sendBatch)
		r.Post("/{id}/preview", a.previewMessage)
		r.Patch("/{id}/status", a.setCampaignStatus)
		r.Delete("/{id}", a.deleteCampaign)
	})

	// Automated WhatsApp: the browser fills and watches the queue, the local
	// Baileys bridge drains it one message at a time under /agent.
	r.Route("/whatsapp", func(r chi.Router) {
		r.Get("/queue", a.whatsAppStatus)
		r.Post("/queue", a.enqueueWhatsApp)
		r.Delete("/queue", a.clearWhatsAppQueue)
		r.Post("/queue/pause", a.pauseWhatsApp)
		r.Post("/queue/resume", a.resumeWhatsApp)

		r.Post("/agent/claim", a.claimWhatsApp)
		r.Post("/agent/result", a.reportWhatsApp)
		r.Post("/agent/connection", a.reportWhatsAppConnection)
	})

	r.Route("/imports", func(r chi.Router) {
		r.Get("/", a.listImports)
		r.Post("/", a.analyzeImport)
		r.Get("/{id}", a.getImport)
		r.Post("/{id}/commit", a.commitImport)
	})

	r.Get("/analytics/overview", a.analyticsOverview)

	r.Get("/settings", a.getSettings)
	r.Put("/settings", a.updateSettings)

	// Kicks off background email discovery for leads that still have none.
	r.Post("/leads/enrich-emails", a.enrichEmails)
	r.Get("/leads/enrich-emails/progress", a.enrichEmailsProgress)

	r.Post("/searches", a.searchLeads)
	r.Get("/searches/recent", a.recentSearches)
	r.Post("/searches/import", a.importSearchResults)
	r.Get("/searches/usage", a.searchUsage)
	r.Get("/searches/quota", a.searchQuota)
	r.Post("/searches/state", a.searchState)
	r.Get("/searches/state/progress", a.searchStateProgress)
	r.Post("/searches/state/cancel", a.cancelSearchState)
}

// ------------------------------------------------------------- segments

func (a *API) listSegments(w http.ResponseWriter, r *http.Request) {
	segments, err := a.Segments.List(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": segments})
}

func (a *API) createSegment(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Slug  string `json:"slug"`
		Name  string `json:"name"`
		Color string `json:"color"`
		Icon  string `json:"icon"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if body.Name == "" {
		writeError(w, r, domain.Validation("nome é obrigatório"))
		return
	}
	if body.Slug == "" {
		body.Slug = slugify(body.Name)
	}
	if body.Color == "" {
		body.Color = "slate"
	}
	if body.Icon == "" {
		body.Icon = "Tag"
	}
	segment, err := a.Segments.Create(r.Context(), body.Slug, body.Name, body.Color, body.Icon)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, segment)
}

func (a *API) updateSegment(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		Name     string `json:"name"`
		Color    string `json:"color"`
		Icon     string `json:"icon"`
		IsActive *bool  `json:"is_active"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Segments.Update(r.Context(), id, body.Name, body.Color, body.Icon, body.IsActive); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ---------------------------------------------------------------- leads

func parseFilters(r *http.Request) domain.LeadFilters {
	q := r.URL.Query()
	f := domain.LeadFilters{
		City:          q.Get("city"),
		State:         q.Get("state"),
		Status:        q.Get("status"),
		WebsiteStatus: q.Get("website_status"),
		ContactState:  q.Get("contact_state"),
		Search:        strings.TrimSpace(q.Get("q")),
		Sort:          q.Get("sort"),
	}
	if v := q.Get("segment_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			f.SegmentID = &id
		}
	}
	if v := q.Get("open_now"); v == "true" || v == "false" {
		open := v == "true"
		f.OpenNow = &open
	}
	if v := q.Get("has_email"); v == "true" || v == "false" {
		has := v == "true"
		f.HasEmail = &has
	}
	if v := q.Get("collected_from"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			f.CollectedFrom = &t
		}
	}
	if v := q.Get("collected_to"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			end := t.Add(24 * time.Hour)
			f.CollectedTo = &end
		}
	}
	f.Limit, _ = strconv.Atoi(q.Get("limit"))
	if f.Limit == 0 {
		f.Limit = 50
	}
	page, _ := strconv.Atoi(q.Get("page"))
	if page > 1 {
		f.Offset = (page - 1) * f.Limit
	}
	return f
}

// parseDateRangeParams reads "from"/"to" (YYYY-MM-DD) from the query string
// into the [from, to) range a timestamp column filter expects — "to" is
// bumped a day forward so the day the user picked is included whole.
func parseDateRangeParams(q url.Values) (from, to *time.Time) {
	if v := q.Get("from"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			from = &t
		}
	}
	if v := q.Get("to"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			end := t.Add(24 * time.Hour)
			to = &end
		}
	}
	return from, to
}

func (a *API) listLeads(w http.ResponseWriter, r *http.Request) {
	f := parseFilters(r)
	leads, err := a.Leads.List(r.Context(), f)
	if err != nil {
		writeError(w, r, err)
		return
	}
	counts, err := a.Leads.Counts(r.Context(), f)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"data": leads,
		"meta": map[string]any{"counts": counts, "limit": f.Limit, "offset": f.Offset},
	})
}

func (a *API) getLead(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	lead, err := a.Leads.Get(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, lead)
}

func (a *API) updateLead(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		Status string  `json:"status"`
		Notes  *string `json:"notes"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Leads.UpdateStatus(r.Context(), id, body.Status, body.Notes); err != nil {
		writeError(w, r, err)
		return
	}
	lead, err := a.Leads.Get(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, lead)
}

// deleteLead removes the lead from the board. The contact and every event ever
// recorded for it survive — that is the entire point of the data model.
func (a *API) deleteLead(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Leads.SoftDelete(r.Context(), id); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (a *API) listCities(w http.ResponseWriter, r *http.Request) {
	cities, err := a.Leads.Cities(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": cities})
}

// resolveSelection answers "select all available" server-side. Page 1 of 50
// cannot know which of the 80 eligible rows exist, so the client sends filters
// and gets back ids.
func (a *API) resolveSelection(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Filters       map[string]string `json:"filters"`
		OnlyAvailable bool              `json:"only_available"`
		Limit         int               `json:"limit"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}

	q := r.URL.Query()
	for k, v := range body.Filters {
		if v != "" {
			q.Set(k, v)
		}
	}
	r.URL.RawQuery = q.Encode()
	f := parseFilters(r)

	targets, err := a.Leads.SelectableContacts(r.Context(), f, body.OnlyAvailable, body.Limit)
	if err != nil {
		writeError(w, r, err)
		return
	}
	leadIDs := make([]uuid.UUID, len(targets))
	for i, t := range targets {
		leadIDs[i] = t.LeadID
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"lead_ids": leadIDs,
		"count":    len(targets),
	})
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '_':
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}

func decode(r *http.Request, target any) error {
	if r.Body == nil {
		return nil
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, 5<<20))
	if err != nil {
		return domain.Wrap(domain.CodeValidation, "corpo inválido", err)
	}
	if len(data) == 0 {
		return nil
	}
	if err := json.Unmarshal(data, target); err != nil {
		return domain.Wrap(domain.CodeValidation, "JSON inválido", err)
	}
	return nil
}

func uuidParam(r *http.Request, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		return uuid.Nil, domain.Validation("identificador inválido")
	}
	return id, nil
}

var _ = outreach.KnownVariables
