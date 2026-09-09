package contact

import "testing"

func TestParseBRCanonicalForms(t *testing.T) {
	// Every one of these is the same person. If any of them produces a
	// different E.164 the whole product breaks: they become separate contacts
	// and each one gets its own message.
	same := []string{
		"(34) 99999-8888",
		"34 99999-8888",
		"34999998888",
		"+55 34 99999-8888",
		"5534999998888",
		"+5534999998888",
		"034 99999 8888",
		" (34) 9 9999-8888 ",
		"34 99999-8888 ramal 12",
	}
	const want = "+5534999998888"
	for _, in := range same {
		got, err := Parse(in, "BR")
		if err != nil {
			t.Fatalf("Parse(%q) returned error: %v", in, err)
		}
		if got.E164() != want {
			t.Errorf("Parse(%q).E164() = %q, want %q", in, got.E164(), want)
		}
	}
}

func TestParseBRNinthDigitAlias(t *testing.T) {
	// The eight-digit legacy form must canonicalize UP to the nine-digit form
	// and keep the old form as an alias, in both directions.
	eight, err := Parse("34 9999-8888", "BR")
	if err != nil {
		t.Fatalf("eight-digit parse failed: %v", err)
	}
	if eight.E164() != "+5534999998888" {
		t.Errorf("eight-digit canonical = %q, want +5534999998888", eight.E164())
	}
	if len(eight.Aliases()) != 1 || eight.Aliases()[0] != "+553499998888" {
		t.Errorf("eight-digit aliases = %v, want [+553499998888]", eight.Aliases())
	}

	nine, err := Parse("34 99999-8888", "BR")
	if err != nil {
		t.Fatalf("nine-digit parse failed: %v", err)
	}
	if len(nine.Aliases()) != 1 || nine.Aliases()[0] != "+553499998888" {
		t.Errorf("nine-digit aliases = %v, want [+553499998888]", nine.Aliases())
	}
	if eight.E164() != nine.E164() {
		t.Errorf("eight and nine digit forms diverged: %q vs %q", eight.E164(), nine.E164())
	}
}

func TestParseBRLineType(t *testing.T) {
	mobile, _ := Parse("34 99999-8888", "BR")
	if !mobile.IsMobile() {
		t.Error("nine-digit number should be mobile")
	}
	fixed, err := Parse("34 3222-1111", "BR")
	if err != nil {
		t.Fatalf("landline parse failed: %v", err)
	}
	if fixed.IsMobile() {
		t.Error("3222-1111 should be a landline")
	}
	if fixed.E164() != "+553432221111" {
		t.Errorf("landline canonical = %q", fixed.E164())
	}
	if len(fixed.Aliases()) != 0 {
		t.Errorf("landline should have no ninth-digit alias, got %v", fixed.Aliases())
	}
}

func TestParseRejectsInvalid(t *testing.T) {
	bad := []string{
		"", "abc", "0800 123 4567", "4004-1234", "1234",
		"(99) 99999-9999999", "20 99999-8888", // 20 is not a valid DDD
		"34 00000-0000", "34 99999-99999999",
	}
	for _, in := range bad {
		if got, err := Parse(in, "BR"); err == nil {
			t.Errorf("Parse(%q) should have failed, got %q", in, got.E164())
		}
	}
}

func TestDisplayFormatting(t *testing.T) {
	cases := map[string]string{
		"34999998888": "(34) 99999-8888",
		"3432221111":  "(34) 3222-1111",
	}
	for in, want := range cases {
		got, err := Parse(in, "BR")
		if err != nil {
			t.Fatalf("Parse(%q): %v", in, err)
		}
		if got.Display() != want {
			t.Errorf("Parse(%q).Display() = %q, want %q", in, got.Display(), want)
		}
	}
}

func TestSplitMultiple(t *testing.T) {
	got := SplitMultiple("(34) 99999-8888 / 3222-1111 ; 98888-7777")
	if len(got) != 3 {
		t.Fatalf("SplitMultiple returned %d parts: %v", len(got), got)
	}
}
