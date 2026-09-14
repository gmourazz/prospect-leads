// Package outreach holds template rendering and the send-side domain rules.
package outreach

import (
	"math/rand"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// saoPauloLocation is loaded once; a missing tzdata falls back to UTC rather
// than failing the render (a slightly-off greeting beats a broken send).
var saoPauloLocation = func() *time.Location {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return time.UTC
	}
	return loc
}()

// Greeting returns "Bom dia" / "Boa tarde" / "Boa noite" for the current
// time in Brasília — used by {{saudacao}}, which is deliberately NOT part of
// BuildVars: BuildVars gets computed once and persisted with the campaign
// target, while a greeting must reflect the moment each message actually
// goes out, so Render resolves it fresh on every call instead.
func Greeting(now time.Time) string {
	switch hour := now.In(saoPauloLocation).Hour(); {
	case hour < 12:
		return "Bom dia"
	case hour < 18:
		return "Boa tarde"
	default:
		return "Boa noite"
	}
}

var variablePattern = regexp.MustCompile(`\{\{\s*([a-z0-9_]+)\s*\}\}`)

// imageTokenPattern marks WHERE an attached image goes in the message, e.g.
// {{imagem_1}} for the first image in the template's Images list (1-based,
// matching the order they're shown/uploaded in the editor). A template with
// no such token keeps today's behavior: every attached image just rides
// along as a plain attachment, in list order, position unspecified.
var imageTokenPattern = regexp.MustCompile(`\{\{\s*imagem_(\d+)\s*\}\}`)

// HasImageTokens reports whether the body places at least one attached image
// at a specific spot instead of leaving all of them implicit attachments.
func HasImageTokens(body string) bool {
	return imageTokenPattern.MatchString(body)
}

// ImageTokenIndexes returns the 1-based image indexes referenced by {{imagem_N}}
// tokens in the body, in the order they appear.
func ImageTokenIndexes(body string) []int {
	var out []int
	for _, m := range imageTokenPattern.FindAllStringSubmatch(body, -1) {
		if n, err := strconv.Atoi(m[1]); err == nil && n > 0 {
			out = append(out, n)
		}
	}
	return out
}

// KnownVariables is the catalogue offered in the template editor.
var KnownVariables = []string{
	"nome_empresa",
	"nome_curto",
	"segmento",
	"cidade",
	"estado",
	"saudacao",
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
		if known[v] || imageTokenPattern.MatchString("{{"+v+"}}") {
			continue
		}
		out = append(out, v)
	}
	return out
}

// Render substitutes variables. A variable with no value is replaced by an
// empty string rather than left as literal "{{...}}" text, because a raw
// placeholder reaching a real person is worse than a missing word.
func Render(body string, vars map[string]string) string {
	out := variablePattern.ReplaceAllStringFunc(body, func(match string) string {
		// {{imagem_N}} is not a text variable — it marks where an attached
		// image goes and is left in place for the messaging gateway to
		// resolve against the template's actual image list.
		if imageTokenPattern.MatchString(match) {
			return match
		}
		name := variablePattern.FindStringSubmatch(match)[1]
		if name == "saudacao" {
			return Greeting(time.Now())
		}
		return vars[name]
	})
	// Collapse the double spaces an empty substitution can leave behind.
	lines := strings.Split(out, "\n")
	for i, line := range lines {
		lines[i] = strings.TrimRight(regexp.MustCompile(`[ \t]{2,}`).ReplaceAllString(line, " "), " \t")
	}
	return strings.Join(lines, "\n")
}

// spinPattern matches a single-brace alternation like {Oi|Olá|Bom dia}. The
// required "|" is what keeps it from colliding with {{variavel}} syntax: a
// variable never contains a pipe, so the two can share the same body.
var spinPattern = regexp.MustCompile(`\{([^{}|]*\|[^{}]*)\}`)

// Spin picks one alternative per {a|b|c} group, so the same template produces
// a visibly different message every time.
//
// This is a WhatsApp-only concern and is applied only on that path. Sending
// hundreds of byte-identical messages from one number is the single loudest
// spam signal there is — far louder than the volume itself — because ordinary
// people never retype the same sentence perfectly. Email does not need it
// (and does not get it): inbox filters judge reputation and content, not
// repetition across unrelated recipients.
func Spin(body string) string {
	return spinPattern.ReplaceAllStringFunc(body, func(match string) string {
		options := strings.Split(match[1:len(match)-1], "|")
		return strings.TrimSpace(options[rand.Intn(len(options))])
	})
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
