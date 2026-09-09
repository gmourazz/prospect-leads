-- A business rarely publishes exactly one address: there's contato@, the
-- owner's personal Gmail on a directory listing, comercial@ on the site
-- footer. Finding several and messaging all of them at once is the whole
-- point — one of them is usually the one somebody actually reads.
--
-- These hang off contact_points (immortal) rather than companies (volatile,
-- recreated on every reimport), for the same reason contact history does:
-- deleting and reimporting every lead must never lose what we discovered.
CREATE TABLE IF NOT EXISTS contact_point_emails (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id  uuid NOT NULL REFERENCES contact_points(id) ON DELETE CASCADE,
  email             text NOT NULL,
  -- where it came from: osm | website | web_search | cnpj | manual
  source            text NOT NULL DEFAULT 'manual',
  is_primary        boolean NOT NULL DEFAULT false,
  discovered_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_point_emails_unique UNIQUE (contact_point_id, email)
);

CREATE INDEX IF NOT EXISTS contact_point_emails_contact_idx
  ON contact_point_emails (contact_point_id);

-- Anything already found by the earlier single-email scrape becomes the
-- primary row here, so no discovery work is thrown away.
INSERT INTO contact_point_emails (contact_point_id, email, source, is_primary)
SELECT id, email, 'website', true
  FROM contact_points
 WHERE email IS NOT NULL
ON CONFLICT (contact_point_id, email) DO NOTHING;

-- contact_points.email stays as the denormalized PRIMARY address: the
-- eligibility checks, the lead_board view and the campaign indexes all read
-- it, and keeping it avoids a join in the hot reservation path. It is always
-- kept in sync with the is_primary row above.

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
         AND d.status IN ('reserved', 'sending', 'opened', 'sent')
    )
  ) AS is_available
FROM leads l
JOIN companies c            ON c.id = l.company_id
LEFT JOIN segments s        ON s.id = COALESCE(l.segment_id, c.segment_id)
LEFT JOIN contact_points cp ON cp.id = l.primary_contact_point_id
LEFT JOIN contact_point_stats st ON st.contact_point_id = cp.id
LEFT JOIN suppressions sup  ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL;
