// Package outreach holds template rendering and the send-side domain rules.
package outreach

import (
	"net/url"
	"regexp"
	"sort"
	"strings"
)

var variablePattern = regexp.MustCompile(`\{\{\s*([a-z0-9_]+)\s*\}\}`)

// KnownVariables is the catalogue offered in the template editor.
var KnownVariables = []string{
	"nome_empresa",
	"nome_curto",
	"segmento",
	"cidade",
	"estado",
}

// ExtractVariables returns the sorted, deduplicated variable names used in a
// template body.
func ExtractVariables(body string) []string {
	seen := map[string]bool{}
	for _, m := range variablePattern.FindAllStringSubmatch(body, -1) {
		seen[m[1]] = true
	}
	out := make([]string, 0, len(seen))
	for v := range seen {
		out = append(out, v)
	}
	sort.Strings(out)
	return out
}

// UnknownVariables reports variables in the body that the system cannot fill.
func UnknownVariables(body string) []string {
	known := map[string]bool{}
	for _, v := range KnownVariables {
		known[v] = true
	}
	var out []string
	for _, v := range ExtractVariables(body) {
		if !known[v] {
			out = append(out, v)
		}
	}
	return out
}

// Render substitutes variables. A variable with no value is replaced by an
// empty string rather than left as literal "{{...}}" text, because a raw
// placeholder reaching a real person is worse than a missing word.
func Render(body string, vars map[string]string) string {
	out := variablePattern.ReplaceAllStringFunc(body, func(match string) string {
		name := variablePattern.FindStringSubmatch(match)[1]
		return vars[name]
	})
	// Collapse the double spaces an empty substitution can leave behind.
	lines := strings.Split(out, "\n")
	for i, line := range lines {
		lines[i] = strings.TrimRight(regexp.MustCompile(`[ \t]{2,}`).ReplaceAllString(line, " "), " \t")
	}
	return strings.Join(lines, "\n")
}

// ShortName takes the first meaningful word of a business name, for greetings
// like "Oi, Imperial!".
func ShortName(companyName string) string {
	fields := strings.Fields(companyName)
	skip := map[string]bool{
		"barbearia": true, "clinica": true, "clínica": true, "studio": true,
		"salao": true, "salão": true, "dr": true, "dra": true, "consultorio": true,
		"consultório": true, "centro": true, "espaco": true, "espaço": true,
	}
	for _, f := range fields {
		if !skip[strings.ToLower(strings.Trim(f, ".,"))] {
			return f
		}
	}
	if len(fields) > 0 {
		return fields[0]
	}
	return companyName
}

// BuildVars assembles the substitution map for one target.
func BuildVars(companyName, segment, city, state string) map[string]string {
	return map[string]string{
		"nome_empresa": companyName,
		"nome_curto":   ShortName(companyName),
		"segmento":     strings.ToLower(segment),
		"cidade":       city,
		"estado":       state,
	}
}

// WhatsAppLink builds a click-to-chat URL (wa.me) with the message already
// typed into the compose box. It sends nothing by itself — the human presses
// send — which is exactly why opening it is never recorded as a delivered
// message.
func WhatsAppLink(phoneE164, body string) string {
	digits := strings.TrimPrefix(phoneE164, "+")
	return "https://wa.me/" + digits + "?text=" + url.QueryEscape(body)
}
