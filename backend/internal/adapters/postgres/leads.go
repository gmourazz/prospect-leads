package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/domain"
)

type LeadRepo struct{ *Store }

func NewLeadRepo(s *Store) *LeadRepo { return &LeadRepo{s} }

// buildFilter turns LeadFilters into a WHERE clause over the lead_board view.
// One implementation feeds the list, the counts and the campaign selection, so
// the three can never disagree about what "available" means.
func buildFilter(f domain.LeadFilters) (string, []any) {
	var clauses []string
	var args []any
	add := func(clause string, value any) {
		args = append(args, value)
		clauses = append(clauses, fmt.Sprintf(clause, len(args)))
	}

	if f.SegmentID != nil {
		add("segment_id = $%d", *f.SegmentID)
	}
	if f.City != "" {
		add("city_key = $%d", strings.ToLower(f.City))
	}
	if f.State != "" {
		add("state = $%d", strings.ToUpper(f.State))
	}
	if f.Status != "" {
		add("lead_status = $%d::lead_status", f.Status)
	}
	if f.WebsiteStatus != "" {
		add("website_status = $%d::website_status", f.WebsiteStatus)
	}
	if f.Search != "" {
		args = append(args, f.Search)
		n := len(args)
		clauses = append(clauses, fmt.Sprintf(
			"(company_name ILIKE '%%' || $%d || '%%' OR phone_e164 ILIKE '%%' || $%d || '%%')", n, n))
	}
	if f.CollectedFrom != nil {
		add("collected_at >= $%d", *f.CollectedFrom)
	}
	if f.CollectedTo != nil {
		add("collected_at <= $%d", *f.CollectedTo)
	}

	if f.OpenNow != nil {
		add("is_open_now = $%d", *f.OpenNow)
	}

	if f.HasEmail != nil {
		if *f.HasEmail {
			clauses = append(clauses, "email IS NOT NULL")
		} else {
			clauses = append(clauses, "email IS NULL")
		}
	}

	switch f.ContactState {
	case "available":
		clauses = append(clauses, "is_available")
	case "never":
		clauses = append(clauses, "contact_count = 0 AND NOT is_suppressed")
	case "contacted":
		clauses = append(clauses, "contact_count > 0")
	case "replied":
		clauses = append(clauses, "contact_state = 'replied'")
	case "suppressed":
		clauses = append(clauses, "is_suppressed")
	}

	if len(clauses) == 0 {
		return "TRUE", args
	}
	return strings.Join(clauses, " AND "), args
}

const leadSelect = `
	SELECT lead_id, lead_status, notes, collected_at, last_interaction_at,
	       company_id, company_name, cnpj, city, state, website_status,
	       opening_hours, is_open_now,
	       segment_id, segment_name, segment_color,
	       contact_point_id, phone_display, phone_e164, email, emails, line_type,
	       contact_count, first_contacted_at, last_contacted_at, contact_state,
	       is_suppressed, suppression_reason, is_available
	  FROM lead_board`

func (r *LeadRepo) List(ctx context.Context, f domain.LeadFilters) ([]domain.Lead, error) {
	where, args := buildFilter(f)

	order := "collected_at DESC"
	switch f.Sort {
	case "company_name":
		order = "company_name ASC"
	case "last_contacted":
		order = "last_contacted_at DESC NULLS LAST"
	case "status":
		order = "lead_status ASC, collected_at DESC"
	}

	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	args = append(args, limit, f.Offset)

	query := fmt.Sprintf("%s WHERE %s ORDER BY %s LIMIT $%d OFFSET $%d",
		leadSelect, where, order, len(args)-1, len(args))

	rows, err := r.DB(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	leads := []domain.Lead{}
	ids := []uuid.UUID{}
	for rows.Next() {
		var l domain.Lead
		var segID *uuid.UUID
		var segName, segColor *string
		if err := rows.Scan(
			&l.ID, &l.Status, &l.Notes, &l.CollectedAt, &l.LastInteractionAt,
			&l.Company.ID, &l.Company.Name, &l.Company.CNPJ, &l.Company.City,
			&l.Company.State, &l.Company.WebsiteStatus,
			&l.Company.OpeningHours, &l.Company.IsOpenNow,
			&segID, &segName, &segColor,
			&l.Contact.ContactPointID, &l.Contact.PhoneDisplay, &l.Contact.PhoneE164, &l.Contact.Email,
			&l.Contact.Emails, &l.Contact.LineType, &l.Contact.ContactCount, &l.Contact.FirstContactedAt,
			&l.Contact.LastContactedAt, &l.Contact.Status,
			&l.Contact.IsSuppressed, &l.Contact.SuppressionReason, &l.IsAvailable,
		); err != nil {
			return nil, TranslateError(err)
		}
		if segID != nil {
			l.Segment = &domain.LeadSegment{ID: *segID}
			if segName != nil {
				l.Segment.Name = *segName
			}
			if segColor != nil {
				l.Segment.Color = *segColor
			}
		}
		l.WebPresences = []domain.WebPresence{}
		leads = append(leads, l)
		ids = append(ids, l.Company.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, TranslateError(err)
	}
	if len(leads) == 0 {
		return leads, nil
	}
	return r.attachPresences(ctx, leads, ids)
}

func (r *LeadRepo) attachPresences(ctx context.Context, leads []domain.Lead, companyIDs []uuid.UUID) ([]domain.Lead, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT company_id, id, url, host, kind::text
		  FROM web_presences
		 WHERE company_id = ANY($1)
		 ORDER BY kind`, companyIDs)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	byCompany := map[uuid.UUID][]domain.WebPresence{}
	for rows.Next() {
		var companyID uuid.UUID
		var p domain.WebPresence
		if err := rows.Scan(&companyID, &p.ID, &p.URL, &p.Host, &p.Kind); err != nil {
			return nil, TranslateError(err)
		}
		byCompany[companyID] = append(byCompany[companyID], p)
	}
	for i := range leads {
		if p, ok := byCompany[leads[i].Company.ID]; ok {
			leads[i].WebPresences = p
		}
	}
	return leads, rows.Err()
}

// Counts drives "100 encontrados / 80 disponíveis / 20 já contatados". It runs
// over the whole filtered set, never over the current page.
func (r *LeadRepo) Counts(ctx context.Context, f domain.LeadFilters) (domain.LeadCounts, error) {
	base := f
	base.ContactState = "" // counts describe the contact split, so ignore it
	where, args := buildFilter(base)

	var c domain.LeadCounts
	err := r.DB(ctx).QueryRow(ctx, fmt.Sprintf(`
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE is_available),
		       COUNT(*) FILTER (WHERE contact_count > 0),
		       COUNT(*) FILTER (WHERE contact_state = 'replied'),
		       COUNT(*) FILTER (WHERE is_suppressed),
		       COUNT(*) FILTER (WHERE contact_point_id IS NULL),
		       COUNT(*) FILTER (WHERE website_status = 'no_website')
		  FROM lead_board WHERE %s`, where), args...).
		Scan(&c.Total, &c.Available, &c.Contacted, &c.Replied,
			&c.Suppressed, &c.NoPhone, &c.NoWebsite)
	if err != nil {
		return c, TranslateError(err)
	}
	return c, nil
}

func (r *LeadRepo) Get(ctx context.Context, id uuid.UUID) (domain.Lead, error) {
	leads, err := r.listByIDs(ctx, []uuid.UUID{id})
	if err != nil {
		return domain.Lead{}, err
	}
	if len(leads) == 0 {
		return domain.Lead{}, domain.NotFound("lead")
	}
	return leads[0], nil
}

func (r *LeadRepo) listByIDs(ctx context.Context, ids []uuid.UUID) ([]domain.Lead, error) {
	rows, err := r.DB(ctx).Query(ctx, leadSelect+" WHERE lead_id = ANY($1)", ids)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	leads := []domain.Lead{}
	companyIDs := []uuid.UUID{}
	for rows.Next() {
		var l domain.Lead
		var segID *uuid.UUID
		var segName, segColor *string
		if err := rows.Scan(
			&l.ID, &l.Status, &l.Notes, &l.CollectedAt, &l.LastInteractionAt,
			&l.Company.ID, &l.Company.Name, &l.Company.CNPJ, &l.Company.City,
			&l.Company.State, &l.Company.WebsiteStatus,
			&l.Company.OpeningHours, &l.Company.IsOpenNow,
			&segID, &segName, &segColor,
			&l.Contact.ContactPointID, &l.Contact.PhoneDisplay, &l.Contact.PhoneE164, &l.Contact.Email,
			&l.Contact.Emails, &l.Contact.LineType, &l.Contact.ContactCount, &l.Contact.FirstContactedAt,
			&l.Contact.LastContactedAt, &l.Contact.Status,
			&l.Contact.IsSuppressed, &l.Contact.SuppressionReason, &l.IsAvailable,
		); err != nil {
			return nil, TranslateError(err)
		}
		if segID != nil {
			l.Segment = &domain.LeadSegment{ID: *segID}
			if segName != nil {
				l.Segment.Name = *segName
			}
			if segColor != nil {
				l.Segment.Color = *segColor
			}
		}
		l.WebPresences = []domain.WebPresence{}
		leads = append(leads, l)
		companyIDs = append(companyIDs, l.Company.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, TranslateError(err)
	}
	if len(leads) == 0 {
		return leads, nil
	}
	return r.attachPresences(ctx, leads, companyIDs)
}

func (r *LeadRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status string, notes *string) error {
	tag, err := r.DB(ctx).Exec(ctx, `
		UPDATE leads
		   SET status = COALESCE(NULLIF($2, '')::lead_status, status),
		       notes  = COALESCE($3, notes),
		       updated_at = now()
		 WHERE id = $1 AND deleted_at IS NULL`, id, status, notes)
	if err != nil {
		return TranslateError(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("lead")
	}
	return nil
}

// SoftDelete removes the lead from the board. The contact and its history are
// untouched by design — that is the point of the whole model.
func (r *LeadRepo) SoftDelete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.DB(ctx).Exec(ctx,
		`UPDATE leads SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return TranslateError(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFound("lead")
	}
	return nil
}

// SelectableContacts resolves a bulk selection server-side. The client sends
// filters, not a list of ids, because page 1 of 50 cannot know all 80 eligible
// rows.
func (r *LeadRepo) SelectableContacts(ctx context.Context, f domain.LeadFilters, onlyAvailable bool, limit int) ([]SelectedTarget, error) {
	where, args := buildFilter(f)
	if onlyAvailable {
		where += " AND is_available"
	}
	if limit <= 0 || limit > 5000 {
		limit = 1000
	}
	args = append(args, limit)

	rows, err := r.DB(ctx).Query(ctx, fmt.Sprintf(`
		SELECT lead_id, company_id, contact_point_id, company_name,
		       COALESCE(segment_name, ''), COALESCE(city, ''), COALESCE(state, '')
		  FROM lead_board
		 WHERE %s AND contact_point_id IS NOT NULL
		 ORDER BY collected_at DESC
		 LIMIT $%d`, where, len(args)), args...)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []SelectedTarget{}
	for rows.Next() {
		var t SelectedTarget
		if err := rows.Scan(&t.LeadID, &t.CompanyID, &t.ContactPointID,
			&t.CompanyName, &t.SegmentName, &t.City, &t.State); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

type SelectedTarget struct {
	LeadID         uuid.UUID `json:"lead_id"`
	CompanyID      uuid.UUID `json:"company_id"`
	ContactPointID uuid.UUID `json:"contact_point_id"`
	CompanyName    string    `json:"company_name"`
	SegmentName    string    `json:"segment_name"`
	City           string    `json:"city"`
	State          string    `json:"state"`
}

func (r *LeadRepo) Cities(ctx context.Context) ([]string, error) {
	rows, err := r.DB(ctx).Query(ctx, `
		SELECT DISTINCT city FROM companies
		 WHERE city IS NOT NULL AND city <> '' AND deleted_at IS NULL
		 ORDER BY city`)
	if err != nil {
		return nil, TranslateError(err)
	}
	defer rows.Close()

	out := []string{}
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			return nil, TranslateError(err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
