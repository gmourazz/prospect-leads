-- Google resets its "requests per day" quotas at midnight America/Los_Angeles,
-- not at any Brazil-calendar boundary and not monthly — that distinction is
-- what search_usage (a monthly, success-only counter) can't answer. This
-- tracks, per provider and per Pacific-calendar day: how many calls were
-- attempted (success or fail) and, if the provider ever returned a real
-- quota-exceeded response today, when that last happened — so the UI can say
-- "esgotada, tenta de novo às HH:MM" instead of inviting another wasted try.
CREATE TABLE provider_daily_quota (
  provider          text NOT NULL,
  quota_day         date NOT NULL, -- America/Los_Angeles calendar
  call_count        int  NOT NULL DEFAULT 0,
  quota_exceeded_at timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, quota_day)
);
