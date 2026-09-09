// Package osm adapts the free, public OpenStreetMap Overpass API to the
// sourcing.Provider port. It requires no API key and no billing account,
// which is why it is the default provider: every result is a real business
// tagged by OSM contributors, never fabricated data. Coverage of phone
// numbers is incomplete (not every business has been tagged with one) —
// that is a real limitation of open community data, not a shortcut taken by
// this code.
//
// This deliberately talks only to the official Overpass API (a documented,
// rate-limited data endpoint designed for exactly this kind of programmatic
// query) — it does not scrape maps.google.com or any page meant for human
// browsing, which is the ToS-violating shortcut the architecture doc warns
// against.
package osm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/geovanna/prospect/backend/internal/domain/sourcing"
)

const overpassURL = "https://overpass-api.de/api/interpreter"

type Provider struct {
	client *http.Client
}

func New() *Provider {
	return &Provider{client: &http.Client{Timeout: 35 * time.Second}}
}

func (p *Provider) Name() string { return "openstreetmap" }

// tagsBySegment maps a product segment name to the OSM tag(s) that identify
// it. Where OSM has no exact equivalent (personal trainer), the closest real
// category is used and documented.
var tagsBySegment = map[string][]string{
	"barbearia":            {`shop=hairdresser`},
	"dentista":             {`amenity=dentist`},
	"clínica odontológica": {`amenity=dentist`},
	"clinica odontologica": {`amenity=dentist`},
	"personal trainer":     {`leisure=fitness_centre`, `sport=fitness`},
	"médico":               {`amenity=doctors`},
	"medico":               {`amenity=doctors`},
	"clínica médica":       {`amenity=clinic`},
	"clinica medica":       {`amenity=clinic`},
	"advocacia":            {`office=lawyer`},
}

type overpassResponse struct {
	Elements []struct {
		Type string            `json:"type"`
		ID   int64             `json:"id"`
		Tags map[string]string `json:"tags"`
	} `json:"elements"`
}

// Search queries Overpass for nodes/ways/relations tagged with the segment's
// category inside the named city's administrative boundary. Only elements
// carrying at least one phone-like tag are returned — a business with no
// public number cannot become a WhatsApp lead in this product anyway.
func (p *Provider) Search(ctx context.Context, q sourcing.SearchQuery) (sourcing.SearchResult, error) {
	tags := tagsBySegment[strings.ToLower(strings.TrimSpace(q.Segment))]
	if len(tags) == 0 {
		tags = []string{`shop`}
	}

	limit := q.Limit
	if limit <= 0 || limit > 30 {
		limit = 30
	}
	// Phone tagging on OSM is sparse (commonly under 20% of entries in a
	// given category), so the raw fetch always asks for the API's practical
	// ceiling rather than scaling with `limit` — a small `limit` would
	// otherwise almost always under-return once untagged entries are
	// filtered out below.
	const fetchCap = 200

	var filters strings.Builder
	for _, tag := range tags {
		for _, kind := range []string{"node", "way", "relation"} {
			fmt.Fprintf(&filters, "%s(area.a)[%s];", kind, tag)
		}
	}

	// admin_level restricts the area match to city/municipality-sized
	// boundaries. Without it, "boundary=administrative" also matches the
	// state and country polygons sharing part of the same name, and unioning
	// those into the search area is what was pushing real queries past
	// Overpass's server-side timeout (observed as a 504).
	query := fmt.Sprintf(`
[out:json][timeout:25];
area["name"="%s"]["boundary"="administrative"]["admin_level"~"^(6|7|8|9|10)$"]->.a;
(
%s
);
out tags %d;`, escapeOverpass(q.City), filters.String(), fetchCap)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, overpassURL,
		strings.NewReader(url.Values{"data": {query}}.Encode()))
	if err != nil {
		return sourcing.SearchResult{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	// Overpass's usage policy asks for an identifying User-Agent on every
	// client; omitting it is the kind of thing that gets an IP rate-limited.
	req.Header.Set("User-Agent", "ProspectApp/1.0 (lead sourcing; contact: gmouraz@icloud.com)")

	resp, err := p.client.Do(req)
	if err != nil {
		return sourcing.SearchResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return sourcing.SearchResult{}, fmt.Errorf("overpass API retornou status %d", resp.StatusCode)
	}

	var parsed overpassResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return sourcing.SearchResult{}, err
	}

	leads := make([]sourcing.RawLead, 0, limit)
	for _, el := range parsed.Elements {
		if len(leads) >= limit {
			break
		}
		name := firstNonEmpty(el.Tags["name"], el.Tags["name:pt"])
		phone := firstNonEmpty(el.Tags["contact:phone"], el.Tags["phone"], el.Tags["contact:mobile"], el.Tags["mobile"])
		if name == "" || phone == "" {
			continue
		}

		leads = append(leads, sourcing.RawLead{
			ExternalID:   fmt.Sprintf("osm-%s-%d", el.Type, el.ID),
			Name:         name,
			Phone:        phone,
			Address:      firstNonEmpty(el.Tags["addr:street"], ""),
			City:         firstNonEmpty(el.Tags["addr:city"], q.City),
			State:        q.State,
			Website:      firstNonEmpty(el.Tags["contact:website"], el.Tags["website"]),
			Email:        firstNonEmpty(el.Tags["contact:email"], el.Tags["email"]),
			Category:     q.Segment,
			OpeningHours: el.Tags["opening_hours"],
		})
	}

	return sourcing.SearchResult{Provider: p.Name(), IsDemo: false, Leads: leads}, nil
}

func escapeOverpass(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	return s
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
