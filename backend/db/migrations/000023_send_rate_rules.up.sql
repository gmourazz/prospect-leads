-- Manual send still requires a click (see OutreachService.SendBatch), but the
-- click can now be gated by a daily cap and an allowed window, so cold
-- outreach doesn't accidentally blow past what a fresh Gmail sender can
-- safely handle in one day.
ALTER TABLE app_settings
  ADD COLUMN daily_send_limit int NOT NULL DEFAULT 60,
  ADD COLUMN send_weekdays    smallint[] NOT NULL DEFAULT '{1,2,3,4,5}', -- ISO: 1=segunda .. 7=domingo
  ADD COLUMN send_hour_start  smallint NOT NULL DEFAULT 9,
  ADD COLUMN send_hour_end    smallint NOT NULL DEFAULT 18,
  ADD CONSTRAINT app_settings_daily_limit_positive CHECK (daily_send_limit > 0),
  ADD CONSTRAINT app_settings_hours_valid
    CHECK (send_hour_start >= 0 AND send_hour_start < 24
       AND send_hour_end   >  0 AND send_hour_end   <= 24
       AND send_hour_start <  send_hour_end);
