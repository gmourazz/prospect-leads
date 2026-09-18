package http

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/application"
	"github.com/geovanna/prospect/backend/internal/domain"
)

// Two audiences share these routes and the same session auth: the browser
// (queue up leads, watch progress, pull the kill switch) and the local
// Baileys bridge (ask for work, report back). The bridge logs in with the
// owner's own credentials because it IS the owner's own machine — inventing a
// second credential type would add a secret to leak without adding a boundary
// that means anything here.

// ------------------------------------------------------------------- fila

func (a *API) enqueueWhatsApp(w http.ResponseWriter, r *http.Request) {
	var body struct {
		LeadIDs           []string `json:"lead_ids"`
		TemplateVersionID string   `json:"template_version_id"`
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
	leadIDs := make([]uuid.UUID, 0, len(body.LeadIDs))
	for _, raw := range body.LeadIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, r, domain.Validation("lead_ids contém um identificador inválido"))
			return
		}
		leadIDs = append(leadIDs, id)
	}

	result, err := a.WhatsApp.Enqueue(r.Context(), leadIDs, versionID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (a *API) whatsAppStatus(w http.ResponseWriter, r *http.Request) {
	from, to := parseDateRangeParams(r.URL.Query())
	status, err := a.WhatsApp.Status(r.Context(), from, to)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (a *API) pauseWhatsApp(w http.ResponseWriter, r *http.Request) {
	if err := a.WhatsApp.SetPaused(r.Context(), true, "pausada manualmente"); err != nil {
		writeError(w, r, err)
		return
	}
	a.whatsAppStatus(w, r)
}

func (a *API) resumeWhatsApp(w http.ResponseWriter, r *http.Request) {
	if err := a.WhatsApp.SetPaused(r.Context(), false, ""); err != nil {
		writeError(w, r, err)
		return
	}
	a.whatsAppStatus(w, r)
}

func (a *API) clearWhatsAppQueue(w http.ResponseWriter, r *http.Request) {
	canceled, err := a.WhatsApp.ClearQueue(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"canceled": canceled})
}

// ----------------------------------------------------------------- bridge

// claimWhatsApp is the bridge's only way to get work. It answers with at most
// one message, or with how long to wait — never with a list.
func (a *API) claimWhatsApp(w http.ResponseWriter, r *http.Request) {
	outcome, err := a.WhatsApp.Claim(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, outcome)
}

func (a *API) reportWhatsApp(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DispatchID        string `json:"dispatch_id"`
		Delivered         bool   `json:"delivered"`
		RenderedBody      string `json:"rendered_body"`
		ProviderMessageID string `json:"provider_message_id"`
		ErrorCode         string `json:"error_code"`
		ErrorMessage      string `json:"error_message"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	dispatchID, err := uuid.Parse(body.DispatchID)
	if err != nil {
		writeError(w, r, domain.Validation("dispatch_id inválido"))
		return
	}

	if err := a.WhatsApp.ReportResult(r.Context(), application.ReportResultCommand{
		DispatchID:        dispatchID,
		Delivered:         body.Delivered,
		RenderedBody:      body.RenderedBody,
		ProviderMessageID: body.ProviderMessageID,
		ErrorCode:         body.ErrorCode,
		ErrorMessage:      body.ErrorMessage,
	}); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// reportWhatsAppConnection doubles as the bridge's heartbeat and as the
// automatic kill switch: reporting 'logged_out' or 'blocked' pauses the queue
// without anyone having to be watching.
func (a *API) reportWhatsAppConnection(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Connection string `json:"connection"`
		Error      string `json:"error"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if err := a.WhatsApp.SetConnection(r.Context(), body.Connection, body.Error); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
