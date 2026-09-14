package http

import (
	"net/http"

	"github.com/geovanna/prospect/backend/internal/domain"
)

// Settings exposes the sender configuration the frontend needs: which
// address messages go out from, the signature appended to every message, and
// the manual-send rate rules. SendBatch still gates on allowed weekdays and
// hours; daily_send_limit is informational only (Gmail's own daily sending
// limit still applies regardless of what's set here).
func (a *API) getSettings(w http.ResponseWriter, r *http.Request) {
	signature, err := a.Settings.EmailSignature(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	rules, err := a.Settings.SendRules(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	sentToday, err := a.Outreach.SentToday(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	wa, err := a.Settings.WhatsAppRules(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"sender_email":     a.SenderEmail,
		"email_signature":  signature,
		"daily_send_limit": rules.DailyLimit,
		"send_weekdays":    rules.Weekdays,
		"send_hour_start":  rules.HourStart,
		"send_hour_end":    rules.HourEnd,
		"sent_today":       sentToday,

		"wa_daily_limit":      wa.DailyLimit,
		"wa_min_interval_sec": wa.MinIntervalSec,
		"wa_max_interval_sec": wa.MaxIntervalSec,
		"wa_burst_size":       wa.BurstSize,
		"wa_burst_pause_min":  wa.BurstPauseMin,
		"wa_weekdays":         wa.Weekdays,
		"wa_hour_start":       wa.HourStart,
		"wa_hour_end":         wa.HourEnd,
	})
}

func (a *API) updateSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		EmailSignature *string  `json:"email_signature"`
		DailySendLimit *int     `json:"daily_send_limit"`
		SendWeekdays   *[]int16 `json:"send_weekdays"`
		SendHourStart  *int     `json:"send_hour_start"`
		SendHourEnd    *int     `json:"send_hour_end"`

		WADailyLimit     *int     `json:"wa_daily_limit"`
		WAMinIntervalSec *int     `json:"wa_min_interval_sec"`
		WAMaxIntervalSec *int     `json:"wa_max_interval_sec"`
		WABurstSize      *int     `json:"wa_burst_size"`
		WABurstPauseMin  *int     `json:"wa_burst_pause_min"`
		WAWeekdays       *[]int16 `json:"wa_weekdays"`
		WAHourStart      *int     `json:"wa_hour_start"`
		WAHourEnd        *int     `json:"wa_hour_end"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, r, err)
		return
	}

	if body.EmailSignature != nil {
		if err := a.Settings.SetEmailSignature(r.Context(), *body.EmailSignature); err != nil {
			writeError(w, r, err)
			return
		}
	}

	if body.DailySendLimit != nil || body.SendWeekdays != nil || body.SendHourStart != nil || body.SendHourEnd != nil {
		current, err := a.Settings.SendRules(r.Context())
		if err != nil {
			writeError(w, r, err)
			return
		}
		if body.DailySendLimit != nil {
			current.DailyLimit = *body.DailySendLimit
		}
		if body.SendWeekdays != nil {
			current.Weekdays = *body.SendWeekdays
		}
		if body.SendHourStart != nil {
			current.HourStart = *body.SendHourStart
		}
		if body.SendHourEnd != nil {
			current.HourEnd = *body.SendHourEnd
		}
		if current.DailyLimit <= 0 {
			writeError(w, r, domain.Validation("daily_send_limit deve ser maior que zero"))
			return
		}
		if current.HourStart < 0 || current.HourStart >= 24 ||
			current.HourEnd <= 0 || current.HourEnd > 24 || current.HourStart >= current.HourEnd {
			writeError(w, r, domain.Validation("horário de envio inválido"))
			return
		}
		if err := a.Settings.SetSendRules(r.Context(), current); err != nil {
			writeError(w, r, err)
			return
		}
	}

	if body.WADailyLimit != nil || body.WAMinIntervalSec != nil || body.WAMaxIntervalSec != nil ||
		body.WABurstSize != nil || body.WABurstPauseMin != nil || body.WAWeekdays != nil ||
		body.WAHourStart != nil || body.WAHourEnd != nil {
		wa, err := a.Settings.WhatsAppRules(r.Context())
		if err != nil {
			writeError(w, r, err)
			return
		}
		if body.WADailyLimit != nil {
			wa.DailyLimit = *body.WADailyLimit
		}
		if body.WAMinIntervalSec != nil {
			wa.MinIntervalSec = *body.WAMinIntervalSec
		}
		if body.WAMaxIntervalSec != nil {
			wa.MaxIntervalSec = *body.WAMaxIntervalSec
		}
		if body.WABurstSize != nil {
			wa.BurstSize = *body.WABurstSize
		}
		if body.WABurstPauseMin != nil {
			wa.BurstPauseMin = *body.WABurstPauseMin
		}
		if body.WAWeekdays != nil {
			wa.Weekdays = *body.WAWeekdays
		}
		if body.WAHourStart != nil {
			wa.HourStart = *body.WAHourStart
		}
		if body.WAHourEnd != nil {
			wa.HourEnd = *body.WAHourEnd
		}
		// Loosening these is how a number gets banned, so the bounds are
		// refused here rather than only by the CHECK constraint — the message
		// needs to explain itself.
		switch {
		case wa.DailyLimit <= 0 || wa.DailyLimit > 200:
			writeError(w, r, domain.Validation("limite diário do WhatsApp deve ficar entre 1 e 200"))
			return
		case wa.MinIntervalSec < 20:
			writeError(w, r, domain.Validation("intervalo mínimo entre mensagens não pode ser menor que 20 segundos"))
			return
		case wa.MaxIntervalSec < wa.MinIntervalSec:
			writeError(w, r, domain.Validation("intervalo máximo não pode ser menor que o mínimo"))
			return
		case wa.BurstSize <= 0 || wa.BurstSize > 50:
			writeError(w, r, domain.Validation("mensagens por rodada deve ficar entre 1 e 50"))
			return
		case wa.BurstPauseMin < 0:
			writeError(w, r, domain.Validation("pausa entre rodadas inválida"))
			return
		case wa.HourStart < 0 || wa.HourStart >= 24 || wa.HourEnd <= 0 ||
			wa.HourEnd > 24 || wa.HourStart >= wa.HourEnd:
			writeError(w, r, domain.Validation("horário de envio do WhatsApp inválido"))
			return
		}
		if err := a.Settings.SetWhatsAppRules(r.Context(), wa); err != nil {
			writeError(w, r, err)
			return
		}
	}

	a.getSettings(w, r)
}
