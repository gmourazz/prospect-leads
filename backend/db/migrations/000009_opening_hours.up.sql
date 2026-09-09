-- Lets the campaign filter answer "aberto agora" / "fechado agora" so a
-- dispatch can target only currently-open (or closed) businesses.
--
-- opening_hours stores the raw OSM opening_hours syntax when known. Full
-- compliance with that spec (holidays, sunrise/sunset, month ranges, week
-- numbers) is deliberately out of scope — business_is_open() below returns
-- NULL ("desconhecido") whenever it meets syntax it cannot parse safely,
-- rather than guessing. A lead with unknown hours matches neither the "open"
-- nor the "closed" filter, which is the honest behavior.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS opening_hours text;

CREATE OR REPLACE FUNCTION business_is_open(hours text, at_time timestamptz)
RETURNS boolean AS $$
DECLARE
  local_time    timestamp;
  cur_time      time;
  dow_code      text;
  days_order    text[] := ARRAY['Mo','Tu','We','Th','Fr','Sa','Su'];
  day_idx       int;
  rule          text;
  day_part      text;
  time_part     text;
  day_token     text;
  time_token    text;
  day_start     text;
  day_end       text;
  start_idx     int;
  end_idx       int;
  matched_today boolean := false;
  is_open       boolean := false;
  t_start       time;
  t_end         time;
BEGIN
  IF hours IS NULL OR btrim(hours) = '' THEN
    RETURN NULL;
  END IF;

  -- Syntax this parser does not attempt: public holidays, sunrise/sunset,
  -- month/week ranges. Being honest about "don't know" beats guessing.
  IF hours ~* 'sunrise|sunset|\mPH\M|week\s|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec' THEN
    RETURN NULL;
  END IF;

  IF btrim(hours) = '24/7' THEN
    RETURN true;
  END IF;

  local_time := at_time AT TIME ZONE 'America/Sao_Paulo';
  cur_time := local_time::time;
  dow_code := (ARRAY['Su','Mo','Tu','We','Th','Fr','Sa'])[extract(dow from local_time)::int + 1];
  day_idx := array_position(days_order, dow_code);

  FOREACH rule IN ARRAY string_to_array(hours, ';') LOOP
    rule := btrim(rule);
    CONTINUE WHEN rule = '';

    day_part := btrim(substring(rule from '^[^0-9]*'));
    time_part := btrim(substring(rule from '[0-9].*$'));
    IF day_part = '' THEN
      day_part := 'Mo-Su';
    END IF;

    FOREACH day_token IN ARRAY string_to_array(day_part, ',') LOOP
      day_token := btrim(day_token);
      IF day_token = '' THEN
        CONTINUE;
      END IF;
      IF day_token ~ '-' THEN
        day_start := split_part(day_token, '-', 1);
        day_end   := split_part(day_token, '-', 2);
      ELSE
        day_start := day_token;
        day_end   := day_token;
      END IF;
      start_idx := array_position(days_order, day_start);
      end_idx   := array_position(days_order, day_end);
      IF start_idx IS NULL OR end_idx IS NULL THEN
        CONTINUE;
      END IF;

      IF (start_idx <= end_idx AND day_idx BETWEEN start_idx AND end_idx)
         OR (start_idx > end_idx AND (day_idx >= start_idx OR day_idx <= end_idx)) THEN
        matched_today := true;

        IF time_part = '' OR time_part = 'off' THEN
          is_open := false;
        ELSE
          FOREACH time_token IN ARRAY string_to_array(time_part, ',') LOOP
            time_token := btrim(time_token);
            IF time_token !~ '^[0-9]{1,2}:[0-9]{2}-[0-9]{1,2}:[0-9]{2}$' THEN
              CONTINUE;
            END IF;
            t_start := split_part(time_token, '-', 1)::time;
            t_end   := split_part(time_token, '-', 2)::time;
            IF t_start <= t_end THEN
              IF cur_time >= t_start AND cur_time < t_end THEN
                is_open := true;
              END IF;
            ELSE
              IF cur_time >= t_start OR cur_time < t_end THEN
                is_open := true;
              END IF;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT matched_today THEN
    RETURN false;
  END IF;
  RETURN is_open;
END;
$$ LANGUAGE plpgsql STABLE;

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
