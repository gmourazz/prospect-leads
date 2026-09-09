-- =====================================================================
-- Prospect — schema inicial
-- Regra central: contact_points é a raiz imortal. Nada que aponte para
-- ela pode cascatear deleção. O histórico sobrevive a tudo.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------------- tipos
CREATE TYPE lead_status AS ENUM (
  'new', 'qualified', 'contacted', 'replied', 'interested',
  'negotiating', 'customer', 'not_interested', 'lost', 'archived'
);

CREATE TYPE contact_status AS ENUM (
  'never_contacted', 'contacted', 'replied', 'opted_out', 'blocked'
);

CREATE TYPE website_status AS ENUM (
  'has_website', 'no_website', 'unknown', 'review_required'
);

CREATE TYPE web_presence_kind AS ENUM (
  'own_site', 'instagram', 'facebook', 'linktree', 'marketplace',
  'whatsapp_link', 'google_business', 'other'
);

CREATE TYPE contact_channel AS ENUM ('whatsapp', 'phone', 'email');

CREATE TYPE dispatch_status AS ENUM (
  'reserved', 'sending', 'sent', 'failed', 'canceled', 'skipped'
);

CREATE TYPE batch_status AS ENUM (
  'reserving', 'ready', 'running', 'completed', 'partially_failed',
  'failed', 'canceled'
);

CREATE TYPE contact_event_type AS ENUM (
  'message_sent', 'message_failed', 'replied', 'call_made',
  'meeting_scheduled', 'opted_out', 'manual_note', 'imported_seen'
);

-- ---------------------------------------------------------------- base
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  name          text   NOT NULL,
  password_hash text   NOT NULL DEFAULT '',
  role          text   NOT NULL DEFAULT 'owner',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE segments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        citext NOT NULL UNIQUE,
  name        text   NOT NULL,
  parent_id   uuid REFERENCES segments(id) ON DELETE SET NULL,
  color       text,
  icon        text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        citext NOT NULL UNIQUE,
  name        text   NOT NULL,
  kind        text   NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------- contatos (imortais)
CREATE TABLE contact_points (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel               contact_channel NOT NULL DEFAULT 'whatsapp',
  phone_e164            text NOT NULL,
  phone_raw             text,
  phone_display         text NOT NULL,
  country_code          text NOT NULL DEFAULT '55',
  area_code             text,
  line_type             text NOT NULL DEFAULT 'unknown',
  is_whatsapp_verified  boolean NOT NULL DEFAULT false,
  normalization_version int NOT NULL DEFAULT 1,
  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_points_e164_format CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE UNIQUE INDEX contact_points_phone_e164_key ON contact_points (phone_e164);
CREATE INDEX contact_points_area_code_idx ON contact_points (area_code);

CREATE TABLE contact_point_aliases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id uuid NOT NULL REFERENCES contact_points(id) ON DELETE CASCADE,
  alias_e164       text NOT NULL,
  reason           text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contact_point_aliases_alias_key ON contact_point_aliases (alias_e164);

CREATE TABLE contact_point_stats (
  contact_point_id    uuid PRIMARY KEY REFERENCES contact_points(id) ON DELETE CASCADE,
  contact_count       int  NOT NULL DEFAULT 0,
  first_contacted_at  timestamptz,
  last_contacted_at   timestamptz,
  last_event_type     contact_event_type,
  last_event_at       timestamptz,
  reply_count         int  NOT NULL DEFAULT 0,
  status              contact_status NOT NULL DEFAULT 'never_contacted',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_point_stats_status_idx ON contact_point_stats (status);
CREATE INDEX contact_point_stats_last_contacted_idx
  ON contact_point_stats (last_contacted_at DESC NULLS LAST);

CREATE TABLE suppressions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id uuid NOT NULL REFERENCES contact_points(id) ON DELETE CASCADE,
  reason           text NOT NULL,
  note             text,
  source           text NOT NULL DEFAULT 'manual',
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz,
  revoked_by       uuid REFERENCES users(id),
  revoke_reason    text
);

CREATE UNIQUE INDEX suppressions_active_unique
  ON suppressions (contact_point_id) WHERE revoked_at IS NULL;

-- ------------------------------------------------------- empresas/leads
CREATE TABLE companies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name         text,
  trade_name         text NOT NULL,
  name_key           text NOT NULL,
  cnpj               text,
  segment_id         uuid REFERENCES segments(id) ON DELETE SET NULL,
  city               text,
  city_key           text NOT NULL DEFAULT '',
  state              char(2),
  neighborhood       text,
  postal_code        text,
  address_line       text,
  latitude           numeric(10,7),
  longitude          numeric(10,7),
  website_status     website_status NOT NULL DEFAULT 'unknown',
  website_checked_at timestamptz,
  field_provenance   jsonb NOT NULL DEFAULT '{}'::jsonb,
  merged_into_id     uuid REFERENCES companies(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  CONSTRAINT companies_cnpj_digits CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$')
);

CREATE UNIQUE INDEX companies_cnpj_key
  ON companies (cnpj) WHERE cnpj IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX companies_natural_key
  ON companies (name_key, city_key, state) WHERE deleted_at IS NULL;
CREATE INDEX companies_segment_idx ON companies (segment_id) WHERE deleted_at IS NULL;
CREATE INDEX companies_city_idx    ON companies (state, city_key) WHERE deleted_at IS NULL;
CREATE INDEX companies_wstatus_idx ON companies (website_status) WHERE deleted_at IS NULL;
CREATE INDEX companies_created_idx ON companies (created_at DESC);
CREATE INDEX companies_name_trgm_idx ON companies USING gin (name_key gin_trgm_ops);

CREATE TABLE company_contact_points (
  company_id       uuid NOT NULL REFERENCES companies(id)      ON DELETE CASCADE,
  contact_point_id uuid NOT NULL REFERENCES contact_points(id) ON DELETE RESTRICT,
  is_primary       boolean NOT NULL DEFAULT false,
  label            text,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, contact_point_id)
);

CREATE UNIQUE INDEX company_contact_points_primary_unique
  ON company_contact_points (company_id) WHERE is_primary;
CREATE INDEX company_contact_points_contact_idx
  ON company_contact_points (contact_point_id);

CREATE TABLE import_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      uuid REFERENCES sources(id),
  segment_id     uuid REFERENCES segments(id),
  filename       text,
  storage_key    text,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'uploaded',
  total_rows     int NOT NULL DEFAULT 0,
  valid_rows     int NOT NULL DEFAULT 0,
  invalid_rows   int NOT NULL DEFAULT 0,
  created_count  int NOT NULL DEFAULT 0,
  merged_count   int NOT NULL DEFAULT 0,
  skipped_count  int NOT NULL DEFAULT 0,
  review_count   int NOT NULL DEFAULT 0,
  already_contacted_count int NOT NULL DEFAULT 0,
  error          text,
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  committed_at   timestamptz
);

CREATE TABLE leads (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  segment_id               uuid REFERENCES segments(id) ON DELETE SET NULL,
  source_id                uuid REFERENCES sources(id),
  import_job_id            uuid REFERENCES import_jobs(id) ON DELETE SET NULL,
  status                   lead_status NOT NULL DEFAULT 'new',
  owner_id                 uuid REFERENCES users(id),
  score                    int,
  notes                    text,
  primary_contact_point_id uuid REFERENCES contact_points(id) ON DELETE SET NULL,
  collected_at             timestamptz NOT NULL DEFAULT now(),
  last_interaction_at      timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

CREATE UNIQUE INDEX leads_company_active_key ON leads (company_id) WHERE deleted_at IS NULL;
CREATE INDEX leads_status_idx    ON leads (status)     WHERE deleted_at IS NULL;
CREATE INDEX leads_segment_idx   ON leads (segment_id) WHERE deleted_at IS NULL;
CREATE INDEX leads_collected_idx ON leads (collected_at DESC);
CREATE INDEX leads_contact_idx   ON leads (primary_contact_point_id);
CREATE INDEX leads_board_idx     ON leads (segment_id, status, collected_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE import_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id     uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number        int  NOT NULL,
  raw               jsonb NOT NULL,
  normalized        jsonb,
  outcome           text,
  reason            text,
  matched_company_id       uuid REFERENCES companies(id) ON DELETE SET NULL,
  matched_contact_point_id uuid REFERENCES contact_points(id) ON DELETE SET NULL,
  was_already_contacted    boolean NOT NULL DEFAULT false,
  errors            jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_job_id, row_number)
);

CREATE INDEX import_rows_outcome_idx ON import_rows (import_job_id, outcome);

-- ------------------------------------------------------ presença digital
CREATE TABLE web_presences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url            text NOT NULL,
  url_key        text NOT NULL,
  host           text NOT NULL,
  kind           web_presence_kind NOT NULL DEFAULT 'other',
  is_primary     boolean NOT NULL DEFAULT false,
  confidence     numeric(3,2),
  discovered_at  timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX web_presences_company_url_key ON web_presences (company_id, url_key);
CREATE INDEX web_presences_kind_idx ON web_presences (kind);

-- ------------------------------------------------------------ templates
CREATE TABLE message_templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  segment_id         uuid REFERENCES segments(id) ON DELETE SET NULL,
  description        text,
  is_active          boolean NOT NULL DEFAULT true,
  current_version_id uuid,
  created_by         uuid REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE TABLE message_template_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
  version      int  NOT NULL,
  body         text NOT NULL,
  variables    text[] NOT NULL DEFAULT '{}',
  image_url    text,
  image_name   text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES message_template_versions(id) ON DELETE SET NULL;

-- ------------------------------------------------- campanhas e disparos
CREATE TABLE campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  template_version_id uuid NOT NULL REFERENCES message_template_versions(id),
  segment_id          uuid REFERENCES segments(id),
  filter_snapshot     jsonb NOT NULL DEFAULT '{}'::jsonb,
  batch_size          int  NOT NULL DEFAULT 10 CHECK (batch_size BETWEEN 1 AND 50),
  status              text NOT NULL DEFAULT 'active',
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

CREATE INDEX campaigns_created_idx ON campaigns (created_at DESC);

CREATE TABLE campaign_targets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_point_id uuid NOT NULL REFERENCES contact_points(id) ON DELETE RESTRICT,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  company_id       uuid REFERENCES companies(id) ON DELETE SET NULL,
  render_vars      jsonb NOT NULL DEFAULT '{}'::jsonb,
  state            text NOT NULL DEFAULT 'pending',
  excluded_reason  text,
  added_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX campaign_targets_unique ON campaign_targets (campaign_id, contact_point_id);
CREATE INDEX campaign_targets_pending_idx
  ON campaign_targets (campaign_id, state) WHERE state = 'pending';

CREATE TABLE dispatch_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sequence_no     int  NOT NULL,
  requested_size  int  NOT NULL CHECK (requested_size BETWEEN 1 AND 50),
  reserved_count  int  NOT NULL DEFAULT 0,
  sent_count      int  NOT NULL DEFAULT 0,
  failed_count    int  NOT NULL DEFAULT 0,
  status          batch_status NOT NULL DEFAULT 'reserving',
  idempotency_key text NOT NULL,
  is_recontact    boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  UNIQUE (campaign_id, sequence_no)
);

CREATE TABLE recontact_approvals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id uuid NOT NULL REFERENCES contact_points(id) ON DELETE CASCADE,
  reason           text NOT NULL,
  approved_by      uuid REFERENCES users(id),
  approved_at      timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  consumed_at      timestamptz
);

CREATE INDEX recontact_approvals_usable_idx
  ON recontact_approvals (contact_point_id) WHERE consumed_at IS NULL;

CREATE TABLE message_dispatches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id      uuid NOT NULL REFERENCES contact_points(id) ON DELETE RESTRICT,
  lead_id               uuid REFERENCES leads(id)     ON DELETE SET NULL,
  company_id            uuid REFERENCES companies(id) ON DELETE SET NULL,
  campaign_id           uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  batch_id              uuid REFERENCES dispatch_batches(id) ON DELETE SET NULL,
  campaign_target_id    uuid REFERENCES campaign_targets(id) ON DELETE SET NULL,
  template_version_id   uuid REFERENCES message_template_versions(id),
  attempt_seq           int NOT NULL,
  recontact_approval_id uuid UNIQUE REFERENCES recontact_approvals(id),
  status                dispatch_status NOT NULL DEFAULT 'reserved',
  rendered_body         text,
  rendered_at           timestamptz,
  provider              text,
  provider_message_id   text,
  error_code            text,
  error_message         text,
  reserved_at           timestamptz NOT NULL DEFAULT now(),
  sent_at               timestamptz,
  failed_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_attempt_positive CHECK (attempt_seq >= 1),
  CONSTRAINT dispatch_recontact_requires_approval
    CHECK (attempt_seq = 1 OR recontact_approval_id IS NOT NULL),
  CONSTRAINT dispatch_sent_has_timestamp
    CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);

-- A GARANTIA. Sem ela nada mais importa.
CREATE UNIQUE INDEX message_dispatches_contact_attempt_unique
  ON message_dispatches (contact_point_id, attempt_seq)
  WHERE status IN ('reserved', 'sending', 'sent');

CREATE UNIQUE INDEX message_dispatches_first_contact_unique
  ON message_dispatches (contact_point_id)
  WHERE attempt_seq = 1 AND status IN ('reserved', 'sending', 'sent');

CREATE INDEX message_dispatches_batch_idx    ON message_dispatches (batch_id);
CREATE INDEX message_dispatches_campaign_idx ON message_dispatches (campaign_id, status);
CREATE INDEX message_dispatches_contact_idx  ON message_dispatches (contact_point_id, sent_at DESC);

CREATE TABLE message_attempts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id       uuid NOT NULL REFERENCES message_dispatches(id) ON DELETE CASCADE,
  attempt_no        int  NOT NULL,
  request_id        text,
  http_status       int,
  provider_response jsonb,
  error_code        text,
  error_message     text,
  duration_ms       int,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dispatch_id, attempt_no)
);

-- --------------------------------------------------- histórico canônico
CREATE TABLE contact_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id    uuid NOT NULL REFERENCES contact_points(id) ON DELETE RESTRICT,
  event_type          contact_event_type NOT NULL,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  dispatch_id         uuid REFERENCES message_dispatches(id) ON DELETE SET NULL,
  lead_id             uuid REFERENCES leads(id)     ON DELETE SET NULL,
  company_id          uuid REFERENCES companies(id) ON DELETE SET NULL,
  campaign_id         uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  template_version_id uuid REFERENCES message_template_versions(id),
  snapshot            jsonb NOT NULL DEFAULT '{}'::jsonb,
  note                text,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_events_contact_idx ON contact_events (contact_point_id, occurred_at DESC);
CREATE INDEX contact_events_type_idx    ON contact_events (event_type, occurred_at DESC);
CREATE INDEX contact_events_campaign_idx ON contact_events (campaign_id);

CREATE OR REPLACE FUNCTION refresh_contact_point_stats() RETURNS trigger AS $$
BEGIN
  INSERT INTO contact_point_stats AS s (
    contact_point_id, contact_count, first_contacted_at, last_contacted_at,
    last_event_type, last_event_at, reply_count, status, updated_at
  )
  VALUES (
    NEW.contact_point_id,
    CASE WHEN NEW.event_type = 'message_sent' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'message_sent' THEN NEW.occurred_at END,
    CASE WHEN NEW.event_type = 'message_sent' THEN NEW.occurred_at END,
    NEW.event_type, NEW.occurred_at,
    CASE WHEN NEW.event_type = 'replied' THEN 1 ELSE 0 END,
    CASE
      WHEN NEW.event_type = 'opted_out'    THEN 'opted_out'::contact_status
      WHEN NEW.event_type = 'replied'      THEN 'replied'::contact_status
      WHEN NEW.event_type = 'message_sent' THEN 'contacted'::contact_status
      ELSE 'never_contacted'::contact_status
    END,
    now()
  )
  ON CONFLICT (contact_point_id) DO UPDATE SET
    contact_count = s.contact_count
      + CASE WHEN NEW.event_type = 'message_sent' THEN 1 ELSE 0 END,
    first_contacted_at = COALESCE(
      s.first_contacted_at,
      CASE WHEN NEW.event_type = 'message_sent' THEN NEW.occurred_at END),
    last_contacted_at = CASE
      WHEN NEW.event_type = 'message_sent'
        THEN GREATEST(COALESCE(s.last_contacted_at, NEW.occurred_at), NEW.occurred_at)
      ELSE s.last_contacted_at END,
    last_event_type = NEW.event_type,
    last_event_at   = GREATEST(COALESCE(s.last_event_at, NEW.occurred_at), NEW.occurred_at),
    reply_count = s.reply_count
      + CASE WHEN NEW.event_type = 'replied' THEN 1 ELSE 0 END,
    status = CASE
      WHEN s.status = 'opted_out'          THEN 'opted_out'::contact_status
      WHEN NEW.event_type = 'opted_out'    THEN 'opted_out'::contact_status
      WHEN NEW.event_type = 'replied'      THEN 'replied'::contact_status
      WHEN NEW.event_type = 'message_sent'
           AND s.status = 'never_contacted' THEN 'contacted'::contact_status
      ELSE s.status END,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_events_stats_trigger
  AFTER INSERT ON contact_events
  FOR EACH ROW EXECUTE FUNCTION refresh_contact_point_stats();

CREATE OR REPLACE FUNCTION forbid_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'contact_events e append-only (tentativa de %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_events_immutable
  BEFORE UPDATE OR DELETE ON contact_events
  FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();

-- ------------------------------------------ idempotência e auditoria
CREATE TABLE idempotency_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL,
  user_id       uuid REFERENCES users(id),
  endpoint      text NOT NULL,
  request_hash  text NOT NULL,
  status        text NOT NULL,
  response_code int,
  response_body jsonb,
  locked_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE UNIQUE INDEX idempotency_keys_unique ON idempotency_keys (key, endpoint);
CREATE INDEX idempotency_keys_expiry_idx ON idempotency_keys (expires_at);

CREATE TABLE audit_events (
  id           bigserial PRIMARY KEY,
  actor_id     uuid REFERENCES users(id),
  actor_type   text NOT NULL DEFAULT 'user',
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  request_id   text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_events_action_idx ON audit_events (action, occurred_at DESC);

-- ------------------------------------------------------ view do painel
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
  s.id AS segment_id, s.name AS segment_name, s.color AS segment_color,
  cp.id                     AS contact_point_id,
  cp.phone_display,
  cp.phone_e164,
  cp.line_type,
  COALESCE(st.contact_count, 0)          AS contact_count,
  st.first_contacted_at,
  st.last_contacted_at,
  COALESCE(st.status, 'never_contacted') AS contact_state,
  (sup.id IS NOT NULL)                   AS is_suppressed,
  sup.reason                             AS suppression_reason,
  (
    cp.id IS NOT NULL
    AND sup.id IS NULL
    AND COALESCE(st.contact_count, 0) = 0
    AND NOT EXISTS (
      SELECT 1 FROM message_dispatches d
       WHERE d.contact_point_id = cp.id
         AND d.status IN ('reserved', 'sending', 'sent')
    )
  ) AS is_available
FROM leads l
JOIN companies c            ON c.id = l.company_id
LEFT JOIN segments s        ON s.id = COALESCE(l.segment_id, c.segment_id)
LEFT JOIN contact_points cp ON cp.id = l.primary_contact_point_id
LEFT JOIN contact_point_stats st ON st.contact_point_id = cp.id
LEFT JOIN suppressions sup  ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL;
