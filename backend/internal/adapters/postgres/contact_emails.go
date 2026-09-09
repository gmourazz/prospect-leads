package postgres

import (
	"context"

	"github.com/google/uuid"
)

// EmailInput is one discovered address plus where it came from.
type EmailInput struct {
	Email  string
	Source string
}

// ContactEmail is one stored address.
type ContactEmail struct {
	Email     string `json:"email"`
	Source    string `json:"source"`
	IsPrimary bool   `json:"is_primary"`
}

// AddEmails stores every address found for a contact and makes sure exactly
// one of them is flagged primary. Re-running discovery is safe: an address
// already known keeps its original source and discovery date instead of
// being overwritten by a worse source.
//
// contact_points.email is kept in sync with the primary row — the send path,
// the availability view and the campaign eligibility queries all read that
// column, so it must never drift from this table.
func (r *ContactRepo) AddEmails(ctx context.Context, contactPointID uuid.UUID, emails []EmailInput) (added int, err error) {
	if len(emails) == 0 {
		return 0, nil
	}
	err = r.WithTx(ctx, func(ctx context.Context) error {
		for _, e := range emails {
			tag, err := r.DB(ctx).Exec(ctx, `
				INSERT INTO contact_point_emails (contact_point_id, email, source)
				VALUES ($1, lower($2), $3)
				ON CONFLICT (contact_point_id, email) DO NOTHING`,
				contactPointID, e.Email, e.Source)
			if err != nil {
				return TranslateError(err)
			}
			added += int(tag.RowsAffected())
		}

		// The caller passes them already ranked best-first, so the first row
		// ever inserted for this contact is the one worth defaulting to.
		if _, err := r.DB(ctx).Exec(ctx, `
			UPDATE contact_point_emails
			   SET is_primary = (id = (
			         SELECT id FROM contact_point_emails
			          WHERE contact_point_id = $1
			          ORDER BY is_primary DESC, discovered_at, email
			          LIMIT 1))
			 WHERE contact_point_id = $1`, contactPointID); err != nil {
			return TranslateError(err)
		}

		_, err := r.DB(ctx).Exec(ctx, `
			UPDATE contact_points
			   SET email = (SELECT email FROM contact_point_emails
			                 WHERE contact_point_id = $1 AND is_primary
			                 LIMIT 1),
			       updated_at = now()
			 WHERE id = $1`, contactPointID)
		return TranslateError(err)
	})
	return added, err
}

// SetPrimaryEmail is the manual override: the user picked which address the
// campaign should treat as the main one.
func (r *ContactRepo) SetPrimaryEmail(ctx context.Context, contactPointID uuid.UUID, email string) error {
	return r.WithTx(ctx, func(ctx context.Context) error {
		if _, err := r.DB(ctx).Exec(ctx, `
			UPDATE contact_point_emails
			   SET is_primary = (lower(email) = lower($2))
			 WHERE contact_point_id = $1`, contactPointID, email); err != nil {
			return TranslateError(err)
		}
		_, err := r.DB(ctx).Exec(ctx, `
			UPDATE contact_points
			   SET email = (SELECT email FROM contact_point_emails
			                 WHERE contact_point_id = $1 AND is_primary LIMIT 1),
			       updated_at = now()
			 WHERE id = $1`, contactPointID)
		return TranslateError(err)
	})
}

func (r *ContactRepo) RemoveEmail(ctx context.Context, contactPointID uuid.UUID, email string) error {
	return r.WithTx(ctx, func(ctx context.Context) error {
		if _, err := r.DB(ctx).Exec(ctx, `
			DELETE FROM contact_point_emails
			 WHERE contact_point_id = $1 AND lower(email) = lower($2)`,
			contactPointID, email); err != nil {
			return TranslateError(err)
		}
		if _, err := r.DB(ctx).Exec(ctx, `
			UPDATE contact_point_emails
			   SET is_primary = (id = (
			         SELECT id FROM contact_point_emails
			          WHERE contact_point_id = $1
			          ORDER BY is_primary DESC, discovered_at, email
			          LIMIT 1))
			 WHERE contact_point_id = $1`, contactPointID); err != nil {
			return TranslateError(err)
		}
		_, err := r.DB(ctx).Exec(ctx, `
			UPDATE contact_points
			   SET email = (SELECT email FROM contact_point_emails
			                 WHERE contact_point_id = $1 AND is_primary LIMIT 1),
			       updated_at = now()
			 WHERE id = $1`, contactPointID)
		return TranslateError(err)
	})
}

func (r *ContactRepo) ListEmails(ctx context.Context, contactPointID uuid.UUID) ([]ContactEmail, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT email, source, is_primary
		  FROM contact_point_emails
		 WHERE contact_point_id = $1
		 ORDER BY is_primary DESC, discovered_at`, contactPointID)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []ContactEmail{}
	for rows.Next() {
		var e ContactEmail
		if err := rows.Scan(&e.Email, &e.Source, &e.IsPrimary); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// EnrichmentTarget is one lead still missing an email, with everything the
// finder needs to go looking for one.
type EnrichmentTarget struct {
	ContactPointID uuid.UUID
	CompanyID      uuid.UUID
	CompanyName    string
	City           string
	State          string
	Website        string
	CNPJ           string
}

// LeadsMissingEmail lists contacts with no address yet, newest leads first —
// those are the ones the user is most likely about to work.
func (r *LeadRepo) LeadsMissingEmail(ctx context.Context, limit int) ([]EnrichmentTarget, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT DISTINCT ON (cp.id)
		       cp.id, c.id, c.trade_name, COALESCE(c.city, ''), COALESCE(c.state, ''),
		       COALESCE((SELECT wp.url FROM web_presences wp
		                  WHERE wp.company_id = c.id AND wp.kind = 'own_site'
		                  LIMIT 1), ''),
		       COALESCE(c.cnpj, '')
		  FROM leads l
		  JOIN companies c ON c.id = l.company_id
		  JOIN contact_points cp ON cp.id = l.primary_contact_point_id
		 WHERE l.deleted_at IS NULL
		   AND c.deleted_at IS NULL
		   AND cp.email IS NULL
		 ORDER BY cp.id, l.collected_at DESC
		 LIMIT $1`, limit)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []EnrichmentTarget{}
	for rows.Next() {
		var t EnrichmentTarget
		if err := rows.Scan(&t.ContactPointID, &t.CompanyID, &t.CompanyName, &t.City,
			&t.State, &t.Website, &t.CNPJ); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// CountLeadsMissingEmail is what the progress screen shows as "faltam": it
// is recomputed from the database rather than tracked in memory, so it stays
// correct even if the app restarts mid-run.
func (r *LeadRepo) CountLeadsMissingEmail(ctx context.Context) (int, error) {
	var n int
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT COUNT(DISTINCT cp.id)
		  FROM leads l
		  JOIN companies c ON c.id = l.company_id
		  JOIN contact_points cp ON cp.id = l.primary_contact_point_id
		 WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL AND cp.email IS NULL`).Scan(&n)
	if err != nil {
		return 0, TranslateError(err)
	}
	return n, nil
}
