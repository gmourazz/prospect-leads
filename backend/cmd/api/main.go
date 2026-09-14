package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/geovanna/prospect/backend/db"
	"github.com/geovanna/prospect/backend/internal/adapters/enrichment/emailfinder"
	"github.com/geovanna/prospect/backend/internal/adapters/messaging"
	"github.com/geovanna/prospect/backend/internal/adapters/messaging/gmailsmtp"
	"github.com/geovanna/prospect/backend/internal/adapters/postgres"
	"github.com/geovanna/prospect/backend/internal/adapters/providers/googleplaces"
	"github.com/geovanna/prospect/backend/internal/adapters/providers/osm"
	"github.com/geovanna/prospect/backend/internal/application"
	"github.com/geovanna/prospect/backend/internal/config"
	"github.com/geovanna/prospect/backend/internal/domain/sourcing"
	"github.com/geovanna/prospect/backend/internal/observability"
	transport "github.com/geovanna/prospect/backend/internal/transport/http"
)

func main() {
	cfg := config.Load()
	logger := observability.New(cfg.LogLevel)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := postgres.Migrate(ctx, pool, db.Migrations, logger); err != nil {
		logger.Error("migration failed", "error", err)
		os.Exit(1)
	}

	// Explicit wiring, no DI framework: every dependency is traceable by eye.
	store := postgres.NewStore(pool)
	contacts := postgres.NewContactRepo(store)
	companies := postgres.NewCompanyRepo(store)
	leads := postgres.NewLeadRepo(store)
	segments := postgres.NewSegmentRepo(store)
	templates := postgres.NewTemplateRepo(store)
	outreachRepo := postgres.NewOutreachRepo(store)
	importsRepo := postgres.NewImportRepo(store)
	analytics := postgres.NewAnalyticsRepo(store)
	idempotency := postgres.NewIdempotencyRepo(store)
	users := postgres.NewUserRepo(store)
	searchUsage := postgres.NewSearchUsageRepo(store)
	searchRuns := postgres.NewSearchRunRepo(store)
	attachmentRepo := postgres.NewAttachmentRepo(store)
	settingsRepo := postgres.NewSettingsRepo(store)

	// The simulated gateway exercises the full send path — reservation,
	// failure handling, history — without sending real email. Real sending
	// only when Gmail credentials are configured.
	var gateway messaging.Gateway
	if cfg.GmailAddress != "" && cfg.GmailAppPassword != "" {
		gateway = gmailsmtp.New(cfg.GmailAddress, cfg.GmailAppPassword, cfg.UploadsDir)
		logger.Info("gateway de envio: Gmail SMTP (mensagens reais)", "from", cfg.GmailAddress)
	} else {
		gateway = messaging.NewSimulated(cfg.GatewayFailRate)
		logger.Info("gateway de envio: simulado (defina GMAIL_ADDRESS e GMAIL_APP_PASSWORD para enviar de verdade)")
	}

	// "Buscar leads" uses the official Google Places API when a paid key is
	// configured; otherwise it queries the free OpenStreetMap Overpass API.
	// Both return real, live businesses — there is no demo/mock path.
	var leadProvider sourcing.Provider
	if cfg.GooglePlacesAPIKey != "" {
		leadProvider = googleplaces.New(cfg.GooglePlacesAPIKey)
	} else {
		leadProvider = osm.New()
		logger.Info("busca de leads usando OpenStreetMap (defina GOOGLE_PLACES_API_KEY para usar o Google Places)")
	}

	// Email discovery: the website/CNPJ sources always run; web search only
	// when Google Programmable Search credentials are configured.
	emailFinder := emailfinder.New(cfg.GoogleSearchAPIKey, cfg.GoogleSearchCX)
	if !emailFinder.SearchEnabled() {
		logger.Info("busca de emails na web desativada (defina GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX)")
	}

	api := &transport.API{
		Leads:       leads,
		Contacts:    contacts,
		Segments:    segments,
		Templates:   templates,
		Analytics:   analytics,
		Companies:   companies,
		Outreach:    application.NewOutreachService(store, outreachRepo, leads, templates, idempotency, settingsRepo, gateway),
		Imports:     application.NewImportService(store, importsRepo, contacts, companies, segments, idempotency),
		LeadService: application.NewLeadService(store, leads, companies, contacts),
		Sourcing:    application.NewSourcingService(store, companies, contacts, segments, leads, searchUsage, leadProvider, emailFinder),
		Users:       users,
		Attachments: attachmentRepo,
		SearchRuns:  searchRuns,
		Settings:    settingsRepo,
		Logger:      logger,
		CORS:        cfg.CORSOrigin,
		SenderEmail: cfg.GmailAddress,
		JWTSecret:   cfg.JWTSecret,
		UploadsDir:  cfg.UploadsDir,
	}

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.Router(),
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      120 * time.Second,
	}

	go func() {
		logger.Info("server listening", "port", cfg.Port, "gateway", gateway.Name())
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown failed", "error", err)
	}
}
