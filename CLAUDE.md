# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

**Prospect** — sistema pessoal de captação e prospecção de leads (negócios sem site) por email, com WhatsApp automatizado (agente pausado por padrão) e manual como canais secundários. Três componentes que rodam separados:

- **backend/** — Go 1.26, ports & adapters, PostgreSQL via pgx (sem ORM)
- **frontend/** — React SPA, feature-sliced, Vite + TypeScript
- **whatsapp-bridge/** — Node.js, sessão local de WhatsApp Web (Baileys), roda na máquina do usuário, nunca em servidor

Documento de arquitetura completo (modelo de domínio, DDL, fluxos, contratos de API): [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Ele descreve a fase de design original (email como único canal); o código avançou além disso — trate o código como fonte da verdade quando divergir, e o doc como o porquê das decisões de modelagem que ainda valem (contact_points imortal, defesa em profundidade, etc.).

Repositório git real, remoto em `github.com/gmourazz/prospect-leads`. Produção: backend no Fly.io (`prospect-backend.fly.dev`), Postgres no Neon, frontend no Netlify — deploy não é automático em push (ver seção Deploy).

## Comandos

### Banco de dados
```bash
docker compose up -d          # Postgres 17 em localhost:5434 (db/user/senha: prospect)
```

### Backend (Go 1.26, em `backend/`)
```bash
go run ./cmd/api               # sobe a API em :8080; aplica migrations pendentes automaticamente no start
go build ./...
go test ./...                  # roda todos os testes
go test ./internal/domain/outreach/... -run TestGreeting   # teste único
go vet ./...
```
Variáveis de ambiente: ver `backend/.env.example` (`DATABASE_URL`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `GOOGLE_PLACES_API_KEY`, `GOOGLE_SEARCH_API_KEY`/`GOOGLE_SEARCH_CX`, `GMAIL_ADDRESS`/`GMAIL_APP_PASSWORD`, `UPLOADS_DIR`, `GATEWAY_FAIL_RATE`). Sem Gmail configurado, o gateway de envio fica simulado.

### Frontend (React + Vite + TS, em `frontend/`)
```bash
npm install
npm run dev         # Vite em :5173, proxy de /api para localhost:8080
npm run build       # tsc -b && vite build
npm run typecheck   # tsc --noEmit
```
Sem lint configurado e sem suíte de testes no frontend.

### whatsapp-bridge (Node ≥20, em `whatsapp-bridge/`)
```bash
npm install
cp .env.example .env    # API_URL do backend + API_EMAIL/API_PASSWORD (mesmo login do site)
npm start                # primeira vez mostra QR code no terminal pra parear
```
Precisa ficar com o terminal aberto pra o envio automático de WhatsApp funcionar — é o processo que pergunta ao backend "posso enviar algo?" e recebe uma mensagem por vez ou "ainda não". Ver `whatsapp-bridge/README.md` para o modelo de risco e as camadas de ritmo.

## Deploy (produção)

Slash command `/build-prod` faz o fluxo inteiro: portão de qualidade (`go build/vet/test` + `tsc --noEmit` + `vite build`) → commit por assunto → push → `flyctl deploy` (backend) → `netlify deploy --prod` (frontend). Detalhes por trás disso:

- **Fly.io**: 1 máquina sempre ligada (`min_machines_running = 1`, sem auto-stop — grátis dentro do allowance), volume persistente montado em `/app/uploads` (senão a imagem do template some a cada deploy). App conectado ao GitHub, mas `flyctl deploy` builda do diretório local — push sozinho não redeploya.
- **Netlify**: **não** está conectado ao GitHub — publicado via CLI (`netlify deploy --prod`), então um `git push` sozinho também não atualiza o site. `VITE_API_URL` é *baked* no build (`npm run build`), não lido em runtime — mudar o backend de URL exige rebuild + redeploy do frontend, não só trocar env var no Netlify.
- **Neon**: Postgres gerenciado, grátis, separado do Postgres local (`docker compose`) e do que era usado no Railway (projeto antigo, ainda existe mas não é mais o backend de produção).
- `frontend/public/_redirects`: `/uploads/*` precisa apontar pro domínio do Fly *antes* do catch-all de SPA (`/* → /index.html`) — senão imagem de template quebra em prod (a ordem das regras importa, primeira que casar vence).

## Arquitetura

### Decisão central de modelagem
`contact_points` (telefone normalizado E.164) é entidade de primeira classe, imortal, independente de `leads`/`companies` (voláteis, recriáveis via reimport). Todo histórico de contato (`contact_events`, `message_dispatches`) é chaveado em `contact_point_id`, nunca em `lead_id`. Consequência: apagar e reimportar todos os leads não perde o histórico "já enviado".

### Backend — camadas (`backend/internal/`)
```
transport/http   → handlers HTTP finos (parse, auth, serialização) — router.go define todas as rotas
application       → casos de uso, orquestra transações (ex.: "enviar lote de 10", pacing do agente de WhatsApp)
domain            → entidades, value objects (PhoneNumber, CNPJ), erros de domínio, ports (interfaces)
adapters          → postgres (pgx, sem ORM), providers de coleta (googleplaces, osm), messaging (Gmail SMTP ou simulado)
```
Wiring é manual em `cmd/api/main.go` (sem DI framework) — toda dependência é rastreável lendo essa função.

Erros de domínio cruzam camadas como um único tipo (`domain.Error` com `Code`); o mapeamento `Code → HTTP status` vive só em `transport/http/errors.go` (`statusFor`).

Migrations: arquivos SQL puros em `db/migrations/*.up.sql`, embutidos via `go:embed` (`db/embed.go`) e aplicados em ordem por `postgres.Migrate` no boot — sem ferramenta externa (não é golang-migrate apesar do nome dos arquivos). Postgres proíbe usar um valor de enum novo (`ALTER TYPE ... ADD VALUE`) na mesma transação que o criou, e o runner de migration embrulha cada arquivo numa transação — por isso um `ADD VALUE` sempre vira migration própria, separada de quem lê esse valor (ver 000010/000018/000027→000028 como exemplos).

Autenticação: JWT (HS256) via `internal/domain/identity`, middleware `RequireAuth` protege todas as rotas de `/api/v1` exceto `POST /auth/login`.

### Defesa em profundidade contra envio duplicado
Camadas, cada uma insuficiente sozinha — **o banco é a garantia real**:
1. Frontend desabilita botão / invalida query
2. `Idempotency-Key` por requisição (header, gerado no clique)
3. Transação + `SELECT ... FOR UPDATE SKIP LOCKED` na reserva do lote
4. Índice único parcial em `message_dispatches` (`contact_point_id, channel, attempt_seq` WHERE status ocupando o contato) — fisicamente impossível violar

A garantia é **por canal**: email e WhatsApp podem ter cada um sua própria tentativa 1 pro mesmo contato (primeiro toque por email, depois WhatsApp se não responder), mas nunca duas tentativas no mesmo canal. `queued` (fila do WhatsApp automatizado) conta como "ocupando o contato" desde o momento em que entra na fila, não só quando sai de fato — senão uma fila de 200 aceitaria o mesmo contato duas vezes.

Ver seção 2.2, 4.7 e 10 de `docs/ARCHITECTURE.md` para o fluxo completo de campanha/lote/dispatch (a garantia descrita lá vale igual pro WhatsApp automatizado, só que "reserva" virou "claim" puxado pelo bridge).

### WhatsApp automatizado (`whatsapp-bridge/` + `application/whatsapp_agent.go`)
O bridge é deliberadamente burro: só pergunta "posso enviar algo?" (`POST /whatsapp/agent/claim`) e reporta o resultado (`POST /whatsapp/agent/result`). Toda regra de ritmo — intervalo aleatório entre mensagens, teto diário, janela de dias/horário, pausa longa a cada N mensagens — vive no Go, persistida em `app_settings` (`wa_*`) e `whatsapp_agent_state` (singleton, `id=1`), nunca em memória do processo Node. Agente começa **pausado**; reiniciar o bridge não reseta cooldown. Roda na máquina do usuário por design (sessão de WhatsApp Web saindo de datacenter é sinal de automação); o caminho manual antigo (abrir chat com mensagem pronta, confirmar "enviei") continua existindo como fallback quando o bridge não está rodando.

Templates de WhatsApp suportam spintax (`{opção1|opção2}`) pro texto variar entre envios — só nesse canal, email não usa.

### Frontend — feature-sliced (`frontend/src/`)
```
app/          → router, query client, providers
components/   → ui/ (shadcn-style primitives), layout/, common/ — sem regra de negócio
features/<nome>/api/       → chamadas HTTP (usa frontend/src/lib/http.ts)
features/<nome>/hooks/     → TanStack Query (única fonte de estado servidor)
features/<nome>/components/
pages/        → uma página por rota, compõe features
```
`lib/http.ts` centraliza fetch: injeta `Authorization: Bearer <token>` do localStorage, injeta `Idempotency-Key` quando passado, e notifica um listener global em 401 (dispara logout) — não duplicar essa lógica em chamadas ad-hoc. `VITE_API_URL` troca o proxy de dev por URL absoluta em build de produção.

Filtros de leads vivem na URL (`useLeadFilters`), não em state React, com fallback pro último filtro usado salvo em localStorage quando a navegação chega sem query string — compartilhar link ainda reproduz a tela exata.

Um fluxo em fila que dispara mutações que invalidam a query de leads (ex.: `BulkWhatsAppDialog`) deve tirar um snapshot da seleção no momento em que abre, não derivar a lista ao vivo da query — cada confirmação invalida `['leads']`, o que pode reordenar/encurtar a página atual embaixo da fila.

### `frontend/mocks-pages/`
**Não é código do app.** São landing pages de demonstração (ex.: `advocacia-models/lp-simples`, `lp-premium`) usadas como anexo/exemplo enviado a leads durante a prospecção — projetos estáticos separados, não tocam no build do Vite principal. Ignorar ao navegar a arquitetura do produto.
