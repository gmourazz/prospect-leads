// Package sourcing defines the boundary between the domain and any external
// lead source. The domain only ever sees RawLead — no provider-specific
// shape leaks past this package, so adding or swapping a provider never
// touches dedupe, normalization, or the rest of the pipeline.
package sourcing

import "context"

type RawLead struct {
	ExternalID string
	Name       string
	Phone      string
	Address    string
	City       string
	State      string
	Website    string
	// Email is only ever set when the source itself publishes one (an OSM
	// contact:email tag, say) — never guessed from the domain.
	Email        string
	Category     string
	OpeningHours string
}

type SearchQuery struct {
	Segment string
	City    string
	State   string
	Limit   int
}

type SearchResult struct {
	Provider string
	// IsDemo marks results that are NOT real businesses — sample data shown
	// so the search UI is fully usable before a real provider key is
	// configured. Never persisted as a lead without the caller knowing.
	IsDemo bool
	Leads  []RawLead
}

type Provider interface {
	Name() string
	Search(ctx context.Context, q SearchQuery) (SearchResult, error)
}
