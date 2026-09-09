# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

**Prospect** — sistema pessoal de captação e prospecção de leads (negócios sem site) via WhatsApp. Monolito modular: backend Go (ports & adapters) + frontend React SPA (feature-sliced) + PostgreSQL. Não é um repositório git.

Documento de arquitetura completo (modelo de domínio, DDL, fluxos, contratos de API, roadmap): [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Ele descreve a fase de design; a implementação real já avançou além do que o documento descreve como "não escrito ainda" — trate o código como fonte da verdade quando divergir, e o documento como o porquê das decisões de modelagem.

## Comandos

### Banco de dados
```bash
docker-compose up -d          # Postgres 17 em localhost:5434 (db: prospect/prospect)
```

### Backend (Go 1.26, em `backend/`)
```bash
go run ./cmd/api               # sobe a API; aplica migrations pendentes automaticamente no start
go build ./...
go test ./...                  # roda todos os testes
go test ./internal/domain/contact/... -run TestNome   # teste único
go vet ./...
```
Variáveis de ambiente: ver `backend/.env.example` (`DATABASE_URL`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `GOOGLE_PLACES_API_KEY`, `WHATSAPP_NUMBER`, `SEND_DELAY_MIN_MS`/`MAX_MS`, `GATEWAY_FAIL_RATE`).

### Frontend (React + Vite + TS, em `frontend/`)
```bash
npm install
npm run dev         # Vite em :5173, proxy de /api para localhost:8080
npm run build       # tsc -b && vite build
npm run typecheck   # tsc --noEmit
```
Sem lint configurado e sem suíte de testes no frontend.

## Arquitetura

### Decisão central de modelagem
`contact_points` (telefone normalizado E.164) é entidade de primeira classe, imortal, independente de `leads`/`companies` (voláteis, recriáveis via reimport). Todo histórico de contato (`contact_events`, `message_dispatches`) é chaveado em `contact_point_id`, nunca em `lead_id`. Consequência: apagar e reimportar todos os leads não perde o histórico "já enviado".

### Backend — camadas (`backend/internal/`)
```
transport/http   → handlers HTTP finos (parse, auth, serialização) — router.go define todas as rotas
application       → casos de uso, orquestra transações (ex.: "enviar lote de 10")
domain            → entidades, value objects (PhoneNumber, CNPJ), erros de domínio, ports (interfaces)
adapters          → postgres (pgx, sem ORM), providers de coleta (googleplaces, osm), messaging (gateway simulado)
```
Wiring é manual em `cmd/api/main.go` (sem DI framework) — toda dependência é rastreável lendo essa função.

Erros de domínio cruzam camadas como um único tipo (`domain.Error` com `Code`); o mapeamento `Code → HTTP status` vive só em `transport/http/errors.go` (`statusFor`).

Migrations: arquivos SQL puros em `db/migrations/*.up.sql`, embutidos via `go:embed` (`db/embed.go`) e aplicados em ordem por `postgres.Migrate` no boot — sem ferramenta externa (não é golang-migrate apesar do nome dos arquivos).

Autenticação: JWT (HS256) via `internal/domain/identity`, middleware `RequireAuth` protege todas as rotas de `/api/v1` exceto `POST /auth/login`.

### Defesa em profundidade contra envio duplicado
Quatro camadas, cada uma insuficiente sozinha — **o banco é a garantia real**:
1. Frontend desabilita botão / invalida query
2. `Idempotency-Key` por requisição (header, gerado no clique)
3. Transação + `SELECT ... FOR UPDATE SKIP LOCKED` na reserva do lote
4. Índice único parcial em `message_dispatches` (`contact_point_id, attempt_seq` WHERE status ativo) — fisicamente impossível violar

Ver seção 2.2 e 4.7 de `docs/ARCHITECTURE.md` para o fluxo completo de campanha/lote/dispatch.

### Frontend — feature-sliced (`frontend/src/`)
```
app/          → router, query client, providers
components/   → ui/ (shadcn-style primitives), layout/, common/ — sem regra de negócio
features/<nome>/api/       → chamadas HTTP (usa frontend/src/lib/http.ts)
features/<nome>/hooks/     → TanStack Query (única fonte de estado servidor)
features/<nome>/components/
pages/        → uma página por rota, compõe features
```
`lib/http.ts` centraliza fetch: injeta `Authorization: Bearer <token>` do localStorage, injeta `Idempotency-Key` quando passado, e notifica um listener global em 401 (dispara logout) — não duplicar essa lógica em chamadas ad-hoc.

### `frontend/mocks-pages/`
**Não é código do app.** São landing pages de demonstração (ex.: `advocacia-models/lp-simples`, `lp-premium`) usadas como anexo/exemplo enviado a leads durante a prospecção — projetos estáticos separados, não tocam no build do Vite principal. Ignorar ao navegar a arquitetura do produto.
