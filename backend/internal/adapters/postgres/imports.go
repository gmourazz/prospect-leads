package postgres

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/domain"
)

type ImportRepo struct{ *Store }

func NewImportRepo(s *Store) *ImportRepo { return &ImportRepo{s} }

func (r *ImportRepo) CreateJob(ctx context.Context, filename string, segmentID *uuid.UUID, mapping map[string]string, by uuid.UUID) (uuid.UUID, error) {
	m, _ := json.Marshal(mapping)
	var id uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO import_jobs (filename, segment_id, column_mapping, status, created_by,
		                         source_id)
		VALUES ($1, $2, $3, 'analyzing', $4, (SELECT id FROM sources WHERE slug = 'csv'))
		RETURNING id`, filename, segmentID, m, by).Scan(&id)
	if err != nil {
		return uuid.Nil, TranslateError(err)
	}
	return id, nil
}

type RowResult struct {
	RowNumber        int
	Raw              map[string]string
	Normalized       map[string]any
	Outcome          string
	Reason           string
	CompanyID        *uuid.UUID
	ContactPointID   *uuid.UUID
	AlreadyContacted bool
	Errors           []string
}

func (r *ImportRepo) SaveRow(ctx context.Context, jobID uuid.UUID, row RowResult) error {
	raw, _ := json.Marshal(row.Raw)
	normalized, _ := json.Marshal(row.Normalized)
	errs, _ := json.Marshal(row.Errors)
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO import_rows
			(import_job_id, row_number, raw, normalized, outcome, reason,
			 matched_company_id, matched_contact_point_id, was_already_contacted, errors)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, $10)
		ON CONFLICT (import_job_id, row_number) DO UPDATE SET
			normalized = EXCLUDED.normalized,
			outcome = EXCLUDED.outcome,
			reason = EXCLUDED.reason,
			matched_company_id = EXCLUDED.matched_company_id,
			matched_contact_point_id = EXCLUDED.matched_contact_point_id,
			was_already_contacted = EXCLUDED.was_already_contacted,
			errors = EXCLUDED.errors`,
		jobID, row.RowNumber, raw, normalized, row.Outcome, row.Reason,
		row.CompanyID, row.ContactPointID, row.AlreadyContacted, errs)
	return TranslateError(err)
}

func (r *ImportRepo) UpdateJobStats(ctx context.Context, jobID uuid.UUID, status string) error {
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE import_jobs j
		   SET status = $2,
		       total_rows    = s.total,
		       valid_rows    = s.valid,
		       invalid_rows  = s.invalid,
		       created_count = s.created,
		       merged_count  = s.merged,
		       skipped_count = s.skipped,
		       review_count  = s.review,
		       already_contacted_count = s.already,
		       committed_at  = CASE WHEN $2 = 'completed' THEN now() ELSE j.committed_at END
		  FROM (
			SELECT COUNT(*) AS total,
			       COUNT(*) FILTER (WHERE outcome <> 'invalid') AS valid,
			       COUNT(*) FILTER (WHERE outcome = 'invalid') AS invalid,
			       COUNT(*) FILTER (WHERE outcome = 'created') AS created,
			       COUNT(*) FILTER (WHERE outcome = 'merged')  AS merged,
			       COUNT(*) FILTER (WHERE outcome = 'skipped') AS skipped,
			       COUNT(*) FILTER (WHERE outcome = 'needs_review') AS review,
			       COUNT(*) FILTER (WHERE was_already_contacted) AS already
			  FROM import_rows WHERE import_job_id = $1
		  ) s
		 WHERE j.id = $1`, jobID, status)
	return TranslateError(err)
}

func (r *ImportRepo) Preview(ctx context.Context, jobID uuid.UUID, limit int) (domain.ImportPreview, error) {
	var p domain.ImportPreview
	var mapping []byte
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT id, COALESCE(filename, ''), status, total_rows, created_count, merged_count,
		       skipped_count, review_count, invalid_rows, already_contacted_count, column_mapping
		  FROM import_jobs WHERE id = $1`, jobID).
		Scan(&p.JobID, &p.Filename, &p.Status, &p.TotalRows, &p.WillCreate, &p.WillMerge,
			&p.WillSkip, &p.NeedsReview, &p.Invalid, &p.AlreadyContacted, &mapping)
	if err != nil {
		return p, TranslateError(err)
	}
	_ = json.Unmarshal(mapping, &p.ColumnMapping)

	rows, err := r.DB(ctx).Query(ctx, `
		SELECT row_number, normalized, outcome, COALESCE(reason, ''),
		       was_already_contacted, errors
		  FROM import_rows
		 WHERE import_job_id = $1
		 ORDER BY row_number
		 LIMIT $2`, jobID, limit)
	if err != nil {
		return p, TranslateError(err)
	}
	defer rows.Close()

	p.Rows = []domain.ImportRowView{}
	for rows.Next() {
		var v domain.ImportRowView
		var normalized, errs []byte
		if err := rows.Scan(&v.RowNumber, &normalized, &v.Outcome, &v.Reason,
			&v.AlreadyContacted, &errs); err != nil {
			return p, TranslateError(err)
		}
		var n map[string]any
		_ = json.Unmarshal(normalized, &n)
		v.CompanyName = str(n["company_name"])
		v.PhoneDisplay = str(n["phone_display"])
		v.City = str(n["city"])
		v.State = str(n["state"])
		v.Website = str(n["website"])
		_ = json.Unmarshal(errs, &v.Errors)
		if v.Errors == nil {
			v.Errors = []string{}
		}
		p.Rows = append(p.Rows, v)
	}
	return p, rows.Err()
}

func (r *ImportRepo) ListJobs(ctx context.Context) ([]domain.ImportPreview, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT id, COALESCE(filename, ''), status, total_rows, created_count, merged_count,
		       skipped_count, review_count, invalid_rows, already_contacted_count
		  FROM import_jobs
		 ORDER BY created_at DESC
		 LIMIT 50`)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []domain.ImportPreview{}
	for rows.Next() {
		var p domain.ImportPreview
		if err := rows.Scan(&p.JobID, &p.Filename, &p.Status, &p.TotalRows,
			&p.WillCreate, &p.WillMerge, &p.WillSkip, &p.NeedsReview,
			&p.Invalid, &p.AlreadyContacted); err != nil {
			return nil, TranslateError(err)
		}
		p.Rows = []domain.ImportRowView{}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ImportRepo) JobStatus(ctx context.Context, jobID uuid.UUID) (string, error) {
	var status string
	err := r.DB(ctx).QueryRow(ctx, `SELECT status FROM import_jobs WHERE id = $1`, jobID).Scan(&status)
	return status, TranslateError(err)
}

func str(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
