package domain

import (
	"time"

	"github.com/google/uuid"
)

// Segment is a prospecting vertical. Cadastrável em runtime.
type Segment struct {
	ID        uuid.UUID `json:"id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	Icon      string    `json:"icon"`
	IsActive  bool      `json:"is_active"`
	SortOrder int       `json:"sort_order"`
	LeadCount int       `json:"lead_count"`
}

// ContactPoint is the immortal root: a normalized phone that outlives every
// lead, import and campaign that ever referenced it.
type ContactPoint struct {
	ID           uuid.UUID `json:"id"`
	PhoneE164    string    `json:"phone_e164"`
	PhoneDisplay string    `json:"phone_display"`
	PhoneRaw     string    `json:"phone_raw,omitempty"`
	AreaCode     string    `json:"area_code,omitempty"`
	LineType     string    `json:"line_type"`
	// Email is best-effort: scraped from the business's own website at
	// import time, or entered by hand when that fails. Nil means unknown,
	// not "no email" — the business may well have one.
	Email       *string   `json:"email"`
	FirstSeenAt time.Time `json:"first_seen_at"`
	LastSeenAt  time.Time `json:"last_seen_at"`
}

// ContactState is the derived answer to "already messaged?", read from the
// rollup that the contact_events trigger maintains.
type ContactState struct {
	ContactPointID *uuid.UUID `json:"contact_point_id"`
	PhoneDisplay   string     `json:"phone_display"`
	PhoneE164      string     `json:"phone_e164"`
	Email          *string    `json:"email"`
	// Emails is every address discovered for this contact, primary first.
	// A campaign message goes to all of them at once.
	Emails            []string   `json:"emails"`
	LineType          string     `json:"line_type"`
	Status            string     `json:"status"`
	ContactCount      int        `json:"contact_count"`
	FirstContactedAt  *time.Time `json:"first_contacted_at"`
	LastContactedAt   *time.Time `json:"last_contacted_at"`
	IsSuppressed      bool       `json:"is_suppressed"`
	SuppressionReason *string    `json:"suppression_reason"`
	// LastChannel/HasError/LastErrorCode describe the most recent dispatch
	// attempt regardless of outcome — unlike Status, which only ever reflects
	// a successful send (contact_point_stats never hears about a failure).
	LastChannel   *string `json:"last_channel"`
	HasError      bool    `json:"has_error"`
	LastErrorCode *string `json:"last_error_code"`
}

type WebPresence struct {
	ID   uuid.UUID `json:"id"`
	URL  string    `json:"url"`
	Host string    `json:"host"`
	Kind string    `json:"kind"`
}

// Lead is one row of the board: the commercial opportunity plus the derived
// contact state that drives the ✓ Enviado badge.
type Lead struct {
	ID                uuid.UUID     `json:"id"`
	Status            string        `json:"status"`
	Notes             *string       `json:"notes"`
	CollectedAt       time.Time     `json:"collected_at"`
	LastInteractionAt *time.Time    `json:"last_interaction_at"`
	Company           LeadCompany   `json:"company"`
	Segment           *LeadSegment  `json:"segment"`
	Contact           ContactState  `json:"contact"`
	WebPresences      []WebPresence `json:"web_presences"`
	IsAvailable       bool          `json:"is_available"`
}

type LeadCompany struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	CNPJ          *string   `json:"cnpj"`
	City          *string   `json:"city"`
	State         *string   `json:"state"`
	WebsiteStatus string    `json:"website_status"`
	OpeningHours  *string   `json:"opening_hours"`
	// IsOpenNow is nil when the opening hours are unknown or use syntax this
	// product does not parse (holidays, sunrise/sunset, month ranges) —
	// treated as "don't know", never guessed.
	IsOpenNow *bool `json:"is_open_now"`
}

type LeadSegment struct {
	ID    uuid.UUID `json:"id"`
	Name  string    `json:"name"`
	Color string    `json:"color"`
}

// LeadCounts powers "100 encontrados / 80 disponíveis / 20 já contatados".
// Always computed over the whole filter in the database, never over the page.
type LeadCounts struct {
	Total      int `json:"total"`
	Available  int `json:"available"`
	Contacted  int `json:"contacted"`
	Replied    int `json:"replied"`
	Suppressed int `json:"suppressed"`
	NoPhone    int `json:"no_phone"`
	NoWebsite  int `json:"no_website"`
	Failed     int `json:"failed"`
}

// LeadFilters mirrors the query string of GET /leads.
type LeadFilters struct {
	SegmentID     *uuid.UUID
	City          string
	State         string
	Status        string
	WebsiteStatus string
	ContactState  string // never | contacted | replied | suppressed | available
	Search        string
	CollectedFrom *time.Time
	CollectedTo   *time.Time
	Sort          string
	Limit         int
	Offset        int
	// OpenNow filters by current opening status: nil means no filter, true
	// only currently-open businesses, false only currently-closed ones.
	// Leads with unknown hours match neither.
	OpenNow *bool
	// HasEmail filters by whether the contact point has an email on file:
	// nil means no filter, true only leads with an email, false only
	// leads still missing one.
	HasEmail *bool
}

type ContactEvent struct {
	ID         uuid.UUID      `json:"id"`
	Type       string         `json:"type"`
	OccurredAt time.Time      `json:"occurred_at"`
	Snapshot   map[string]any `json:"snapshot"`
	Note       *string        `json:"note"`
	CampaignID *uuid.UUID     `json:"campaign_id"`
}

type Template struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description"`
	SegmentID   *uuid.UUID `json:"segment_id"`
	SegmentName *string    `json:"segment_name"`
	// Audience says who the pitch is written for: no_website (I can build
	// you one), has_website (I can improve yours) or any.
	Audience string `json:"audience"`
	// Channel is purely organizational (email vs whatsapp) — there is still
	// only one automated send gateway (email); a "whatsapp" template is
	// meant to be copied or hand-sent, same as the manual followup step.
	Channel string `json:"channel"`
	// Purpose says WHEN in the relationship this template fits: the cold
	// first touch, or a remarketing nudge to someone contacted before.
	Purpose   string          `json:"purpose"`
	IsActive  bool            `json:"is_active"`
	VersionID *uuid.UUID      `json:"version_id"`
	Version   int             `json:"version"`
	Subject   string          `json:"subject"`
	Body      string          `json:"body"`
	Variables []string        `json:"variables"`
	Images    []TemplateImage `json:"images"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// TemplateImage is one of up to 5 attachments carried by a template version.
type TemplateImage struct {
	ID       uuid.UUID `json:"id"`
	URL      string    `json:"url"`
	Filename string    `json:"filename"`
}

type Campaign struct {
	ID                uuid.UUID        `json:"id"`
	Name              string           `json:"name"`
	Status            string           `json:"status"`
	TemplateVersionID uuid.UUID        `json:"template_version_id"`
	TemplateName      string           `json:"template_name"`
	BatchSize         int              `json:"batch_size"`
	CreatedAt         time.Time        `json:"created_at"`
	Progress          CampaignProgress `json:"progress"`
}

type CampaignProgress struct {
	TotalTargets      int            `json:"total_targets"`
	Pending           int            `json:"pending"`
	Sent              int            `json:"sent"`
	Failed            int            `json:"failed"`
	Excluded          int            `json:"excluded"`
	ExcludedBreakdown map[string]int `json:"excluded_breakdown"`
}

type CampaignTarget struct {
	ID             uuid.UUID         `json:"id"`
	ContactPointID uuid.UUID         `json:"contact_point_id"`
	LeadID         *uuid.UUID        `json:"lead_id"`
	CompanyID      *uuid.UUID        `json:"company_id"`
	CompanyName    string            `json:"company_name"`
	PhoneDisplay   string            `json:"phone_display"`
	Email          *string           `json:"email"`
	City           *string           `json:"city"`
	State          *string           `json:"state"`
	SegmentName    *string           `json:"segment_name"`
	State_         string            `json:"state_"`
	ExcludedReason *string           `json:"excluded_reason"`
	RenderVars     map[string]string `json:"render_vars"`
}

type Batch struct {
	ID            uuid.UUID  `json:"id"`
	CampaignID    uuid.UUID  `json:"campaign_id"`
	SequenceNo    int        `json:"sequence_no"`
	RequestedSize int        `json:"requested_size"`
	ReservedCount int        `json:"reserved_count"`
	SentCount     int        `json:"sent_count"`
	FailedCount   int        `json:"failed_count"`
	Status        string     `json:"status"`
	IsRecontact   bool       `json:"is_recontact"`
	CreatedAt     time.Time  `json:"created_at"`
	FinishedAt    *time.Time `json:"finished_at"`
}

type DispatchResult struct {
	DispatchID     uuid.UUID  `json:"dispatch_id"`
	ContactPointID uuid.UUID  `json:"contact_point_id"`
	CompanyName    string     `json:"company_name"`
	PhoneDisplay   string     `json:"phone_display"`
	Status         string     `json:"status"`
	SentAt         *time.Time `json:"sent_at"`
	ErrorCode      *string    `json:"error_code"`
	ErrorMessage   *string    `json:"error_message"`
}

type BatchOutcome struct {
	Batch            Batch            `json:"batch"`
	Results          []DispatchResult `json:"results"`
	CampaignProgress CampaignProgress `json:"campaign_progress"`
}

type DashboardMetrics struct {
	Totals struct {
		Leads       int `json:"leads"`
		NoWebsite   int `json:"no_website"`
		Available   int `json:"available"`
		Contacted   int `json:"contacted"`
		Replied     int `json:"replied"`
		Interested  int `json:"interested"`
		Negotiating int `json:"negotiating"`
		Customers   int `json:"customers"`
		Suppressed  int `json:"suppressed"`
	} `json:"totals"`
	Rates struct {
		ResponseRate   float64 `json:"response_rate"`
		InterestRate   float64 `json:"interest_rate"`
		ConversionRate float64 `json:"conversion_rate"`
	} `json:"rates"`
	BySegment  []SegmentMetric `json:"by_segment"`
	Timeline   []TimelinePoint `json:"timeline"`
	LeadStatus []StatusSlice   `json:"lead_status"`
	Recent     []ActivityItem  `json:"recent_activity"`
}

type SegmentMetric struct {
	SegmentName string `json:"segment_name"`
	Color       string `json:"color"`
	Leads       int    `json:"leads"`
	Contacted   int    `json:"contacted"`
	Replied     int    `json:"replied"`
	Customers   int    `json:"customers"`
}

type TimelinePoint struct {
	Date      string `json:"date"`
	Contacted int    `json:"contacted"`
	Collected int    `json:"collected"`
}

type StatusSlice struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type ActivityItem struct {
	Type        string    `json:"type"`
	OccurredAt  time.Time `json:"occurred_at"`
	CompanyName string    `json:"company_name"`
	Detail      string    `json:"detail"`
}

// ImportPreview is the dry-run answer: exactly what the commit will do.
type ImportPreview struct {
	JobID            uuid.UUID         `json:"job_id"`
	Filename         string            `json:"filename"`
	Status           string            `json:"status"`
	TotalRows        int               `json:"total_rows"`
	WillCreate       int               `json:"will_create"`
	WillMerge        int               `json:"will_merge"`
	WillSkip         int               `json:"will_skip"`
	NeedsReview      int               `json:"needs_review"`
	Invalid          int               `json:"invalid"`
	AlreadyContacted int               `json:"already_contacted"`
	ColumnMapping    map[string]string `json:"column_mapping"`
	Headers          []string          `json:"headers"`
	Rows             []ImportRowView   `json:"rows"`
}

type ImportRowView struct {
	RowNumber        int      `json:"row_number"`
	CompanyName      string   `json:"company_name"`
	PhoneDisplay     string   `json:"phone_display"`
	City             string   `json:"city"`
	State            string   `json:"state"`
	Website          string   `json:"website"`
	Outcome          string   `json:"outcome"`
	Reason           string   `json:"reason"`
	AlreadyContacted bool     `json:"already_contacted"`
	Errors           []string `json:"errors"`
}

type Suppression struct {
	ID           uuid.UUID `json:"id"`
	ContactID    uuid.UUID `json:"contact_point_id"`
	PhoneDisplay string    `json:"phone_display"`
	CompanyName  *string   `json:"company_name"`
	Reason       string    `json:"reason"`
	Note         *string   `json:"note"`
	CreatedAt    time.Time `json:"created_at"`
}
