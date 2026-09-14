package postgres

import "context"

type SettingsRepo struct{ *Store }

func NewSettingsRepo(s *Store) *SettingsRepo { return &SettingsRepo{s} }

// EmailSignature is appended to every outgoing message. Kept in one place
// rather than repeated in each template so changing a phone number or a link
// is one edit, not four.
func (r *SettingsRepo) EmailSignature(ctx context.Context) (string, error) {
	var signature string
	err := r.DB(ctx).QueryRow(ctx,
		`SELECT email_signature FROM app_settings WHERE id = 1`).Scan(&signature)
	if err != nil {
		return "", TranslateError(err)
	}
	return signature, nil
}

func (r *SettingsRepo) SetEmailSignature(ctx context.Context, signature string) error {
	_, err := r.DB(ctx).Exec(ctx, `
		INSERT INTO app_settings (id, email_signature, updated_at)
		VALUES (1, $1, now())
		ON CONFLICT (id) DO UPDATE
		   SET email_signature = EXCLUDED.email_signature, updated_at = now()`,
		signature)
	return TranslateError(err)
}

// SendRules caps how a batch can be sent by hand — SendBatch checks these
// before reserving anything, but nothing here runs on its own: without a
// click, no email goes out regardless of day or hour.
type SendRules struct {
	DailyLimit int     `json:"daily_send_limit"`
	Weekdays   []int16 `json:"send_weekdays"` // ISO: 1=segunda..7=domingo
	HourStart  int     `json:"send_hour_start"`
	HourEnd    int     `json:"send_hour_end"`
}

func (r *SettingsRepo) SendRules(ctx context.Context) (SendRules, error) {
	var sr SendRules
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT daily_send_limit, send_weekdays, send_hour_start, send_hour_end
		  FROM app_settings WHERE id = 1`).
		Scan(&sr.DailyLimit, &sr.Weekdays, &sr.HourStart, &sr.HourEnd)
	if err != nil {
		return SendRules{}, TranslateError(err)
	}
	return sr, nil
}

func (r *SettingsRepo) SetSendRules(ctx context.Context, sr SendRules) error {
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE app_settings
		   SET daily_send_limit = $1, send_weekdays = $2,
		       send_hour_start = $3, send_hour_end = $4, updated_at = now()
		 WHERE id = 1`,
		sr.DailyLimit, sr.Weekdays, sr.HourStart, sr.HourEnd)
	return TranslateError(err)
}

// WhatsAppRules paces the automated WhatsApp queue. Kept apart from SendRules
// because the two limits answer to different masters: email is throttled by
// Gmail, WhatsApp bans numbers that behave like software. Unlike SendRules,
// these are enforced continuously — every single message asks permission.
type WhatsAppRules struct {
	DailyLimit     int     `json:"wa_daily_limit"`
	MinIntervalSec int     `json:"wa_min_interval_sec"`
	MaxIntervalSec int     `json:"wa_max_interval_sec"`
	BurstSize      int     `json:"wa_burst_size"`
	BurstPauseMin  int     `json:"wa_burst_pause_min"`
	Weekdays       []int16 `json:"wa_weekdays"` // ISO: 1=segunda..7=domingo
	HourStart      int     `json:"wa_hour_start"`
	HourEnd        int     `json:"wa_hour_end"`
}

func (r *SettingsRepo) WhatsAppRules(ctx context.Context) (WhatsAppRules, error) {
	var wr WhatsAppRules
	err := r.DB(ctx).QueryRow(ctx, `
		SELECT wa_daily_limit, wa_min_interval_sec, wa_max_interval_sec,
		       wa_burst_size, wa_burst_pause_min, wa_weekdays,
		       wa_hour_start, wa_hour_end
		  FROM app_settings WHERE id = 1`).
		Scan(&wr.DailyLimit, &wr.MinIntervalSec, &wr.MaxIntervalSec,
			&wr.BurstSize, &wr.BurstPauseMin, &wr.Weekdays,
			&wr.HourStart, &wr.HourEnd)
	if err != nil {
		return WhatsAppRules{}, TranslateError(err)
	}
	return wr, nil
}

func (r *SettingsRepo) SetWhatsAppRules(ctx context.Context, wr WhatsAppRules) error {
	_, err := r.DB(ctx).Exec(ctx, `
		UPDATE app_settings
		   SET wa_daily_limit = $1, wa_min_interval_sec = $2, wa_max_interval_sec = $3,
		       wa_burst_size = $4, wa_burst_pause_min = $5, wa_weekdays = $6,
		       wa_hour_start = $7, wa_hour_end = $8, updated_at = now()
		 WHERE id = 1`,
		wr.DailyLimit, wr.MinIntervalSec, wr.MaxIntervalSec, wr.BurstSize,
		wr.BurstPauseMin, wr.Weekdays, wr.HourStart, wr.HourEnd)
	return TranslateError(err)
}
