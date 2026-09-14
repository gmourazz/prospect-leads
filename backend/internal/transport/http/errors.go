package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/observability"
)

// Problem follows RFC 9457. `code` is what the frontend switches on; `detail`
// is what the user reads in the toast.
type Problem struct {
	Type      string         `json:"type"`
	Title     string         `json:"title"`
	Status    int            `json:"status"`
	Code      string         `json:"code"`
	Detail    string         `json:"detail"`
	Instance  string         `json:"instance,omitempty"`
	RequestID string         `json:"request_id,omitempty"`
	Meta      map[string]any `json:"meta,omitempty"`
}

// statusFor is the single place where a domain code becomes an HTTP status.
func statusFor(code domain.Code) (int, string) {
	switch code {
	case domain.CodeValidation:
		return http.StatusUnprocessableEntity, "Dados inválidos"
	case domain.CodeNotFound:
		return http.StatusNotFound, "Não encontrado"
	case domain.CodeAlreadyContacted:
		return http.StatusConflict, "Contato já recebeu mensagem"
	case domain.CodeContactSuppressed:
		return http.StatusConflict, "Contato bloqueado"
	case domain.CodeInvalidPhone:
		return http.StatusUnprocessableEntity, "Telefone inválido"
	case domain.CodeRecontactRequired:
		return http.StatusConflict, "Recontato exige confirmação"
	case domain.CodeBatchInProgress:
		return http.StatusConflict, "Envio em andamento"
	case domain.CodeIdempotencyReuse:
		return http.StatusUnprocessableEntity, "Requisição inconsistente"
	case domain.CodeNoEligibleTargets:
		return http.StatusUnprocessableEntity, "Nenhum contato disponível"
	case domain.CodeProviderUnavailable:
		return http.StatusBadGateway, "Serviço de envio indisponível"
	case domain.CodeConflict:
		return http.StatusConflict, "Conflito"
	case domain.CodeSendWindowClosed:
		return http.StatusUnprocessableEntity, "Fora da janela de envio"
	case domain.CodeUnauthorized:
		return http.StatusUnauthorized, "Não autenticado"
	default:
		return http.StatusInternalServerError, "Erro interno"
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
}

func writeError(w http.ResponseWriter, r *http.Request, err error) {
	requestID := RequestIDFrom(r.Context())

	var domErr *domain.Error
	if !errors.As(err, &domErr) {
		domErr = domain.Wrap(domain.CodeInternal, "erro inesperado", err)
	}

	status, title := statusFor(domErr.Code)
	if status >= 500 {
		observability.FromContext(r.Context()).Error("request failed",
			"error", err.Error(), "code", string(domErr.Code))
	}

	w.Header().Set("Content-Type", "application/problem+json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(Problem{
		Type:      "https://prospect.local/errors/" + string(domErr.Code),
		Title:     title,
		Status:    status,
		Code:      string(domErr.Code),
		Detail:    domErr.Message,
		Instance:  r.URL.Path,
		RequestID: requestID,
		Meta:      domErr.Details,
	})
}
