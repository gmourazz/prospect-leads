package postgres

import (
	"context"

	"github.com/geovanna/prospect/backend/internal/domain"
)

type AnalyticsRepo struct{ *Store }

func NewAnalyticsRepo(s *Store) *AnalyticsRepo { return &AnalyticsRepo{s} }

func (r *AnalyticsRepo) Overview(ctx context.Context, days int) (domain.DashboardMetrics, error) {
	var m domain.DashboardMetrics

	err := r.DB(ctx).QueryRow(ctx, `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE website_status = 'no_website'),
		       COUNT(*) FILTER (WHERE is_available),
		       COUNT(*) FILTER (WHERE contact_count > 0),
		       COUNT(*) FILTER (WHERE contact_state = 'replied'),
		       COUNT(*) FILTER (WHERE lead_status = 'interested'),
		       COUNT(*) FILTER (WHERE lead_status = 'negotiating'),
		       COUNT(*) FILTER (WHERE lead_status = 'customer'),
		       COUNT(*) FILTER (WHERE is_suppressed)
		  FROM lead_board`).
		Scan(&m.Totals.Leads, &m.Totals.NoWebsite, &m.Totals.Available,
			&m.Totals.Contacted, &m.Totals.Replied, &m.Totals.Interested,
			&m.Totals.Negotiating, &m.Totals.Customers, &m.Totals.Suppressed)
	if err != nil {
		return m, TranslateError(err)
	}

	if m.Totals.Contacted > 0 {
		m.Rates.ResponseRate = float64(m.Totals.Replied) / float64(m.Totals.Contacted)
		m.Rates.InterestRate = float64(m.Totals.Interested) / float64(m.Totals.Contacted)
		m.Rates.ConversionRate = float64(m.Totals.Customers) / float64(m.Totals.Contacted)
	}

	segRows, err := r.DB(ctx).Query(ctx, `
		SELECT COALESCE(segment_name, 'Sem segmento'), COALESCE(segment_color, 'slate'),
		       COUNT(*),
		       COUNT(*) FILTER (WHERE contact_count > 0),
		       COUNT(*) FILTER (WHERE contact_state = 'replied'),
		       COUNT(*) FILTER (WHERE lead_status = 'customer')
		  FROM lead_board
		 GROUP BY 1, 2
		 ORDER BY 3 DESC`)
	if err != nil {
		return m, TranslateError(err)
	}
	m.BySegment = []domain.SegmentMetric{}
	for segRows.Next() {
		var s domain.SegmentMetric
		if err := segRows.Scan(&s.SegmentName, &s.Color, &s.Leads, &s.Contacted,
			&s.Replied, &s.Customers); err != nil {
			segRows.Close()
			return m, TranslateError(err)
		}
		m.BySegment = append(m.BySegment, s)
	}
	segRows.Close()

	tlRows, err := r.DB(ctx).Query(ctx, `
		WITH days AS (
			SELECT generate_series(
				(current_date - ($1::int - 1) * interval '1 day')::date,
				current_date, interval '1 day')::date AS d
		)
		SELECT to_char(days.d, 'YYYY-MM-DD'),
		       (SELECT COUNT(*) FROM contact_events e
		         WHERE e.event_type = 'message_sent'
		           AND e.occurred_at::date = days.d),
		       (SELECT COUNT(*) FROM leads l
		         WHERE l.deleted_at IS NULL AND l.collected_at::date = days.d)
		  FROM days ORDER BY days.d`, days)
	if err != nil {
		return m, TranslateError(err)
	}
	m.Timeline = []domain.TimelinePoint{}
	for tlRows.Next() {
		var p domain.TimelinePoint
		if err := tlRows.Scan(&p.Date, &p.Contacted, &p.Collected); err != nil {
			tlRows.Close()
			return m, TranslateError(err)
		}
		m.Timeline = append(m.Timeline, p)
	}
	tlRows.Close()

	stRows, err := r.DB(ctx).Query(ctx, `
		SELECT lead_status::text, COUNT(*)
		  FROM lead_board GROUP BY 1 ORDER BY 2 DESC`)
	if err != nil {
		return m, TranslateError(err)
	}
	m.LeadStatus = []domain.StatusSlice{}
	for stRows.Next() {
		var s domain.StatusSlice
		if err := stRows.Scan(&s.Status, &s.Count); err != nil {
			stRows.Close()
			return m, TranslateError(err)
		}
		m.LeadStatus = append(m.LeadStatus, s)
	}
	stRows.Close()

	acRows, err := r.DB(ctx).Query(ctx, `
		SELECT e.event_type::text, e.occurred_at,
		       COALESCE(e.snapshot->>'company_name', 'Contato'),
		       COALESCE(e.snapshot->>'template_name', '')
		  FROM contact_events e
		 ORDER BY e.occurred_at DESC
		 LIMIT 12`)
	if err != nil {
		return m, TranslateError(err)
	}
	defer acRows.Close()
	m.Recent = []domain.ActivityItem{}
	for acRows.Next() {
		var a domain.ActivityItem
		if err := acRows.Scan(&a.Type, &a.OccurredAt, &a.CompanyName, &a.Detail); err != nil {
			return m, TranslateError(err)
		}
		m.Recent = append(m.Recent, a)
	}
	return m, acRows.Err()
}
