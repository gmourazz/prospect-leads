package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/domain"
)

type SegmentRepo struct{ *Store }

func NewSegmentRepo(s *Store) *SegmentRepo { return &SegmentRepo{s} }

func (r *SegmentRepo) List(ctx context.Context) ([]domain.Segment, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT s.id, s.slug, s.name, COALESCE(s.color, 'slate'), COALESCE(s.icon, 'Tag'),
		       s.is_active, s.sort_order,
		       (SELECT COUNT(*) FROM leads l
		         WHERE l.deleted_at IS NULL
		           AND COALESCE(l.segment_id, (SELECT c.segment_id FROM companies c WHERE c.id = l.company_id)) = s.id)
		  FROM segments s
		 ORDER BY s.sort_order, s.name`)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []domain.Segment{}
	for rows.Next() {
		var s domain.Segment
		if err := rows.Scan(&s.ID, &s.Slug, &s.Name, &s.Color, &s.Icon,
			&s.IsActive, &s.SortOrder, &s.LeadCount); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *SegmentRepo) Create(ctx context.Context, slug, name, color, icon string) (domain.Segment, error) {
	var s domain.Segment
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO segments (slug, name, color, icon, sort_order)
		VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM segments))
		RETURNING id, slug, name, COALESCE(color, 'slate'), COALESCE(icon, 'Tag'), is_active, sort_order`,
		slug, name, color, icon).
		Scan(&s.ID, &s.Slug, &s.Name, &s.Color, &s.Icon, &s.IsActive, &s.SortOrder)
	if err != nil {
		return s, TranslateError(err)
	}
	return s, nil
}

func (r *SegmentRepo) Update(ctx context.Context, id uuid.UUID, name, color, icon string, active *bool) error {
	tag, err := r.DB(ctx).Exec(ctx, `
		UPDATE segments
		   SET name  = COALESCE(NULLIF($2, ''), name),
		       color = COALESCE(NULLIF($3, ''), color),
		       icon  = COALESCE(NULLIF($4, ''), icon),
		       is_active = COALESCE($5, is_active),
		       updated_at = now()
		 WHERE id = $1`, id, name, color, icon, active)
	if err != nil {
		return TranslateError(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("segmento")
	}
	return nil
}

func (r *SegmentRepo) FindBySlugOrName(ctx context.Context, value string) (*uuid.UUID, error) {
	var id uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT id FROM segments
		 WHERE slug = $1 OR lower(name) = lower($1)
		 LIMIT 1`, value).Scan(&id)
	if err != nil {
		return nil, nil
	}
	return &id, nil
}
