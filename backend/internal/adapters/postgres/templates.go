package postgres

import (
	"context"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/domain"
)

type TemplateRepo struct{ *Store }

func NewTemplateRepo(s *Store) *TemplateRepo { return &TemplateRepo{s} }

const templateSelect = `
	SELECT t.id, t.name, t.description, t.segment_id, s.name, t.audience, t.is_active,
	       v.id, COALESCE(v.version, 0), COALESCE(v.subject, ''), COALESCE(v.body, ''),
	       COALESCE(v.variables, '{}'), t.updated_at
	  FROM message_templates t
	  LEFT JOIN message_template_versions v ON v.id = t.current_version_id
	  LEFT JOIN segments s ON s.id = t.segment_id
	 WHERE t.deleted_at IS NULL`

func (r *TemplateRepo) List(ctx context.Context) ([]domain.Template, error) {
	rows, err := r.DB(ctx).Query(ctx, templateSelect+" ORDER BY t.updated_at DESC")
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []domain.Template{}
	for rows.Next() {
		var t domain.Template
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.SegmentID, &t.SegmentName,
			&t.Audience, &t.IsActive, &t.VersionID, &t.Version, &t.Subject, &t.Body, &t.Variables,
			&t.UpdatedAt); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, TranslateError(err)
	}
	return r.attachImages(ctx, out)
}

func (r *TemplateRepo) attachImages(ctx context.Context, templates []domain.Template) ([]domain.Template, error) {
	attachments := NewAttachmentRepo(r.Store)
	for i := range templates {
		// Always a slice, never nil: a nil slice serializes to JSON `null`,
		// and the frontend calls .length/.map on this unconditionally.
		templates[i].Images = []domain.TemplateImage{}
		if templates[i].VersionID == nil {
			continue
		}
		images, err := attachments.ForVersion(ctx, *templates[i].VersionID)
		if err != nil {
			return nil, err
		}
		for _, img := range images {
			templates[i].Images = append(templates[i].Images, domain.TemplateImage{
				ID: img.ID, URL: img.URL, Filename: img.Filename,
			})
		}
	}
	return templates, nil
}

func (r *TemplateRepo) Get(ctx context.Context, id uuid.UUID) (domain.Template, error) {
	var t domain.Template
	err := r.DB(ctx).QueryRow(ctx, templateSelect+" AND t.id = $1", id).
		Scan(&t.ID, &t.Name, &t.Description, &t.SegmentID, &t.SegmentName,
			&t.Audience, &t.IsActive, &t.VersionID, &t.Version, &t.Subject, &t.Body, &t.Variables,
			&t.UpdatedAt)
	if err != nil {
		return t, TranslateError(err)
	}
	out, err := r.attachImages(ctx, []domain.Template{t})
	if err != nil {
		return t, err
	}
	return out[0], nil
}

type TemplateInput struct {
	Name          string
	Description   string
	SegmentID     *uuid.UUID
	Audience      string
	Subject       string
	Body          string
	Variables     []string
	AttachmentIDs []uuid.UUID // max 5, enforced by a database trigger
}

func (r *TemplateRepo) Create(ctx context.Context, in TemplateInput, by uuid.UUID) (uuid.UUID, error) {
	var templateID uuid.UUID
	err := r.WithTx(ctx, func(ctx context.Context) error {
		if err := r.DB(ctx).QueryRow(ctx, `
			INSERT INTO message_templates (name, description, segment_id, audience, created_by)
			VALUES ($1, NULLIF($2, ''), $3, COALESCE(NULLIF($4, ''), 'any'), $5)
			RETURNING id`, in.Name, in.Description, in.SegmentID, in.Audience, by).Scan(&templateID); err != nil {
			return TranslateError(err)
		}
		versionID, err := r.insertVersion(ctx, templateID, in, by)
		if err != nil {
			return err
		}
		_, err = r.DB(ctx).Exec(ctx,
			`UPDATE message_templates SET current_version_id = $2 WHERE id = $1`,
			templateID, versionID)
		return TranslateError(err)
	})
	return templateID, err
}

// NewVersion never rewrites the previous body or its attached images: what
// was already sent must stay readable exactly as it went out.
func (r *TemplateRepo) NewVersion(ctx context.Context, templateID uuid.UUID, in TemplateInput, by uuid.UUID) error {
	return r.WithTx(ctx, func(ctx context.Context) error {
		versionID, err := r.insertVersion(ctx, templateID, in, by)
		if err != nil {
			return err
		}
		_, err = r.DB(ctx).Exec(ctx, `
			UPDATE message_templates
			   SET current_version_id = $2,
			       name = COALESCE(NULLIF($3, ''), name),
			       description = COALESCE(NULLIF($4, ''), description),
			       segment_id = COALESCE($5, segment_id),
			       audience = COALESCE(NULLIF($6, ''), audience),
			       updated_at = now()
			 WHERE id = $1`, templateID, versionID, in.Name, in.Description, in.SegmentID, in.Audience)
		return TranslateError(err)
	})
}

func (r *TemplateRepo) insertVersion(ctx context.Context, templateID uuid.UUID, in TemplateInput, by uuid.UUID) (uuid.UUID, error) {
	if len(in.AttachmentIDs) > 5 {
		return uuid.Nil, domain.Validation("um template pode ter no máximo 5 imagens")
	}

	var versionID uuid.UUID
	if err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO message_template_versions (template_id, version, subject, body, variables, created_by)
		VALUES ($1,
		        (SELECT COALESCE(MAX(version), 0) + 1
		           FROM message_template_versions WHERE template_id = $1),
		        $2, $3, $4, $5)
		RETURNING id`, templateID, in.Subject, in.Body, in.Variables, by).Scan(&versionID); err != nil {
		return uuid.Nil, TranslateError(err)
	}

	attachments := NewAttachmentRepo(r.Store)
	for i, attachmentID := range in.AttachmentIDs {
		if err := attachments.LinkToVersion(ctx, versionID, attachmentID, i); err != nil {
			return uuid.Nil, err
		}
	}
	return versionID, nil
}

func (r *TemplateRepo) SoftDelete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.DB(ctx).Exec(ctx,
		`UPDATE message_templates SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return TranslateError(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("template")
	}
	return nil
}

func (r *TemplateRepo) VersionBody(ctx context.Context, versionID uuid.UUID) (string, []AttachmentView, error) {
	details, err := r.VersionDetails(ctx, versionID)
	if err != nil {
		return "", nil, err
	}
	return details.Body, details.Images, nil
}

// VersionDetail carries everything SendBatch needs to render and send one
// email: subject, body and the images to attach.
type VersionDetail struct {
	Subject   string
	Body      string
	Images    []AttachmentView
	Variables []string
}

func (r *TemplateRepo) VersionDetails(ctx context.Context, versionID uuid.UUID) (VersionDetail, error) {
	var d VersionDetail
	if err := r.DB(ctx).QueryRow(ctx, `
		SELECT subject, body, COALESCE(variables, '{}')
		  FROM message_template_versions WHERE id = $1`, versionID).
		Scan(&d.Subject, &d.Body, &d.Variables); err != nil {
		return d, TranslateError(err)
	}
	images, err := NewAttachmentRepo(r.Store).ForVersion(ctx, versionID)
	if err != nil {
		return d, err
	}
	d.Images = images
	return d, nil
}
