package application

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/messaging"
	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/outreach"
	"github.com/geovanna/prospect/backend/internal/observability"
)

type OutreachService struct {
	store     *postgres.Store
	repo      *postgres.OutreachRepo
	leads     *postgres.LeadRepo
	templates *postgres.TemplateRepo
	idem      *postgres.IdempotencyRepo
	settings  *postgres.SettingsRepo
	gateway   messaging.Gateway
}

func NewOutreachService(
	store *postgres.Store,
	repo *postgres.OutreachRepo,
	leads *postgres.LeadRepo,
	templates *postgres.TemplateRepo,
	idem *postgres.IdempotencyRepo,
	settings *postgres.SettingsRepo,
	gateway messaging.Gateway,
) *OutreachService {
	return &OutreachService{store, repo, leads, templates, idem, settings, gateway}
}

// withSignature appends the sender's signature to a rendered body. It lives
// outside the template on purpose: the signature is the same in every
// message, so it is stored once and changing it never means editing (and
// possibly missing) a template.
func withSignature(body, signature string) string {
	if signature == "" {
		return body
	}
	return body + "\n\n" + signature
}

type CreateCampaignCommand struct {
	Name              string
	TemplateVersionID uuid.UUID
	Filters           domain.LeadFilters
	FiltersRaw        map[string]any
	BatchSize         int
	UserID            uuid.UUID
}

// CreateCampaign snapshots the eligible set at selection time. Contacts that
// were already messaged or suppressed still enter as `excluded`, so the UI can
// explain the gap between "100 encontrados" and "80 disponíveis" instead of
// silently showing fewer rows.
func (s *OutreachService) CreateCampaign(ctx context.Context, cmd CreateCampaignCommand) (domain.Campaign, error) {
	if cmd.Name == "" {
		return domain.Campaign{}, domain.Validation("nome da campanha é obrigatório")
	}
	if cmd.BatchSize <= 0 || cmd.BatchSize > 50 {
		cmd.BatchSize = 10
	}

	var campaignID uuid.UUID
	err := s.store.WithTx(ctx, func(ctx context.Context) error {
		id, err := s.repo.CreateCampaign(ctx, cmd.Name, cmd.TemplateVersionID,
			cmd.Filters.SegmentID, cmd.FiltersRaw, cmd.BatchSize, cmd.UserID)
		if err != nil {
			return err
		}
		campaignID = id

		selected, err := s.leads.SelectableContacts(ctx, cmd.Filters, false, 5000)
		if err != nil {
			return err
		}
		if len(selected) == 0 {
			return domain.New(domain.CodeNoEligibleTargets,
				"nenhum lead com email corresponde a este filtro")
		}

		targets := make([]postgres.TargetInput, 0, len(selected))
		for _, t := range selected {
			targets = append(targets, postgres.TargetInput{
				ContactPointID: t.ContactPointID,
				LeadID:         t.LeadID,
				CompanyID:      t.CompanyID,
				RenderVars:     outreach.BuildVars(t.CompanyName, t.SegmentName, t.City, t.State),
			})
		}
		return s.repo.AddTargets(ctx, campaignID, targets)
	})
	if err != nil {
		return domain.Campaign{}, err
	}
	return s.repo.GetCampaign(ctx, campaignID)
}

// SentToday backs the "quantos já saíram hoje" reading the settings screen
// shows next to the daily cap.
func (s *OutreachService) SentToday(ctx context.Context) (int, error) {
	return s.repo.CountSentToday(ctx)
}

func (s *OutreachService) ListCampaigns(ctx context.Context) ([]domain.Campaign, error) {
	return s.repo.ListCampaigns(ctx)
}

func (s *OutreachService) GetCampaign(ctx context.Context, id uuid.UUID) (domain.Campaign, error) {
	return s.repo.GetCampaign(ctx, id)
}

func (s *OutreachService) DeleteCampaign(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteCampaign(ctx, id)
}

func (s *OutreachService) SetCampaignStatus(ctx context.Context, id uuid.UUID, status string) error {
	if status != "active" && status != "paused" && status != "completed" {
		return domain.Validation("status inválido")
	}
	return s.repo.SetCampaignStatus(ctx, id, status)
}

func (s *OutreachService) ListTargets(ctx context.Context, id uuid.UUID, state string, limit int) ([]domain.CampaignTarget, error) {
	return s.repo.ListTargets(ctx, id, state, limit)
}

func (s *OutreachService) ListBatches(ctx context.Context, id uuid.UUID) ([]domain.Batch, error) {
	return s.repo.ListBatches(ctx, id)
}

type SendBatchCommand struct {
	CampaignID     uuid.UUID
	Size           int
	IdempotencyKey string
	RequestHash    string
	Endpoint       string
	Recontact      bool
	ApprovalIDs    []uuid.UUID
	UserID         uuid.UUID
}

// SendBatch processes AT MOST Size messages and then stops. There is no
// scheduler, no queue worker and no continuation: sending the next batch
// requires another explicit click. That absence is a design decision, not a
// missing feature.
func (s *OutreachService) SendBatch(ctx context.Context, cmd SendBatchCommand) (domain.BatchOutcome, error) {
	logger := observability.FromContext(ctx).With("campaign_id", cmd.CampaignID)

	// 1. Claim the idempotency key. A replay returns the original response
	//    with zero new side effects.
	replay, err := s.idem.Begin(ctx, cmd.IdempotencyKey, cmd.Endpoint, cmd.RequestHash)
	if err != nil {
		return domain.BatchOutcome{}, err
	}
	if replay != nil {
		var out domain.BatchOutcome
		if err := json.Unmarshal(replay.ResponseBody, &out); err != nil {
			return domain.BatchOutcome{}, domain.Wrap(domain.CodeInternal,
				"resposta armazenada inválida", err)
		}
		logger.Info("idempotency replay", "action", "idempotency.replay",
			"idempotency_key", cmd.IdempotencyKey)
		return out, nil
	}

	campaign, err := s.repo.GetCampaign(ctx, cmd.CampaignID)
	if err != nil {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.BatchOutcome{}, err
	}

	size := cmd.Size
	if size <= 0 || size > 50 {
		size = campaign.BatchSize
	}

	// 1b. Allowed weekday/hour window still gates the click — there is still
	//    no scheduler, so a batch requested outside the window is simply
	//    refused rather than queued for later. Daily volume is no longer
	//    capped by the app itself (Gmail's own sending limits still apply).
	rules, err := s.settings.SendRules(ctx)
	if err != nil {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.BatchOutcome{}, err
	}
	now := time.Now()
	weekday := int(now.Weekday())
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
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.BatchOutcome{}, domain.New(domain.CodeSendWindowClosed,
			"hoje não está nos dias configurados para envio")
	}
	if now.Hour() < rules.HourStart || now.Hour() >= rules.HourEnd {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.BatchOutcome{}, domain.New(domain.CodeSendWindowClosed,
			fmt.Sprintf("fora do horário de envio (%02dh–%02dh)", rules.HourStart, rules.HourEnd))
	}

	// 2. Short transaction: create the batch and reserve the targets. The
	//    unique index fires HERE, before a single message goes out.
	var (
		batch        domain.Batch
		reservations []postgres.Reservation
	)
	err = s.store.WithTx(ctx, func(ctx context.Context) error {
		b, err := s.repo.CreateBatch(ctx, cmd.CampaignID, size, cmd.IdempotencyKey, cmd.Recontact, cmd.UserID)
		if err != nil {
			return err
		}
		batch = b

		if cmd.Recontact {
			if len(cmd.ApprovalIDs) == 0 {
				return domain.New(domain.CodeRecontactRequired,
					"recontato exige aprovações explícitas")
			}
			reservations, err = s.repo.ReserveRecontact(ctx, cmd.CampaignID, b.ID,
				campaign.TemplateVersionID, cmd.ApprovalIDs)
		} else {
			reservations, err = s.repo.Reserve(ctx, cmd.CampaignID, b.ID,
				campaign.TemplateVersionID, size)
		}
		return err
	})
	if err != nil {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.BatchOutcome{}, err
	}

	logger.Info("batch reserved", "action", "batch.reserved",
		"batch_id", batch.ID, "reserved_count", len(reservations))

	details, err := s.templates.VersionDetails(ctx, campaign.TemplateVersionID)
	if err != nil {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.BatchOutcome{}, err
	}
	imageURLs := make([]string, len(details.Images))
	for i, img := range details.Images {
		imageURLs[i] = img.URL
	}

	signature, err := s.settings.EmailSignature(ctx)
	if err != nil {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.BatchOutcome{}, err
	}

	// 3. Dispatch sequentially, outside any database transaction. Network I/O
	//    never runs inside an open transaction.
	results := make([]domain.DispatchResult, 0, len(reservations))
	sent, failed := 0, 0

	for _, res := range reservations {
		rendered := withSignature(outreach.Render(details.Body, res.RenderVars), signature)
		subject := outreach.Render(details.Subject, res.RenderVars)
		msg := messaging.OutboundMessage{To: res.Emails, Subject: subject, Body: rendered, ImageURLs: imageURLs}

		providerResult, sendErr := s.gateway.Send(ctx, msg)
		if sendErr != nil {
			failed++
			code, message := "provider_unavailable", sendErr.Error()
			if err := s.repo.MarkFailed(ctx, res, code, message); err != nil {
				logger.Error("could not release reservation",
					"dispatch_id", res.DispatchID, "error", err)
			}
			logger.Error("message failed", "action", "outreach.message.failed",
				"dispatch_id", res.DispatchID,
				"contact_point_id", res.ContactPointID,
				"email_masked", observability.MaskEmails(res.Emails),
				"error", message)
			results = append(results, domain.DispatchResult{
				DispatchID: res.DispatchID, ContactPointID: res.ContactPointID,
				CompanyName: res.CompanyName, PhoneDisplay: res.PhoneDisplay,
				Status: "failed", ErrorCode: &code, ErrorMessage: &message,
			})
			continue
		}

		snapshot := map[string]any{
			"company_name":  res.CompanyName,
			"template_name": campaign.TemplateName,
			"campaign_name": campaign.Name,
			"body_preview":  preview(rendered, 140),
		}
		if err := s.repo.MarkSent(ctx, res, rendered, providerResult.Provider,
			providerResult.ProviderMessageID, cmd.CampaignID,
			campaign.TemplateVersionID, snapshot); err != nil {
			logger.Error("could not persist sent message",
				"dispatch_id", res.DispatchID, "error", err)
		}
		sent++
		logger.Info("message dispatched", "action", "outreach.message.sent",
			"dispatch_id", res.DispatchID,
			"contact_point_id", res.ContactPointID,
			"email_masked", observability.MaskEmails(res.Emails),
			"provider", providerResult.Provider)

		results = append(results, domain.DispatchResult{
			DispatchID: res.DispatchID, ContactPointID: res.ContactPointID,
			CompanyName: res.CompanyName, PhoneDisplay: res.PhoneDisplay,
			Status: "sent",
		})
	}

	// 4. Close the batch and STOP.
	finished, err := s.repo.FinishBatch(ctx, batch.ID, sent, failed)
	if err != nil {
		return domain.BatchOutcome{}, err
	}
	progress, err := s.repo.Progress(ctx, cmd.CampaignID)
	if err != nil {
		return domain.BatchOutcome{}, err
	}

	// Nothing left to send: the campaign closes itself instead of sitting
	// "active" forever with an empty queue. A manual pause/resume can still
	// override this afterward.
	if progress.Pending == 0 {
		if err := s.repo.SetCampaignStatus(ctx, cmd.CampaignID, "completed"); err != nil {
			logger.Error("could not auto-complete campaign", "error", err)
		}
	}

	outcome := domain.BatchOutcome{Batch: finished, Results: results, CampaignProgress: progress}
	if err := s.idem.Complete(ctx, cmd.IdempotencyKey, cmd.Endpoint, 200, outcome); err != nil {
		logger.Error("could not store idempotent response", "error", err)
	}
	return outcome, nil
}

func (s *OutreachService) ApproveRecontact(ctx context.Context, contactPointID uuid.UUID, reason string, by uuid.UUID) (uuid.UUID, error) {
	if reason == "" {
		reason = "recontato manual"
	}
	return s.repo.CreateRecontactApproval(ctx, contactPointID, reason, by)
}

// PreviewMessage renders one target exactly as it would be sent.
func (s *OutreachService) PreviewMessage(ctx context.Context, campaignID uuid.UUID, targetID uuid.UUID) (map[string]any, error) {
	campaign, err := s.repo.GetCampaign(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	details, err := s.templates.VersionDetails(ctx, campaign.TemplateVersionID)
	if err != nil {
		return nil, err
	}
	targets, err := s.repo.ListTargets(ctx, campaignID, "", 500)
	if err != nil {
		return nil, err
	}
	signature, err := s.settings.EmailSignature(ctx)
	if err != nil {
		return nil, err
	}
	for _, t := range targets {
		if t.ID == targetID || targetID == uuid.Nil {
			return map[string]any{
				"company_name":         t.CompanyName,
				"email":                t.Email,
				"rendered_subject":     outreach.Render(details.Subject, t.RenderVars),
				"rendered_body":        withSignature(outreach.Render(details.Body, t.RenderVars), signature),
				"images":               details.Images,
				"unresolved_variables": outreach.UnknownVariables(details.Body),
			}, nil
		}
	}
	return nil, domain.NotFound("alvo da campanha")
}

func preview(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n]) + "…"
}
