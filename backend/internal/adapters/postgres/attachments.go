package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type AttachmentRepo struct{ *Store }

func NewAttachmentRepo(s *Store) *AttachmentRepo { return &AttachmentRepo{s} }

type Attachment struct {
	ID         uuid.UUID
	Filename   string
	StorageKey string
	MimeType   string
	SizeBytes  int64
	Checksum   string
}

// FindByChecksum lets the upload handler dedupe: uploading the same file
// twice returns the same attachment instead of storing it again.
func (r *AttachmentRepo) FindByChecksum(ctx context.Context, checksum string) (*Attachment, error) {
	var a Attachment
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT id, filename, storage_key, mime_type, size_bytes, checksum
		  FROM attachments WHERE checksum = $1`, checksum).
		Scan(&a.ID, &a.Filename, &a.StorageKey, &a.MimeType, &a.SizeBytes, &a.Checksum)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, TranslateError(err)
	}
	return &a, nil
}

func (r *AttachmentRepo) Create(ctx context.Context, a Attachment, by uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.DB(ctx).QueryRow(ctx, `
		INSERT INTO attachments (filename, storage_key, mime_type, size_bytes, checksum, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (checksum) DO UPDATE SET filename = attachments.filename
		RETURNING id`,
		a.Filename, a.StorageKey, a.MimeType, a.SizeBytes, a.Checksum, by).Scan(&id)
	if err != nil {
		return uuid.Nil, TranslateError(err)
	}
	return id, nil
}

func (r *AttachmentRepo) Get(ctx context.Context, id uuid.UUID) (Attachment, error) {
	var a Attachment
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT id, filename, storage_key, mime_type, size_bytes, checksum
		  FROM attachments WHERE id = $1`, id).
		Scan(&a.ID, &a.Filename, &a.StorageKey, &a.MimeType, &a.SizeBytes, &a.Checksum)
	if err != nil {
		return a, TranslateError(err)
	}
	return a, nil
}

// LinkToVersion enforces the ordering and lets the database's own trigger
// reject a 6th image — this call is the only place that constraint can fire.
func (r *AttachmentRepo) LinkToVersion(ctx context.Context, versionID, attachmentID uuid.UUID, sortOrder int) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO template_version_attachments (template_version_id, attachment_id, sort_order)
		VALUES ($1, $2, $3)
		ON CONFLICT (template_version_id, attachment_id) DO UPDATE SET sort_order = $3`,
		versionID, attachmentID, sortOrder)
	return TranslateError(err)
}

type AttachmentView struct {
	ID       uuid.UUID `json:"id"`
	URL      string    `json:"url"`
	Filename string    `json:"filename"`
}

func (r *AttachmentRepo) ForVersion(ctx context.Context, versionID uuid.UUID) ([]AttachmentView, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT a.id, a.storage_key, a.filename
		  FROM template_version_attachments tva
		  JOIN attachments a ON a.id = tva.attachment_id
		 WHERE tva.template_version_id = $1
		 ORDER BY tva.sort_order`, versionID)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []AttachmentView{}
	for rows.Next() {
		var id uuid.UUID
		var storageKey, filename string
		if err := rows.Scan(&id, &storageKey, &filename); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, AttachmentView{ID: id, URL: "/uploads/" + storageKey, Filename: filename})
	}
	return out, rows.Err()
}
