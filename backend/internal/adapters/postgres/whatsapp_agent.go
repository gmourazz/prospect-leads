package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/geovanna/prospect/backend/internal/domain"
)

// The automated WhatsApp channel. A local Baileys session (see
// whatsapp-bridge/) drives an ordinary WhatsApp Web login and asks this
// repository for one message at a time — it never receives a list, because a
// list is the thing that turns into a burst.
//
// Every guarantee that protects the email path protects this one: the same
// message_dispatches table, the same partial unique index, the same
// append-only contact_events. The only addition is pacing state, and it lives
// here rather than in the bridge so that killing and restarting the bridge
// cannot shorten a cooldown.

type WhatsAppRepo struct{ *Store }

func NewWhatsAppRepo(s *Store) *WhatsAppRepo { return &WhatsAppRepo{s} }

// Connection states reported by the bridge. Only 'connected' can send;
// 'logged_out' and 'blocked' additionally trip the kill switch.
const (
	ConnOffline    = "offline"
	ConnConnecting = "connecting"
	ConnQRRequired = "qr_required"
	ConnConnected  = "connected"
	ConnLoggedOut  = "logged_out"
	ConnBlocked    = "blocked"
)

type AgentState struct {
	Connection      string     `json:"connection"`
	Paused          bool       `json:"paused"`
	PauseReason     *string    `json:"pause_reason"`
	NextAllowedAt   time.Time  `json:"next_allowed_at"`
	BurstCount      int        `json:"burst_count"`
	LastSentAt      *time.Time `json:"last_sent_at"`
	LastHeartbeatAt *time.Time `json:"last_heartbeat_at"`
	LastError       *string    `json:"last_error"`

	// WaitFor is how long is left on the cooldown, measured by Postgres.
	//
	// It is not derived from NextAllowedAt in Go on purpose. That timestamp is
	// WRITTEN by the database (now() + interval), so comparing it against the
	// API server's clock silently folds any drift between the two machines
	// into the send interval — and the entire safety of this feature is "wait
	// exactly this long before the next message". One clock decides both ends.
	// NextAllowedAt stays only to be displayed.
	WaitFor time.Duration `json:"-"`
}

func (r *WhatsAppRepo) State(ctx context.Context) (AgentState, error) {
	var s AgentState
	var waitSeconds float64
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT connection, paused, pause_reason, next_allowed_at, burst_count,
		       last_sent_at, last_heartbeat_at, last_error,
		       EXTRACT(EPOCH FROM GREATEST(next_allowed_at - now(), interval '0'))
		  FROM whatsapp_agent_state WHERE id = 1`).
		Scan(&s.Connection, &s.Paused, &s.PauseReason, &s.NextAllowedAt,
			&s.BurstCount, &s.LastSentAt, &s.LastHeartbeatAt, &s.LastError, &waitSeconds)
	if err != nil {
		return s, TranslateError(err)
	}
	s.WaitFor = time.Duration(waitSeconds * float64(time.Second))
	return s, nil
}

// SetConnection records the bridge's heartbeat. It is also the kill switch:
// a session that got logged out or blocked pauses the queue on the spot, so
// no further message is handed out until a human looks at it.
func (r *WhatsAppRepo) SetConnection(ctx context.Context, connection, lastError string) error {
	var errPtr *string
	if lastError != "" {
		errPtr = &lastError
	}
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE whatsapp_agent_state
		   SET connection        = $1,
		       last_error        = $2,
		       last_heartbeat_at = now(),
		       paused      = paused      OR $1 IN ('logged_out', 'blocked'),
		       pause_reason = CASE
		         WHEN $1 = 'logged_out' THEN 'sessão do WhatsApp foi desconectada'
		         WHEN $1 = 'blocked'    THEN 'o WhatsApp restringiu este número'
		         ELSE pause_reason END,
		       updated_at = now()
		 WHERE id = 1`, connection, errPtr)
	return TranslateError(err)
}

func (r *WhatsAppRepo) SetPaused(ctx context.Context, paused bool, reason string) error {
	var reasonPtr *string
	if paused && reason != "" {
		reasonPtr = &reason
	}
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE whatsapp_agent_state
		   SET paused = $1, pause_reason = $2, updated_at = now()
		 WHERE id = 1`, paused, reasonPtr)
	return TranslateError(err)
}

// ScheduleNext pushes the cooldown forward and advances the burst counter.
//
// It is called when a message is HANDED OUT, not when it is reported back.
// That ordering is the whole protection: a bridge that claims a message and
// then crashes, hangs, or simply never reports still cannot be given another
// one before the interval has passed. Charging the interval on the report
// instead would let a crash-looping or duplicated bridge drain the queue as
// fast as HTTP allows.
func (r *WhatsAppRepo) ScheduleNext(ctx context.Context, delay time.Duration, resetBurst bool) error {
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE whatsapp_agent_state
		   SET next_allowed_at = now() + make_interval(secs => $1),
		       burst_count     = CASE WHEN $2 THEN 0 ELSE burst_count + 1 END,
		       updated_at      = now()
		 WHERE id = 1`, delay.Seconds(), resetBurst)
	return TranslateError(err)
}

// ------------------------------------------------------------------ fila

type EnqueueResult struct {
	Queued  int            `json:"queued"`
	Skipped map[string]int `json:"skipped"`
}

// Enqueue turns selected leads into queued dispatches. Every exclusion rule
// is expressed as SQL rather than checked in Go so that two clicks arriving
// at once cannot both pass the same check — the partial unique index is the
// last word either way.
func (r *WhatsAppRepo) Enqueue(ctx context.Context, leadIDs []uuid.UUID, templateVersionID uuid.UUID) (EnqueueResult, error) {
	out := EnqueueResult{Skipped: map[string]int{}}

	rows, err := r.DB(ctx).Query(ctx, `
		INSERT INTO message_dispatches
			(contact_point_id, lead_id, company_id, template_version_id,
			 attempt_seq, status, channel, provider)
		SELECT cp.id, l.id, l.company_id, $2, 1, 'queued', 'whatsapp', 'baileys'
		  FROM leads l
		  JOIN contact_points cp ON cp.id = l.primary_contact_point_id
		  LEFT JOIN suppressions sup
		         ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
		 WHERE l.id = ANY($1)
		   AND l.deleted_at IS NULL
		   AND sup.id IS NULL
		   AND cp.line_type <> 'fixed_line'
		   AND NOT EXISTS (
		         SELECT 1 FROM message_dispatches d
		          WHERE d.contact_point_id = cp.id
		            AND d.channel = 'whatsapp'
		            AND d.status IN ('queued','reserved','sending','opened','sent'))
		ON CONFLICT DO NOTHING
		RETURNING lead_id`, leadIDs, templateVersionID)
	if err != nil {
		return out, TranslateError(err)
	}
	queuedLeads := []uuid.UUID{}
	for rows.Next() {
		var leadID uuid.UUID
		if err := rows.Scan(&leadID); err != nil {
			rows.Close()
			return out, TranslateError(err)
		}
		queuedLeads = append(queuedLeads, leadID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, TranslateError(err)
	}
	out.Queued = len(queuedLeads)

	// Why the rest were left out, so the screen can say "20 selecionados, 17
	// entraram" and explain the three instead of silently shrinking.
	//
	// The leads just queued are excluded by id rather than re-tested: they now
	// match the "already has a WhatsApp dispatch" check they were inserted by,
	// and would otherwise be reported as skipped in the same breath as being
	// queued.
	reasons, err := r.DB(ctx).Query(ctx, `
		SELECT CASE
		         WHEN cp.id IS NULL             THEN 'sem_telefone'
		         WHEN sup.id IS NOT NULL        THEN 'nao_contatar'
		         WHEN cp.line_type = 'fixed_line' THEN 'telefone_fixo'
		         ELSE 'ja_contatado' END,
		       COUNT(*)
		  FROM leads l
		  LEFT JOIN contact_points cp ON cp.id = l.primary_contact_point_id
		  LEFT JOIN suppressions sup
		         ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
		 WHERE l.id = ANY($1)
		   AND NOT (l.id = ANY($2))
		   AND l.deleted_at IS NULL
		   AND (cp.id IS NULL
		        OR sup.id IS NOT NULL
		        OR cp.line_type = 'fixed_line'
		        OR EXISTS (SELECT 1 FROM message_dispatches d
		                    WHERE d.contact_point_id = cp.id
		                      AND d.channel = 'whatsapp'
		                      AND d.status IN ('queued','reserved','sending','opened','sent')))
		 GROUP BY 1`, leadIDs, queuedLeads)
	if err != nil {
		return out, TranslateError(err)
	}
	defer reasons.Close()
	for reasons.Next() {
		var reason string
		var n int
		if err := reasons.Scan(&reason, &n); err != nil {
			return out, TranslateError(err)
		}
		out.Skipped[reason] = n
	}
	return out, reasons.Err()
}

type QueueCounts struct {
	Queued    int `json:"queued"`
	Sending   int `json:"sending"`
	SentToday int `json:"sent_today"`
	SentTotal int `json:"sent_total"`
	Failed    int `json:"failed"`
}

func (r *WhatsAppRepo) Counts(ctx context.Context) (QueueCounts, error) {
	var c QueueCounts
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FILTER (WHERE status = 'queued'),
		       COUNT(*) FILTER (WHERE status = 'sending'),
		       COUNT(*) FILTER (WHERE status = 'sent'
		                          AND sent_at >= date_trunc('day', now())),
		       COUNT(*) FILTER (WHERE status = 'sent'),
		       COUNT(*) FILTER (WHERE status = 'failed'
		                          AND failed_at >= date_trunc('day', now()))
		  FROM message_dispatches
		 WHERE channel = 'whatsapp' AND provider = 'baileys'`).
		Scan(&c.Queued, &c.Sending, &c.SentToday, &c.SentTotal, &c.Failed)
	if err != nil {
		return c, TranslateError(err)
	}
	return c, nil
}

// SentToday counts against the daily ceiling. It deliberately counts every
// WhatsApp message that left today, hand-sent ones included: the limit exists
// to protect the number, and the number does not care which screen a message
// was typed on.
func (r *WhatsAppRepo) SentToday(ctx context.Context) (int, error) {
	var n int
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FROM message_dispatches
		 WHERE channel = 'whatsapp' AND status = 'sent'
		   AND sent_at >= date_trunc('day', now())`).Scan(&n)
	if err != nil {
		return 0, TranslateError(err)
	}
	return n, nil
}

type QueueItem struct {
	DispatchID   uuid.UUID  `json:"dispatch_id"`
	CompanyName  string     `json:"company_name"`
	PhoneDisplay string     `json:"phone_display"`
	Status       string     `json:"status"`
	BodyPreview  *string    `json:"body_preview"`
	ErrorMessage *string    `json:"error_message"`
	SentAt       *time.Time `json:"sent_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Recent is the activity feed on the queue screen: what just went out, what
// failed and why.
func (r *WhatsAppRepo) Recent(ctx context.Context, limit int, from, to *time.Time) ([]QueueItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 30
	}
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT d.id, COALESCE(co.trade_name, 'Empresa'), cp.phone_display,
		       d.status::text, LEFT(d.rendered_body, 120), d.error_message,
		       d.sent_at, d.updated_at
		  FROM message_dispatches d
		  JOIN contact_points cp ON cp.id = d.contact_point_id
		  LEFT JOIN companies co ON co.id = d.company_id
		 WHERE d.channel = 'whatsapp' AND d.provider = 'baileys'
		   AND d.status IN ('sent', 'failed', 'sending')
		   AND ($2::timestamptz IS NULL OR d.updated_at >= $2)
		   AND ($3::timestamptz IS NULL OR d.updated_at < $3)
		 ORDER BY d.updated_at DESC
		 LIMIT $1`, limit, from, to)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []QueueItem{}
	for rows.Next() {
		var i QueueItem
		if err := rows.Scan(&i.DispatchID, &i.CompanyName, &i.PhoneDisplay,
			&i.Status, &i.BodyPreview, &i.ErrorMessage, &i.SentAt, &i.UpdatedAt); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// ClearQueue drops everything still waiting. Messages already sent are
// untouched — history never gets rewritten by a queue operation.
func (r *WhatsAppRepo) ClearQueue(ctx context.Context) (int, error) {
	tag, err := r.DB(ctx).Exec(ctx, `
		UPDATE message_dispatches
		   SET status = 'canceled', updated_at = now()
		 WHERE channel = 'whatsapp' AND status = 'queued'`)
	if err != nil {
		return 0, TranslateError(err)
	}
	return int(tag.RowsAffected()), nil
}

// ------------------------------------------------------------- despacho

type Job struct {
	DispatchID        uuid.UUID
	ContactPointID    uuid.UUID
	LeadID            *uuid.UUID
	CompanyID         *uuid.UUID
	TemplateVersionID uuid.UUID
	CompanyName       string
	PhoneE164         string
	PhoneDisplay      string
	City              *string
	State             *string
	SegmentName       *string
}

// ReleaseStale puts messages abandoned mid-flight back in line. The bridge
// gets killed with Ctrl-C like any local process, and a dispatch stuck in
// 'sending' would otherwise hold that contact hostage forever — the unique
// index counts 'sending' as occupied.
func (r *WhatsAppRepo) ReleaseStale(ctx context.Context, olderThan time.Duration) (int, error) {
	tag, err := r.DB(ctx).Exec(ctx, `
		UPDATE message_dispatches
		   SET status = 'queued', updated_at = now()
		 WHERE channel = 'whatsapp' AND status = 'sending'
		   AND updated_at < now() - make_interval(secs => $1)`, olderThan.Seconds())
	if err != nil {
		return 0, TranslateError(err)
	}
	return int(tag.RowsAffected()), nil
}

// ClaimNext hands out exactly one message. SKIP LOCKED is what makes a second
// bridge (or a stray retry) take a different row instead of the same one.
func (r *WhatsAppRepo) ClaimNext(ctx context.Context) (*Job, error) {
	var j Job
	err := r.DB(ctx).QueryRow(ctx, `
		WITH claimed AS (
			UPDATE message_dispatches
			   SET status = 'sending', updated_at = now()
			 WHERE id = (
			       SELECT id FROM message_dispatches
			        WHERE status = 'queued' AND channel = 'whatsapp'
			        ORDER BY created_at
			        FOR UPDATE SKIP LOCKED
			        LIMIT 1)
			RETURNING id, contact_point_id, lead_id, company_id, template_version_id
		)
		SELECT c.id, c.contact_point_id, c.lead_id, c.company_id, c.template_version_id,
		       COALESCE(co.trade_name, 'Empresa'), cp.phone_e164, cp.phone_display,
		       co.city, co.state, s.name
		  FROM claimed c
		  JOIN contact_points cp ON cp.id = c.contact_point_id
		  LEFT JOIN companies co ON co.id = c.company_id
		  LEFT JOIN segments s   ON s.id = co.segment_id`).
		Scan(&j.DispatchID, &j.ContactPointID, &j.LeadID, &j.CompanyID,
			&j.TemplateVersionID, &j.CompanyName, &j.PhoneE164, &j.PhoneDisplay,
			&j.City, &j.State, &j.SegmentName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, TranslateError(err)
	}
	return &j, nil
}

// ClaimedJob reloads a dispatch the bridge is reporting back on. The bridge
// sends only an id and an outcome — who that id belongs to is read from the
// database, never trusted from the request body.
func (r *WhatsAppRepo) ClaimedJob(ctx context.Context, dispatchID uuid.UUID) (*Job, error) {
	var j Job
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT d.id, d.contact_point_id, d.lead_id, d.company_id, d.template_version_id,
		       COALESCE(co.trade_name, 'Empresa'), cp.phone_e164, cp.phone_display,
		       co.city, co.state, s.name
		  FROM message_dispatches d
		  JOIN contact_points cp ON cp.id = d.contact_point_id
		  LEFT JOIN companies co ON co.id = d.company_id
		  LEFT JOIN segments s   ON s.id = co.segment_id
		 WHERE d.id = $1 AND d.channel = 'whatsapp' AND d.status = 'sending'`, dispatchID).
		Scan(&j.DispatchID, &j.ContactPointID, &j.LeadID, &j.CompanyID,
			&j.TemplateVersionID, &j.CompanyName, &j.PhoneE164, &j.PhoneDisplay,
			&j.City, &j.State, &j.SegmentName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.NotFound("envio em andamento")
		}
		return nil, TranslateError(err)
	}
	return &j, nil
}

// MarkSent is the only place an automated WhatsApp message becomes history,
// and it writes the same contact_event the email path does — the ✓ Enviado
// badge stays a consequence of the event, never of a flag.
func (r *WhatsAppRepo) MarkSent(ctx context.Context, job Job, body, providerMessageID string, snapshot map[string]any) error {
	return r.WithTx(ctx, func(ctx context.Context) error {
		tag, err := r.DB(ctx).Exec(ctx, `
			UPDATE message_dispatches
			   SET status = 'sent', sent_at = now(), rendered_body = $2,
			       rendered_at = now(), provider_message_id = $3, updated_at = now()
			 WHERE id = $1 AND status = 'sending'`,
			job.DispatchID, body, providerMessageID)
		if err != nil {
			return TranslateError(err)
		}
		if tag.RowsAffected() == 0 {
			return domain.New(domain.CodeConflict, "este envio já foi finalizado")
		}

		snapshotJSON, _ := json.Marshal(snapshot)
		if _, err := r.DB(ctx).Exec(ctx, `
			INSERT INTO contact_events
				(contact_point_id, event_type, dispatch_id, lead_id, company_id,
				 template_version_id, snapshot)
			VALUES ($1, 'message_sent', $2, $3, $4, $5, $6)`,
			job.ContactPointID, job.DispatchID, job.LeadID, job.CompanyID,
			job.TemplateVersionID, snapshotJSON); err != nil {
			return TranslateError(err)
		}

		if job.LeadID != nil {
			if _, err := r.DB(ctx).Exec(ctx, `
				UPDATE leads
				   SET last_interaction_at = now(),
				       status = CASE WHEN status = 'new' THEN 'contacted'::lead_status ELSE status END,
				       updated_at = now()
				 WHERE id = $1`, *job.LeadID); err != nil {
				return TranslateError(err)
			}
		}

		_, err = r.DB(ctx).Exec(ctx,
			`UPDATE whatsapp_agent_state SET last_sent_at = now() WHERE id = 1`)
		return TranslateError(err)
	})
}

// MarkFailed releases the contact: nothing arrived, so it stays contactable.
func (r *WhatsAppRepo) MarkFailed(ctx context.Context, dispatchID uuid.UUID, code, message string) error {
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE message_dispatches
		   SET status = 'failed', failed_at = now(), error_code = $2,
		       error_message = $3, updated_at = now()
		 WHERE id = $1 AND status = 'sending'`, dispatchID, code, message)
	return TranslateError(err)
}
