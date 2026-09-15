-- interest_marks lets a contact be flagged "demonstrou interesse" for future
-- remarketing, independent of suppressions — the two are unrelated states
-- (a contact can be both, though the UI treats suppression as the stronger
-- signal). Keyed on contact_point_id like suppressions, for the same reason:
-- it must survive "apagar e reimportar todos os leads".
CREATE TABLE interest_marks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id uuid NOT NULL REFERENCES contact_points(id) ON DELETE CASCADE,
  note             text,
  source           text NOT NULL DEFAULT 'manual',
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz,
  revoked_by       uuid REFERENCES users(id)
);

CREATE UNIQUE INDEX interest_marks_active_unique
  ON interest_marks (contact_point_id) WHERE revoked_at IS NULL;

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
  ld.channel                             AS last_channel,
  COALESCE(ld.status = 'failed', false)  AS has_error,
  ld.error_code                          AS last_error_code,
  (sup.id IS NOT NULL)                   AS is_suppressed,
  sup.reason                             AS suppression_reason,
  (im.id IS NOT NULL)                    AS is_interested,
  im.note                                AS interest_note,
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
LEFT JOIN interest_marks im ON im.contact_point_id = cp.id AND im.revoked_at IS NULL
LEFT JOIN LATERAL (
  SELECT d.channel, d.status, d.error_code
    FROM message_dispatches d
   WHERE d.contact_point_id = cp.id
   ORDER BY d.updated_at DESC
   LIMIT 1
) ld ON cp.id IS NOT NULL
WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL;
