package application

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/outreach"
	"github.com/geovanna/prospect/backend/internal/observability"
)

// The pacing brain for the automated WhatsApp channel.
//
// The bridge (whatsapp-bridge/, a local Baileys session) is deliberately
// stupid: it asks "may I send something?", and this service answers either
// with one message or with a number of milliseconds to wait. Every rule that
// decides how fast cold outreach leaves the number lives here, in Go, backed
// by database state — not in the Node process, which can be restarted, and
// not in the browser, which can be closed.
//
// The service never pushes. Nothing sends unless the bridge asks, and the
// bridge only runs while the user has a terminal open on her own machine.

type WhatsAppAgentService struct {
	repo      *postgres.WhatsAppRepo
	templates *postgres.TemplateRepo
	settings  *postgres.SettingsRepo
}

func NewWhatsAppAgentService(
	repo *postgres.WhatsAppRepo,
	templates *postgres.TemplateRepo,
	settings *postgres.SettingsRepo,
) *WhatsAppAgentService {
	return &WhatsAppAgentService{repo, templates, settings}
}

// staleAfter is how long a message may sit in 'sending' before the queue
// assumes the bridge died holding it and takes it back.
const staleAfter = 10 * time.Minute

// Poll intervals for the three ways there is nothing to do. They are minutes,
// not seconds, because a bridge hammering the API adds nothing: the next
// message is gated by next_allowed_at regardless of how often it asks.
const (
	waitPaused     = 60 * time.Second
	waitEmptyQueue = 30 * time.Second
	waitCapped     = 10 * time.Minute
	waitMaxWindow  = 15 * time.Minute
)

// saoPaulo anchors the allowed-hours window to Brazilian business hours
// regardless of where the server runs — Fly machines are UTC, and a window
// silently shifted by three hours would send at 6am.
var saoPaulo = func() *time.Location {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return time.UTC
	}
	return loc
}()

type AgentJob struct {
	DispatchID   uuid.UUID `json:"dispatch_id"`
	PhoneE164    string    `json:"phone_e164"`
	CompanyName  string    `json:"company_name"`
	RenderedBody string    `json:"rendered_body"`
}

// ClaimOutcome is the bridge's entire instruction set: send this, or sleep
// this long. Never both.
type ClaimOutcome struct {
	Job    *AgentJob `json:"job"`
	WaitMS int64     `json:"wait_ms"`
	Reason string    `json:"reason"`
}

func wait(d time.Duration, reason string) ClaimOutcome {
	return ClaimOutcome{WaitMS: d.Milliseconds(), Reason: reason}
}

// Claim runs the full gauntlet in order of cheapness, and every gate that
// fails answers with a wait instead of an error — a bridge that only ever
// gets told "not yet" is working exactly as intended.
func (s *WhatsAppAgentService) Claim(ctx context.Context) (ClaimOutcome, error) {
	logger := observability.FromContext(ctx)

	if released, err := s.repo.ReleaseStale(ctx, staleAfter); err != nil {
		return ClaimOutcome{}, err
	} else if released > 0 {
		logger.Info("released stale whatsapp dispatches",
			"action", "whatsapp.stale.released", "count", released)
	}

	state, err := s.repo.State(ctx)
	if err != nil {
		return ClaimOutcome{}, err
	}
	if state.Paused {
		reason := "fila pausada"
		if state.PauseReason != nil && *state.PauseReason != "" {
			reason = *state.PauseReason
		}
		return wait(waitPaused, reason), nil
	}

	rules, err := s.settings.WhatsAppRules(ctx)
	if err != nil {
		return ClaimOutcome{}, err
	}

	if d, ok := untilWindowOpens(time.Now(), rules); !ok {
		return wait(d, "fora do horário de envio"), nil
	}

	sentToday, err := s.repo.SentToday(ctx)
	if err != nil {
		return ClaimOutcome{}, err
	}
	if sentToday >= rules.DailyLimit {
		return wait(waitCapped, fmt.Sprintf("limite diário atingido (%d)", rules.DailyLimit)), nil
	}

	// The cooldown from the previous message. This is the gate that actually
	// spaces messages out; everything above it is a coarser guard. The
	// remaining time is measured by Postgres — see AgentState.WaitFor.
	if state.WaitFor > 0 {
		return wait(state.WaitFor, "aguardando intervalo entre mensagens"), nil
	}

	job, err := s.repo.ClaimNext(ctx)
	if err != nil {
		return ClaimOutcome{}, err
	}
	if job == nil {
		return wait(waitEmptyQueue, "fila vazia"), nil
	}

	body, err := s.render(ctx, *job)
	if err != nil {
		// The message was already claimed, so it cannot be left in 'sending'
		// with no one working on it.
		_ = s.repo.MarkFailed(ctx, job.DispatchID, "render_failed", err.Error())
		return ClaimOutcome{}, err
	}

	// The cooldown is charged HERE, before the message is even handed over —
	// see ScheduleNext. Whatever the bridge does with it next, including
	// nothing at all, the queue is already closed for the next interval.
	if err := s.scheduleNext(ctx, rules, state.BurstCount); err != nil {
		return ClaimOutcome{}, err
	}

	logger.Info("whatsapp job claimed", "action", "whatsapp.job.claimed",
		"dispatch_id", job.DispatchID, "contact_point_id", job.ContactPointID)

	return ClaimOutcome{Job: &AgentJob{
		DispatchID:   job.DispatchID,
		PhoneE164:    job.PhoneE164,
		CompanyName:  job.CompanyName,
		RenderedBody: body,
	}}, nil
}

// render resolves the template at send time rather than at queue time, so
// {{saudacao}} matches the hour the message actually goes out and the spintax
// draw is different for every recipient.
func (s *WhatsAppAgentService) render(ctx context.Context, job postgres.Job) (string, error) {
	details, err := s.templates.VersionDetails(ctx, job.TemplateVersionID)
	if err != nil {
		return "", err
	}
	segment, city, state := "", "", ""
	if job.SegmentName != nil {
		segment = *job.SegmentName
	}
	if job.City != nil {
		city = *job.City
	}
	if job.State != nil {
		state = *job.State
	}
	vars := outreach.BuildVars(job.CompanyName, segment, city, state)
	return outreach.Spin(outreach.Render(details.Body, vars)), nil
}

// ReportResult closes one attempt and sets the clock for the next one.
type ReportResultCommand struct {
	DispatchID uuid.UUID
	Delivered  bool
	// RenderedBody is what the bridge actually sent. It comes back from the
	// bridge rather than being re-rendered here because it is not
	// reproducible: the spintax draw happened once, at claim time.
	RenderedBody      string
	ProviderMessageID string
	ErrorCode         string
	ErrorMessage      string
}

// fatalCodes are the ones that mean "stop entirely", not "this one failed".
// Reported by the bridge when WhatsApp itself pushes back.
var fatalCodes = map[string]string{
	"logged_out":   "sessão do WhatsApp foi desconectada",
	"blocked":      "o WhatsApp restringiu este número",
	"rate_limited": "o WhatsApp sinalizou excesso de envios",
}

func (s *WhatsAppAgentService) ReportResult(ctx context.Context, cmd ReportResultCommand) error {
	logger := observability.FromContext(ctx).With("dispatch_id", cmd.DispatchID)

	job, err := s.repo.ClaimedJob(ctx, cmd.DispatchID)
	if err != nil {
		return err
	}

	if cmd.Delivered {
		snapshot := map[string]any{
			"company_name": job.CompanyName,
			"channel":      "whatsapp",
			"mode":         "automatico",
		}
		if err := s.repo.MarkSent(ctx, *job, cmd.RenderedBody, cmd.ProviderMessageID, snapshot); err != nil {
			return err
		}
		logger.Info("whatsapp message sent", "action", "whatsapp.message.sent",
			"contact_point_id", job.ContactPointID)
	} else {
		code := cmd.ErrorCode
		if code == "" {
			code = "provider_unavailable"
		}
		if err := s.repo.MarkFailed(ctx, cmd.DispatchID, code, cmd.ErrorMessage); err != nil {
			return err
		}
		logger.Error("whatsapp message failed", "action", "whatsapp.message.failed",
			"contact_point_id", job.ContactPointID, "error_code", code)
	}

	// A fatal signal stops the queue before the next message is even
	// considered. Getting this wrong is the difference between one bad send
	// and a burned number.
	if reason, fatal := fatalCodes[cmd.ErrorCode]; fatal {
		if err := s.repo.SetPaused(ctx, true, reason); err != nil {
			return err
		}
		logger.Error("whatsapp queue paused by provider signal",
			"action", "whatsapp.queue.halted", "reason", reason)
	}

	// Nothing here touches the cooldown: it was already charged when this
	// message was claimed.
	return nil
}

// scheduleNext applies the per-message interval, or the long pause when this
// message closes out a burst.
//
// The burst pause exists because an even drip is itself a tell: a person who
// sends five messages and then goes quiet for half an hour looks like someone
// working through a list between other things, while one message every two
// minutes for three hours looks like exactly what it is.
func (s *WhatsAppAgentService) scheduleNext(ctx context.Context, rules postgres.WhatsAppRules, burstCount int) error {
	if burstCount+1 >= rules.BurstSize {
		return s.repo.ScheduleNext(ctx, time.Duration(rules.BurstPauseMin)*time.Minute, true)
	}
	return s.repo.ScheduleNext(ctx, randomInterval(rules), false)
}

func randomInterval(rules postgres.WhatsAppRules) time.Duration {
	spread := rules.MaxIntervalSec - rules.MinIntervalSec
	seconds := rules.MinIntervalSec
	if spread > 0 {
		seconds += rand.Intn(spread + 1)
	}
	return time.Duration(seconds) * time.Second
}

// untilWindowOpens reports whether now falls inside the allowed weekday/hour
// window and, when it does not, how long to sleep before asking again. The
// wait is capped so that a settings change takes effect within minutes
// instead of at the end of a computed multi-hour sleep.
func untilWindowOpens(now time.Time, rules postgres.WhatsAppRules) (time.Duration, bool) {
	local := now.In(saoPaulo)

	weekday := int(local.Weekday())
	if weekday == 0 {
		weekday = 7 // ISO: segunda=1 .. domingo=7
	}
	allowedDay := false
	for _, d := range rules.Weekdays {
		if int(d) == weekday {
			allowedDay = true
			break
		}
	}
	if !allowedDay {
		return waitMaxWindow, false
	}

	hour := local.Hour()
	if hour < rules.HourStart {
		opensAt := time.Date(local.Year(), local.Month(), local.Day(),
			rules.HourStart, 0, 0, 0, saoPaulo)
		return min(time.Until(opensAt), waitMaxWindow), false
	}
	if hour >= rules.HourEnd {
		return waitMaxWindow, false
	}
	return 0, true
}

// ------------------------------------------------------------ operação

type QueueStatus struct {
	State  postgres.AgentState    `json:"state"`
	Counts postgres.QueueCounts   `json:"counts"`
	Rules  postgres.WhatsAppRules `json:"rules"`
	Recent []postgres.QueueItem   `json:"recent"`
}

func (s *WhatsAppAgentService) Status(ctx context.Context, from, to *time.Time) (QueueStatus, error) {
	var out QueueStatus
	var err error
	if out.State, err = s.repo.State(ctx); err != nil {
		return out, err
	}
	if out.Counts, err = s.repo.Counts(ctx); err != nil {
		return out, err
	}
	if out.Rules, err = s.settings.WhatsAppRules(ctx); err != nil {
		return out, err
	}
	// A wider window than the default 30 whenever a date range narrows the
	// result anyway — otherwise a busy day past the first 30 rows would look
	// empty for no reason once it's filtered.
	limit := 30
	if from != nil || to != nil {
		limit = 200
	}
	if out.Recent, err = s.repo.Recent(ctx, limit, from, to); err != nil {
		return out, err
	}
	return out, nil
}

func (s *WhatsAppAgentService) Enqueue(ctx context.Context, leadIDs []uuid.UUID, templateVersionID uuid.UUID) (postgres.EnqueueResult, error) {
	if len(leadIDs) == 0 {
		return postgres.EnqueueResult{}, domain.Validation("nenhum lead selecionado")
	}
	if _, err := s.templates.VersionDetails(ctx, templateVersionID); err != nil {
		return postgres.EnqueueResult{}, err
	}
	return s.repo.Enqueue(ctx, leadIDs, templateVersionID)
}

// SetPaused is the manual half of the kill switch. Resuming deliberately
// pushes the clock forward by one full interval so that hitting "retomar"
// never fires a message instantly.
func (s *WhatsAppAgentService) SetPaused(ctx context.Context, paused bool, reason string) error {
	if err := s.repo.SetPaused(ctx, paused, reason); err != nil {
		return err
	}
	if paused {
		return nil
	}
	rules, err := s.settings.WhatsAppRules(ctx)
	if err != nil {
		return err
	}
	return s.repo.ScheduleNext(ctx, randomInterval(rules), true)
}

func (s *WhatsAppAgentService) ClearQueue(ctx context.Context) (int, error) {
	return s.repo.ClearQueue(ctx)
}

func (s *WhatsAppAgentService) SetConnection(ctx context.Context, connection, lastError string) error {
	switch connection {
	case postgres.ConnOffline, postgres.ConnConnecting, postgres.ConnQRRequired,
		postgres.ConnConnected, postgres.ConnLoggedOut, postgres.ConnBlocked:
	default:
		return domain.Validation("estado de conexão inválido")
	}
	return s.repo.SetConnection(ctx, connection, lastError)
}
