package application

import (
	"context"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/company"
	"github.com/geovanna/prospect/backend/internal/domain/contact"
)

type LeadService struct {
	store     *postgres.Store
	leads     *postgres.LeadRepo
	companies *postgres.CompanyRepo
	contacts  *postgres.ContactRepo
}

func NewLeadService(store *postgres.Store, leads *postgres.LeadRepo, companies *postgres.CompanyRepo, contacts *postgres.ContactRepo) *LeadService {
	return &LeadService{store, leads, companies, contacts}
}

type CreateLeadCommand struct {
	CompanyName string
	Phone       string
	Email       string
	City        string
	State       string
	CNPJ        string
	SegmentID   *uuid.UUID
	Website     string
	Instagram   string
}

// CreateManual runs the same resolution path as an import: the phone is
// normalized, the contact is resolved against existing history, and the
// company is deduped. A number typed by hand that was already messaged shows
// its check immediately.
func (s *LeadService) CreateManual(ctx context.Context, cmd CreateLeadCommand) (domain.Lead, error) {
	if cmd.CompanyName == "" {
		return domain.Lead{}, domain.Validation("nome da empresa é obrigatório")
	}

	var parsed *contact.Number
	if cmd.Phone != "" {
		n, err := contact.Parse(cmd.Phone, "BR")
		if err != nil {
			return domain.Lead{}, domain.New(domain.CodeInvalidPhone,
				"telefone inválido: "+cmd.Phone)
		}
		parsed = &n
	}

	var leadID uuid.UUID
	err := s.store.WithTx(ctx, func(ctx context.Context) error {
		var contactID *uuid.UUID
		if parsed != nil {
			id, _, err := s.contacts.Upsert(ctx, *parsed)
			if err != nil {
				return err
			}
			if cmd.Email != "" {
				if err := s.contacts.SetEmail(ctx, id, cmd.Email); err != nil {
					return err
				}
			}
			contactID = &id
		}

		input := postgres.CompanyInput{
			TradeName: cmd.CompanyName,
			NameKey:   company.NameKey(cmd.CompanyName),
			CNPJ:      company.NormalizeCNPJ(cmd.CNPJ),
			SegmentID: cmd.SegmentID,
			City:      cmd.City,
			CityKey:   company.CityKey(cmd.City),
			State:     company.NormalizeState(cmd.State),
		}

		match, err := s.companies.Resolve(ctx, input)
		if err != nil {
			return err
		}
		var companyID uuid.UUID
		if match.Matched {
			companyID = match.CompanyID
			if err := s.companies.Merge(ctx, companyID, input); err != nil {
				return err
			}
		} else {
			companyID, err = s.companies.Create(ctx, input)
			if err != nil {
				return err
			}
		}

		if contactID != nil {
			if err := s.companies.LinkContact(ctx, companyID, *contactID, true); err != nil {
				return err
			}
		}
		for _, url := range []string{cmd.Website, cmd.Instagram} {
			if url == "" {
				continue
			}
			kind, host, urlKey, ok := company.ClassifyURL(url)
			if !ok {
				continue
			}
			if err := s.companies.AddPresence(ctx, companyID, url, host, urlKey, kind); err != nil {
				return err
			}
		}
		if err := s.companies.RefreshWebsiteStatus(ctx, companyID); err != nil {
			return err
		}

		id, _, err := s.companies.UpsertLead(ctx, companyID, cmd.SegmentID, contactID, "manual", nil)
		if err != nil {
			return err
		}
		leadID = id
		return nil
	})
	if err != nil {
		return domain.Lead{}, err
	}
	return s.leads.Get(ctx, leadID)
}

// LookupPhone answers "already messaged this number?" for a raw string, before
// any lead exists for it.
func (s *LeadService) LookupPhone(ctx context.Context, raw string) (map[string]any, error) {
	n, err := contact.Parse(raw, "BR")
	if err != nil {
		return nil, domain.New(domain.CodeInvalidPhone, "telefone inválido: "+raw)
	}
	out := map[string]any{
		"phone_e164":    n.E164(),
		"phone_display": n.Display(),
		"line_type":     string(n.LineType()),
		"aliases":       n.Aliases(),
		"known":         false,
	}
	id, found, err := s.contacts.Resolve(ctx, n)
	if err != nil {
		return nil, err
	}
	if !found {
		return out, nil
	}
	state, err := s.contacts.State(ctx, id)
	if err != nil {
		return nil, err
	}
	out["known"] = true
	out["contact"] = state
	return out, nil
}
