package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type UserRepo struct{ *Store }

func NewUserRepo(s *Store) *UserRepo { return &UserRepo{s} }

type User struct {
	ID           uuid.UUID
	Email        string
	Name         string
	PasswordHash string
}

func (r *UserRepo) FindByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := r.DB(ctx).QueryRow(ctx,
		`SELECT id, email, name, password_hash FROM users WHERE email = $1`, email).
		Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, TranslateError(err)
	}
	return &u, nil
}

func (r *UserRepo) FindByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var u User
	err := r.DB(ctx).QueryRow(ctx,
		`SELECT id, email, name, password_hash FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, TranslateError(err)
	}
	return &u, nil
}
