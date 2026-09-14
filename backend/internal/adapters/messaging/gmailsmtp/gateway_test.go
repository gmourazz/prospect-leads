package gmailsmtp

import (
	"mime"
	"mime/multipart"
	"net/mail"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/geovanna/prospect/backend/internal/adapters/messaging"
)

func writeFixtureImage(t *testing.T, dir, name string) string {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte("fake-image-bytes"), 0o644); err != nil {
		t.Fatal(err)
	}
	return "/uploads/" + name
}

// walk recursively collects every leaf MIME part (skips container parts),
// keyed by their Content-Type, Content-Disposition and Content-ID headers.
type part struct {
	contentType string
	disposition string
	contentID   string
}

func walk(t *testing.T, r *multipart.Reader) []part {
	t.Helper()
	var out []part
	for {
		p, err := r.NextPart()
		if err != nil {
			break
		}
		ct := p.Header.Get("Content-Type")
		mediaType, params, err := mime.ParseMediaType(ct)
		if err != nil {
			t.Fatalf("invalid Content-Type %q: %v", ct, err)
		}
		if strings.HasPrefix(mediaType, "multipart/") {
			out = append(out, walk(t, multipart.NewReader(p, params["boundary"]))...)
			continue
		}
		out = append(out, part{
			contentType: mediaType,
			disposition: p.Header.Get("Content-Disposition"),
			contentID:   p.Header.Get("Content-ID"),
		})
	}
	return out
}

func parseParts(t *testing.T, raw []byte) []part {
	t.Helper()
	m, err := mail.ReadMessage(strings.NewReader(string(raw)))
	if err != nil {
		t.Fatalf("mail.ReadMessage: %v", err)
	}
	_, params, err := mime.ParseMediaType(m.Header.Get("Content-Type"))
	if err != nil {
		t.Fatalf("mime.ParseMediaType: %v", err)
	}
	return walk(t, multipart.NewReader(m.Body, params["boundary"]))
}

func TestBuildMessage_NoImageTokens(t *testing.T) {
	dir := t.TempDir()
	url := writeFixtureImage(t, dir, "a.jpg")

	raw, err := buildMessage("me@example.com", messaging.OutboundMessage{
		To:        []string{"lead@example.com"},
		Subject:   "Oi",
		Body:      "Mensagem sem imagem posicionada.",
		ImageURLs: []string{url},
	}, dir)
	if err != nil {
		t.Fatal(err)
	}

	parts := parseParts(t, raw)
	if len(parts) != 2 {
		t.Fatalf("want 2 parts (text + attachment), got %d: %+v", len(parts), parts)
	}
	if parts[0].contentType != "text/plain" {
		t.Errorf("part 0 = %q, want text/plain", parts[0].contentType)
	}
	if !strings.Contains(parts[1].disposition, "attachment") {
		t.Errorf("image part disposition = %q, want attachment", parts[1].disposition)
	}
	if parts[1].contentID != "" {
		t.Errorf("image part should have no Content-ID when not referenced, got %q", parts[1].contentID)
	}
}

func TestBuildMessage_WithImageToken(t *testing.T) {
	dir := t.TempDir()
	inlineURL := writeFixtureImage(t, dir, "inline.jpg")
	extraURL := writeFixtureImage(t, dir, "extra.jpg")

	raw, err := buildMessage("me@example.com", messaging.OutboundMessage{
		To:      []string{"lead@example.com"},
		Subject: "Oi",
		Body:    "Olha o exemplo:\n\n{{imagem_1}}\n\nTe mando mais depois.",
		// imagem_1 -> inlineURL (index 1); extraURL has no token pointing at
		// it (index 2) and must stay a plain attachment.
		ImageURLs: []string{inlineURL, extraURL},
	}, dir)
	if err != nil {
		t.Fatal(err)
	}

	parts := parseParts(t, raw)
	// text/plain + text/html (alternative) + 1 inline image + 1 attachment.
	if len(parts) != 4 {
		t.Fatalf("want 4 leaf parts, got %d: %+v", len(parts), parts)
	}

	var sawPlain, sawHTML, sawInline, sawAttachment bool
	for _, p := range parts {
		switch {
		case p.contentType == "text/plain":
			sawPlain = true
		case p.contentType == "text/html":
			sawHTML = true
		case p.contentID == "<img1>" && strings.Contains(p.disposition, "inline"):
			sawInline = true
		case strings.Contains(p.disposition, "attachment") && p.contentID == "":
			sawAttachment = true
		}
	}
	if !sawPlain {
		t.Error("missing text/plain alternative")
	}
	if !sawHTML {
		t.Error("missing text/html alternative")
	}
	if !sawInline {
		t.Errorf("missing inline image with Content-ID <img1>: %+v", parts)
	}
	if !sawAttachment {
		t.Errorf("missing plain attachment for the unreferenced image: %+v", parts)
	}
}
