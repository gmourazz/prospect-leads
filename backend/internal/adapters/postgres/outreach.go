package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/domain"
)

type OutreachRepo struct{ *Store }

func NewOutreachRepo(s *Store) *OutreachRepo { return &OutreachRepo{s} }

func (r *OutreachRepo) CreateCampaign(ctx context.Context, name string, templateVersionID uuid.UUID, segmentID *uuid.UUID, filters map[string]any, batchSize int, by uuid.UUID) (uuid.UUID, error) {
	snapshot, _ := json.Marshal(filters)
	var id uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO campaigns (name, template_version_id, segment_id, filter_snapshot, batch_size, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`, name, templateVersionID, segmentID, snapshot, batchSize, by).Scan(&id)
	if err != nil {
		return uuid.Nil, TranslateError(err)
	}
	return id, nil
}

type TargetInput struct {
	ContactPointID uuid.UUID
	LeadID         uuid.UUID
	CompanyID      uuid.UUID
	RenderVars     map[string]string
}

// AddTargets classifies every candidate at selection time. Already-contacted
// and suppressed contacts enter the campaign as `excluded` rather than being
// silently dropped, so the UI can explain the 100 → 80 gap.
func (r *OutreachRepo) AddTargets(ctx context.Context, campaignID uuid.UUID, targets []TargetInput) error {
	for _, t := range targets {
		vars, _ := json.Marshal(t.RenderVars)
		_, err := r.DB(ctx).Exec(ctx, `
			INSERT INTO campaign_targets
				(campaign_id, contact_point_id, lead_id, company_id, render_vars, state, excluded_reason)
			SELECT $1, $2, $3, $4, $5,
			       CASE
			         WHEN sup.id IS NOT NULL THEN 'excluded'
			         WHEN EXISTS (SELECT 1 FROM message_dispatches d
			                       WHERE d.contact_point_id = $2
			                         AND d.channel = 'email'
			                         AND d.status IN ('reserved','sending','opened','sent'))
			           THEN 'excluded'
			         WHEN cp.email IS NULL THEN 'excluded'
			         ELSE 'pending' END,
			       CASE
			         WHEN sup.id IS NOT NULL THEN 'suppressed'
			         WHEN EXISTS (SELECT 1 FROM message_dispatches d
			                       WHERE d.contact_point_id = $2
			                         AND d.channel = 'email'
			                         AND d.status IN ('reserved','sending','opened','sent'))
			           THEN 'already_contacted'
			         WHEN cp.email IS NULL THEN 'no_email'
			         ELSE NULL END
			  FROM contact_points cp
			  LEFT JOIN suppressions sup
			         ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
			 WHERE cp.id = $2
			ON CONFLICT (campaign_id, contact_point_id) DO NOTHING`,
			campaignID, t.ContactPointID, t.LeadID, t.CompanyID, vars)
		if err != nil {
			return TranslateError(err)
		}
	}
	return nil
}

func (r *OutreachRepo) Progress(ctx context.Context, campaignID uuid.UUID) (domain.CampaignProgress, error) {
	var p domain.CampaignProgress
	p.ExcludedBreakdown = map[string]int{}

	err := r.DB(ctx).QueryRow(ctx, `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE state = 'pending'),
		       COUNT(*) FILTER (WHERE state = 'sent'),
		       COUNT(*) FILTER (WHERE state = 'failed'),
		       COUNT(*) FILTER (WHERE state = 'excluded')
		  FROM campaign_targets WHERE campaign_id = $1`, campaignID).
		Scan(&p.TotalTargets, &p.Pending, &p.Sent, &p.Failed, &p.Excluded)
	if err != nil {
		return p, TranslateError(err)
	}

	rows, err := r.DB(ctx).Query(ctx, `
		SELECT COALESCE(excluded_reason, 'other'), COUNT(*)
		  FROM campaign_targets
		 WHERE campaign_id = $1 AND state = 'excluded'
		 GROUP BY 1`, campaignID)
	if err != nil {
		return p, TranslateError(err)
	}
	defer rows.Close()
	for rows.Next() {
		var reason string
		var n int
		if err := rows.Scan(&reason, &n); err != nil {
			return p, TranslateError(err)
		}
		p.ExcludedBreakdown[reason] = n
	}
	return p, rows.Err()
}

// CountSentToday backs the daily send cap: it counts across every campaign,
// not just the one being sent, because the limit protects the sender
// reputation as a whole, not one campaign's quota.
func (r *OutreachRepo) CountSentToday(ctx context.Context) (int, error) {
	var n int
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FROM message_dispatches
		 WHERE status = 'sent' AND sent_at >= date_trunc('day', now())`).Scan(&n)
	if err != nil {
		return 0, TranslateError(err)
	}
	return n, nil
}

func (r *OutreachRepo) ListCampaigns(ctx context.Context) ([]domain.Campaign, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT c.id, c.name, c.status, c.template_version_id,
		       COALESCE(t.name, 'Template removido'), c.batch_size, c.created_at
		  FROM campaigns c
		  LEFT JOIN message_template_versions v ON v.id = c.template_version_id
		  LEFT JOIN message_templates t ON t.id = v.template_id
		 ORDER BY c.created_at DESC`)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []domain.Campaign{}
	for rows.Next() {
		var c domain.Campaign
		if err := rows.Scan(&c.ID, &c.Name, &c.Status, &c.TemplateVersionID,
			&c.TemplateName, &c.BatchSize, &c.CreatedAt); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, TranslateError(err)
	}
	for i := range out {
		p, err := r.Progress(ctx, out[i].ID)
		if err != nil {
			return nil, err
		}
		out[i].Progress = p
	}
	return out, nil
}

func (r *OutreachRepo) GetCampaign(ctx context.Context, id uuid.UUID) (domain.Campaign, error) {
	var c domain.Campaign
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT c.id, c.name, c.status, c.template_version_id,
		       COALESCE(t.name, 'Template removido'), c.batch_size, c.created_at
		  FROM campaigns c
		  LEFT JOIN message_template_versions v ON v.id = c.template_version_id
		  LEFT JOIN message_templates t ON t.id = v.template_id
		 WHERE c.id = $1`, id).
		Scan(&c.ID, &c.Name, &c.Status, &c.TemplateVersionID,
			&c.TemplateName, &c.BatchSize, &c.CreatedAt)
	if err != nil {
		return c, TranslateError(err)
	}
	p, err := r.Progress(ctx, id)
	if err != nil {
		return c, err
	}
	c.Progress = p
	return c, nil
}

func (r *OutreachRepo) ListTargets(ctx context.Context, campaignID uuid.UUID, state string, limit int) ([]domain.CampaignTarget, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT ct.id, ct.contact_point_id, ct.lead_id, ct.company_id,
		       COALESCE(co.trade_name, 'Empresa removida'), cp.phone_display, cp.email,
		       co.city, co.state, s.name, ct.state, ct.excluded_reason, ct.render_vars
		  FROM campaign_targets ct
		  JOIN contact_points cp ON cp.id = ct.contact_point_id
		  LEFT JOIN companies co ON co.id = ct.company_id
		  LEFT JOIN segments s ON s.id = co.segment_id
		 WHERE ct.campaign_id = $1
		   AND ($2 = '' OR ct.state = $2)
		 ORDER BY ct.added_at
		 LIMIT $3`, campaignID, state, limit)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []domain.CampaignTarget{}
	for rows.Next() {
		var t domain.CampaignTarget
		var vars []byte
		if err := rows.Scan(&t.ID, &t.ContactPointID, &t.LeadID, &t.CompanyID,
			&t.CompanyName, &t.PhoneDisplay, &t.Email, &t.City, &t.State, &t.SegmentName,
			&t.State_, &t.ExcludedReason, &vars); err != nil {
			return nil, TranslateError(err)
		}
		_ = json.Unmarshal(vars, &t.RenderVars)
		out = append(out, t)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------- batches

func (r *OutreachRepo) CreateBatch(ctx context.Context, campaignID uuid.UUID, size int, idempotencyKey string, isRecontact bool, by uuid.UUID) (domain.Batch, error) {
	var b domain.Batch
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO dispatch_batches
			(campaign_id, sequence_no, requested_size, idempotency_key, is_recontact, created_by, status)
		VALUES ($1,
		        (SELECT COALESCE(MAX(sequence_no), 0) + 1
		           FROM dispatch_batches WHERE campaign_id = $1),
		        $2, $3, $4, $5, 'reserving')
		RETURNING id, campaign_id, sequence_no, requested_size, reserved_count,
		          sent_count, failed_count, status::text, is_recontact, created_at, finished_at`,
		campaignID, size, idempotencyKey, isRecontact, by).
		Scan(&b.ID, &b.CampaignID, &b.SequenceNo, &b.RequestedSize, &b.ReservedCount,
			&b.SentCount, &b.FailedCount, &b.Status, &b.IsRecontact, &b.CreatedAt, &b.FinishedAt)
	if err != nil {
		return b, TranslateError(err)
	}
	return b, nil
}

type Reservation struct {
	DispatchID     uuid.UUID
	TargetID       uuid.UUID
	ContactPointID uuid.UUID
	LeadID         *uuid.UUID
	CompanyID      *uuid.UUID
	CompanyName    string
	// Emails is every known address for this contact — the message goes to
	// all of them in one send, so one dead inbox doesn't waste the contact.
	Emails       []string
	PhoneDisplay string
	RenderVars   map[string]string
}

// Reserve is the heart of the duplicate-send guarantee.
//
//   - FOR UPDATE ... SKIP LOCKED makes two concurrent requests take DISJOINT
//     sets of targets instead of deadlocking or waiting.
//   - ON CONFLICT DO NOTHING turns a lost race into "I reserved fewer than
//     asked", which is a correct outcome, not an error.
//   - The partial unique index on message_dispatches is what actually makes a
//     second first-contact impossible, even across campaigns and processes.
//
// Reservation happens BEFORE sending: if anything fails afterwards we would
// rather not send than send twice.
func (r *OutreachRepo) Reserve(ctx context.Context, campaignID, batchID, templateVersionID uuid.UUID, size int) ([]Reservation, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		WITH eligible AS (
			SELECT ct.id AS target_id, ct.contact_point_id, ct.lead_id,
			       ct.company_id, ct.render_vars
			  FROM campaign_targets ct
			  JOIN contact_points cp ON cp.id = ct.contact_point_id
			  LEFT JOIN suppressions sup
			         ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
			 WHERE ct.campaign_id = $1
			   AND ct.state = 'pending'
			   AND sup.id IS NULL
			   AND cp.email IS NOT NULL
			   AND NOT EXISTS (
			         SELECT 1 FROM message_dispatches d
			          WHERE d.contact_point_id = cp.id
			            AND d.channel = 'email'
			            AND d.status IN ('reserved', 'sending', 'opened', 'sent'))
			 ORDER BY ct.added_at
			 FOR UPDATE OF ct SKIP LOCKED
			 LIMIT $2
		), inserted AS (
			INSERT INTO message_dispatches
				(contact_point_id, lead_id, company_id, campaign_id, batch_id,
				 campaign_target_id, template_version_id, attempt_seq, status)
			SELECT contact_point_id, lead_id, company_id, $1, $3, target_id, $4, 1, 'reserved'
			  FROM eligible
			ON CONFLICT DO NOTHING
			RETURNING id, contact_point_id, campaign_target_id, lead_id, company_id
		)
		SELECT i.id, i.campaign_target_id, i.contact_point_id, i.lead_id, i.company_id,
		       COALESCE(co.trade_name, 'Empresa'),
		       COALESCE((SELECT array_agg(e.email ORDER BY e.is_primary DESC, e.discovered_at)
		                   FROM contact_point_emails e
		                  WHERE e.contact_point_id = cp.id), ARRAY[cp.email]),
		       cp.phone_display, ct.render_vars
		  FROM inserted i
		  JOIN contact_points cp ON cp.id = i.contact_point_id
		  JOIN campaign_targets ct ON ct.id = i.campaign_target_id
		  LEFT JOIN companies co ON co.id = i.company_id`,
		campaignID, size, batchID, templateVersionID)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []Reservation{}
	for rows.Next() {
		var res Reservation
		var vars []byte
		if err := rows.Scan(&res.DispatchID, &res.TargetID, &res.ContactPointID,
			&res.LeadID, &res.CompanyID, &res.CompanyName, &res.Emails,
			&res.PhoneDisplay, &vars); err != nil {
			return nil, TranslateError(err)
		}
		_ = json.Unmarshal(vars, &res.RenderVars)
		out = append(out, res)
	}
	if err := rows.Err(); err != nil {
		return nil, TranslateError(err)
	}

	if len(out) > 0 {
		targetIDs := make([]uuid.UUID, len(out))
		for i, res := range out {
			targetIDs[i] = res.TargetID
		}
		if _, err := r.DB(ctx).Exec(ctx,
			`UPDATE campaign_targets SET state = 'reserved' WHERE id = ANY($1)`,
			targetIDs); err != nil {
			return nil, TranslateError(err)
		}
	}

	if _, err := r.DB(ctx).Exec(ctx, `
		UPDATE dispatch_batches
		   SET reserved_count = $2, status = 'ready', started_at = now()
		 WHERE id = $1`, batchID, len(out)); err != nil {
		return nil, TranslateError(err)
	}
	return out, nil
}

// MarkSent closes the loop: the dispatch becomes 'sent' AND the append-only
// history gets its event. The ✓ Enviado badge is a consequence of that event,
// never of a flag on the lead.
func (r *OutreachRepo) MarkSent(ctx context.Context, res Reservation, body, provider, providerMessageID string, campaignID, templateVersionID uuid.UUID, snapshot map[string]any) error {
	return r.WithTx(ctx, func(ctx context.Context) error {
		if _, err := r.DB(ctx).Exec(ctx, `
			UPDATE message_dispatches
			   SET status = 'sent', sent_at = now(), rendered_body = $2,
			       rendered_at = now(), provider = $3, provider_message_id = $4,
			       updated_at = now()
			 WHERE id = $1`, res.DispatchID, body, provider, providerMessageID); err != nil {
			return TranslateError(err)
		}
		if _, err := r.DB(ctx).Exec(ctx,
			`UPDATE campaign_targets SET state = 'sent' WHERE id = $1`, res.TargetID); err != nil {
			return TranslateError(err)
		}
		snapshotJSON, _ := json.Marshal(snapshot)
		if _, err := r.DB(ctx).Exec(ctx, `
			INSERT INTO contact_events
				(contact_point_id, event_type, dispatch_id, lead_id, company_id,
				 campaign_id, template_version_id, snapshot)
			VALUES ($1, 'message_sent', $2, $3, $4, $5, $6, $7)`,
			res.ContactPointID, res.DispatchID, res.LeadID, res.CompanyID,
			campaignID, templateVersionID, snapshotJSON); err != nil {
			return TranslateError(err)
		}
		if res.LeadID != nil {
			if _, err := r.DB(ctx).Exec(ctx, `
				UPDATE leads
				   SET last_interaction_at = now(),
				       status = CASE WHEN status = 'new' THEN 'contacted'::lead_status ELSE status END,
				       updated_at = now()
				 WHERE id = $1`, *res.LeadID); err != nil {
				return TranslateError(err)
			}
		}
		return nil
	})
}

// MarkFailed releases the reservation. A failed dispatch leaves the partial
// unique index, so the contact becomes eligible again — no recontact approval
// needed, because the message never arrived.
func (r *OutreachRepo) MarkFailed(ctx context.Context, res Reservation, code, message string) error {
	return r.WithTx(ctx, func(ctx context.Context) error {
		if _, err := r.DB(ctx).Exec(ctx, `
			UPDATE message_dispatches
			   SET status = 'failed', failed_at = now(),
			       error_code = $2, error_message = $3, updated_at = now()
			 WHERE id = $1`, res.DispatchID, code, message); err != nil {
			return TranslateError(err)
		}
		_, err := r.DB(ctx).Exec(ctx,
			`UPDATE campaign_targets SET state = 'pending' WHERE id = $1`, res.TargetID)
		return TranslateError(err)
	})
}

func (r *OutreachRepo) FinishBatch(ctx context.Context, batchID uuid.UUID, sent, failed int) (domain.Batch, error) {
	status := "completed"
	switch {
	case sent == 0 && failed > 0:
		status = "failed"
	case failed > 0:
		status = "partially_failed"
	}

	var b domain.Batch
	err := r.DB(ctx).QueryRow(ctx, `
		UPDATE dispatch_batches
		   SET sent_count = $2, failed_count = $3,
		       status = $4::batch_status, finished_at = now()
		 WHERE id = $1
		RETURNING id, campaign_id, sequence_no, requested_size, reserved_count,
		          sent_count, failed_count, status::text, is_recontact, created_at, finished_at`,
		batchID, sent, failed, status).
		Scan(&b.ID, &b.CampaignID, &b.SequenceNo, &b.RequestedSize, &b.ReservedCount,
			&b.SentCount, &b.FailedCount, &b.Status, &b.IsRecontact, &b.CreatedAt, &b.FinishedAt)
	if err != nil {
		return b, TranslateError(err)
	}
	return b, nil
}

func (r *OutreachRepo) ListBatches(ctx context.Context, campaignID uuid.UUID) ([]domain.Batch, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT id, campaign_id, sequence_no, requested_size, reserved_count,
		       sent_count, failed_count, status::text, is_recontact, created_at, finished_at
		  FROM dispatch_batches
		 WHERE campaign_id = $1
		 ORDER BY sequence_no DESC`, campaignID)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []domain.Batch{}
	for rows.Next() {
		var b domain.Batch
		if err := rows.Scan(&b.ID, &b.CampaignID, &b.SequenceNo, &b.RequestedSize,
			&b.ReservedCount, &b.SentCount, &b.FailedCount, &b.Status,
			&b.IsRecontact, &b.CreatedAt, &b.FinishedAt); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// SetCampaignStatus pauses or resumes a campaign. Pausing changes nothing
// about what was already sent — it only stops the campaign from showing up
// as a place to send the next batch from.
func (r *OutreachRepo) SetCampaignStatus(ctx context.Context, id uuid.UUID, status string) error {
	tag, err := r.DB(ctx).Exec(ctx,
		`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, id, status)
	if err != nil {
		return TranslateError(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("campanha")
	}
	return nil
}

// DeleteCampaign removes a campaign and its target list. The dispatches and
// contact_events it produced are NOT deleted — "já enviei pra esse contato"
// has to survive the campaign that sent it, exactly like it survives the
// lead being deleted. Their campaign_id simply becomes null.
func (r *OutreachRepo) DeleteCampaign(ctx context.Context, id uuid.UUID) error {
	return r.WithTx(ctx, func(ctx context.Context) error {
		if _, err := r.DB(ctx).Exec(ctx,
			`UPDATE message_dispatches SET campaign_id = NULL, campaign_target_id = NULL, batch_id = NULL
			  WHERE campaign_id = $1`, id); err != nil {
			return TranslateError(err)
		}
		if _, err := r.DB(ctx).Exec(ctx,
			`DELETE FROM campaign_targets WHERE campaign_id = $1`, id); err != nil {
			return TranslateError(err)
		}
		if _, err := r.DB(ctx).Exec(ctx,
			`DELETE FROM dispatch_batches WHERE campaign_id = $1`, id); err != nil {
			return TranslateError(err)
		}
		tag, err := r.DB(ctx).Exec(ctx, `DELETE FROM campaigns WHERE id = $1`, id)
		if err != nil {
			return TranslateError(err)
		}
		if tag.RowsAffected() == 0 {
			return domain.NotFound("campanha")
		}
		return nil
	})
}

// ------------------------------------------------------------- recontact

func (r *OutreachRepo) CreateRecontactApproval(ctx context.Context, contactPointID uuid.UUID, reason string, by uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO recontact_approvals (contact_point_id, reason, approved_by)
		VALUES ($1, $2, $3) RETURNING id`, contactPointID, reason, by).Scan(&id)
	if err != nil {
		return uuid.Nil, TranslateError(err)
	}
	return id, nil
}

// ReserveRecontact requires a valid, unconsumed approval per contact. The CHECK
// constraint on message_dispatches rejects any attempt_seq > 1 without one, so
// this path cannot be bypassed by a bug elsewhere.
func (r *OutreachRepo) ReserveRecontact(ctx context.Context, campaignID, batchID, templateVersionID uuid.UUID, approvalIDs []uuid.UUID) ([]Reservation, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		WITH approvals AS (
			SELECT ra.id AS approval_id, ra.contact_point_id
			  FROM recontact_approvals ra
			 WHERE ra.id = ANY($4)
			   AND ra.consumed_at IS NULL
			   AND ra.expires_at > now()
			 FOR UPDATE OF ra SKIP LOCKED
		), targets AS (
			SELECT a.approval_id, a.contact_point_id, ct.id AS target_id,
			       ct.lead_id, ct.company_id
			  FROM approvals a
			  JOIN campaign_targets ct
			    ON ct.campaign_id = $1 AND ct.contact_point_id = a.contact_point_id
			  JOIN contact_points cp ON cp.id = a.contact_point_id
			  LEFT JOIN suppressions sup
			         ON sup.contact_point_id = a.contact_point_id AND sup.revoked_at IS NULL
			 WHERE sup.id IS NULL AND cp.email IS NOT NULL
		), inserted AS (
			INSERT INTO message_dispatches
				(contact_point_id, lead_id, company_id, campaign_id, batch_id,
				 campaign_target_id, template_version_id, attempt_seq,
				 recontact_approval_id, status)
			SELECT t.contact_point_id, t.lead_id, t.company_id, $1, $2, t.target_id, $3,
			       (SELECT COALESCE(MAX(d.attempt_seq), 0) + 1
			          FROM message_dispatches d
			         WHERE d.contact_point_id = t.contact_point_id),
			       t.approval_id, 'reserved'
			  FROM targets t
			ON CONFLICT DO NOTHING
			RETURNING id, contact_point_id, campaign_target_id, lead_id, company_id,
			          recontact_approval_id
		), consumed AS (
			UPDATE recontact_approvals ra
			   SET consumed_at = now()
			  FROM inserted i
			 WHERE ra.id = i.recontact_approval_id
			RETURNING ra.id
		)
		SELECT i.id, i.campaign_target_id, i.contact_point_id, i.lead_id, i.company_id,
		       COALESCE(co.trade_name, 'Empresa'),
		       COALESCE((SELECT array_agg(e.email ORDER BY e.is_primary DESC, e.discovered_at)
		                   FROM contact_point_emails e
		                  WHERE e.contact_point_id = cp.id), ARRAY[cp.email]),
		       cp.phone_display, ct.render_vars
		  FROM inserted i
		  JOIN contact_points cp ON cp.id = i.contact_point_id
		  JOIN campaign_targets ct ON ct.id = i.campaign_target_id
		  LEFT JOIN companies co ON co.id = i.company_id`,
		campaignID, batchID, templateVersionID, approvalIDs)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []Reservation{}
	for rows.Next() {
		var res Reservation
		var vars []byte
		if err := rows.Scan(&res.DispatchID, &res.TargetID, &res.ContactPointID,
			&res.LeadID, &res.CompanyID, &res.CompanyName, &res.Emails,
			&res.PhoneDisplay, &vars); err != nil {
			return nil, TranslateError(err)
		}
		_ = json.Unmarshal(vars, &res.RenderVars)
		out = append(out, res)
	}
	if err := rows.Err(); err != nil {
		return nil, TranslateError(err)
	}

	if _, err := r.DB(ctx).Exec(ctx, `
		UPDATE dispatch_batches
		   SET reserved_count = $2, status = 'ready', started_at = now()
		 WHERE id = $1`, batchID, len(out)); err != nil {
		return nil, TranslateError(err)
	}
	return out, nil
}
