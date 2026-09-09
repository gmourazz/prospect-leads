package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/geovanna/prospect/backend/internal/domain"
)

// Querier is satisfied by both the pool and a transaction, so repository code
// is written once and the caller decides the transactional boundary.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type txCtxKey struct{}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// DB returns the transaction carried in the context when there is one. This is
// what lets a service compose repository calls into a single transaction
// without repositories knowing transactions exist.
func (s *Store) DB(ctx context.Context) Querier {
	if tx, ok := ctx.Value(txCtxKey{}).(pgx.Tx); ok {
		return tx
	}
	return s.pool
}

// WithTx runs fn inside one transaction. Nested calls join the outer one.
func (s *Store) WithTx(ctx context.Context, fn func(context.Context) error) error {
	if _, ok := ctx.Value(txCtxKey{}).(pgx.Tx); ok {
		return fn(ctx)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return domain.Wrap(domain.CodeInternal, "não foi possível iniciar a transação", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := fn(context.WithValue(ctx, txCtxKey{}, tx)); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Wrap(domain.CodeInternal, "não foi possível concluir a transação", err)
	}
	return nil
}

// TranslateError turns Postgres constraint violations into domain errors.
// Constraint names are load-bearing here: a unique violation on the dispatch
// index means "already contacted", not a generic 500.
func TranslateError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.NotFound("registro")
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		switch pgErr.ConstraintName {
		case "message_dispatches_first_contact_unique",
			"message_dispatches_contact_attempt_unique":
			return domain.New(domain.CodeAlreadyContacted,
				"este contato já possui um envio registrado")
		case "idempotency_keys_unique":
			return domain.New(domain.CodeBatchInProgress, "lote já em andamento")
		case "campaign_targets_unique":
			return domain.New(domain.CodeConflict, "contato já está nesta campanha")
		case "contact_points_phone_e164_key":
			return domain.New(domain.CodeConflict, "telefone já cadastrado")
		case "suppressions_active_unique":
			return domain.New(domain.CodeConflict, "contato já está na lista de bloqueio")
		case "companies_cnpj_key", "companies_natural_key":
			return domain.New(domain.CodeConflict, "empresa já cadastrada")
		}
		return domain.Wrap(domain.CodeConflict, "registro duplicado", err)
	}
	return domain.Wrap(domain.CodeInternal, "erro no banco de dados", err)
}
