# Prospect

Sistema pessoal de captação e prospecção de leads (negócios sem site) via email, com fallback manual por WhatsApp. Monolito modular: backend Go (ports & adapters) + frontend React SPA (feature-sliced) + PostgreSQL.

Arquitetura completa, modelo de domínio, DDL e fluxos: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). O código é a fonte da verdade quando divergir do doc.

## Decisão central de modelagem

`contact_points` (telefone normalizado E.164) é entidade de primeira classe, imortal, independente de `leads`/`companies` (voláteis, recriáveis via reimport). Todo histórico de contato (`contact_events`, `message_dispatches`) é chaveado em `contact_point_id`, nunca em `lead_id`. Consequência prática: apagar e reimportar todos os leads não perde o histórico de "já enviado" — o sistema nunca manda a mesma mensagem duas vezes pro mesmo número.

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (precisa estar **aberto**, não só instalado)
- Go 1.26+
- Node 18+

## Como rodar (do zero)

Abra 3 terminais.

### 1. Banco de dados

Se o Docker Desktop não estiver aberto, abra primeiro (`open -a Docker` no macOS e espere ~20-30s até o ícone da baleia parar de animar). Depois, na raiz do projeto:

```bash
docker compose up -d
```

Sobe Postgres 17 em `localhost:5434` (db/user/senha: `prospect`). Confirma que subiu com `docker compose ps` — status deve virar `healthy`.

### 2. Backend

```bash
cd backend
cp .env.example .env   # só na primeira vez — depois edite com suas chaves/senhas
go run ./cmd/api
```

Sobe a API em `localhost:8080` e aplica as migrations pendentes automaticamente no start (arquivos SQL em `db/migrations/*.up.sql`, embutidos via `go:embed`, sem ferramenta externa).

Se der erro de conexão (`connection refused` na porta 5434), é o passo 1 que não rodou.

### 3. Frontend

```bash
cd frontend
npm install   # só na primeira vez ou quando mudar dependência
npm run dev
```

Sobe em `localhost:5173`, com proxy de `/api` pra `localhost:8080`.

Login: usuário criado via seed/migration inicial — ver `db/migrations` ou criar via API `/auth` se não houver nenhum ainda.

## Backend (Go 1.26, `backend/`)

### Stack

- **Router**: [chi](https://github.com/go-chi/chi) (`go-chi/chi/v5`)
- **DB**: PostgreSQL via [pgx](https://github.com/jackc/pgx) — sem ORM, SQL puro
- **Auth**: JWT (HS256) via `golang-jwt/jwt/v5`
- **Sem framework de DI** — todo wiring é manual e rastreável em `cmd/api/main.go`

### Camadas (`backend/internal/`)

```
transport/http   → handlers HTTP finos (parse, auth, serialização) — router.go define todas as rotas
application       → casos de uso, orquestra transações (ex.: "enviar lote de 10")
domain            → entidades, value objects (PhoneNumber, CNPJ), erros de domínio, ports (interfaces)
  ├─ company       → empresas
  ├─ contact       → contact_points, contact_events, suppressions
  ├─ identity      → usuários, auth
  ├─ lead          → leads (vínculo company ↔ contact ↔ segment)
  ├─ outreach      → campanhas, templates, batches, dispatches
  └─ sourcing      → busca/coleta de leads (Google Places, OpenStreetMap)
adapters          → implementações concretas dos ports
  ├─ postgres       → repositórios (LeadRepo, ContactRepo, SegmentRepo, TemplateRepo, AnalyticsRepo, CompanyRepo, UserRepo, AttachmentRepo, SettingsRepo)
  ├─ providers      → Google Places / OpenStreetMap (coleta de leads)
  ├─ enrichment     → busca de email pra leads que só têm telefone
  └─ messaging      → gateway de envio (Gmail SMTP real, ou simulado se não configurado)
observability      → logging estruturado (slog)
config             → carregamento de env vars
```

Erros de domínio cruzam camadas como um único tipo (`domain.Error` com `Code`); o mapeamento `Code → HTTP status` vive só em `transport/http/errors.go`.

### Defesa em profundidade contra envio duplicado

Quatro camadas, cada uma insuficiente sozinha — **o banco é a garantia real**:

1. Frontend desabilita botão / invalida query
2. `Idempotency-Key` por requisição (header, gerado no clique)
3. Transação + `SELECT ... FOR UPDATE SKIP LOCKED` na reserva do lote
4. Índice único parcial em `message_dispatches` (`contact_point_id, attempt_seq` WHERE status ativo) — fisicamente impossível violar

### Rotas principais (`/api/v1`, protegidas por JWT exceto `/auth/login`)

| Recurso | Rotas |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Segmentos | `GET/POST /segments`, `PATCH /segments/{id}` |
| Leads | `GET/POST /leads`, `GET /leads/{id}`, `PATCH/DELETE /leads/{id}`, `GET /leads/cities`, `POST /leads/selection`, `POST /leads/{id}/followup` |
| Enriquecimento | `POST /leads/enrich-emails`, `GET /leads/enrich-emails/progress` |
| Aguardando resposta | `GET /awaiting-reply`, `POST /followups/{id}/confirm`, `POST /followups/{id}/cancel` |
| Contact points | `POST /contact-points/lookup`, `GET/PATCH /contact-points/{id}`, `GET /contact-points/{id}/events`, `POST/DELETE /contact-points/{id}/suppressions`, `POST /contact-points/{id}/recontact-approvals`, `POST /contact-points/{id}/replied` |
| Bloqueios | `GET /suppressions` |
| Templates | `GET/POST /templates`, `GET /templates/{id}`, `POST /templates/{id}/versions`, `DELETE /templates/{id}`, `GET /templates/variables`, `POST /templates/attachments` |
| Campanhas | `GET/POST /campaigns`, `GET /campaigns/{id}`, `GET /campaigns/{id}/targets`, `GET/POST /campaigns/{id}/batches`, `POST /campaigns/{id}/preview`, `DELETE /campaigns/{id}` |
| Importação | `GET/POST /imports`, `GET /imports/{id}`, `POST /imports/{id}/commit` |
| Busca de leads | `POST /searches`, `POST /searches/import`, `GET /searches/usage` |
| Dashboard | `GET /analytics/overview` |
| Configurações | `GET/PUT /settings` |

### Variáveis de ambiente (`backend/.env`, ver `.env.example`)

| Variável | Uso |
|---|---|
| `PORT` | porta da API (padrão 8080) |
| `DATABASE_URL` | connection string do Postgres |
| `CORS_ORIGIN` | origem liberada (frontend dev = `http://localhost:5173`) |
| `LOG_LEVEL` | nível de log (`info`, `debug`, ...) |
| `JWT_SECRET` | segredo de assinatura do JWT — **trocar em produção** |
| `UPLOADS_DIR` | onde ficam os anexos de template |
| `GOOGLE_PLACES_API_KEY` | opcional — sem ela, busca de leads usa OpenStreetMap (gratuito) |
| `GMAIL_ADDRESS` / `GMAIL_APP_PASSWORD` | opcional — sem ambos, envio de email fica simulado. App password gerada em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (exige verificação em 2 etapas ativa) |
| `SEND_DELAY_MIN_MS` / `SEND_DELAY_MAX_MS` | intervalo simulado entre envios de um lote |
| `GATEWAY_FAIL_RATE` | taxa de falha simulada do gateway de envio (0 = desligado, só pra testar tratamento de erro) |

### Comandos

```bash
go run ./cmd/api                                       # sobe a API
go build ./...                                          # compila tudo
go test ./...                                            # roda todos os testes
go test ./internal/domain/contact/... -run TestNome       # teste único
go vet ./...
```

## Frontend (React 18 + Vite + TypeScript, `frontend/`)

### Stack

- **Build**: Vite 6
- **Estado servidor**: TanStack Query 5 (única fonte de dados vindos da API)
- **Roteamento**: react-router-dom 6
- **UI**: componentes próprios estilo shadcn sobre Radix UI (`@radix-ui/react-*`) + Tailwind CSS
- **Ícones**: lucide-react
- **Toasts**: sonner
- **Gráficos**: recharts (parcial — dashboard tem alguns gráficos custom em barra também)

### Estrutura feature-sliced (`frontend/src/`)

```
app/          → router, query client, providers
components/
  ui/          → primitivos estilo shadcn (button, card, badge, dialog, select, ...) — sem regra de negócio
  layout/      → AppShell, Sidebar, Topbar, PageHeader, RequireAuth
  common/      → EmptyState, ErrorState, Pagination, ConfirmDialog
features/<nome>/
  api/          → chamadas HTTP (usa lib/http.ts)
  hooks/        → TanStack Query (queries + mutations)
  components/   → componentes específicos da feature
pages/        → uma página por rota, compõe features
lib/          → http.ts, cn.ts, format.ts, query-keys.ts, segment-colors.ts, api-error.ts
types/        → domain.ts — todos os tipos de domínio espelhando a API
```

Features: `auth`, `leads`, `campaigns`, `dashboard`, `followup`, `imports`, `segments`, `settings`, `sourcing`, `suppression`, `templates`.

`lib/http.ts` centraliza fetch: injeta `Authorization: Bearer <token>` do localStorage, injeta `Idempotency-Key` quando passado, e notifica um listener global em 401 (dispara logout) — não duplicar essa lógica em chamadas ad-hoc.

Filtros de leads vivem na URL (`useLeadFilters`), não em state React — compartilhar link reproduz a tela, back button funciona, F5 mantém o contexto.

### Rotas (páginas)

| Rota | Página |
|---|---|
| `/` | Dashboard |
| `/leads` | Leads |
| `/buscar` | Buscar leads (coleta via Google Places/OSM) |
| `/campanhas`, `/campanhas/:id` | Campanhas |
| `/aguardando` | Aguardando resposta (follow-up WhatsApp) |
| `/templates` | Templates de mensagem |
| `/importar` | Importar leads via CSV |
| `/segmentos` | Segmentos (verticais de negócio) |
| `/bloqueios` | Não contatar (suppressions) |
| `/configuracoes` | Configurações (remetente, assinatura) |
| `/login` | Login |

### Comandos

```bash
npm install
npm run dev         # Vite em :5173, proxy de /api para localhost:8080
npm run build       # tsc -b && vite build
npm run typecheck   # tsc --noEmit
```

Sem lint configurado e sem suíte de testes no frontend.

## `frontend/mocks-pages/`

**Não é código do app.** São landing pages de demonstração (ex.: `advocacia-models/lp-simples`, `lp-premium`) usadas como anexo/exemplo enviado a leads durante a prospecção — projetos estáticos separados, não tocam no build do Vite principal.

## Erros comuns

| Sintoma | Causa | Fix |
|---|---|---|
| `dial tcp [::1]:5434: connect: connection refused` | Postgres não tá rodando | `docker compose up -d` na raiz |
| `failed to connect to the docker API` | Docker Desktop fechado | Abre o app, espera terminar de iniciar, tenta de novo |
| `go: pattern cmd matches multiple packages` | Rodou `go run cmd` em vez do caminho completo | Usa `go run ./cmd/api` |
| CORS bloqueado no browser | `CORS_ORIGIN` no backend não bate com a origem do frontend | Confere `backend/.env` |
