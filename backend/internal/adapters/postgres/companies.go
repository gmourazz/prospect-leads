package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/company"
)

type CompanyRepo struct{ *Store }

func NewCompanyRepo(s *Store) *CompanyRepo { return &CompanyRepo{s} }

type CompanyInput struct {
	TradeName    string
	NameKey      string
	CNPJ         string
	SegmentID    *uuid.UUID
	City         string
	CityKey      string
	State        string
	OpeningHours string
}

type MatchResult struct {
	CompanyID  uuid.UUID
	Matched    bool
	Confidence float64
	Reason     string
}

// Resolve runs the dedupe cascade: CNPJ, then the natural key, then a trigram
// similarity search restricted to the same city. Anything between 0.60 and
// 0.85 is deliberately NOT merged automatically.
func (r *CompanyRepo) Resolve(ctx context.Context, in CompanyInput) (MatchResult, error) {
	if in.CNPJ != "" {
		var id uuid.UUID
		err := r.DB(ctx).QueryRow(ctx,
			`SELECT id FROM companies WHERE cnpj = $1 AND deleted_at IS NULL`, in.CNPJ).Scan(&id)
		if err == nil {
			return MatchResult{CompanyID: id, Matched: true, Confidence: 1.0, Reason: "cnpj"}, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return MatchResult{}, TranslateError(err)
		}
	}

	var id uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT id FROM companies
		 WHERE name_key = $1 AND city_key = $2
		   AND state IS NOT DISTINCT FROM NULLIF($3, '')
		   AND deleted_at IS NULL`, in.NameKey, in.CityKey, in.State).Scan(&id)
	if err == nil {
		return MatchResult{CompanyID: id, Matched: true, Confidence: 0.95, Reason: "natural_key"}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return MatchResult{}, TranslateError(err)
	}

	var sim float64
	err = r.DB(ctx).QueryRow(ctx, `
		SELECT id, similarity(name_key, $1) AS sim
		  FROM companies
		 WHERE deleted_at IS NULL
		   AND city_key = $2
		   AND name_key % $1
		 ORDER BY sim DESC
		 LIMIT 1`, in.NameKey, in.CityKey).Scan(&id, &sim)
	if errors.Is(err, pgx.ErrNoRows) {
		return MatchResult{}, nil
	}
	if err != nil {
		return MatchResult{}, TranslateError(err)
	}

	switch {
	case sim >= 0.85:
		return MatchResult{CompanyID: id, Matched: true, Confidence: sim, Reason: "trigram"}, nil
	case sim >= 0.60:
		return MatchResult{CompanyID: id, Matched: false, Confidence: sim, Reason: "needs_review"}, nil
	default:
		return MatchResult{}, nil
	}
}

func (r *CompanyRepo) Create(ctx context.Context, in CompanyInput) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO companies (trade_name, name_key, cnpj, segment_id, city, city_key, state, opening_hours)
		VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''))
		RETURNING id`,
		in.TradeName, in.NameKey, in.CNPJ, in.SegmentID, in.City, in.CityKey, in.State, in.OpeningHours).Scan(&id)
	if err != nil {
		return uuid.Nil, TranslateError(err)
	}
	return id, nil
}

// Merge applies the fill-if-empty policy. It never overwrites a validated CNPJ
// and never touches anything on the history side.
// SetCNPJIfEmpty stores a CNPJ discovered during email enrichment. It never
// overwrites one already on file: what the user typed or an import brought
// in outranks something scraped from a page footer.
func (r *CompanyRepo) SetCNPJIfEmpty(ctx context.Context, companyID uuid.UUID, cnpj string) error {
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE companies SET cnpj = $2, updated_at = now()
		 WHERE id = $1 AND cnpj IS NULL`, companyID, cnpj)
	return TranslateError(err)
}

func (r *CompanyRepo) Merge(ctx context.Context, id uuid.UUID, in CompanyInput) error {
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE companies
		   SET cnpj           = COALESCE(cnpj, NULLIF($2, '')),
		       segment_id     = COALESCE(segment_id, $3),
		       city           = COALESCE(city, NULLIF($4, '')),
		       city_key       = CASE WHEN city_key = '' THEN $5 ELSE city_key END,
		       state          = COALESCE(state, NULLIF($6, '')),
		       trade_name     = CASE
		                          WHEN length($7) > length(trade_name) THEN $7
		                          ELSE trade_name END,
		       opening_hours  = COALESCE(opening_hours, NULLIF($8, '')),
		       updated_at     = now()
		 WHERE id = $1`,
		id, in.CNPJ, in.SegmentID, in.City, in.CityKey, in.State, in.TradeName, in.OpeningHours)
	return TranslateError(err)
}

func (r *CompanyRepo) LinkContact(ctx context.Context, companyID, contactID uuid.UUID, primary bool) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO company_contact_points (company_id, contact_point_id, is_primary)
		VALUES ($1, $2, $3)
		ON CONFLICT (company_id, contact_point_id)
		DO UPDATE SET last_seen_at = now()`, companyID, contactID, primary)
	return TranslateError(err)
}

func (r *CompanyRepo) AddPresence(ctx context.Context, companyID uuid.UUID, url, host, urlKey string, kind company.PresenceKind) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO web_presences (company_id, url, url_key, host, kind)
		VALUES ($1, $2, $3, $4, $5::web_presence_kind)
		ON CONFLICT (company_id, url_key) DO NOTHING`, companyID, url, urlKey, host, string(kind))
	return TranslateError(err)
}

// RefreshWebsiteStatus recomputes the derived status from the known presences.
// The status is never imported directly from a spreadsheet column.
func (r *CompanyRepo) RefreshWebsiteStatus(ctx context.Context, companyID uuid.UUID) error {
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE companies c
		   SET website_status = CASE
		         WHEN EXISTS (SELECT 1 FROM web_presences w
		                       WHERE w.company_id = c.id AND w.kind = 'own_site')
		           THEN 'has_website'::website_status
		         WHEN EXISTS (SELECT 1 FROM web_presences w WHERE w.company_id = c.id)
		           THEN 'no_website'::website_status
		         ELSE 'unknown'::website_status END,
		       website_checked_at = now()
		 WHERE c.id = $1`, companyID)
	return TranslateError(err)
}

func (r *CompanyRepo) UpsertLead(ctx context.Context, companyID uuid.UUID, segmentID *uuid.UUID, contactID *uuid.UUID, sourceSlug string, importJobID *uuid.UUID) (uuid.UUID, bool, error) {
	var (
		id      uuid.UUID
		created bool
	)
	err := r.DB(ctx).QueryRow(ctx, `
		WITH src AS (SELECT id FROM sources WHERE slug = $4)
		INSERT INTO leads (company_id, segment_id, primary_contact_point_id, source_id, import_job_id)
		VALUES ($1, $2, $3, (SELECT id FROM src), $5)
		ON CONFLICT (company_id) WHERE deleted_at IS NULL
		DO UPDATE SET
			segment_id = COALESCE(leads.segment_id, EXCLUDED.segment_id),
			primary_contact_point_id =
				COALESCE(leads.primary_contact_point_id, EXCLUDED.primary_contact_point_id),
			updated_at = now()
		RETURNING id, (xmax = 0)`,
		companyID, segmentID, contactID, sourceSlug, importJobID).Scan(&id, &created)
	if err != nil {
		return uuid.Nil, false, TranslateError(err)
	}
	return id, created, nil
}

func (r *CompanyRepo) Count(ctx context.Context) (int, error) {
	var n int
	err := r.DB(ctx).QueryRow(ctx,
		`SELECT COUNT(*) FROM companies WHERE deleted_at IS NULL`).Scan(&n)
	return n, TranslateError(err)
}

var _ = domain.CodeInternal
