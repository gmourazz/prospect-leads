package postgres

import "context"

type SettingsRepo struct{ *Store }

func NewSettingsRepo(s *Store) *SettingsRepo { return &SettingsRepo{s} }

// EmailSignature is appended to every outgoing message. Kept in one place
// rather than repeated in each template so changing a phone number or a link
// is one edit, not four.
func (r *SettingsRepo) EmailSignature(ctx context.Context) (string, error) {
	var signature string
	err := r.DB(ctx).QueryRow(ctx,
		`SELECT email_signature FROM app_settings WHERE id = 1`).Scan(&signature)
	if err != nil {
		return "", TranslateError(err)
	}
	return signature, nil
}

func (r *SettingsRepo) SetEmailSignature(ctx context.Context, signature string) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO app_settings (id, email_signature, updated_at)
		VALUES (1, $1, now())
		ON CONFLICT (id) DO UPDATE
		   SET email_signature = EXCLUDED.email_signature, updated_at = now()`,
		signature)
	return TranslateError(err)
}
