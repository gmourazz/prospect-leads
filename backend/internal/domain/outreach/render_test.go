package outreach

import (
	"testing"
	"time"
)

func TestGreeting(t *testing.T) {
	cases := []struct {
		hour int
		want string
	}{
		{0, "Bom dia"},
		{6, "Bom dia"},
		{11, "Bom dia"},
		{12, "Boa tarde"},
		{17, "Boa tarde"},
		{18, "Boa noite"},
		{23, "Boa noite"},
	}
	for _, c := range cases {
		now := time.Date(2026, 1, 15, c.hour, 0, 0, 0, saoPauloLocation)
		if got := Greeting(now); got != c.want {
			t.Errorf("Greeting at %dh = %q, want %q", c.hour, got, c.want)
		}
	}
}

func TestRender_Saudacao(t *testing.T) {
	out := Render("{{saudacao}}, {{nome_curto}}!", map[string]string{"nome_curto": "Imperial"})
	if out == "{{saudacao}}, Imperial!" {
		t.Fatal("saudacao was left as a literal token instead of being resolved")
	}
	valid := map[string]bool{"Bom dia": true, "Boa tarde": true, "Boa noite": true}
	greeting := out[:len(out)-len(", Imperial!")]
	if !valid[greeting] {
		t.Errorf("unexpected greeting %q in rendered output %q", greeting, out)
	}
}
