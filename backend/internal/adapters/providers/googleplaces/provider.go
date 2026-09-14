// Package googleplaces adapts the official Google Places API (New) to the
// sourcing.Provider port. It is used only when GOOGLE_PLACES_API_KEY is
// configured — see internal/adapters/providers/osm for the free fallback
// used otherwise. Scraping Google Maps HTML is deliberately not implemented:
// it violates Google's Terms of Service, so this package only ever talks to
// the official, authenticated API.
package googleplaces

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/geovanna/prospect/backend/internal/domain/sourcing"
)

const searchURL = "https://places.googleapis.com/v1/places:searchText"

type Provider struct {
	apiKey string
	client *http.Client
}

func New(apiKey string) *Provider {
	return &Provider{apiKey: apiKey, client: &http.Client{Timeout: 15 * time.Second}}
}

func (p *Provider) Name() string { return "google_places" }

type searchRequest struct {
	TextQuery      string `json:"textQuery"`
	LanguageCode   string `json:"languageCode"`
	MaxResultCount int    `json:"maxResultCount"`
}

type placeResponse struct {
	Places []struct {
		ID          string `json:"id"`
		DisplayName struct {
			Text string `json:"text"`
		} `json:"displayName"`
		FormattedAddress         string `json:"formattedAddress"`
		NationalPhoneNumber      string `json:"nationalPhoneNumber"`
		InternationalPhoneNumber string `json:"internationalPhoneNumber"`
		WebsiteURI               string `json:"websiteUri"`
		PrimaryTypeDisplayName   struct {
			Text string `json:"text"`
		} `json:"primaryTypeDisplayName"`
	} `json:"places"`
}

// Search issues one Text Search request against the official API. Field mask
// is restricted to exactly what the product needs (name, phone, address) to
// keep the request within the API's free/low-cost tier.
func (p *Provider) Search(ctx context.Context, q sourcing.SearchQuery) (sourcing.SearchResult, error) {
	limit := q.Limit
	if limit <= 0 || limit > 20 {
		limit = 20
	}

	textQuery := strings.TrimSpace(fmt.Sprintf("%s em %s, %s", q.Segment, q.City, q.State))
	body, err := json.Marshal(searchRequest{
		TextQuery:      textQuery,
		LanguageCode:   "pt-BR",
		MaxResultCount: limit,
	})
	if err != nil {
		return sourcing.SearchResult{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, searchURL, bytes.NewReader(body))
	if err != nil {
		return sourcing.SearchResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Goog-Api-Key", p.apiKey)
	req.Header.Set("X-Goog-FieldMask", strings.Join([]string{
		"places.id",
		"places.displayName",
		"places.formattedAddress",
		"places.nationalPhoneNumber",
		"places.internationalPhoneNumber",
		"places.websiteUri",
		"places.primaryTypeDisplayName",
	}, ","))

	resp, err := p.client.Do(req)
	if err != nil {
		return sourcing.SearchResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		if resp.StatusCode == http.StatusTooManyRequests {
			return sourcing.SearchResult{}, &sourcing.QuotaExceededError{
				Provider: p.Name(), Detail: string(body),
			}
		}
		return sourcing.SearchResult{}, fmt.Errorf("google places retornou %d: %s", resp.StatusCode, string(body))
	}

	var parsed placeResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return sourcing.SearchResult{}, err
	}

	leads := make([]sourcing.RawLead, 0, len(parsed.Places))
	for _, place := range parsed.Places {
		phone := place.InternationalPhoneNumber
		if phone == "" {
			phone = place.NationalPhoneNumber
		}
		leads = append(leads, sourcing.RawLead{
			ExternalID: place.ID,
			Name:       place.DisplayName.Text,
			Phone:      phone,
			Address:    place.FormattedAddress,
			City:       q.City,
			State:      q.State,
			Website:    place.WebsiteURI,
			Category:   place.PrimaryTypeDisplayName.Text,
		})
	}

	return sourcing.SearchResult{Provider: p.Name(), IsDemo: false, Leads: leads}, nil
}
