-- The duplicate-send guarantee must cover 'opened' too: without this, opening
-- WhatsApp for the same contact twice (two tabs, a refresh before confirming)
-- would not be blocked by the unique indexes the way 'reserved'/'sending'/
-- 'sent' already are.
DROP INDEX IF EXISTS message_dispatches_contact_attempt_unique;
DROP INDEX IF EXISTS message_dispatches_first_contact_unique;

CREATE UNIQUE INDEX message_dispatches_contact_attempt_unique
  ON message_dispatches (contact_point_id, attempt_seq)
  WHERE status IN ('reserved', 'sending', 'opened', 'sent');

CREATE UNIQUE INDEX message_dispatches_first_contact_unique
  ON message_dispatches (contact_point_id)
  WHERE attempt_seq = 1 AND status IN ('reserved', 'sending', 'opened', 'sent');
