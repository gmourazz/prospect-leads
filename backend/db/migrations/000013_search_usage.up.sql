-- Tracks how many real provider calls "Buscar leads" has made this month, so
-- the UI can warn before an accidental spike turns into a Google Places bill.
-- OpenStreetMap calls are tracked too (for visibility) but carry no cost.
CREATE TABLE search_usage (
  provider    text NOT NULL,
  year_month  text NOT NULL, -- 'YYYY-MM', in the America/Sao_Paulo calendar
  call_count  int  NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, year_month)
);
