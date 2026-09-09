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
	"mime"
	"net/smtp"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/messaging"
)

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

// buildMessage assembles a raw RFC 5322 message: a multipart/mixed envelope
// with a plain-text body part plus one part per image attachment, each
// base64-encoded with the standard 76-column wrap.
func buildMessage(from string, msg messaging.OutboundMessage, uploadsDir string) ([]byte, error) {
	var b bytes.Buffer

	fmt.Fprintf(&b, "From: %s\r\n", from)
	fmt.Fprintf(&b, "To: %s\r\n", strings.Join(msg.To, ", "))
	fmt.Fprintf(&b, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", msg.Subject))
	fmt.Fprintf(&b, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&b, "Content-Type: multipart/mixed; boundary=%q\r\n\r\n", boundary)

	fmt.Fprintf(&b, "--%s\r\n", boundary)
	fmt.Fprintf(&b, "Content-Type: text/plain; charset=\"utf-8\"\r\n")
	fmt.Fprintf(&b, "Content-Transfer-Encoding: base64\r\n\r\n")
	b.WriteString(base64Wrap([]byte(msg.Body)))
	b.WriteString("\r\n")

	for _, url := range msg.ImageURLs {
		localPath := filepath.Join(uploadsDir, strings.TrimPrefix(url, "/uploads/"))
		data, err := os.ReadFile(localPath)
		if err != nil {
			return nil, fmt.Errorf("anexo %s: %w", filepath.Base(localPath), err)
		}
		contentType := mime.TypeByExtension(filepath.Ext(localPath))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		filename := filepath.Base(localPath)

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
