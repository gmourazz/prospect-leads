package application

import (
	"context"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/outreach"
)

// The second step of the funnel. The email went out; the business never
// answered; now one WhatsApp message goes out by hand, with the mockup
// images attached manually by the user in WhatsApp itself.
//
// Nothing here automates WhatsApp. The app renders the text, opens the chat
// with it pre-filled, and then waits for the user to confirm they actually
// pressed send — which is the only moment history is written.

func (s *OutreachService) ListAwaitingReply(ctx context.Context, minDays, limit int) ([]postgres.AwaitingReply, error) {
	if minDays < 0 {
		minDays = 0
	}
	return s.leads.ListAwaitingReply(ctx, minDays, limit)
}

type FollowupPreparation struct {
	DispatchID   uuid.UUID                 `json:"dispatch_id"`
	CompanyName  string                    `json:"company_name"`
	PhoneDisplay string                    `json:"phone_display"`
	RenderedBody string                    `json:"rendered_body"`
	WhatsAppLink string                    `json:"whatsapp_link"`
	Images       []postgres.AttachmentView `json:"images"`
}

// PrepareFollowup reserves the WhatsApp dispatch as 'opened' and renders the
// message. Nothing is written to contact history yet: opening a chat is not
// the same as having sent anything.
func (s *OutreachService) PrepareFollowup(ctx context.Context, leadID, templateVersionID uuid.UUID) (FollowupPreparation, error) {
	lead, err := s.leads.Get(ctx, leadID)
	if err != nil {
		return FollowupPreparation{}, err
	}
	if lead.Contact.ContactPointID == nil {
		return FollowupPreparation{}, domain.Validation("este lead não tem telefone para o follow-up")
	}
	if lead.Contact.IsSuppressed {
		return FollowupPreparation{}, domain.New(domain.CodeContactSuppressed,
			"este contato está na lista de não contatar")
	}

	details, err := s.templates.VersionDetails(ctx, templateVersionID)
	if err != nil {
		return FollowupPreparation{}, err
	}

	segmentName, city, state := "", "", ""
	if lead.Segment != nil {
		segmentName = lead.Segment.Name
	}
	if lead.Company.City != nil {
		city = *lead.Company.City
	}
	if lead.Company.State != nil {
		state = *lead.Company.State
	}
	rendered := outreach.Render(details.Body,
		outreach.BuildVars(lead.Company.Name, segmentName, city, state))

	dispatchID, err := s.repo.OpenWhatsAppFollowup(ctx, leadID,
		*lead.Contact.ContactPointID, lead.Company.ID, templateVersionID)
	if err != nil {
		return FollowupPreparation{}, err
	}

	return FollowupPreparation{
		DispatchID:   dispatchID,
		CompanyName:  lead.Company.Name,
		PhoneDisplay: lead.Contact.PhoneDisplay,
		RenderedBody: rendered,
		WhatsAppLink: outreach.WhatsAppLink(lead.Contact.PhoneE164, rendered),
		Images:       details.Images,
	}, nil
}

// ConfirmFollowup runs only after the user answers "sim, enviei".
func (s *OutreachService) ConfirmFollowup(ctx context.Context, dispatchID, templateVersionID uuid.UUID, renderedBody, companyName, templateName string) error {
	snapshot := map[string]any{
		"company_name":  companyName,
		"template_name": templateName,
		"body_preview":  preview(renderedBody, 140),
		"channel":       "whatsapp",
	}
	return s.repo.ConfirmFollowup(ctx, dispatchID, renderedBody, templateVersionID, snapshot)
}

// CancelFollowup answers "não enviei" — the reservation is released and the
// business stays in the follow-up list.
func (s *OutreachService) CancelFollowup(ctx context.Context, dispatchID uuid.UUID) error {
	return s.repo.CancelFollowup(ctx, dispatchID)
}
