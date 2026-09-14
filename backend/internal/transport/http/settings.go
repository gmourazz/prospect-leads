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
	writeJSON(w, http.StatusOK, map[string]any{
		"sender_email":     a.SenderEmail,
		"email_signature":  signature,
		"daily_send_limit": rules.DailyLimit,
		"send_weekdays":    rules.Weekdays,
		"send_hour_start":  rules.HourStart,
		"send_hour_end":    rules.HourEnd,
		"sent_today":       sentToday,
	})
}

func (a *API) updateSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		EmailSignature *string  `json:"email_signature"`
		DailySendLimit *int     `json:"daily_send_limit"`
		SendWeekdays   *[]int16 `json:"send_weekdays"`
		SendHourStart  *int     `json:"send_hour_start"`
		SendHourEnd    *int     `json:"send_hour_end"`
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

	a.getSettings(w, r)
}
