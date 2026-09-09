package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/geovanna/prospect/backend/internal/domain"
)

// The follow-up stage: a business that got the email and never answered gets
// one more try on WhatsApp, sent by hand. Nothing here automates WhatsApp —
// the app renders the message and opens the chat, the human presses send.
// That distinction is why 'opened' is a separate status from 'sent': opening
// a chat window is not proof anything was delivered.

// AwaitingReply is one lead in the middle of the funnel.
type AwaitingReply struct {
	LeadID         uuid.UUID  `json:"lead_id"`
	ContactPointID uuid.UUID  `json:"contact_point_id"`
	CompanyID      uuid.UUID  `json:"company_id"`
	CompanyName    string     `json:"company_name"`
	PhoneDisplay   string     `json:"phone_display"`
	PhoneE164      string     `json:"phone_e164"`
	Email          *string    `json:"email"`
	City           *string    `json:"city"`
	State          *string    `json:"state"`
	SegmentName    *string    `json:"segment_name"`
	EmailedAt      string     `json:"emailed_at"`
	DaysSinceEmail int        `json:"days_since_email"`
	WhatsAppSent   bool       `json:"whatsapp_sent"`
	OpenDispatchID *uuid.UUID `json:"open_dispatch_id"`
}

// ListAwaitingReply returns leads emailed at least minDays ago that never
// replied. Whether the WhatsApp follow-up already went out is reported
// rather than filtered, so the list doubles as the record of what was done.
func (r *LeadRepo) ListAwaitingReply(ctx context.Context, minDays, limit int) ([]AwaitingReply, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT lb.lead_id, lb.contact_point_id, lb.company_id, lb.company_name,
		       lb.phone_display, lb.phone_e164, lb.email, lb.city, lb.state,
		       lb.segment_name, f.emailed_at,
		       EXTRACT(DAY FROM f.since_email)::int,
		       f.whatsapp_sent,
		       (SELECT d.id FROM message_dispatches d
		         WHERE d.contact_point_id = lb.contact_point_id
		           AND d.channel = 'whatsapp' AND d.status = 'opened'
		         LIMIT 1)
		  FROM lead_board lb
		  JOIN lead_followup f ON f.contact_point_id = lb.contact_point_id
		 WHERE f.has_replied = false
		   AND lb.is_suppressed = false
		   AND f.since_email >= make_interval(days => $1)
		 ORDER BY f.emailed_at
		 LIMIT $2`, minDays, limit)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []AwaitingReply{}
	for rows.Next() {
		var a AwaitingReply
		if err := rows.Scan(&a.LeadID, &a.ContactPointID, &a.CompanyID, &a.CompanyName,
			&a.PhoneDisplay, &a.PhoneE164, &a.Email, &a.City, &a.State,
			&a.SegmentName, &a.EmailedAt, &a.DaysSinceEmail, &a.WhatsAppSent,
			&a.OpenDispatchID); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// OpenWhatsAppFollowup reserves the follow-up as 'opened' — not 'sent'. The
// per-channel unique index makes a second WhatsApp follow-up to the same
// business impossible even if two tabs try at once, while leaving the email
// that came before it untouched.
func (r *OutreachRepo) OpenWhatsAppFollowup(ctx context.Context, leadID, contactPointID, companyID, templateVersionID uuid.UUID) (uuid.UUID, error) {
	var dispatchID uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO message_dispatches
			(contact_point_id, lead_id, company_id, template_version_id,
			 attempt_seq, status, channel, provider)
		SELECT $1, $2, $3, $4, 1, 'opened', 'whatsapp', 'manual'
		 WHERE NOT EXISTS (
		       SELECT 1 FROM suppressions
		        WHERE contact_point_id = $1 AND revoked_at IS NULL)
		RETURNING id`,
		contactPointID, leadID, companyID, templateVersionID).Scan(&dispatchID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, domain.New(domain.CodeContactSuppressed,
				"este contato está na lista de não contatar")
		}
		return uuid.Nil, TranslateError(err)
	}
	return dispatchID, nil
}

// ConfirmFollowup is the only place a hand-sent WhatsApp message becomes
// history, and it runs after the user explicitly says they sent it.
func (r *OutreachRepo) ConfirmFollowup(ctx context.Context, dispatchID uuid.UUID, body string, templateVersionID uuid.UUID, snapshot map[string]any) error {
	return r.WithTx(ctx, func(ctx context.Context) error {
		var contactPointID uuid.UUID
		var leadID, companyID *uuid.UUID
		if err := r.DB(ctx).QueryRow(ctx, `
			UPDATE message_dispatches
			   SET status = 'sent', sent_at = now(), rendered_body = $2,
			       rendered_at = now(), updated_at = now()
			 WHERE id = $1 AND status = 'opened'
			RETURNING contact_point_id, lead_id, company_id`,
			dispatchID, body).Scan(&contactPointID, &leadID, &companyID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.New(domain.CodeConflict,
					"este follow-up já foi confirmado ou cancelado")
			}
			return TranslateError(err)
		}

		snapshotJSON, _ := json.Marshal(snapshot)
		if _, err := r.DB(ctx).Exec(ctx, `
			INSERT INTO contact_events
				(contact_point_id, event_type, dispatch_id, lead_id, company_id,
				 template_version_id, snapshot)
			VALUES ($1, 'message_sent', $2, $3, $4, $5, $6)`,
			contactPointID, dispatchID, leadID, companyID, templateVersionID, snapshotJSON); err != nil {
			return TranslateError(err)
		}

		if leadID != nil {
			if _, err := r.DB(ctx).Exec(ctx, `
				UPDATE leads
				   SET last_interaction_at = now(), updated_at = now()
				 WHERE id = $1`, *leadID); err != nil {
				return TranslateError(err)
			}
		}
		return nil
	})
}

// CancelFollowup releases the reservation: the user opened WhatsApp and
// decided not to send after all, so the business stays followable.
func (r *OutreachRepo) CancelFollowup(ctx context.Context, dispatchID uuid.UUID) error {
	tag, err := r.DB(ctx).Exec(ctx, `
		UPDATE message_dispatches
		   SET status = 'canceled', updated_at = now()
		 WHERE id = $1 AND status = 'opened'`, dispatchID)
	if err != nil {
		return TranslateError(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("follow-up em aberto")
	}
	return nil
}

// MarkReplied records that a business answered — the event that takes it out
// of the follow-up list for good.
func (r *ContactRepo) MarkReplied(ctx context.Context, contactPointID uuid.UUID, note string, by uuid.UUID) error {
	var notePtr *string
	if note != "" {
		notePtr = &note
	}
	return r.RecordEvent(ctx, ContactEventInput{
		ContactPointID: contactPointID,
		Type:           "replied",
		Note:           notePtr,
		CreatedBy:      &by,
	})
}
