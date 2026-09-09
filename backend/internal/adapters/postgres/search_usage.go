package postgres

import "context"

type SearchUsageRepo struct{ *Store }

func NewSearchUsageRepo(s *Store) *SearchUsageRepo { return &SearchUsageRepo{s} }

// Increment records one real provider call for the current calendar month
// (America/Sao_Paulo, matching how Google reports usage/billing periods in
// practice for a Brazil-based account).
func (r *SearchUsageRepo) Increment(ctx context.Context, provider string) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO search_usage (provider, year_month, call_count)
		VALUES ($1, to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'), 1)
		ON CONFLICT (provider, year_month)
		DO UPDATE SET call_count = search_usage.call_count + 1, updated_at = now()`,
		provider)
	return TranslateError(err)
}

type UsageStatus struct {
	Provider  string `json:"provider"`
	YearMonth string `json:"year_month"`
	CallCount int    `json:"call_count"`
}

func (r *SearchUsageRepo) Current(ctx context.Context, provider string) (UsageStatus, error) {
	status := UsageStatus{Provider: provider}
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
		       COALESCE(
		         (SELECT call_count FROM search_usage
		           WHERE provider = $1
		             AND year_month = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')),
		         0)`, provider).
		Scan(&status.YearMonth, &status.CallCount)
	if err != nil {
		return status, TranslateError(err)
	}
	return status, nil
}
