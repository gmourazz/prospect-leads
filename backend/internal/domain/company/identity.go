// Package company owns the rules that decide whether two rows describe the
// same business, and whether a URL counts as a real website.
package company

import (
	"regexp"
	"strings"
)

// legalSuffixes are stripped only from the END of a name, so "Clínica ME
// Odontologia" keeps its middle word.
var legalSuffixes = []string{
	"ltda me", "ltda epp", "eireli me", "s a", "s/a", "sa",
	"ltda", "me", "epp", "eireli", "mei", "cia", "e cia",
}

var nonAlphanumeric = regexp.MustCompile(`[^a-z0-9 ]+`)
var multiSpace = regexp.MustCompile(`\s+`)

// NameKey is the dedupe key for a business name: lowercase, unaccented,
// punctuation-free, without trailing legal suffixes.
func NameKey(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = removeAccents(s)
	s = nonAlphanumeric.ReplaceAllString(s, " ")
	s = multiSpace.ReplaceAllString(s, " ")
	s = strings.TrimSpace(s)

	for changed := true; changed; {
		changed = false
		for _, suffix := range legalSuffixes {
			if strings.HasSuffix(s, " "+suffix) {
				s = strings.TrimSpace(strings.TrimSuffix(s, " "+suffix))
				changed = true
			}
		}
	}
	return s
}

// CityKey normalizes a city name for the composite natural key.
func CityKey(city string) string {
	s := strings.ToLower(strings.TrimSpace(city))
	s = removeAccents(s)
	s = nonAlphanumeric.ReplaceAllString(s, " ")
	return strings.TrimSpace(multiSpace.ReplaceAllString(s, " "))
}

// NormalizeState returns a two-letter uppercase UF, or "" when unrecognized.
func NormalizeState(state string) string {
	s := strings.ToUpper(strings.TrimSpace(state))
	if len(s) != 2 {
		return ""
	}
	return s
}

// accentFolding covers the Latin-1 range used by Portuguese and Spanish
// business names. A dependency-free table is enough here and keeps the
// normalization deterministic across Go versions.
var accentFolding = map[rune]rune{
	'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a', 'å': 'a',
	'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
	'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
	'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
	'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
	'ç': 'c', 'ñ': 'n', 'ý': 'y',
}

func removeAccents(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if folded, ok := accentFolding[r]; ok {
			b.WriteRune(folded)
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

var cnpjDigits = regexp.MustCompile(`[^0-9]`)

// NormalizeCNPJ returns the 14 digits when the check digits are valid, and ""
// otherwise. An invalid CNPJ is treated as absent rather than stored wrong.
func NormalizeCNPJ(raw string) string {
	d := cnpjDigits.ReplaceAllString(raw, "")
	if len(d) != 14 {
		return ""
	}
	if allSame(d) {
		return ""
	}
	if !validCNPJCheckDigits(d) {
		return ""
	}
	return d
}

func validCNPJCheckDigits(d string) bool {
	weights1 := []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	weights2 := []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}

	check := func(weights []int, upTo int) int {
		sum := 0
		for i := 0; i < upTo; i++ {
			sum += int(d[i]-'0') * weights[i]
		}
		rem := sum % 11
		if rem < 2 {
			return 0
		}
		return 11 - rem
	}

	return check(weights1, 12) == int(d[12]-'0') && check(weights2, 13) == int(d[13]-'0')
}

func allSame(s string) bool {
	for i := 1; i < len(s); i++ {
		if s[i] != s[0] {
			return false
		}
	}
	return true
}
