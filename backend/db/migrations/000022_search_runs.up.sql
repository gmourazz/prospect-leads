CREATE TABLE search_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id    uuid REFERENCES segments(id) ON DELETE SET NULL,
  segment_label text NOT NULL,
  city          text NOT NULL,
  state         text NOT NULL,
  leads_found   int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX search_runs_created_idx ON search_runs (created_at DESC);
