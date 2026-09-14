package postgres

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"
)

type SearchRunRepo struct{ *Store }

func NewSearchRunRepo(s *Store) *SearchRunRepo { return &SearchRunRepo{s} }

type SearchRun struct {
	ID           uuid.UUID  `json:"id"`
	SegmentID    *uuid.UUID `json:"segment_id"`
	SegmentLabel string     `json:"segment_label"`
	City         string     `json:"city"`
	State        string     `json:"state"`
	LeadsFound   int        `json:"leads_found"`
	CreatedAt    time.Time  `json:"created_at"`
}

func (r *SearchRunRepo) Record(ctx context.Context, run SearchRun) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO search_runs (segment_id, segment_label, city, state, leads_found)
		VALUES ($1, $2, $3, $4, $5)`,
		run.SegmentID, run.SegmentLabel, run.City, run.State, run.LeadsFound)
	return TranslateError(err)
}

// Recent returns the newest run per segment+city+state pair, so repeating the
// same search doesn't push every other one out of the list.
func (r *SearchRunRepo) Recent(ctx context.Context, limit int) ([]SearchRun, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT DISTINCT ON (segment_label, city, state)
		       id, segment_id, segment_label, city, state, leads_found, created_at
		  FROM search_runs
		 ORDER BY segment_label, city, state, created_at DESC`)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	runs := []SearchRun{}
	for rows.Next() {
		var run SearchRun
		if err := rows.Scan(&run.ID, &run.SegmentID, &run.SegmentLabel, &run.City,
			&run.State, &run.LeadsFound, &run.CreatedAt); err != nil {
			return nil, TranslateError(err)
		}
		runs = append(runs, run)
	}
	if err := rows.Err(); err != nil {
		return nil, TranslateError(err)
	}

	sort.Slice(runs, func(i, j int) bool { return runs[i].CreatedAt.After(runs[j].CreatedAt) })
	if len(runs) > limit {
		runs = runs[:limit]
	}
	return runs, nil
}
