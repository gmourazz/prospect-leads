-- Reverses the decision recorded in 000015_email_channel, deliberately and
-- with the risk understood: WhatsApp sending is automated again, through a
-- local Baileys session (an unofficial WhatsApp Web client) instead of by
-- hand. The Cloud API was reconsidered and rejected a second time — cold
-- first-contact templates don't survive Meta's review.
--
-- What changed since 000015 is not the risk, it's the mitigation. Back then
-- the plan was "script WhatsApp Web and blast"; what lands here is a queue
-- the database paces: one message at a time, minutes apart, a hard daily
-- ceiling, a business-hours window, long pauses between bursts, and a kill
-- switch that trips the moment the session reports trouble. The agent starts
-- PAUSED and every default below is deliberately timid — this is the one
-- place in the product where being slow is the feature.
--
-- Nothing here removes the hand-sent path (000010's 'opened' flow). That
-- stays as the fallback for when the bridge isn't running.

-- ---------------------------------------------------------------- estado
-- Singleton row: there is exactly one WhatsApp number, so there is exactly
-- one agent. Its pacing state lives in the database rather than in the
-- bridge's memory so that restarting the bridge cannot reset a cooldown —
-- a crash loop must never turn into a burst.
CREATE TABLE whatsapp_agent_state (
  id                smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- offline | connecting | qr_required | connected | logged_out | blocked
  connection        text        NOT NULL DEFAULT 'offline',
  paused            boolean     NOT NULL DEFAULT true,
  pause_reason      text,
  -- The clock the whole thing hangs on: no message is handed out before this
  -- instant, and every send pushes it forward by a randomized interval.
  next_allowed_at   timestamptz NOT NULL DEFAULT now(),
  burst_count       int         NOT NULL DEFAULT 0,
  last_sent_at      timestamptz,
  last_heartbeat_at timestamptz,
  last_error        text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO whatsapp_agent_state (id, pause_reason)
VALUES (1, 'nunca iniciado')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------ pacing
-- Separate from the email rules in 000023 because the constraint is a
-- different kind: Gmail throttles, WhatsApp bans. The numbers below are a
-- cautious starting point for a number that has never sent cold outreach,
-- not a recommendation to raise them.
ALTER TABLE app_settings
  ADD COLUMN wa_daily_limit       int        NOT NULL DEFAULT 20,
  ADD COLUMN wa_min_interval_sec  int        NOT NULL DEFAULT 90,
  ADD COLUMN wa_max_interval_sec  int        NOT NULL DEFAULT 240,
  ADD COLUMN wa_burst_size        int        NOT NULL DEFAULT 5,
  ADD COLUMN wa_burst_pause_min   int        NOT NULL DEFAULT 25,
  ADD COLUMN wa_weekdays          smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN wa_hour_start        smallint   NOT NULL DEFAULT 9,
  ADD COLUMN wa_hour_end          smallint   NOT NULL DEFAULT 18,
  ADD CONSTRAINT app_settings_wa_valid CHECK (
        wa_daily_limit      > 0
    AND wa_min_interval_sec > 0
    AND wa_max_interval_sec >= wa_min_interval_sec
    AND wa_burst_size       > 0
    AND wa_burst_pause_min  >= 0
    AND wa_hour_start >= 0 AND wa_hour_start < 24
    AND wa_hour_end   >  0 AND wa_hour_end  <= 24
    AND wa_hour_start <  wa_hour_end);

-- ----------------------------------------------------------- a garantia
-- 'queued' joins the statuses that occupy a contact. Without this a queued
-- message would not block a second one, and the whole queue could double up
-- on the same business before the first message ever left.
DROP INDEX IF EXISTS message_dispatches_contact_attempt_unique;
DROP INDEX IF EXISTS message_dispatches_first_contact_unique;

CREATE UNIQUE INDEX message_dispatches_contact_attempt_unique
  ON message_dispatches (contact_point_id, channel, attempt_seq)
  WHERE status IN ('queued', 'reserved', 'sending', 'opened', 'sent');

CREATE UNIQUE INDEX message_dispatches_first_contact_unique
  ON message_dispatches (contact_point_id, channel)
  WHERE attempt_seq = 1 AND status IN ('queued', 'reserved', 'sending', 'opened', 'sent');

-- The claim query reads exactly this: oldest queued WhatsApp message first.
CREATE INDEX message_dispatches_wa_queue_idx
  ON message_dispatches (created_at)
  WHERE status = 'queued' AND channel = 'whatsapp';

-- Stale 'sending' rows are hunted on every claim (the bridge can be killed
-- mid-message), so that lookup gets its own index too.
CREATE INDEX message_dispatches_wa_sending_idx
  ON message_dispatches (updated_at)
  WHERE status = 'sending' AND channel = 'whatsapp';

-- ------------------------------------------------------------- lead_board
-- Identical to the view from 000016 except that 'queued' now counts as
-- occupying the contact, so a lead sitting in the WhatsApp queue stops
-- showing up as available.
DROP VIEW IF EXISTS lead_board;
CREATE VIEW lead_board AS
SELECT
  l.id                      AS lead_id,
  l.status                  AS lead_status,
  l.notes,
  l.collected_at,
  l.last_interaction_at,
  c.id                      AS company_id,
  c.trade_name              AS company_name,
  c.cnpj,
  c.city, c.state, c.city_key,
  c.website_status,
  c.opening_hours,
  business_is_open(c.opening_hours, now()) AS is_open_now,
  s.id AS segment_id, s.name AS segment_name, s.color AS segment_color,
  cp.id                     AS contact_point_id,
  cp.phone_display,
  cp.phone_e164,
  cp.email,
  COALESCE(
    (SELECT array_agg(e.email ORDER BY e.is_primary DESC, e.email)
       FROM contact_point_emails e
      WHERE e.contact_point_id = cp.id),
    '{}'
  )                         AS emails,
  cp.line_type,
  COALESCE(st.contact_count, 0)          AS contact_count,
  st.first_contacted_at,
  st.last_contacted_at,
  COALESCE(st.status, 'never_contacted') AS contact_state,
  (sup.id IS NOT NULL)                   AS is_suppressed,
  sup.reason                             AS suppression_reason,
  (
    cp.id IS NOT NULL
    AND cp.email IS NOT NULL
    AND sup.id IS NULL
    AND COALESCE(st.contact_count, 0) = 0
    AND NOT EXISTS (
      SELECT 1 FROM message_dispatches d
       WHERE d.contact_point_id = cp.id
         AND d.status IN ('queued', 'reserved', 'sending', 'opened', 'sent')
    )
  ) AS is_available
FROM leads l
JOIN companies c            ON c.id = l.company_id
LEFT JOIN segments s        ON s.id = COALESCE(l.segment_id, c.segment_id)
LEFT JOIN contact_points cp ON cp.id = l.primary_contact_point_id
LEFT JOIN contact_point_stats st ON st.contact_point_id = cp.id
LEFT JOIN suppressions sup  ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL;

-- lead_followup's whatsapp_sent means "this business already got its WhatsApp
-- touch"; a queued or in-flight one counts, otherwise the follow-up screen
-- would offer a second message to someone already in line for one.
CREATE OR REPLACE VIEW lead_followup AS
SELECT
  cp.id                                   AS contact_point_id,
  first_email.sent_at                     AS emailed_at,
  (now() - first_email.sent_at)           AS since_email,
  (wa.id IS NOT NULL)                     AS whatsapp_sent,
  (replied.id IS NOT NULL)                AS has_replied
FROM contact_points cp
LEFT JOIN LATERAL (
  SELECT d.id, d.sent_at
    FROM message_dispatches d
   WHERE d.contact_point_id = cp.id
     AND d.channel = 'email'
     AND d.status = 'sent'
   ORDER BY d.sent_at
   LIMIT 1
) first_email ON true
LEFT JOIN LATERAL (
  SELECT d.id FROM message_dispatches d
   WHERE d.contact_point_id = cp.id
     AND d.channel = 'whatsapp'
     AND d.status IN ('queued', 'sending', 'opened', 'sent')
   LIMIT 1
) wa ON true
LEFT JOIN LATERAL (
  SELECT e.id FROM contact_events e
   WHERE e.contact_point_id = cp.id
     AND e.event_type = 'replied'
   LIMIT 1
) replied ON true
WHERE first_email.id IS NOT NULL;
