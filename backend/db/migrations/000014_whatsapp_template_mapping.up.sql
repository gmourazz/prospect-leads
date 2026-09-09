-- The WhatsApp Cloud API requires cold outbound messages to use a template
-- that Meta has pre-approved (named, versioned, with numbered {{1}}, {{2}}...
-- placeholders — not the same mechanism as our internal named placeholders).
-- These columns map one of our template versions to its Meta-approved
-- counterpart. Until they're filled in, the WhatsApp gateway has nothing to
-- send with and returns a clear configuration error instead of guessing.
ALTER TABLE message_template_versions
  ADD COLUMN IF NOT EXISTS whatsapp_template_name     text,
  ADD COLUMN IF NOT EXISTS whatsapp_template_language  text NOT NULL DEFAULT 'pt_BR';
