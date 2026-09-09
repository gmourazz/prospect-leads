package observability

import (
	"context"
	"log/slog"
	"os"
	"strings"
)

type ctxKey string

const loggerKey ctxKey = "logger"

func New(level string) *slog.Logger {
	var l slog.Level
	switch level {
	case "debug":
		l = slog.LevelDebug
	case "warn":
		l = slog.LevelWarn
	case "error":
		l = slog.LevelError
	default:
		l = slog.LevelInfo
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: l}))
}

func WithLogger(ctx context.Context, logger *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey, logger)
}

// FromContext never returns nil: every layer can log without a nil check and
// without reaching for a package-level global.
func FromContext(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(loggerKey).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}

// MaskPhone keeps enough of a number to correlate logs without writing full
// PII to disk: +55349****8888.
func MaskPhone(e164 string) string {
	if len(e164) < 10 {
		return "***"
	}
	return e164[:6] + "****" + e164[len(e164)-4:]
}

// MaskEmails masks a whole recipient list at once — a message now goes to
// every address known for the business, not just one.
func MaskEmails(emails []string) string {
	masked := make([]string, len(emails))
	for i, e := range emails {
		masked[i] = MaskEmail(e)
	}
	return strings.Join(masked, ", ")
}

// MaskEmail keeps enough of an address to correlate logs without writing the
// full address to disk: ge****@gmail.com.
func MaskEmail(email string) string {
	at := strings.IndexByte(email, '@')
	if at < 2 {
		return "***"
	}
	return email[:2] + "****" + email[at:]
}
