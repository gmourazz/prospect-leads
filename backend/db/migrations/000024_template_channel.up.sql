-- Templates now say which channel they're written for: an email template
-- has a subject line and can carry an inline {{imagem_N}} image, a WhatsApp
-- one is meant to be pasted or hand-sent as a plain chat message (there is
-- still no automated WhatsApp gateway — see 000015_email_channel). This is
-- purely organizational, mirroring message_dispatches.channel from
-- 000018_followup_channel: it does not gate which template a campaign can
-- use.
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email';
