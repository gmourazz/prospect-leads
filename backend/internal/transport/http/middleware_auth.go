package http

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/domain/identity"
)

type authUserKey struct{}

// UserFromContext returns the authenticated user's id, or uuid.Nil if the
// request reached the handler without passing through RequireAuth (only
// /health and /auth/login do).
func UserFromContext(ctx context.Context) uuid.UUID {
	if id, ok := ctx.Value(authUserKey{}).(uuid.UUID); ok {
		return id
	}
	return uuid.Nil
}

// RequireAuth validates the Bearer session token on every protected route.
// There is no cookie fallback: the SPA and API run on different origins in
// dev, so the token travels in the Authorization header on every fetch.
func RequireAuth(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			token := strings.TrimPrefix(header, "Bearer ")
			if token == "" || token == header {
				writeError(w, r, unauthorized("sessão ausente"))
				return
			}

			claims, err := identity.ParseToken(secret, token)
			if err != nil {
				writeError(w, r, unauthorized("sessão inválida ou expirada"))
				return
			}

			ctx := context.WithValue(r.Context(), authUserKey{}, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
