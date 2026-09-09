-- Two-step outreach: the first touch is an email, and a business that never
-- answers gets a second, hand-sent WhatsApp message later.
--
-- That second touch is NOT an accidental double contact, so it must not be
-- blocked by the duplicate guarantee — but a second WhatsApp message to the
-- same business still must be. The fix is to make the guarantee per channel
-- instead of per contact: email attempt 1 and whatsapp attempt 1 can coexist,
-- two of either cannot.
ALTER TABLE message_dispatches
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';

DROP INDEX IF EXISTS message_dispatches_contact_attempt_unique;
DROP INDEX IF EXISTS message_dispatches_first_contact_unique;

CREATE UNIQUE INDEX message_dispatches_contact_attempt_unique
  ON message_dispatches (contact_point_id, channel, attempt_seq)
  WHERE status IN ('reserved', 'sending', 'opened', 'sent');

CREATE UNIQUE INDEX message_dispatches_first_contact_unique
  ON message_dispatches (contact_point_id, channel)
  WHERE attempt_seq = 1 AND status IN ('reserved', 'sending', 'opened', 'sent');

-- awaiting_reply is the middle of the funnel: emailed, still silent, and not
-- yet followed up on WhatsApp. Everything is derived from the append-only
-- history — there is no boolean anywhere saying "waiting", so deleting and
-- reimporting a lead cannot lose or fake this state.
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
     AND d.status IN ('opened', 'sent')
   LIMIT 1
) wa ON true
LEFT JOIN LATERAL (
  SELECT e.id FROM contact_events e
   WHERE e.contact_point_id = cp.id
     AND e.event_type = 'replied'
   LIMIT 1
) replied ON true
WHERE first_email.id IS NOT NULL;
