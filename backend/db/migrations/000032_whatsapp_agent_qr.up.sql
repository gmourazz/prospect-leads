-- The pairing QR the bridge is currently showing, so the site can display it
-- instead of making the owner open the bridge's terminal. Only meaningful
-- while connection = 'qr_required'; cleared on every other state because a
-- QR is short-lived and scanning a stale one just fails.
ALTER TABLE whatsapp_agent_state ADD COLUMN qr_code text;
