// Package contact owns the phone value object. Normalization exists in this
// one place: never in SQL, never in the frontend. Two implementations drift,
// and drift here means contacting the same person twice.
package contact

import (
	"errors"
	"strings"
	"unicode"
)

// NormalizationVersion is stored alongside every contact point so the whole
// base can be re-normalized when this algorithm changes.
const NormalizationVersion = 1

type LineType string

const (
	LineMobile  LineType = "mobile"
	LineFixed   LineType = "fixed_line"
	LineUnknown LineType = "unknown"
)

var ErrInvalidPhone = errors.New("telefone inválido")

// validBRAreaCodes is the closed set of Brazilian DDDs. Anything outside it is
// not a real subscriber line (0800, 4004, typos).
var validBRAreaCodes = map[string]bool{
	"11": true, "12": true, "13": true, "14": true, "15": true, "16": true,
	"17": true, "18": true, "19": true, "21": true, "22": true, "24": true,
	"27": true, "28": true, "31": true, "32": true, "33": true, "34": true,
	"35": true, "37": true, "38": true, "41": true, "42": true, "43": true,
	"44": true, "45": true, "46": true, "47": true, "48": true, "49": true,
	"51": true, "53": true, "54": true, "55": true, "61": true, "62": true,
	"63": true, "64": true, "65": true, "66": true, "67": true, "68": true,
	"69": true, "71": true, "73": true, "74": true, "75": true, "77": true,
	"79": true, "81": true, "82": true, "83": true, "84": true, "85": true,
	"86": true, "87": true, "88": true, "89": true, "91": true, "92": true,
	"93": true, "94": true, "95": true, "96": true, "97": true, "98": true,
	"99": true,
}

// Number is the only way a phone enters the system. The fields are private and
// there is no alternative constructor, so an unnormalized number cannot reach
// the repository layer — the compiler enforces it.
type Number struct {
	e164     string
	display  string
	raw      string
	country  string
	areaCode string
	lineType LineType
	aliases  []string
}

func (n Number) E164() string       { return n.e164 }
func (n Number) Display() string    { return n.display }
func (n Number) Raw() string        { return n.raw }
func (n Number) Country() string    { return n.country }
func (n Number) AreaCode() string   { return n.areaCode }
func (n Number) LineType() LineType { return n.lineType }
func (n Number) IsMobile() bool     { return n.lineType == LineMobile }

// Aliases are alternative canonical forms that must resolve to this same
// contact. For Brazil this is the pre-2016 eight-digit mobile form: without it,
// "+553499999999" and "+5534999999999" become two contacts and the same person
// gets messaged twice.
func (n Number) Aliases() []string { return n.aliases }

// Parse is the single entry point. defaultRegion is an ISO country code; only
// "BR" gets the full national ruleset, everything else is accepted as E.164.
func Parse(raw string, defaultRegion string) (Number, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return Number{}, ErrInvalidPhone
	}

	// Extension markers: keep what comes before, the extension is not dialable.
	for _, sep := range []string{" r.", " ramal", " ext", " x"} {
		if idx := strings.Index(strings.ToLower(trimmed), sep); idx > 0 {
			trimmed = trimmed[:idx]
		}
	}

	hasPlus := strings.HasPrefix(strings.TrimSpace(trimmed), "+")
	digits := onlyDigits(trimmed)
	if digits == "" {
		return Number{}, ErrInvalidPhone
	}

	if hasPlus && !strings.HasPrefix(digits, "55") {
		return parseInternational(digits, raw)
	}
	if strings.ToUpper(defaultRegion) != "BR" && !hasPlus && !strings.HasPrefix(digits, "55") {
		return parseInternational(digits, raw)
	}
	return parseBR(digits, raw)
}

func parseBR(digits, raw string) (Number, error) {
	// Long distance operator prefix: 0 + carrier code, e.g. 0 31 34 9999...
	digits = strings.TrimLeft(digits, "0")

	// Country code, only when the remaining length makes it plausible.
	if strings.HasPrefix(digits, "55") && (len(digits) == 12 || len(digits) == 13) {
		digits = digits[2:]
	}

	if len(digits) != 10 && len(digits) != 11 {
		return Number{}, ErrInvalidPhone
	}

	area := digits[:2]
	if !validBRAreaCodes[area] {
		return Number{}, ErrInvalidPhone
	}
	subscriber := digits[2:]

	if allSameDigit(subscriber) {
		return Number{}, ErrInvalidPhone
	}

	var (
		canonical string
		aliases   []string
		lineType  LineType
	)

	switch len(subscriber) {
	case 9:
		if subscriber[0] != '9' {
			return Number{}, ErrInvalidPhone
		}
		lineType = LineMobile
		canonical = "+55" + area + subscriber
		// The pre-2016 form of the same line.
		if legacy := subscriber[1:]; legacy[0] >= '6' && legacy[0] <= '9' {
			aliases = append(aliases, "+55"+area+legacy)
		}
	case 8:
		switch {
		case subscriber[0] >= '6' && subscriber[0] <= '9':
			// Eight-digit mobile: the canonical form is always the nine-digit one.
			lineType = LineMobile
			canonical = "+55" + area + "9" + subscriber
			aliases = append(aliases, "+55"+area+subscriber)
		case subscriber[0] >= '2' && subscriber[0] <= '5':
			lineType = LineFixed
			canonical = "+55" + area + subscriber
		default:
			return Number{}, ErrInvalidPhone
		}
	default:
		return Number{}, ErrInvalidPhone
	}

	return Number{
		e164:     canonical,
		display:  formatBR(canonical),
		raw:      strings.TrimSpace(raw),
		country:  "55",
		areaCode: area,
		lineType: lineType,
		aliases:  aliases,
	}, nil
}

func parseInternational(digits, raw string) (Number, error) {
	if len(digits) < 8 || len(digits) > 15 {
		return Number{}, ErrInvalidPhone
	}
	e164 := "+" + digits
	return Number{
		e164:     e164,
		display:  e164,
		raw:      strings.TrimSpace(raw),
		country:  "",
		lineType: LineUnknown,
	}, nil
}

// formatBR renders "(34) 99999-9999" or "(34) 3222-1111".
func formatBR(e164 string) string {
	national := strings.TrimPrefix(e164, "+55")
	if len(national) < 10 {
		return e164
	}
	area, sub := national[:2], national[2:]
	switch len(sub) {
	case 9:
		return "(" + area + ") " + sub[:5] + "-" + sub[5:]
	case 8:
		return "(" + area + ") " + sub[:4] + "-" + sub[4:]
	default:
		return e164
	}
}

// SplitMultiple handles spreadsheet cells holding several numbers at once
// ("99999-9999 / 3222-1111").
func SplitMultiple(raw string) []string {
	fields := strings.FieldsFunc(raw, func(r rune) bool {
		return r == '/' || r == ';' || r == ',' || r == '|' || r == '\n'
	})
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		if f = strings.TrimSpace(f); f != "" {
			out = append(out, f)
		}
	}
	return out
}

func onlyDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func allSameDigit(s string) bool {
	if s == "" {
		return false
	}
	for i := 1; i < len(s); i++ {
		if s[i] != s[0] {
			return false
		}
	}
	return true
}
