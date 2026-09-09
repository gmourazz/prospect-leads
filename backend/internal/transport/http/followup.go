package http

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/domain"
)

// listAwaitingReply is the middle-of-funnel screen: emailed, silent, and
// ready for the hand-sent WhatsApp follow-up.
func (a *API) listAwaitingReply(w http.ResponseWriter, r *http.Request) {
	minDays, _ := strconv.Atoi(r.URL.Query().Get("min_days"))
	if minDays <= 0 {
		minDays = 3
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	items, err := a.Outreach.ListAwaitingReply(r.Context(), minDays, limit)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (a *API) prepareFollowup(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		TemplateVersionID string `json:"template_version_id"`
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

	prep, err := a.Outreach.PrepareFollowup(r.Context(), id, versionID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, prep)
}

func (a *API) confirmFollowup(w http.ResponseWriter, r *http.Request) {
	dispatchID, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		TemplateVersionID string `json:"template_version_id"`
		RenderedBody      string `json:"rendered_body"`
		CompanyName       string `json:"company_name"`
		TemplateName      string `json:"template_name"`
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
	if err := a.Outreach.ConfirmFollowup(r.Context(), dispatchID, versionID,
		body.RenderedBody, body.CompanyName, body.TemplateName); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "confirmed"})
}

func (a *API) cancelFollowup(w http.ResponseWriter, r *http.Request) {
	dispatchID, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.Outreach.CancelFollowup(r.Context(), dispatchID); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "canceled"})
}

// markReplied takes a business out of the follow-up list for good: it
// answered, so no second touch should ever go out.
func (a *API) markReplied(w http.ResponseWriter, r *http.Request) {
	id, err := uuidParam(r, "id")
	if err != nil {
		writeError(w, r, err)
		return
	}
	var body struct {
		Note string `json:"note"`
	}
	_ = decode(r, &body)

	if err := a.Contacts.MarkReplied(r.Context(), id, body.Note, UserFromContext(r.Context())); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "replied"})
}
