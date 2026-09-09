package http

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/domain"
)

var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

const maxAttachmentSize = 8 << 20 // 8MB — generous for a WhatsApp image, small enough to keep uploads fast

// uploadAttachment stores one image on local disk and registers it. Content
// is fingerprinted by sha256 so re-uploading the same file (a common thing
// when re-selecting the "LP simples"/"LP premium" mockups across templates)
// reuses the existing attachment instead of duplicating storage.
func (a *API) uploadAttachment(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxAttachmentSize + (1 << 20)); err != nil {
		writeError(w, r, domain.Wrap(domain.CodeValidation, "upload inválido", err))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, r, domain.Validation("arquivo é obrigatório"))
		return
	}
	defer file.Close()

	if header.Size > maxAttachmentSize {
		writeError(w, r, domain.Validation("imagem maior que 8MB"))
		return
	}

	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	mimeType := http.DetectContentType(buf[:n])
	ext, ok := allowedImageTypes[mimeType]
	if !ok {
		writeError(w, r, domain.Validation("apenas imagens JPEG, PNG, WEBP ou GIF são aceitas"))
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		writeError(w, r, domain.Wrap(domain.CodeInternal, "falha ao ler arquivo", err))
		return
	}

	hasher := sha256.New()
	tmpPath := filepath.Join(a.UploadsDir, "tmp-"+uuid.NewString())
	if err := os.MkdirAll(a.UploadsDir, 0o755); err != nil {
		writeError(w, r, domain.Wrap(domain.CodeInternal, "não foi possível preparar o armazenamento", err))
		return
	}
	tmpFile, err := os.Create(tmpPath)
	if err != nil {
		writeError(w, r, domain.Wrap(domain.CodeInternal, "não foi possível salvar o arquivo", err))
		return
	}
	size, err := io.Copy(tmpFile, io.TeeReader(file, hasher))
	tmpFile.Close()
	if err != nil {
		os.Remove(tmpPath)
		writeError(w, r, domain.Wrap(domain.CodeInternal, "não foi possível salvar o arquivo", err))
		return
	}
	checksum := hex.EncodeToString(hasher.Sum(nil))

	// Already have this exact file? Reuse it and discard the new copy.
	if existing, err := a.Attachments.FindByChecksum(r.Context(), checksum); err == nil && existing != nil {
		os.Remove(tmpPath)
		writeJSON(w, http.StatusOK, map[string]any{
			"id": existing.ID, "url": "/uploads/" + existing.StorageKey, "filename": existing.Filename,
		})
		return
	}

	storageKey := checksum + ext
	finalPath := filepath.Join(a.UploadsDir, storageKey)
	if err := os.Rename(tmpPath, finalPath); err != nil {
		os.Remove(tmpPath)
		writeError(w, r, domain.Wrap(domain.CodeInternal, "não foi possível salvar o arquivo", err))
		return
	}

	id, err := a.Attachments.Create(r.Context(), postgres.Attachment{
		Filename:   sanitizeFilename(header.Filename),
		StorageKey: storageKey,
		MimeType:   mimeType,
		SizeBytes:  size,
		Checksum:   checksum,
	}, UserFromContext(r.Context()))
	if err != nil {
		writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id": id, "url": "/uploads/" + storageKey, "filename": sanitizeFilename(header.Filename),
	})
}

func sanitizeFilename(name string) string {
	name = filepath.Base(name)
	name = strings.Map(func(r rune) rune {
		if r == '/' || r == '\\' || r == 0 {
			return '_'
		}
		return r
	}, name)
	if name == "" {
		return "imagem"
	}
	return name
}
