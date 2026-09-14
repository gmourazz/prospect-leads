// Package gmailsmtp sends real outbound email through a personal Gmail
// account over SMTP, authenticated with an "app password" (Google's simpler
// alternative to full OAuth for this exact use case). No template approval,
// no ban risk to a phone number — the tradeoff is Gmail's own sending limits
// (500 recipients/day on a regular account) and spam-filter reputation,
// which is why this product never tries to send faster than the user
// explicitly asks it to.
package gmailsmtp

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"html"
	"mime"
	"net/smtp"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/messaging"
)

// imageTokenPattern marks WHERE an attached image goes in the message body,
// e.g. {{imagem_1}} for the first entry in msg.ImageURLs (1-based). Mirrors
// the pattern in internal/domain/outreach/render.go — duplicated rather than
// imported so this adapter has no dependency on the domain layer.
var imageTokenPattern = regexp.MustCompile(`\{\{\s*imagem_(\d+)\s*\}\}`)

const smtpAddr = "smtp.gmail.com:587"
const smtpHost = "smtp.gmail.com"

type Gateway struct {
	address     string
	appPassword string
	uploadsDir  string
}

// New builds the gateway. uploadsDir is the same directory the HTTP server
// serves at /uploads/ — attachments are read straight off disk instead of
// looping back through our own HTTP server.
func New(address, appPassword, uploadsDir string) *Gateway {
	return &Gateway{address: address, appPassword: appPassword, uploadsDir: uploadsDir}
}

func (g *Gateway) Name() string { return "gmail_smtp" }

func (g *Gateway) Send(ctx context.Context, msg messaging.OutboundMessage) (messaging.Result, error) {
	if len(msg.To) == 0 {
		return messaging.Result{}, fmt.Errorf("nenhum email para este contato")
	}
	raw, err := buildMessage(g.address, msg, g.uploadsDir)
	if err != nil {
		return messaging.Result{}, err
	}

	auth := smtp.PlainAuth("", g.address, g.appPassword, smtpHost)
	if err := smtpSendMail(ctx, smtpAddr, auth, g.address, msg.To, raw); err != nil {
		return messaging.Result{}, err
	}
	return messaging.Result{ProviderMessageID: uuid.NewString(), Provider: g.Name()}, nil
}

// smtpSendMail wraps smtp.SendMail so a canceled/timed-out context still cuts
// the call short — net/smtp has no native context support.
func smtpSendMail(ctx context.Context, addr string, auth smtp.Auth, from string, to []string, msg []byte) error {
	done := make(chan error, 1)
	go func() { done <- smtp.SendMail(addr, auth, from, to, msg) }()
	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

const boundary = "prospect-boundary"
const relatedBoundary = "prospect-related"
const altBoundary = "prospect-alt"

// buildMessage assembles a raw RFC 5322 message. A body with no {{imagem_N}}
// token keeps the original shape: multipart/mixed, one plain-text part plus
// every image as a plain attachment, in list order. A body that places an
// image with a token switches that referenced image to an inline part shown
// exactly where the token sits (any image NOT referenced stays a plain
// attachment) — the same layout the campaign preview already renders.
func buildMessage(from string, msg messaging.OutboundMessage, uploadsDir string) ([]byte, error) {
	referenced := map[int]bool{}
	for _, m := range imageTokenPattern.FindAllStringSubmatch(msg.Body, -1) {
		if n, err := strconv.Atoi(m[1]); err == nil && n >= 1 && n <= len(msg.ImageURLs) {
			referenced[n] = true
		}
	}

	var b bytes.Buffer
	fmt.Fprintf(&b, "From: %s\r\n", from)
	fmt.Fprintf(&b, "To: %s\r\n", strings.Join(msg.To, ", "))
	fmt.Fprintf(&b, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", msg.Subject))
	fmt.Fprintf(&b, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&b, "Content-Type: multipart/mixed; boundary=%q\r\n\r\n", boundary)

	if len(referenced) == 0 {
		fmt.Fprintf(&b, "--%s\r\n", boundary)
		fmt.Fprintf(&b, "Content-Type: text/plain; charset=\"utf-8\"\r\n")
		fmt.Fprintf(&b, "Content-Transfer-Encoding: base64\r\n\r\n")
		b.WriteString(base64Wrap([]byte(msg.Body)))
		b.WriteString("\r\n")

		for _, url := range msg.ImageURLs {
			data, contentType, filename, err := readImage(uploadsDir, url)
			if err != nil {
				return nil, err
			}
			fmt.Fprintf(&b, "--%s\r\n", boundary)
			fmt.Fprintf(&b, "Content-Type: %s; name=%q\r\n", contentType, filename)
			fmt.Fprintf(&b, "Content-Transfer-Encoding: base64\r\n")
			fmt.Fprintf(&b, "Content-Disposition: attachment; filename=%q\r\n\r\n", filename)
			b.WriteString(base64Wrap(data))
			b.WriteString("\r\n")
		}

		fmt.Fprintf(&b, "--%s--\r\n", boundary)
		return b.Bytes(), nil
	}

	// --boundary(mixed) > --relatedBoundary > [alternative(text/plain,
	// text/html) + one inline part per REFERENCED image] > close related >
	// one plain attachment per image NOT referenced by any token > close mixed.
	fmt.Fprintf(&b, "--%s\r\n", boundary)
	fmt.Fprintf(&b, "Content-Type: multipart/related; boundary=%q\r\n\r\n", relatedBoundary)
	writeAlternative(&b, msg.Body)

	for i, url := range msg.ImageURLs {
		idx := i + 1
		if !referenced[idx] {
			continue
		}
		data, contentType, filename, err := readImage(uploadsDir, url)
		if err != nil {
			return nil, err
		}
		fmt.Fprintf(&b, "--%s\r\n", relatedBoundary)
		fmt.Fprintf(&b, "Content-Type: %s; name=%q\r\n", contentType, filename)
		fmt.Fprintf(&b, "Content-Transfer-Encoding: base64\r\n")
		fmt.Fprintf(&b, "Content-ID: <img%d>\r\n", idx)
		fmt.Fprintf(&b, "Content-Disposition: inline; filename=%q\r\n\r\n", filename)
		b.WriteString(base64Wrap(data))
		b.WriteString("\r\n")
	}
	fmt.Fprintf(&b, "--%s--\r\n", relatedBoundary)

	for i, url := range msg.ImageURLs {
		idx := i + 1
		if referenced[idx] {
			continue
		}
		data, contentType, filename, err := readImage(uploadsDir, url)
		if err != nil {
			return nil, err
		}
		fmt.Fprintf(&b, "--%s\r\n", boundary)
		fmt.Fprintf(&b, "Content-Type: %s; name=%q\r\n", contentType, filename)
		fmt.Fprintf(&b, "Content-Transfer-Encoding: base64\r\n")
		fmt.Fprintf(&b, "Content-Disposition: attachment; filename=%q\r\n\r\n", filename)
		b.WriteString(base64Wrap(data))
		b.WriteString("\r\n")
	}

	fmt.Fprintf(&b, "--%s--\r\n", boundary)
	return b.Bytes(), nil
}

func readImage(uploadsDir, url string) (data []byte, contentType, filename string, err error) {
	localPath := filepath.Join(uploadsDir, strings.TrimPrefix(url, "/uploads/"))
	data, err = os.ReadFile(localPath)
	if err != nil {
		return nil, "", "", fmt.Errorf("anexo %s: %w", filepath.Base(localPath), err)
	}
	contentType = mime.TypeByExtension(filepath.Ext(localPath))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	return data, contentType, filepath.Base(localPath), nil
}

var collapseBlankLines = regexp.MustCompile(`\n{3,}`)

// writeAlternative writes the multipart/alternative part (plain text + HTML)
// inside the caller's still-open multipart/related. Referenced image tokens
// are stripped for the plain-text copy and turned into "cid:imgN" <img> tags
// for the HTML copy, at the exact spot they appear in the template body.
func writeAlternative(b *bytes.Buffer, body string) {
	fmt.Fprintf(b, "--%s\r\n", relatedBoundary)
	fmt.Fprintf(b, "Content-Type: multipart/alternative; boundary=%q\r\n\r\n", altBoundary)

	plainText := imageTokenPattern.ReplaceAllString(body, "")
	plainText = collapseBlankLines.ReplaceAllString(plainText, "\n\n")
	fmt.Fprintf(b, "--%s\r\n", altBoundary)
	fmt.Fprintf(b, "Content-Type: text/plain; charset=\"utf-8\"\r\n")
	fmt.Fprintf(b, "Content-Transfer-Encoding: base64\r\n\r\n")
	b.WriteString(base64Wrap([]byte(plainText)))
	b.WriteString("\r\n")

	htmlBody := html.EscapeString(body)
	htmlBody = strings.ReplaceAll(htmlBody, "\n", "<br>\n")
	htmlBody = imageTokenPattern.ReplaceAllStringFunc(htmlBody, func(m string) string {
		sub := imageTokenPattern.FindStringSubmatch(m)
		idx, _ := strconv.Atoi(sub[1])
		return fmt.Sprintf(`<img src="cid:img%d" alt="" style="max-width:100%%;display:block;margin:8px 0;">`, idx)
	})
	fmt.Fprintf(b, "--%s\r\n", altBoundary)
	fmt.Fprintf(b, "Content-Type: text/html; charset=\"utf-8\"\r\n")
	fmt.Fprintf(b, "Content-Transfer-Encoding: base64\r\n\r\n")
	b.WriteString(base64Wrap([]byte("<html><body>" + htmlBody + "</body></html>")))
	b.WriteString("\r\n")

	fmt.Fprintf(b, "--%s--\r\n", altBoundary)
}

func base64Wrap(data []byte) string {
	encoded := base64.StdEncoding.EncodeToString(data)
	var out strings.Builder
	for i := 0; i < len(encoded); i += 76 {
		end := i + 76
		if end > len(encoded) {
			end = len(encoded)
		}
		out.WriteString(encoded[i:end])
		out.WriteString("\r\n")
	}
	return out.String()
}
