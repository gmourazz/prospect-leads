-- A contact with an unconfirmed manual dispatch ('opened') must not be
-- reported as available: without this, a batch send and a manual contact
-- could target the same phone number at the same time.
CREATE OR REPLACE VIEW lead_board AS
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
  cp.line_type,
  COALESCE(st.contact_count, 0)          AS contact_count,
  st.first_contacted_at,
  st.last_contacted_at,
  COALESCE(st.status, 'never_contacted') AS contact_state,
  (sup.id IS NOT NULL)                   AS is_suppressed,
  sup.reason                             AS suppression_reason,
  (
    cp.id IS NOT NULL
    AND cp.line_type <> 'fixed_line'
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
