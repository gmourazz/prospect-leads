-- Supports manual (non-campaign) outreach: a WhatsApp "click-to-chat" link is
-- opened, but that is NOT the same as the message having been sent — the
-- user must explicitly confirm afterwards. 'opened' sits between 'reserved'
-- and 'sent' for exactly that reason: opening a chat window is not proof of
-- delivery, so the ✓ Enviado badge must not appear until confirmed.
ALTER TYPE dispatch_status ADD VALUE IF NOT EXISTS 'opened';
