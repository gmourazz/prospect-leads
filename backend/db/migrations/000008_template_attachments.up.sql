-- Templates move from a single image_url column to 0-5 real uploaded
-- attachments, ordered, via a join table — matching the architecture doc's
-- original design (message_templates → attachments) instead of the
-- single-image shortcut the MVP started with.

CREATE TABLE attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type   text NOT NULL,
  size_bytes  bigint NOT NULL,
  checksum    text NOT NULL,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Reused across templates: uploading the same file twice returns the same
-- attachment instead of storing it again.
CREATE UNIQUE INDEX attachments_checksum_key ON attachments (checksum);

CREATE TABLE template_version_attachments (
  template_version_id uuid NOT NULL REFERENCES message_template_versions(id) ON DELETE CASCADE,
  attachment_id        uuid NOT NULL REFERENCES attachments(id) ON DELETE RESTRICT,
  sort_order           int NOT NULL DEFAULT 0,
  PRIMARY KEY (template_version_id, attachment_id)
);

CREATE OR REPLACE FUNCTION enforce_max_attachments() RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM template_version_attachments
       WHERE template_version_id = NEW.template_version_id) >= 5 THEN
    RAISE EXCEPTION 'um template pode ter no máximo 5 imagens';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER template_version_attachments_max_five
  BEFORE INSERT ON template_version_attachments
  FOR EACH ROW EXECUTE FUNCTION enforce_max_attachments();

ALTER TABLE message_template_versions
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS image_name;
