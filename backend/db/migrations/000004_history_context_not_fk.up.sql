-- Two guarantees collided: contact_events is append-only (a BEFORE UPDATE
-- trigger raises), while lead_id/company_id/campaign_id were declared
-- ON DELETE SET NULL. Deleting a lead therefore asked Postgres to UPDATE an
-- immutable row, and the whole delete failed — blocking the exact workflow the
-- product is built around ("apago tudo e recoleto").
--
-- Immutability is the stronger guarantee, so the historical context columns
-- stop being foreign keys and become plain references. They may point at rows
-- that no longer exist; that is intentional, and the snapshot jsonb on every
-- event is what keeps the timeline readable ("mensagem enviada para Barbearia
-- Imperial") after the lead is gone.
--
-- contact_point_id keeps its FK with ON DELETE RESTRICT: it is the anchor of
-- the entire history and must never dangle.

ALTER TABLE contact_events DROP CONSTRAINT IF EXISTS contact_events_lead_id_fkey;
ALTER TABLE contact_events DROP CONSTRAINT IF EXISTS contact_events_company_id_fkey;
ALTER TABLE contact_events DROP CONSTRAINT IF EXISTS contact_events_campaign_id_fkey;
ALTER TABLE contact_events DROP CONSTRAINT IF EXISTS contact_events_dispatch_id_fkey;
ALTER TABLE contact_events DROP CONSTRAINT IF EXISTS contact_events_template_version_id_fkey;
ALTER TABLE contact_events DROP CONSTRAINT IF EXISTS contact_events_created_by_fkey;

COMMENT ON COLUMN contact_events.lead_id IS
  'Historical reference, intentionally not a foreign key: the event outlives the lead.';
COMMENT ON COLUMN contact_events.company_id IS
  'Historical reference, intentionally not a foreign key: the event outlives the company.';
COMMENT ON COLUMN contact_events.snapshot IS
  'Denormalized context so the timeline stays readable after leads/companies are deleted.';

-- message_dispatches keeps its FKs (it is mutable), but its historical value
-- deserves the same protection, so it also carries the company name it used.
ALTER TABLE message_dispatches
  ADD COLUMN IF NOT EXISTS company_name_snapshot text;
