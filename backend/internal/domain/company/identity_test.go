package company

import "testing"

func TestNameKey(t *testing.T) {
	cases := map[string]string{
		"Barbearia Imperial LTDA - ME":  "barbearia imperial",
		"BARBEARIA  IMPERIAL":           "barbearia imperial",
		"Clínica Odontológica São José": "clinica odontologica sao jose",
		"Studio Alpha EIRELI":           "studio alpha",
		"Clínica ME Odontologia":        "clinica me odontologia",
	}
	for in, want := range cases {
		if got := NameKey(in); got != want {
			t.Errorf("NameKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNormalizeCNPJ(t *testing.T) {
	if got := NormalizeCNPJ("11.222.333/0001-81"); got != "11222333000181" {
		t.Errorf("valid CNPJ rejected: %q", got)
	}
	for _, bad := range []string{"11.222.333/0001-82", "11111111111111", "123", ""} {
		if got := NormalizeCNPJ(bad); got != "" {
			t.Errorf("NormalizeCNPJ(%q) = %q, want empty", bad, got)
		}
	}
}

func TestClassifyURL(t *testing.T) {
	cases := map[string]PresenceKind{
		"https://instagram.com/barbeariaimperial": PresenceInstagram,
		"www.facebook.com/barbearia":              PresenceFacebook,
		"linktr.ee/barbearia":                     PresenceLinktree,
		"https://wa.me/5534999998888":             PresenceWhatsAppLink,
		"barbeariaimperial.com.br":                PresenceOwnSite,
		"https://minhabarbearia.wixsite.com/site": PresenceOther,
		"https://ifood.com.br/loja/x":             PresenceMarketplace,
	}
	for in, want := range cases {
		got, _, _, ok := ClassifyURL(in)
		if !ok {
			t.Fatalf("ClassifyURL(%q) failed to parse", in)
		}
		if got != want {
			t.Errorf("ClassifyURL(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDeriveWebsiteStatus(t *testing.T) {
	if got := DeriveWebsiteStatus(nil); got != StatusUnknown {
		t.Errorf("no presences should be unknown, got %q", got)
	}
	social := []PresenceKind{PresenceInstagram, PresenceWhatsAppLink, PresenceLinktree}
	if got := DeriveWebsiteStatus(social); got != StatusNoWebsite {
		t.Errorf("social-only should be no_website, got %q", got)
	}
	mixed := []PresenceKind{PresenceInstagram, PresenceOwnSite}
	if got := DeriveWebsiteStatus(mixed); got != StatusHasWebsite {
		t.Errorf("own site present should be has_website, got %q", got)
	}
}
