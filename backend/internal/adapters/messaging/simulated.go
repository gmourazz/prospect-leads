// Package messaging holds the outbound gateways. The simulated one exists so
// the entire send architecture — reservation, idempotency, failure handling,
// history — can be exercised end to end without sending real email.
// Swapping in the real gateway is a one-line change at wiring time.
//
// It deliberately has no concept of "safe" pacing, delay ranges, or send
// rate: this product does not try to guess or work around a messaging
// platform's rules. Sequencing is purely sequential — one item after the
// next — and any latency here only simulates the round-trip of a real HTTP
// call, never a deliberately "safe" interval.
package messaging

import (
	"context"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

type OutboundMessage struct {
	// To carries EVERY address known for the business, not just one: a
	// small business publishes contato@, the owner's personal Gmail and
	// whatever a directory listed, and there's no way to know which one a
	// human actually reads. One message, all of them.
	To        []string
	Subject   string
	Body      string
	ImageURLs []string // web paths under /uploads/, e.g. "/uploads/abc123.jpg"
}

type Result struct {
	ProviderMessageID string
	Provider          string
}

type Gateway interface {
	Name() string
	Send(ctx context.Context, msg OutboundMessage) (Result, error)
}

// roundTripLatency stands in for the time a real HTTP call to a messaging
// API would take. Fixed, not randomized — it is not standing in for pacing.
const roundTripLatency = 200 * time.Millisecond

type SimulatedGateway struct {
	FailureRate float64
}

func NewSimulated(failureRate float64) *SimulatedGateway {
	return &SimulatedGateway{FailureRate: failureRate}
}

func (g *SimulatedGateway) Name() string { return "simulated" }

func (g *SimulatedGateway) Send(ctx context.Context, msg OutboundMessage) (Result, error) {
	select {
	case <-ctx.Done():
		return Result{}, ctx.Err()
	case <-time.After(roundTripLatency):
	}

	if g.FailureRate > 0 && rand.Float64() < g.FailureRate {
		return Result{}, ErrProviderUnavailable
	}
	return Result{ProviderMessageID: "sim_" + uuid.NewString(), Provider: g.Name()}, nil
}

type providerError struct{ msg string }

func (e providerError) Error() string { return e.msg }

var ErrProviderUnavailable = providerError{"gateway indisponível"}
