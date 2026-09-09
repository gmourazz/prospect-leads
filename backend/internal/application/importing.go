package application

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"io"
	"strings"

	"github.com/google/uuid"

	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/domain"
	"github.com/geovanna/prospect/backend/internal/domain/company"
	"github.com/geovanna/prospect/backend/internal/domain/contact"
)

type ImportService struct {
	store     *postgres.Store
	imports   *postgres.ImportRepo
	contacts  *postgres.ContactRepo
	companies *postgres.CompanyRepo
	segments  *postgres.SegmentRepo
	idem      *postgres.IdempotencyRepo
}

func NewImportService(
	store *postgres.Store,
	imports *postgres.ImportRepo,
	contacts *postgres.ContactRepo,
	companies *postgres.CompanyRepo,
	segments *postgres.SegmentRepo,
	idem *postgres.IdempotencyRepo,
) *ImportService {
	return &ImportService{store, imports, contacts, companies, segments, idem}
}

// headerAliases maps common spreadsheet headers to canonical fields. The
// mapping is a suggestion the user can override before committing.
var headerAliases = map[string]string{
	"nome": "company_name", "empresa": "company_name", "razao social": "company_name",
	"razão social": "company_name", "nome fantasia": "company_name", "estabelecimento": "company_name",
	"title": "company_name", "name": "company_name",

	"telefone": "phone", "fone": "phone", "whatsapp": "phone", "celular": "phone",
	"contato": "phone", "phone": "phone", "telefone 1": "phone", "tel": "phone",

	"cidade": "city", "municipio": "city", "município": "city", "city": "city",
	"uf": "state", "estado": "state", "state": "state",
	"cnpj": "cnpj", "documento": "cnpj",
	"site": "website", "website": "website", "url": "website", "página": "website",
	"instagram": "instagram", "insta": "instagram",
	"segmento": "segment", "categoria": "segment", "ramo": "segment", "category": "segment",
	"endereco": "address", "endereço": "address", "address": "address",
}

func detectMapping(headers []string) map[string]string {
	mapping := map[string]string{}
	for _, h := range headers {
		key := strings.ToLower(strings.TrimSpace(h))
		if field, ok := headerAliases[key]; ok {
			if _, taken := mapping[field]; !taken {
				mapping[field] = h
			}
		}
	}
	return mapping
}

type AnalyzeCommand struct {
	Filename  string
	Reader    io.Reader
	SegmentID *uuid.UUID
	Mapping   map[string]string
	UserID    uuid.UUID
}

// Analyze is the dry-run. It writes ONLY to the staging table, so the user sees
// exactly what a commit would do — including how many of these contacts have
// already been messaged — before anything touches the real tables.
func (s *ImportService) Analyze(ctx context.Context, cmd AnalyzeCommand) (domain.ImportPreview, error) {
	reader := csv.NewReader(cmd.Reader)
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		return domain.ImportPreview{}, domain.Wrap(domain.CodeValidation,
			"não foi possível ler o CSV", err)
	}
	if len(records) < 2 {
		return domain.ImportPreview{}, domain.Validation("arquivo sem linhas de dados")
	}

	headers := records[0]
	mapping := cmd.Mapping
	if len(mapping) == 0 {
		mapping = detectMapping(headers)
	}
	if _, ok := mapping["company_name"]; !ok {
		return domain.ImportPreview{}, domain.Validation(
			"não foi possível identificar a coluna do nome da empresa")
	}

	index := map[string]int{}
	for i, h := range headers {
		index[h] = i
	}

	jobID, err := s.imports.CreateJob(ctx, cmd.Filename, cmd.SegmentID, mapping, cmd.UserID)
	if err != nil {
		return domain.ImportPreview{}, err
	}

	for i, record := range records[1:] {
		raw := map[string]string{}
		for h, idx := range index {
			if idx < len(record) {
				raw[h] = strings.TrimSpace(record[idx])
			}
		}
		result := s.processRow(ctx, i+2, raw, mapping, cmd.SegmentID, false)
		if err := s.imports.SaveRow(ctx, jobID, result); err != nil {
			return domain.ImportPreview{}, err
		}
	}

	if err := s.imports.UpdateJobStats(ctx, jobID, "previewed"); err != nil {
		return domain.ImportPreview{}, err
	}

	preview, err := s.imports.Preview(ctx, jobID, 200)
	if err != nil {
		return domain.ImportPreview{}, err
	}
	preview.Headers = headers
	return preview, nil
}

// processRow runs the pipeline stages for one row. With apply=false it only
// resolves and classifies; with apply=true it performs the upserts.
func (s *ImportService) processRow(ctx context.Context, rowNumber int, raw, mapping map[string]string, defaultSegment *uuid.UUID, apply bool) postgres.RowResult {
	get := func(field string) string {
		if col, ok := mapping[field]; ok {
			return raw[col]
		}
		return ""
	}

	result := postgres.RowResult{RowNumber: rowNumber, Raw: raw, Errors: []string{}}

	name := get("company_name")
	if name == "" {
		result.Outcome = "invalid"
		result.Reason = "nome da empresa ausente"
		result.Errors = append(result.Errors, "company_name obrigatório")
		result.Normalized = map[string]any{}
		return result
	}

	city := get("city")
	state := company.NormalizeState(get("state"))
	cnpj := company.NormalizeCNPJ(get("cnpj"))
	website := get("website")
	instagram := get("instagram")

	normalized := map[string]any{
		"company_name": name,
		"city":         city,
		"state":        state,
		"cnpj":         cnpj,
		"website":      website,
		"instagram":    instagram,
	}

	// Phone: the row is not necessarily invalid without one, but it can never
	// be messaged, so it is flagged.
	var parsed *contact.Number
	if rawPhone := get("phone"); rawPhone != "" {
		for _, candidate := range contact.SplitMultiple(rawPhone) {
			n, err := contact.Parse(candidate, "BR")
			if err != nil {
				continue
			}
			if parsed == nil || (!parsed.IsMobile() && n.IsMobile()) {
				num := n
				parsed = &num
			}
			if parsed.IsMobile() {
				break
			}
		}
		if parsed == nil {
			result.Errors = append(result.Errors, "telefone inválido: "+rawPhone)
		}
	}
	if parsed != nil {
		normalized["phone_e164"] = parsed.E164()
		normalized["phone_display"] = parsed.Display()
		normalized["line_type"] = string(parsed.LineType())
	}
	result.Normalized = normalized

	segmentID := defaultSegment
	if seg := get("segment"); seg != "" {
		if found, _ := s.segments.FindBySlugOrName(ctx, seg); found != nil {
			segmentID = found
		}
	}

	companyInput := postgres.CompanyInput{
		TradeName: name,
		NameKey:   company.NameKey(name),
		CNPJ:      cnpj,
		SegmentID: segmentID,
		City:      city,
		CityKey:   company.CityKey(city),
		State:     state,
	}

	// Contact resolution comes first: the answer to "already messaged?" must be
	// known even for a row that ends up being skipped.
	if parsed != nil {
		if apply {
			id, _, err := s.contacts.Upsert(ctx, *parsed)
			if err != nil {
				result.Outcome = "invalid"
				result.Reason = err.Error()
				return result
			}
			result.ContactPointID = &id
		} else if id, found, err := s.contacts.Resolve(ctx, *parsed); err == nil && found {
			result.ContactPointID = &id
		}
		if result.ContactPointID != nil {
			if contacted, err := s.contacts.HasBeenContacted(ctx, *result.ContactPointID); err == nil {
				result.AlreadyContacted = contacted
			}
		}
	}

	match, err := s.companies.Resolve(ctx, companyInput)
	if err != nil {
		result.Outcome = "invalid"
		result.Reason = err.Error()
		return result
	}

	switch {
	case match.Matched:
		result.CompanyID = &match.CompanyID
		result.Outcome = "merged"
		result.Reason = "empresa existente (" + match.Reason + ")"
	case match.Reason == "needs_review":
		result.CompanyID = &match.CompanyID
		result.Outcome = "needs_review"
		result.Reason = "possível duplicata"
	default:
		result.Outcome = "created"
	}

	if !apply {
		return result
	}

	var companyID uuid.UUID
	if match.Matched {
		companyID = match.CompanyID
		if err := s.companies.Merge(ctx, companyID, companyInput); err != nil {
			result.Outcome = "invalid"
			result.Reason = err.Error()
			return result
		}
	} else {
		id, err := s.companies.Create(ctx, companyInput)
		if err != nil {
			result.Outcome = "invalid"
			result.Reason = err.Error()
			return result
		}
		companyID = id
	}
	result.CompanyID = &companyID

	if result.ContactPointID != nil {
		if err := s.companies.LinkContact(ctx, companyID, *result.ContactPointID, true); err != nil {
			result.Errors = append(result.Errors, err.Error())
		}
	}

	for _, url := range []string{website, instagram} {
		if url == "" {
			continue
		}
		kind, host, urlKey, ok := company.ClassifyURL(url)
		if !ok {
			continue
		}
		if err := s.companies.AddPresence(ctx, companyID, url, host, urlKey, kind); err != nil {
			result.Errors = append(result.Errors, err.Error())
		}
	}
	if err := s.companies.RefreshWebsiteStatus(ctx, companyID); err != nil {
		result.Errors = append(result.Errors, err.Error())
	}

	leadID, created, err := s.companies.UpsertLead(ctx, companyID, segmentID, result.ContactPointID, "csv", nil)
	if err != nil {
		result.Outcome = "invalid"
		result.Reason = err.Error()
		return result
	}
	if !created && result.Outcome == "created" {
		result.Outcome = "merged"
		result.Reason = "lead já existia para esta empresa"
	}

	// Record that the contact reappeared. This is history, not contact: it
	// never marks the number as messaged.
	if result.ContactPointID != nil {
		_ = s.contacts.RecordEvent(ctx, postgres.ContactEventInput{
			ContactPointID: *result.ContactPointID,
			Type:           "imported_seen",
			LeadID:         &leadID,
			CompanyID:      &companyID,
			Snapshot:       map[string]any{"company_name": name, "source": "csv"},
		})
	}
	return result
}

type CommitCommand struct {
	JobID          uuid.UUID
	IdempotencyKey string
	RequestHash    string
	Endpoint       string
	UserID         uuid.UUID
}

// Commit applies the staged rows. Contact history, stats and suppressions are
// never written here — that is what makes re-importing the same spreadsheet a
// safe, visibly no-op operation.
func (s *ImportService) Commit(ctx context.Context, cmd CommitCommand) (domain.ImportPreview, error) {
	replay, err := s.idem.Begin(ctx, cmd.IdempotencyKey, cmd.Endpoint, cmd.RequestHash)
	if err != nil {
		return domain.ImportPreview{}, err
	}
	if replay != nil {
		var out domain.ImportPreview
		if err := json.Unmarshal(replay.ResponseBody, &out); err != nil {
			return domain.ImportPreview{}, domain.Wrap(domain.CodeInternal,
				"resposta armazenada inválida", err)
		}
		return out, nil
	}

	status, err := s.imports.JobStatus(ctx, cmd.JobID)
	if err != nil {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.ImportPreview{}, err
	}
	if status == "completed" {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return s.imports.Preview(ctx, cmd.JobID, 200)
	}

	staged, err := s.imports.Preview(ctx, cmd.JobID, 100000)
	if err != nil {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.ImportPreview{}, err
	}

	rows, err := s.stagedRaw(ctx, cmd.JobID)
	if err != nil {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.ImportPreview{}, err
	}

	mapping := staged.ColumnMapping
	segmentID, err := s.jobSegment(ctx, cmd.JobID)
	if err != nil {
		_ = s.idem.Release(ctx, cmd.IdempotencyKey, cmd.Endpoint)
		return domain.ImportPreview{}, err
	}

	const chunkSize = 200
	for start := 0; start < len(rows); start += chunkSize {
		end := start + chunkSize
		if end > len(rows) {
			end = len(rows)
		}
		chunk := rows[start:end]
		err := s.store.WithTx(ctx, func(ctx context.Context) error {
			for _, row := range chunk {
				result := s.processRow(ctx, row.RowNumber, row.Raw, mapping, segmentID, true)
				if err := s.imports.SaveRow(ctx, cmd.JobID, result); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			return domain.ImportPreview{}, err
		}
	}

	if err := s.imports.UpdateJobStats(ctx, cmd.JobID, "completed"); err != nil {
		return domain.ImportPreview{}, err
	}
	out, err := s.imports.Preview(ctx, cmd.JobID, 200)
	if err != nil {
		return domain.ImportPreview{}, err
	}
	if err := s.idem.Complete(ctx, cmd.IdempotencyKey, cmd.Endpoint, 200, out); err != nil {
		return out, nil
	}
	return out, nil
}

type stagedRow struct {
	RowNumber int
	Raw       map[string]string
}

func (s *ImportService) stagedRaw(ctx context.Context, jobID uuid.UUID) ([]stagedRow, error) {
	rows, err := s.store.DB(ctx).Query(ctx,
		`SELECT row_number, raw FROM import_rows WHERE import_job_id = $1 ORDER BY row_number`, jobID)
	if err != nil {
		return nil, postgres.TranslateError(err)
	}
	defer rows.Close()

	out := []stagedRow{}
	for rows.Next() {
		var r stagedRow
		var raw []byte
		if err := rows.Scan(&r.RowNumber, &raw); err != nil {
			return nil, postgres.TranslateError(err)
		}
		_ = json.Unmarshal(raw, &r.Raw)
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *ImportService) jobSegment(ctx context.Context, jobID uuid.UUID) (*uuid.UUID, error) {
	var id *uuid.UUID
	err := s.store.DB(ctx).QueryRow(ctx,
		`SELECT segment_id FROM import_jobs WHERE id = $1`, jobID).Scan(&id)
	if err != nil {
		return nil, postgres.TranslateError(err)
	}
	return id, nil
}

func (s *ImportService) ListJobs(ctx context.Context) ([]domain.ImportPreview, error) {
	return s.imports.ListJobs(ctx)
}

func (s *ImportService) GetPreview(ctx context.Context, jobID uuid.UUID) (domain.ImportPreview, error) {
	return s.imports.Preview(ctx, jobID, 200)
}
