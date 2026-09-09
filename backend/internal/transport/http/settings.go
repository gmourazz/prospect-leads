package http

import (
	"net/http"

	"github.com/geovanna/prospect/backend/internal/domain"
)

// Settings exposes the sender configuration the frontend needs: which
// address messages go out from, and the signature appended to every one of
// them.
func (a *API) getSettings(w http.ResponseWriter, r *http.Request) {
	signature, err := a.Settings.EmailSignature(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"sender_email":    a.SenderEmail,
		"email_signature": signature,
	})
}

func (a *API) updateSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		EmailSignature *string `json:"email_signature"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if body.EmailSignature == nil {
		writeError(w, r, domain.Validation("email_signature é obrigatório"))
		return
	}
	if err := a.Settings.SetEmailSignature(r.Context(), *body.EmailSignature); err != nil {
		writeError(w, r, err)
		return
	}
	a.getSettings(w, r)
}
