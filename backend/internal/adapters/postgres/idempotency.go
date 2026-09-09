package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/geovanna/prospect/backend/internal/domain"
)

type IdempotencyRepo struct{ *Store }

func NewIdempotencyRepo(s *Store) *IdempotencyRepo { return &IdempotencyRepo{s} }

type IdempotencyRecord struct {
	Replayed     bool
	ResponseCode int
	ResponseBody json.RawMessage
}

func HashRequest(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

// Begin claims the key. The unique index makes the claim atomic: exactly one
// caller becomes the executor, everyone else gets the stored response or a
// "still running" conflict.
//
// This protects against the SAME request repeated (refresh, retry, double
// click). It does NOT protect against two different requests targeting the
// same contact — that is what the dispatch unique index is for. Neither layer
// replaces the other.
func (r *IdempotencyRepo) Begin(ctx context.Context, key, endpoint, requestHash string) (*IdempotencyRecord, error) {
	if key == "" {
		return nil, domain.Validation("cabeçalho Idempotency-Key é obrigatório")
	}

	var id string
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO idempotency_keys (key, endpoint, request_hash, status, locked_at)
		VALUES ($1, $2, $3, 'in_progress', now())
		ON CONFLICT (key, endpoint) DO NOTHING
		RETURNING id`, key, endpoint, requestHash).Scan(&id)

	if err == nil {
		return nil, nil // we are the executor
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, TranslateError(err)
	}

	var (
		status       string
		storedHash   string
		responseCode *int
		responseBody []byte
	)
	if err := r.DB(ctx).QueryRow(ctx, `
		SELECT status, request_hash, response_code, response_body
		  FROM idempotency_keys WHERE key = $1 AND endpoint = $2`, key, endpoint).
		Scan(&status, &storedHash, &responseCode, &responseBody); err != nil {
		return nil, TranslateError(err)
	}

	if storedHash != requestHash {
		return nil, domain.New(domain.CodeIdempotencyReuse,
			"a mesma chave de idempotência foi usada com um corpo diferente")
	}
	if status == "in_progress" {
		return nil, domain.New(domain.CodeBatchInProgress,
			"um envio com esta chave ainda está em andamento")
	}

	rec := &IdempotencyRecord{Replayed: true, ResponseBody: responseBody}
	if responseCode != nil {
		rec.ResponseCode = *responseCode
	}
	return rec, nil
}

func (r *IdempotencyRepo) Complete(ctx context.Context, key, endpoint string, code int, body any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return domain.Wrap(domain.CodeInternal, "não foi possível serializar a resposta", err)
	}
	_, err = r.DB(ctx).Exec(ctx, `
		UPDATE idempotency_keys
		   SET status = 'completed', response_code = $3, response_body = $4,
		       completed_at = now()
		 WHERE key = $1 AND endpoint = $2`, key, endpoint, code, payload)
	return TranslateError(err)
}

// Release drops a claim that failed before producing a response, so the client
// can retry with the same key instead of being locked out.
func (r *IdempotencyRepo) Release(ctx context.Context, key, endpoint string) error {
	_, err := r.DB(ctx).Exec(ctx,
		`DELETE FROM idempotency_keys WHERE key = $1 AND endpoint = $2 AND status = 'in_progress'`,
		key, endpoint)
	return TranslateError(err)
}
