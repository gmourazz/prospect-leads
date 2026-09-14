package domain

import "fmt"

// Code is the machine-readable error identifier shared with the frontend.
type Code string

const (
	CodeValidation          Code = "validation_failed"
	CodeNotFound            Code = "not_found"
	CodeAlreadyContacted    Code = "already_contacted"
	CodeContactSuppressed   Code = "contact_suppressed"
	CodeInvalidPhone        Code = "invalid_phone"
	CodeRecontactRequired   Code = "recontact_approval_required"
	CodeBatchInProgress     Code = "batch_in_progress"
	CodeIdempotencyReuse    Code = "idempotency_key_reuse"
	CodeNoEligibleTargets   Code = "no_eligible_targets"
	CodeProviderUnavailable Code = "provider_unavailable"
	CodeConflict            Code = "conflict"
	CodeUnauthorized        Code = "unauthorized"
	CodeInternal            Code = "internal_error"
	CodeSendWindowClosed    Code = "send_window_closed"
)

// Error is the single error type crossing layer boundaries. Transport maps
// Code to an HTTP status in exactly one place.
type Error struct {
	Code    Code
	Message string
	Details map[string]any
	cause   error
}

func (e *Error) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *Error) Unwrap() error { return e.cause }

func (e *Error) With(key string, value any) *Error {
	if e.Details == nil {
		e.Details = map[string]any{}
	}
	e.Details[key] = value
	return e
}

func New(code Code, message string) *Error {
	return &Error{Code: code, Message: message}
}

func Wrap(code Code, message string, cause error) *Error {
	return &Error{Code: code, Message: message, cause: cause}
}

func NotFound(what string) *Error {
	return New(CodeNotFound, what+" não encontrado")
}

func Validation(message string) *Error {
	return New(CodeValidation, message)
}
