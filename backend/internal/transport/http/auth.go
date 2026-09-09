package http

import (
	"net/http"

	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/identity"
)

func unauthorized(msg string) *domain.Error {
	return domain.New(domain.CodeUnauthorized, msg)
}

// login is the only route besides /health that skips RequireAuth. It checks
// the bcrypt hash and, on success, issues a signed session token — nothing is
// stored server-side, so there is no session table to keep in sync.
func (a *API) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}
	if body.Email == "" || body.Password == "" {
		writeError(w, r, domain.Validation("email e senha são obrigatórios"))
		return
	}

	user, err := a.Users.FindByEmail(r.Context(), body.Email)
	if err != nil {
		writeError(w, r, err)
		return
	}
	// Same error for "no such user" and "wrong password": an attacker
	// probing for valid emails learns nothing either way.
	if user == nil || user.PasswordHash == "" || !identity.CheckPassword(user.PasswordHash, body.Password) {
		writeError(w, r, unauthorized("email ou senha incorretos"))
		return
	}

	token, err := identity.IssueToken([]byte(a.JWTSecret), user.ID, user.Email)
	if err != nil {
		writeError(w, r, domain.Wrap(domain.CodeInternal, "não foi possível iniciar a sessão", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"token": token,
		"user":  map[string]any{"id": user.ID, "email": user.Email, "name": user.Name},
	})
}

// me lets the SPA restore a session after a page refresh without re-sending
// the password: the Bearer token alone proves identity.
func (a *API) me(w http.ResponseWriter, r *http.Request) {
	userID := UserFromContext(r.Context())
	user, err := a.Users.FindByID(r.Context(), userID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if user == nil {
		writeError(w, r, unauthorized("usuário não encontrado"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": user.ID, "email": user.Email, "name": user.Name})
}
