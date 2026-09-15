package http

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/application"
	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/contact"
	"github.com/geovanna/prospect/backend/internal/domain/outreach"
)

func (a *API) createLead(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CompanyName string  `json:"company_name"`
		Phone       string  `json:"phone"`
		Email       string  `json:"email"`
		City        string  `json:"city"`
		State       string  `json:"state"`
		CNPJ        string  `json:"cnpj"`
		SegmentID   *string `json:"segment_id"`
		Website     string  `json:"website"`
		Instagram   string  `json:"instagram"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	cmd := application.CreateLeadCommand{
		CompanyName: body.CompanyName,
		Phone:       body.Phone,
		Email:       body.Email,
		City:        body.City,
		State:       body.State,
		CNPJ:        body.CNPJ,
		Website:     body.Website,
		Instagram:   body.Instagram,
	}
	if body.SegmentID != nil && *body.SegmentID != "" {
		if id, err := uuid.Parse(*body.SegmentID); err == nil {
			cmd.SegmentID = &id
		}
	}
	lead, err := a.LeadService.CreateManual(r.Context(), cmd)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, lead)
}

// ------------------------------------------------------------- contacts

func (a *API) getContact(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	cp, err := a.Contacts.Get(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	state, err := a.Contacts.State(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contact_point": cp, "state": state})
}

// updateContactEmail lets the user fix or add an email by hand — the
// best-effort website scrape at import time doesn't always find one.
func (a *API) updateContactEmail(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		Email string `json:"email"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Contacts.SetEmail(r.Context(), id, body.Email); err != nil {
		writeError(w, r, err)
		return
	}
	cp, err := a.Contacts.Get(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, cp)
}

// deleteCampaign removes the campaign only. Every message it already sent
// stays in the contact history: "já contatei essa empresa" must outlive the
// campaign that did it, exactly like it outlives a deleted lead.
func (a *API) deleteCampaign(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Outreach.DeleteCampaign(r.Context(), id); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (a *API) setCampaignStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Outreach.SetCampaignStatus(r.Context(), id, body.Status); err != nil {
		writeError(w, r, err)
		return
	}
	campaign, err := a.Outreach.GetCampaign(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, campaign)
}

// enrichEmails looks for public email addresses for every lead that still
// has none. It returns as soon as the work is queued: discovery paces its
// own search queries, so a few hundred leads take minutes.
func (a *API) enrichEmails(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Limit int `json:"limit"`
	}
	_ = decode(r, &body)

	queued, err := a.Sourcing.EnrichMissingEmails(r.Context(), body.Limit)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"queued": queued})
}

// enrichEmailsProgress is polled while discovery runs so the screen can show
// how far it got instead of an unchanging list.
func (a *API) enrichEmailsProgress(w http.ResponseWriter, r *http.Request) {
	status, err := a.Sourcing.EnrichmentStatus(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (a *API) contactEvents(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	events, err := a.Contacts.Events(r.Context(), id, limit)
	if err != nil {
		writeError(w, r, err)
		return
	}
	state, err := a.Contacts.State(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contact": state, "events": events})
}

func (a *API) suppressContact(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		Reason string `json:"reason"`
		Note   string `json:"note"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if body.Reason == "" {
		body.Reason = "user_request"
	}
	if err := a.Contacts.Suppress(r.Context(), id, body.Reason, body.Note, UserFromContext(r.Context())); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "suppressed"})
}

// blockPhone lets a number be suppressed before it has ever been imported —
// resolving or creating its contact_point first, since suppressions are
// keyed on that immortal entity, never on a raw phone string.
func (a *API) blockPhone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone  string `json:"phone"`
		Reason string `json:"reason"`
		Note   string `json:"note"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	n, err := contact.Parse(body.Phone, "BR")
	if err != nil {
		writeError(w, r, domain.New(domain.CodeInvalidPhone, "telefone inválido: "+body.Phone))
		return
	}
	id, _, err := a.Contacts.Upsert(r.Context(), n)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if body.Reason == "" {
		body.Reason = "user_request"
	}
	if err := a.Contacts.Suppress(r.Context(), id, body.Reason, body.Note, UserFromContext(r.Context())); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "suppressed"})
}

func (a *API) unsuppressContact(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	_ = decode(r, &body)
	if err := a.Contacts.Unsuppress(r.Context(), id, body.Reason, UserFromContext(r.Context())); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "released"})
}

func (a *API) listSuppressions(w http.ResponseWriter, r *http.Request) {
	items, err := a.Contacts.ListSuppressions(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (a *API) markInterested(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		Note string `json:"note"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Contacts.MarkInterested(r.Context(), id, body.Note, UserFromContext(r.Context())); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "interested"})
}

func (a *API) unmarkInterested(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Contacts.UnmarkInterested(r.Context(), id, UserFromContext(r.Context())); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "released"})
}

func (a *API) listInterested(w http.ResponseWriter, r *http.Request) {
	items, err := a.Contacts.ListInterested(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (a *API) lookupPhone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone string `json:"phone"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	out, err := a.LeadService.LookupPhone(r.Context(), body.Phone)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// approveRecontact creates the single-use authorization the database CHECK
// constraint demands before any attempt_seq > 1 can exist.
func (a *API) approveRecontact(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	_ = decode(r, &body)

	approvalID, err := a.Outreach.ApproveRecontact(r.Context(), id, body.Reason, UserFromContext(r.Context()))
	if err != nil {
		writeError(w, r, err)
		return
	}
	events, err := a.Contacts.Events(r.Context(), id, 10)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"approval_id":       approvalID,
		"previous_contacts": events,
	})
}

// ------------------------------------------------------------ templates

func (a *API) listTemplates(w http.ResponseWriter, r *http.Request) {
	items, err := a.Templates.List(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (a *API) getTemplate(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	t, err := a.Templates.Get(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (a *API) templateVariables(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"data": outreach.KnownVariables})
}

type templateBody struct {
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	SegmentID     *string  `json:"segment_id"`
	Audience      string   `json:"audience"`
	Channel       string   `json:"channel"`
	Purpose       string   `json:"purpose"`
	Subject       string   `json:"subject"`
	Body          string   `json:"body"`
	AttachmentIDs []string `json:"attachment_ids"`
}

func (b templateBody) toInput() (postgres.TemplateInput, error) {
	in := postgres.TemplateInput{
		Name:        b.Name,
		Description: b.Description,
		Audience:    b.Audience,
		Channel:     b.Channel,
		Purpose:     b.Purpose,
		Subject:     b.Subject,
		Body:        b.Body,
		Variables:   outreach.ExtractVariables(b.Body),
	}
	if b.SegmentID != nil && *b.SegmentID != "" {
		if id, err := uuid.Parse(*b.SegmentID); err == nil {
			in.SegmentID = &id
		}
	}
	if len(b.AttachmentIDs) > 5 {
		return in, domain.Validation("um template pode ter no máximo 5 imagens")
	}
	for _, raw := range b.AttachmentIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			return in, domain.Validation("attachment_id inválido: " + raw)
		}
		in.AttachmentIDs = append(in.AttachmentIDs, id)
	}
	return in, nil
}

func (a *API) createTemplate(w http.ResponseWriter, r *http.Request) {
	var body templateBody
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if body.Name == "" || body.Body == "" {
		writeError(w, r, domain.Validation("nome e mensagem são obrigatórios"))
		return
	}
	input, err := body.toInput()
	if err != nil {
		writeError(w, r, err)
		return
	}
	id, err := a.Templates.Create(r.Context(), input, UserFromContext(r.Context()))
	if err != nil {
		writeError(w, r, err)
		return
	}
	t, err := a.Templates.Get(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

// newTemplateVersion never rewrites history: the previous version stays exactly
// as it was sent.
func (a *API) newTemplateVersion(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body templateBody
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if body.Body == "" {
		writeError(w, r, domain.Validation("mensagem é obrigatória"))
		return
	}
	input, err := body.toInput()
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Templates.NewVersion(r.Context(), id, input, UserFromContext(r.Context())); err != nil {
		writeError(w, r, err)
		return
	}
	t, err := a.Templates.Get(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (a *API) deleteTemplate(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Templates.SoftDelete(r.Context(), id); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ------------------------------------------------------------ campaigns

func (a *API) listCampaigns(w http.ResponseWriter, r *http.Request) {
	items, err := a.Outreach.ListCampaigns(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (a *API) getCampaign(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	c, err := a.Outreach.GetCampaign(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *API) createCampaign(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name              string            `json:"name"`
		TemplateVersionID string            `json:"template_version_id"`
		BatchSize         int               `json:"batch_size"`
		Filters           map[string]string `json:"filters"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	versionID, err := uuid.Parse(body.TemplateVersionID)
	if err != nil {
		writeError(w, r, domain.Validation("template_version_id inválido"))
		return
	}

	q := r.URL.Query()
	for k, v := range body.Filters {
		if v != "" {
			q.Set(k, v)
		}
	}
	r.URL.RawQuery = q.Encode()
	filters := parseFilters(r)
	filters.Limit = 5000

	raw := map[string]any{}
	for k, v := range body.Filters {
		raw[k] = v
	}

	campaign, err := a.Outreach.CreateCampaign(r.Context(), application.CreateCampaignCommand{
		Name:              body.Name,
		TemplateVersionID: versionID,
		Filters:           filters,
		FiltersRaw:        raw,
		BatchSize:         body.BatchSize,
		UserID:            UserFromContext(r.Context()),
	})
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, campaign)
}

func (a *API) listTargets(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	targets, err := a.Outreach.ListTargets(r.Context(), id, r.URL.Query().Get("state"), limit)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": targets})
}

func (a *API) listBatches(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	batches, err := a.Outreach.ListBatches(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": batches})
}

// sendBatch processes at most `size` messages and stops. Requires an
// Idempotency-Key so a refresh or retry cannot produce a second send.
func (a *API) sendBatch(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	key := r.Header.Get("Idempotency-Key")
	if key == "" {
		writeError(w, r, domain.Validation("cabeçalho Idempotency-Key é obrigatório"))
		return
	}

	var body struct {
		Size        int      `json:"size"`
		Mode        string   `json:"mode"`
		ApprovalIDs []string `json:"approval_ids"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}

	payload, _ := json.Marshal(body)
	cmd := application.SendBatchCommand{
		CampaignID:     id,
		Size:           body.Size,
		IdempotencyKey: key,
		RequestHash:    postgres.HashRequest(payload),
		Endpoint:       "POST /campaigns/:id/batches",
		Recontact:      body.Mode == "recontact",
		UserID:         UserFromContext(r.Context()),
	}
	for _, raw := range body.ApprovalIDs {
		if approvalID, err := uuid.Parse(raw); err == nil {
			cmd.ApprovalIDs = append(cmd.ApprovalIDs, approvalID)
		}
	}

	outcome, err := a.Outreach.SendBatch(r.Context(), cmd)
	if err != nil {
		writeError(w, r, err)
		return
	}

	status := http.StatusOK
	if outcome.Batch.FailedCount > 0 && outcome.Batch.SentCount > 0 {
		status = http.StatusMultiStatus
	}
	writeJSON(w, status, outcome)
}

func (a *API) previewMessage(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		TargetID string `json:"target_id"`
	}
	_ = decode(r, &body)

	targetID := uuid.Nil
	if body.TargetID != "" {
		if parsed, err := uuid.Parse(body.TargetID); err == nil {
			targetID = parsed
		}
	}
	out, err := a.Outreach.PreviewMessage(r.Context(), id, targetID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// -------------------------------------------------------------- imports

func (a *API) analyzeImport(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, r, domain.Wrap(domain.CodeValidation, "upload inválido", err))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, r, domain.Validation("arquivo CSV é obrigatório"))
		return
	}
	defer file.Close()

	cmd := application.AnalyzeCommand{
		Filename: header.Filename,
		Reader:   file,
		UserID:   UserFromContext(r.Context()),
	}
	if v := r.FormValue("segment_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			cmd.SegmentID = &id
		}
	}
	if v := r.FormValue("mapping"); v != "" {
		var mapping map[string]string
		if err := json.Unmarshal([]byte(v), &mapping); err == nil {
			cmd.Mapping = mapping
		}
	}

	preview, err := a.Imports.Analyze(r.Context(), cmd)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, preview)
}

func (a *API) commitImport(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	key := r.Header.Get("Idempotency-Key")
	if key == "" {
		writeError(w, r, domain.Validation("cabeçalho Idempotency-Key é obrigatório"))
		return
	}
	out, err := a.Imports.Commit(r.Context(), application.CommitCommand{
		JobID:          id,
		IdempotencyKey: key,
		RequestHash:    postgres.HashRequest([]byte(id.String())),
		Endpoint:       "POST /imports/:id/commit",
		UserID:         UserFromContext(r.Context()),
	})
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *API) listImports(w http.ResponseWriter, r *http.Request) {
	items, err := a.Imports.ListJobs(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (a *API) getImport(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	preview, err := a.Imports.GetPreview(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, preview)
}

// ------------------------------------------------------------ analytics

func (a *API) analyticsOverview(w http.ResponseWriter, r *http.Request) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 180 {
		days = 30
	}
	metrics, err := a.Analytics.Overview(r.Context(), days)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, metrics)
}

// setWhatsAppTemplate links a template version to a Meta-approved WhatsApp
// message template — required before the real WhatsApp gateway can send
// anything for it.
