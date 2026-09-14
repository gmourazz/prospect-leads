package postgres

import (
	"context"
	"time"
)

type ProviderQuotaRepo struct{ *Store }

func NewProviderQuotaRepo(s *Store) *ProviderQuotaRepo { return &ProviderQuotaRepo{s} }

// RecordCall counts one provider call attempt — success or failure — against
// today's window in the America/Los_Angeles calendar, the same one Google
// itself resets its per-day quotas against. A Brazil-calendar day would drift
// from the real reset and make the count lie about when it clears.
func (r *ProviderQuotaRepo) RecordCall(ctx context.Context, provider string) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO provider_daily_quota (provider, quota_day, call_count)
		VALUES ($1, (now() AT TIME ZONE 'America/Los_Angeles')::date, 1)
		ON CONFLICT (provider, quota_day)
		DO UPDATE SET call_count = provider_daily_quota.call_count + 1, updated_at = now()`,
		provider)
	return TranslateError(err)
}

// RecordQuotaExceeded marks today's window as having actually hit a quota
// error, not just a guess from the call count — so the UI can stop
// suggesting more searches instead of letting the person burn attempts
// against a wall that won't move until the next Pacific midnight.
func (r *ProviderQuotaRepo) RecordQuotaExceeded(ctx context.Context, provider string) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO provider_daily_quota (provider, quota_day, call_count, quota_exceeded_at)
		VALUES ($1, (now() AT TIME ZONE 'America/Los_Angeles')::date, 0, now())
		ON CONFLICT (provider, quota_day)
		DO UPDATE SET quota_exceeded_at = now(), updated_at = now()`,
		provider)
	return TranslateError(err)
}

type DailyQuotaStatus struct {
	Provider   string     `json:"provider"`
	QuotaDay   string     `json:"quota_day"`
	CallCount  int        `json:"call_count"`
	Exceeded   bool       `json:"exceeded"`
	ExceededAt *time.Time `json:"exceeded_at,omitempty"`
	// ResetsAt is the next America/Los_Angeles midnight, as an absolute
	// instant — the frontend renders it in whatever timezone the browser is
	// already in rather than the backend guessing one.
	ResetsAt time.Time `json:"resets_at"`
}

func (r *ProviderQuotaRepo) Today(ctx context.Context, provider string) (DailyQuotaStatus, error) {
	status := DailyQuotaStatus{Provider: provider}
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT
			to_char((now() AT TIME ZONE 'America/Los_Angeles')::date, 'YYYY-MM-DD'),
			COALESCE(
				(SELECT call_count FROM provider_daily_quota
				  WHERE provider = $1
				    AND quota_day = (now() AT TIME ZONE 'America/Los_Angeles')::date),
				0),
			(SELECT quota_exceeded_at FROM provider_daily_quota
			  WHERE provider = $1
			    AND quota_day = (now() AT TIME ZONE 'America/Los_Angeles')::date),
			(((now() AT TIME ZONE 'America/Los_Angeles')::date + 1)::timestamp
				AT TIME ZONE 'America/Los_Angeles')
		`, provider).
		Scan(&status.QuotaDay, &status.CallCount, &status.ExceededAt, &status.ResetsAt)
	if err != nil {
		return status, TranslateError(err)
	}
	status.Exceeded = status.ExceededAt != nil
	return status, nil
}
