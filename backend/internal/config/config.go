package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port            string
	DatabaseURL     string
	CORSOrigin      string
	GatewayFailRate float64
	LogLevel        string
	// GooglePlacesAPIKey switches "Buscar leads" to the official Google
	// Places API when set. Empty means the free OpenStreetMap provider is
	// used instead — both return real businesses, never mock data.
	GooglePlacesAPIKey string
	// JWTSecret signs session tokens. Losing/rotating it logs everyone out.
	JWTSecret string
	// Google Programmable Search, used to look for a business's email when
	// it has no website of its own. Optional: without it that source is
	// skipped (scraping a search engine instead does not work — they answer
	// scripted requests with an anti-bot page). 100 queries/day are free.
	GoogleSearchAPIKey string
	GoogleSearchCX     string
	// Gmail SMTP credentials (an "app password", not the account password).
	// When both are set, real email goes out through here instead of the
	// simulated gateway — see internal/adapters/messaging/gmailsmtp.
	GmailAddress     string
	GmailAppPassword string
	// UploadsDir stores template attachment files on local disk. Served
	// statically under /uploads/, and read straight off disk when the email
	// gateway attaches them.
	UploadsDir string
}

func Load() Config {
	loadDotenv(".env")
	return Config{
		Port:               env("PORT", "8080"),
		DatabaseURL:        env("DATABASE_URL", "postgres://localhost:5432/prospect?sslmode=disable"),
		CORSOrigin:         env("CORS_ORIGIN", "http://localhost:5173"),
		GatewayFailRate:    envFloat("GATEWAY_FAIL_RATE", 0.0),
		LogLevel:           env("LOG_LEVEL", "info"),
		GooglePlacesAPIKey: env("GOOGLE_PLACES_API_KEY", ""),
		JWTSecret:          env("JWT_SECRET", "dev-secret-change-me-in-production"),
		GoogleSearchAPIKey: env("GOOGLE_SEARCH_API_KEY", ""),
		GoogleSearchCX:     env("GOOGLE_SEARCH_CX", ""),
		GmailAddress:       env("GMAIL_ADDRESS", ""),
		GmailAppPassword:   env("GMAIL_APP_PASSWORD", ""),
		UploadsDir:         env("UPLOADS_DIR", "./uploads"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func envFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}
