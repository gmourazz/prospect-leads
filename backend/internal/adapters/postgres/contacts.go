package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/contact"
)

type ContactRepo struct{ *Store }

func NewContactRepo(s *Store) *ContactRepo { return &ContactRepo{s} }

// Resolve finds the contact for a parsed number, checking the canonical column
// AND the alias table. Skipping the alias lookup is what would let the same
// person be messaged twice under two spellings of their number.
func (r *ContactRepo) Resolve(ctx context.Context, n contact.Number) (uuid.UUID, bool, error) {
	candidates := append([]string{n.E164()}, n.Aliases()...)

	var id uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT cp.id
		  FROM contact_points cp
		 WHERE cp.phone_e164 = ANY($1)
		 UNION
		SELECT a.contact_point_id
		  FROM contact_point_aliases a
		 WHERE a.alias_e164 = ANY($1)
		 LIMIT 1`, candidates).Scan(&id)

	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, nil
	}
	if err != nil {
		return uuid.Nil, false, TranslateError(err)
	}
	return id, true, nil
}

// Upsert resolves or creates the contact and records its aliases. It only ever
// touches last_seen_at on an existing row: history, stats and suppressions are
// never modified from the import path.
func (r *ContactRepo) Upsert(ctx context.Context, n contact.Number) (uuid.UUID, bool, error) {
	if id, found, err := r.Resolve(ctx, n); err != nil {
		return uuid.Nil, false, err
	} else if found {
		if _, err := r.DB(ctx).Exec(ctx,
			`UPDATE contact_points SET last_seen_at = now(), updated_at = now() WHERE id = $1`,
			id); err != nil {
			return uuid.Nil, false, TranslateError(err)
		}
		return id, false, nil
	}

	var id uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO contact_points
			(phone_e164, phone_raw, phone_display, country_code, area_code,
			 line_type, normalization_version)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (phone_e164) DO UPDATE SET last_seen_at = now()
		RETURNING id`,
		n.E164(), n.Raw(), n.Display(), "55", n.AreaCode(),
		string(n.LineType()), contact.NormalizationVersion).Scan(&id)
	if err != nil {
		return uuid.Nil, false, TranslateError(err)
	}

	for _, alias := range n.Aliases() {
		if _, err := r.DB(ctx).Exec(ctx, `
			INSERT INTO contact_point_aliases (contact_point_id, alias_e164, reason)
			VALUES ($1, $2, 'br_ninth_digit')
			ON CONFLICT (alias_e164) DO NOTHING`, id, alias); err != nil {
			return uuid.Nil, false, TranslateError(err)
		}
	}
	return id, true, nil
}

// State answers "has this number ever been messaged?" from the rollup.
func (r *ContactRepo) State(ctx context.Context, id uuid.UUID) (domain.ContactState, error) {
	var st domain.ContactState
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT cp.id, cp.phone_display, cp.phone_e164, cp.email, cp.line_type,
		       COALESCE(s.status::text, 'never_contacted'),
		       COALESCE(s.contact_count, 0),
		       s.first_contacted_at, s.last_contacted_at,
		       (sup.id IS NOT NULL), sup.reason
		  FROM contact_points cp
		  LEFT JOIN contact_point_stats s ON s.contact_point_id = cp.id
		  LEFT JOIN suppressions sup
		         ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
		 WHERE cp.id = $1`, id).
		Scan(&st.ContactPointID, &st.PhoneDisplay, &st.PhoneE164, &st.Email, &st.LineType,
			&st.Status, &st.ContactCount, &st.FirstContactedAt, &st.LastContactedAt,
			&st.IsSuppressed, &st.SuppressionReason)
	if err != nil {
		return st, TranslateError(err)
	}
	return st, nil
}

// HasBeenContacted is the authoritative check, re-run inside the reservation
// transaction rather than trusted from the rollup.
func (r *ContactRepo) HasBeenContacted(ctx context.Context, id uuid.UUID) (bool, error) {
	var exists bool
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM message_dispatches
			 WHERE contact_point_id = $1
			   AND status IN ('reserved', 'sending', 'sent'))`, id).Scan(&exists)
	if err != nil {
		return false, TranslateError(err)
	}
	return exists, nil
}

func (r *ContactRepo) Events(ctx context.Context, id uuid.UUID, limit int) ([]domain.ContactEvent, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT id, event_type::text, occurred_at, snapshot, note, campaign_id
		  FROM contact_events
		 WHERE contact_point_id = $1
		 ORDER BY occurred_at DESC
		 LIMIT $2`, id, limit)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	events := []domain.ContactEvent{}
	for rows.Next() {
		var e domain.ContactEvent
		var snapshot []byte
		if err := rows.Scan(&e.ID, &e.Type, &e.OccurredAt, &snapshot, &e.Note, &e.CampaignID); err != nil {
			return nil, TranslateError(err)
		}
		_ = json.Unmarshal(snapshot, &e.Snapshot)
		events = append(events, e)
	}
	return events, rows.Err()
}

// RecordEvent appends to the append-only history. The trigger updates the
// rollup; nothing else writes contact_point_stats.
func (r *ContactRepo) RecordEvent(ctx context.Context, e ContactEventInput) error {
	snapshot, _ := json.Marshal(e.Snapshot)
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO contact_events
			(contact_point_id, event_type, occurred_at, dispatch_id, lead_id,
			 company_id, campaign_id, template_version_id, snapshot, note, created_by)
		VALUES ($1, $2::contact_event_type, COALESCE($3, now()), $4, $5, $6, $7, $8, $9, $10, $11)`,
		e.ContactPointID, e.Type, e.OccurredAt, e.DispatchID, e.LeadID,
		e.CompanyID, e.CampaignID, e.TemplateVersionID, snapshot, e.Note, e.CreatedBy)
	return TranslateError(err)
}

type ContactEventInput struct {
	ContactPointID    uuid.UUID
	Type              string
	OccurredAt        *time.Time
	DispatchID        *uuid.UUID
	LeadID            *uuid.UUID
	CompanyID         *uuid.UUID
	CampaignID        *uuid.UUID
	TemplateVersionID *uuid.UUID
	Snapshot          map[string]any
	Note              *string
	CreatedBy         *uuid.UUID
}

func (r *ContactRepo) Suppress(ctx context.Context, id uuid.UUID, reason, note string, by uuid.UUID) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO suppressions (contact_point_id, reason, note, created_by)
		VALUES ($1, $2, NULLIF($3, ''), $4)`, id, reason, note, by)
	if err != nil {
		return TranslateError(err)
	}
	return r.RecordEvent(ctx, ContactEventInput{
		ContactPointID: id,
		Type:           "opted_out",
		Snapshot:       map[string]any{"reason": reason},
		CreatedBy:      &by,
	})
}

func (r *ContactRepo) Unsuppress(ctx context.Context, id uuid.UUID, reason string, by uuid.UUID) error {
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE suppressions
		   SET revoked_at = now(), revoked_by = $2, revoke_reason = $3
		 WHERE contact_point_id = $1 AND revoked_at IS NULL`, id, by, reason)
	return TranslateError(err)
}

func (r *ContactRepo) ListSuppressions(ctx context.Context) ([]domain.Suppression, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT s.id, s.contact_point_id, cp.phone_display,
		       (SELECT c.trade_name
		          FROM company_contact_points ccp
		          JOIN companies c ON c.id = ccp.company_id
		         WHERE ccp.contact_point_id = cp.id
		         LIMIT 1),
		       s.reason, s.note, s.created_at
		  FROM suppressions s
		  JOIN contact_points cp ON cp.id = s.contact_point_id
		 WHERE s.revoked_at IS NULL
		 ORDER BY s.created_at DESC`)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []domain.Suppression{}
	for rows.Next() {
		var s domain.Suppression
		if err := rows.Scan(&s.ID, &s.ContactID, &s.PhoneDisplay, &s.CompanyName,
			&s.Reason, &s.Note, &s.CreatedAt); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *ContactRepo) Get(ctx context.Context, id uuid.UUID) (domain.ContactPoint, error) {
	var cp domain.ContactPoint
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT id, phone_e164, phone_display, COALESCE(phone_raw, ''),
		       COALESCE(area_code, ''), email, line_type, first_seen_at, last_seen_at
		  FROM contact_points WHERE id = $1`, id).
		Scan(&cp.ID, &cp.PhoneE164, &cp.PhoneDisplay, &cp.PhoneRaw,
			&cp.AreaCode, &cp.Email, &cp.LineType, &cp.FirstSeenAt, &cp.LastSeenAt)
	if err != nil {
		return cp, TranslateError(err)
	}
	return cp, nil
}

// SetEmail adds an address typed by hand and promotes it to primary — used
// when discovery found nothing, or found the wrong inbox. It never deletes
// the addresses discovery already found; those stay as alternatives.
func (r *ContactRepo) SetEmail(ctx context.Context, id uuid.UUID, email string) error {
	if email == "" {
		return domain.Validation("email é obrigatório")
	}
	if _, err := r.AddEmails(ctx, id, []EmailInput{{Email: email, Source: "manual"}}); err != nil {
		return err
	}
	return r.SetPrimaryEmail(ctx, id, email)
}
