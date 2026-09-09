# Prospect — Arquitetura do Sistema

Documento de arquitetura da fase de design. Nenhuma linha de código de aplicação foi escrita ainda: este documento define o domínio, o modelo de dados, as garantias de integridade e o plano de execução antes da implementação.

**Nome de trabalho:** `prospect`
**Stack:** React + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query + React Router · Go · PostgreSQL
**Escopo inicial:** ambiente local, uso pessoal (single-tenant, multi-usuário preparado)

---

## Índice

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Diagrama textual do fluxo](#2-diagrama-textual-do-fluxo)
3. [Entidades do domínio](#3-entidades-do-domínio)
4. [Modelo relacional do PostgreSQL](#4-modelo-relacional-do-postgresql)
5. [Relacionamentos entre tabelas](#5-relacionamentos-entre-tabelas)
6. [Estratégia de normalização de telefones](#6-estratégia-de-normalização-de-telefones)
7. [Estratégia de deduplicação](#7-estratégia-de-deduplicação)
8. [Arquitetura do histórico de contato](#8-arquitetura-do-histórico-de-contato)
9. [Mecanismo de persistência do status "já enviado"](#9-mecanismo-de-persistência-do-status-já-enviado)
10. [Estratégia para impedir envios duplicados](#10-estratégia-para-impedir-envios-duplicados)
11. [Estratégia de idempotência](#11-estratégia-de-idempotência)
12. [Arquitetura de campanhas e lotes](#12-arquitetura-de-campanhas-e-lotes)
13. [Arquitetura Go](#13-arquitetura-go)
14. [Estrutura de pastas do backend](#14-estrutura-de-pastas-do-backend)
15. [Arquitetura React](#15-arquitetura-react)
16. [Estrutura de pastas do frontend](#16-estrutura-de-pastas-do-frontend)
17. [Contratos principais da API](#17-contratos-principais-da-api)
18. [Estratégia de tratamento de erros](#18-estratégia-de-tratamento-de-erros)
19. [Estratégia de logs](#19-estratégia-de-logs)
20. [Estratégia de importação](#20-estratégia-de-importação)
21. [Arquitetura futura de coleta](#21-arquitetura-futura-de-coleta)
22. [Riscos técnicos](#22-riscos-técnicos)
23. [Roadmap do MVP](#23-roadmap-do-mvp)

---

## 1. Visão geral da arquitetura

### 1.1 Decisão central

O sistema inteiro gira em torno de uma decisão de modelagem: **o contato (telefone normalizado) é uma entidade de primeira classe, independente e de ciclo de vida mais longo que o lead**.

Isso inverte a modelagem ingênua. Na modelagem ingênua o telefone é uma coluna do lead, e o histórico morre junto com o lead. Aqui:

```
contact_points  (vive para sempre, chave = telefone E.164)
      ▲
      │ referenciado por
      │
   leads / companies  (voláteis: recoletados, reimportados, deletados, recriados)
```

Consequência prática: recoletar a base, apagar todos os leads e reimportar do zero **não perde nada** do histórico de contato. O `✓ Enviado` reaparece porque ele nunca dependeu do lead — ele é derivado de `message_dispatches` ligado a `contact_points`.

### 1.2 Camadas

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND — React SPA (Vite)                                     │
│  Feature-sliced. TanStack Query = única fonte de estado servidor.│
│  Zero regra de negócio: só apresentação, formulários e cache.    │
└───────────────────────────┬──────────────────────────────────────┘
                            │ REST/JSON + OpenAPI (tipos gerados)
┌───────────────────────────▼──────────────────────────────────────┐
│  BACKEND Go — arquitetura em camadas (ports & adapters)          │
│                                                                  │
│  ┌────────────┐  HTTP handlers: parse, auth, serializa. Fino.    │
│  │ transport  │                                                  │
│  ├────────────┤  Casos de uso. Orquestra transações.             │
│  │ application│  É AQUI que vive "enviar lote de 10".            │
│  ├────────────┤  Entidades, value objects (PhoneNumber),         │
│  │  domain    │  invariantes, erros de domínio, ports (interfaces)│
│  ├────────────┤  Postgres (pgx+sqlc), providers de coleta,       │
│  │ adapters   │  gateway WhatsApp, storage de anexos, clock.     │
│  └────────────┘                                                  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│  POSTGRESQL — guardião final da integridade                      │
│  Constraints, partial unique indexes, FKs, transações.           │
│  A regra "não enviar duas vezes" é fisicamente impossível de     │
│  violar mesmo que a aplicação tenha bug.                         │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Princípio de defesa em profundidade

A proteção contra envio duplicado existe em **quatro** camadas, e cada uma sozinha é insuficiente:

| Camada | Proteção | Protege contra |
|---|---|---|
| Frontend | Botão desabilita, query invalidada | UX, duplo clique óbvio |
| API | Chave de idempotência por requisição | Retry de rede, refresh, F5 |
| Aplicação | Transação + `SELECT … FOR UPDATE SKIP LOCKED` | Duas abas, duas campanhas concorrentes |
| Banco | Índice único parcial em `message_dispatches` | Tudo o resto. É a garantia real. |

O frontend é conveniência. **O banco é a verdade.**

### 1.4 Serviços/módulos lógicos

Um único binário Go no MVP (monolito modular), com fronteiras internas claras para permitir extração futura:

- `identity` — usuários, sessão
- `catalog` — segmentos, cidades
- `sourcing` — importações, jobs de coleta, providers
- `dedupe` — resolução de identidade de empresa e contato
- `presence` — detecção e classificação de presença digital (site próprio ou não)
- `outreach` — templates, campanhas, lotes, envios, histórico
- `suppression` — do-not-contact, blacklist
- `analytics` — agregações do dashboard
- `audit` — trilha de eventos

---

## 2. Diagrama textual do fluxo

### 2.1 Fluxo macro (ingestão → contato)

```
  [ CSV ]  [ Excel ]  [ Manual ]  [ Provider API ]  [ Scraper futuro ]
     │        │           │             │                  │
     └────────┴───────────┴──────┬──────┴──────────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  INGESTION (staging)     │  import_rows: linha crua em jsonb
                    │  nada toca o banco final │  status: pending
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  1. NORMALIZAÇÃO         │  trim, unaccent, casing,
                    │                          │  nome legal, cidade/UF, URL
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  2. TELEFONE → E.164     │  libphonenumber, região BR
                    │                          │  + regra 9º dígito + aliases
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  3. VALIDAÇÃO            │  CNPJ (dígito verificador),
                    │                          │  telefone plausível, UF válida
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  4. RESOLUÇÃO DE         │  CNPJ → nome+cidade → trigram
                    │     IDENTIDADE (dedupe)  │  match / new / review
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  5. ASSOCIAR CONTATOS    │  upsert contact_points
                    │                          │  liga empresa ↔ contato
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  6. HERDAR HISTÓRICO     │  já existia? já foi contatado?
                    │                          │  está em do_not_contact?
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  7. PRESENÇA DIGITAL     │  classifica URLs:
                    │                          │  own_site / social / market
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  8. UPSERT FINAL         │  insere só o que é novo;
                    │     (transacional)       │  NUNCA sobrescreve histórico
                    └────────────┬─────────────┘
                                 │
                                 ▼
                          leads no painel
```

### 2.2 Fluxo de contato (o coração do produto)

```
  Painel de leads
        │
        │  filtra: segmento, cidade, sem site, não contatado
        ▼
  ┌───────────────────────────────────────────┐
  │  100 encontrados                          │
  │   80 disponíveis para contato             │  ← calculado no BACKEND,
  │   20 já contatados                        │    não no frontend
  │    3 bloqueados (do not contact)          │
  └───────────────┬───────────────────────────┘
                  │  "Selecionar disponíveis"  → seleciona só os 80
                  ▼
  ┌───────────────────────────────────────────┐
  │  Escolher template + imagem               │
  │  Preview com variáveis resolvidas         │
  └───────────────┬───────────────────────────┘
                  │
                  ▼
  ┌───────────────────────────────────────────┐
  │  Criar campanha (ou usar existente)       │
  │  campaign_targets = snapshot dos alvos    │
  └───────────────┬───────────────────────────┘
                  │
                  │  clique: "Enviar próximos 10"
                  │  header: Idempotency-Key: <uuid gerado no clique>
                  ▼
  ┌═══════════════════════════════════════════════════════════════┐
  ║  TRANSAÇÃO 1 — RESERVA (é aqui que a duplicidade é barrada)   ║
  ║                                                               ║
  ║  a) registra idempotency_key (unique) — se já existe, retorna ║
  ║     a resposta anterior e NÃO reserva nada                    ║
  ║  b) cria dispatch_batch (status = reserving)                  ║
  ║  c) SELECT alvos elegíveis                                    ║
  ║       FOR UPDATE SKIP LOCKED  LIMIT 10                        ║
  ║     elegível = nunca despachado ∧ não bloqueado ∧ não em      ║
  ║     outro lote aberto                                         ║
  ║  d) INSERT em message_dispatches (status = reserved)          ║
  ║       ↳ índice único parcial dispara aqui se alguém já pegou  ║
  ║  e) batch → status = ready, count = N (N ≤ 10, pode ser < 10) ║
  ╚═══════════════════┬═══════════════════════════════════════════╝
                      │
                      ▼
  ┌───────────────────────────────────────────┐
  │  DESPACHO — item a item, sequencial       │
  │  MVP: gateway simulado (dry-run)          │
  │  Futuro: gateway WhatsApp real            │
  │  Cada item: message_attempts (N tentativas)│
  └───────────────┬───────────────────────────┘
                  │
                  ▼
  ┌═══════════════════════════════════════════════════════════════┐
  ║  TRANSAÇÃO 2..N+1 — por item, isoladas                        ║
  ║  sucesso → dispatch.status = sent, sent_at = now              ║
  ║          → INSERT contact_events (message_sent)               ║
  ║          → atualiza contact_point_stats (trigger)             ║
  ║  falha   → dispatch.status = failed + error_code              ║
  ║          → reserva é LIBERADA (contato volta a elegível)      ║
  ╚═══════════════════┬═══════════════════════════════════════════╝
                      │
                      ▼
  ┌───────────────────────────────────────────┐
  │  BATCH → completed. PARA.                 │
  │  Novo estado: 70 disponíveis.             │
  │  Nenhum loop automático. Precisa clicar.  │
  └───────────────────────────────────────────┘
```

### 2.3 Fluxo de recontato (sempre explícito)

```
  usuário clica "Enviar novamente" num contato já contatado
        │
        ▼
  modal: "Este contato recebeu mensagem em 05/09/2026 às 14:32.
          Total de 1 contato realizado. Deseja realmente enviar de novo?"
        │
        │ confirma
        ▼
  POST /contact-points/:id/recontact-approvals
        │
        ▼
  cria recontact_approval (uso único, com expiração e motivo)
        │
        ▼
  lote de recontato só aceita alvos com approval válido
        │
        ▼
  message_dispatches.attempt_seq = 2, recontact_approval_id = <id>
  (CHECK do banco exige a approval para attempt_seq > 1)
```

---

## 3. Entidades do domínio

Agrupadas por contexto. O nome à esquerda é a entidade; a descrição explica **por que ela existe separada** — que é a parte que importa.

### 3.1 Núcleo de identidade

| Entidade | Razão de existir |
|---|---|
| **ContactPoint** | O telefone/WhatsApp como entidade global e imortal. Chave natural = E.164. É o âncora de todo o histórico. Nunca é deletado, só marcado. |
| **ContactPointAlias** | Formas normalizadas alternativas do mesmo número (ex.: forma sem o 9º dígito) que devem resolver para o mesmo ContactPoint. Sem isso, a migração de 8→9 dígitos cria contatos fantasmas. |
| **Company** | A empresa/profissional como identidade estável. Separada do lead porque a mesma empresa pode ser reencontrada em coletas diferentes, em segmentos diferentes, com nomes ligeiramente diferentes. |
| **Lead** | A **oportunidade comercial** sobre uma empresa. Volátil por natureza: tem pipeline, dono, status, e pode ser recriado. É o objeto de trabalho do dia a dia. |

A distinção Company/Lead evita o erro clássico: se lead e empresa são a mesma coisa, deletar um lead apaga a identidade e o próximo import cria um duplicado sem passado.

### 3.2 Presença digital

| Entidade | Razão de existir |
|---|---|
| **WebPresence** | Cada URL encontrada da empresa, com sua classificação (`own_site`, `instagram`, `facebook`, `linktree`, `marketplace`, `whatsapp_link`, `unknown`). Uma empresa tem N presenças. |
| **WebsiteCheck** | Resultado de uma verificação técnica de uma URL (HTTP status, redirect final, título, se é parking page, quando foi checado). Histórico, não estado. |

O campo `Company.website_status` (`HAS_WEBSITE` / `NO_WEBSITE` / `UNKNOWN` / `REVIEW_REQUIRED`) é **derivado** das WebPresences, nunca digitado à mão como fonte primária.

### 3.3 Catálogo

| Entidade | Razão de existir |
|---|---|
| **Segment** | Segmento cadastrável e extensível (barbearia, dentista, …), com slug, cor e ícone para a UI. Hierarquia opcional (`parent_id`) para "Odontologia > Clínica odontológica". |
| **User** | Dono das ações. Mesmo em uso pessoal, toda ação de envio é atribuída — necessário para auditoria e para futuro multiusuário. |

### 3.4 Origem dos dados

| Entidade | Razão de existir |
|---|---|
| **Source** | A fonte lógica: "CSV manual", "Google Places", "planilha do parceiro X". Permite medir qualidade por fonte. |
| **ImportJob** | Uma execução de importação. Tem preview/dry-run, estatísticas e é reversível no nível de "o que eu criei". |
| **ImportRow** | Staging: a linha crua em `jsonb` + o resultado do processamento (criou / mesclou / ignorou / erro). É a auditoria da importação. |
| **SearchJob** | (futuro) Uma execução de coleta automática num provider, com parâmetros, cursor e resultados. |

### 3.5 Mensageria

| Entidade | Razão de existir |
|---|---|
| **MessageTemplate** | Corpo com variáveis `{{nome_empresa}}`, versionado. Alterar um template não pode reescrever o que já foi enviado. |
| **TemplateVersion** | Snapshot imutável do texto. O envio referencia a **versão**, não o template. Assim o histórico mostra exatamente o que foi enviado. |
| **Attachment** | Imagem/arquivo associado a um template (ex.: `barbearia-landing-page.jpg`). |
| **Campaign** | Um esforço de prospecção: template + filtro + período + meta. Agrupa lotes. |
| **CampaignTarget** | O alvo dentro da campanha (contato + lead no momento da seleção). Snapshot: preserva o vínculo mesmo se o lead mudar. |
| **DispatchBatch** | Um clique em "Enviar próximos 10". Unidade de idempotência e de parada. |
| **MessageDispatch** | **A entidade crítica.** Um envio a um contato. Carrega os índices únicos que tornam a duplicidade impossível. |
| **MessageAttempt** | Tentativa técnica de entrega de um dispatch (retry de rede). N tentativas, 1 dispatch. |
| **RecontactApproval** | Autorização explícita, de uso único, para enviar de novo a um contato já contatado. Sem ela o banco recusa. |

### 3.6 Histórico e supressão

| Entidade | Razão de existir |
|---|---|
| **ContactEvent** | O histórico canônico, **chaveado em `contact_point_id`**. Registra `message_sent`, `replied`, `bounced`, `opted_out`, `manual_note`, `call_made`. Append-only. É daqui que sai o `✓ Enviado`. |
| **ContactPointStats** | Rollup denormalizado (`contact_count`, `first_contacted_at`, `last_contacted_at`, `last_event_type`) mantido por trigger. Existe puramente por performance — a tabela de leads precisa desse dado em uma listagem de milhares de linhas sem agregação. |
| **Suppression** | Entrada de do-not-contact para um `contact_point`, com motivo, origem, data e quem registrou. Global e permanente. |
| **AuditEvent** | Trilha genérica de ações relevantes do sistema (quem, o quê, sobre qual entidade, payload antes/depois). |

### 3.7 Value Objects (não são tabelas)

| VO | Invariante que ele carrega |
|---|---|
| **PhoneNumber** | Só existe se for parseável. Expõe `E164()`, `Display()`, `IsMobile()`, `AreaCode()`, `Aliases()`. Impossível construir um telefone inválido no domínio. |
| **CNPJ** | Valida dígitos verificadores na construção. |
| **CompanyNameKey** | Nome normalizado para dedupe (minúsculo, sem acento, sem sufixo legal). |
| **WebsiteClassification** | Regra pura: dado um host, retorna a classificação. Testável sem banco e sem rede. |
| **TemplateRender** | Renderização de `{{var}}` com validação de variáveis desconhecidas. |

---

## 4. Modelo relacional do PostgreSQL

DDL de referência. Migrations reais serão versionadas em `db/migrations/` com `golang-migrate`.

### 4.1 Extensões e tipos

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- normalização de nomes
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- dedupe fuzzy + busca por nome
CREATE EXTENSION IF NOT EXISTS "citext";     -- e-mails, slugs

CREATE TYPE lead_status AS ENUM (
  'new', 'qualified', 'contacted', 'replied', 'interested',
  'negotiating', 'customer', 'not_interested', 'lost', 'archived'
);

CREATE TYPE contact_status AS ENUM (
  'never_contacted', 'contacted', 'replied', 'opted_out', 'blocked'
);

CREATE TYPE website_status AS ENUM (
  'has_website', 'no_website', 'unknown', 'review_required'
);

CREATE TYPE web_presence_kind AS ENUM (
  'own_site', 'instagram', 'facebook', 'linktree', 'marketplace',
  'whatsapp_link', 'google_business', 'other'
);

CREATE TYPE contact_channel AS ENUM ('whatsapp', 'phone', 'email');

CREATE TYPE dispatch_status AS ENUM (
  'reserved', 'sending', 'sent', 'failed', 'canceled', 'skipped'
);

CREATE TYPE batch_status AS ENUM (
  'reserving', 'ready', 'running', 'completed', 'partially_failed',
  'failed', 'canceled'
);

CREATE TYPE contact_event_type AS ENUM (
  'message_sent', 'message_failed', 'replied', 'call_made',
  'meeting_scheduled', 'opted_out', 'manual_note', 'imported_seen'
);
```

> **Nota sobre ENUM vs tabela de referência.** Enums nativos foram escolhidos para estados fechados e de baixa mudança (o custo de `ALTER TYPE … ADD VALUE` é aceitável). `segments` é tabela justamente porque precisa ser cadastrável em runtime.

### 4.2 Base

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  name          text   NOT NULL,
  password_hash text   NOT NULL,
  role          text   NOT NULL DEFAULT 'owner',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE segments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        citext NOT NULL UNIQUE,
  name        text   NOT NULL,
  parent_id   uuid REFERENCES segments(id) ON DELETE SET NULL,
  color       text,               -- token de cor para badge na UI
  icon        text,               -- nome do ícone lucide
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        citext NOT NULL UNIQUE,   -- 'csv', 'manual', 'google_places'
  name        text   NOT NULL,
  kind        text   NOT NULL,          -- 'file' | 'api' | 'manual' | 'scraper'
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### 4.3 Contatos — o núcleo imortal

```sql
CREATE TABLE contact_points (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel              contact_channel NOT NULL DEFAULT 'whatsapp',

  -- CHAVE CANÔNICA. Toda comparação e dedupe usa esta coluna.
  phone_e164           text NOT NULL,

  -- Apresentação e proveniência. Nunca usados para comparar.
  phone_raw            text,
  phone_display        text NOT NULL,          -- '(34) 99999-9999'

  country_code         text NOT NULL DEFAULT '55',
  area_code            text,                   -- DDD
  line_type            text,                   -- 'mobile' | 'fixed_line' | 'unknown'
  is_whatsapp_verified boolean NOT NULL DEFAULT false,

  -- Versão do algoritmo de normalização que gerou phone_e164.
  -- Permite renormalizar em massa quando a regra mudar.
  normalization_version int NOT NULL DEFAULT 1,

  first_seen_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at         timestamptz NOT NULL DEFAULT now(),

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contact_points_e164_format CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

-- GARANTIA 1: um telefone = uma linha. Para sempre.
CREATE UNIQUE INDEX contact_points_phone_e164_key
  ON contact_points (phone_e164);

CREATE INDEX contact_points_area_code_idx ON contact_points (area_code);

-- Formas alternativas que resolvem para o MESMO contato.
-- Ex.: +553499999999 (8 díg.) → contato de +5534999999999 (9 díg.)
CREATE TABLE contact_point_aliases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id uuid NOT NULL REFERENCES contact_points(id) ON DELETE CASCADE,
  alias_e164       text NOT NULL,
  reason           text NOT NULL,   -- 'br_ninth_digit' | 'manual_merge' | 'legacy'
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contact_point_aliases_alias_key
  ON contact_point_aliases (alias_e164);
```

**Rollup de histórico** (existe só por performance de listagem):

```sql
CREATE TABLE contact_point_stats (
  contact_point_id    uuid PRIMARY KEY
                      REFERENCES contact_points(id) ON DELETE CASCADE,
  contact_count       int  NOT NULL DEFAULT 0,   -- nº de message_sent
  first_contacted_at  timestamptz,
  last_contacted_at   timestamptz,
  last_event_type     contact_event_type,
  last_event_at       timestamptz,
  reply_count         int  NOT NULL DEFAULT 0,
  status              contact_status NOT NULL DEFAULT 'never_contacted',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_point_stats_status_idx ON contact_point_stats (status);
CREATE INDEX contact_point_stats_last_contacted_idx
  ON contact_point_stats (last_contacted_at DESC NULLS LAST);
```

**Supressão (do not contact) — global e permanente:**

```sql
CREATE TABLE suppressions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id uuid NOT NULL REFERENCES contact_points(id) ON DELETE CASCADE,
  reason           text NOT NULL,   -- 'user_request' | 'invalid' | 'manual' | 'bounce'
  note             text,
  source           text NOT NULL DEFAULT 'manual',
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz,     -- reversível, mas com registro
  revoked_by       uuid REFERENCES users(id),
  revoke_reason    text
);

-- GARANTIA 2: no máximo uma supressão ATIVA por contato.
CREATE UNIQUE INDEX suppressions_active_unique
  ON suppressions (contact_point_id)
  WHERE revoked_at IS NULL;
```

### 4.4 Empresas e leads

```sql
CREATE TABLE companies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  legal_name         text,
  trade_name         text NOT NULL,           -- nome exibido
  -- chave de dedupe: minúsculo, sem acento, sem LTDA/ME/EIRELI, espaços colapsados
  name_key           text NOT NULL,

  cnpj               text,                    -- só dígitos, já validado
  segment_id         uuid REFERENCES segments(id) ON DELETE SET NULL,

  city               text,
  city_key           text,                    -- cidade normalizada
  state              char(2),
  neighborhood       text,
  postal_code        text,
  address_line       text,
  latitude           numeric(10,7),
  longitude          numeric(10,7),

  website_status     website_status NOT NULL DEFAULT 'unknown',
  website_checked_at timestamptz,

  -- proveniência por campo: {"trade_name": {"source":"csv","at":"..."}, ...}
  field_provenance   jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,

  CONSTRAINT companies_cnpj_digits CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$')
);

-- GARANTIA 3: CNPJ é único quando presente.
CREATE UNIQUE INDEX companies_cnpj_key
  ON companies (cnpj) WHERE cnpj IS NOT NULL AND deleted_at IS NULL;

-- GARANTIA 4: mesma empresa, mesma cidade → uma linha só.
CREATE UNIQUE INDEX companies_natural_key
  ON companies (name_key, city_key, state)
  WHERE deleted_at IS NULL;

CREATE INDEX companies_segment_idx  ON companies (segment_id) WHERE deleted_at IS NULL;
CREATE INDEX companies_city_idx     ON companies (state, city_key) WHERE deleted_at IS NULL;
CREATE INDEX companies_wstatus_idx  ON companies (website_status) WHERE deleted_at IS NULL;
CREATE INDEX companies_created_idx  ON companies (created_at DESC);
-- busca por nome e dedupe fuzzy
CREATE INDEX companies_name_trgm_idx ON companies USING gin (name_key gin_trgm_ops);
```

**Ligação empresa ↔ contato (N:N intencional).** O mesmo número pode pertencer a duas empresas (mesmo dono, franquia), e uma empresa tem vários números.

```sql
CREATE TABLE company_contact_points (
  company_id       uuid NOT NULL REFERENCES companies(id)       ON DELETE CASCADE,
  contact_point_id uuid NOT NULL REFERENCES contact_points(id)  ON DELETE RESTRICT,
  is_primary       boolean NOT NULL DEFAULT false,
  label            text,               -- 'recepção', 'dono', 'whatsapp'
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, contact_point_id)
);

-- só um contato primário por empresa
CREATE UNIQUE INDEX company_contact_points_primary_unique
  ON company_contact_points (company_id) WHERE is_primary;

CREATE INDEX company_contact_points_contact_idx
  ON company_contact_points (contact_point_id);
```

> **`ON DELETE RESTRICT` no contact_point é deliberado.** Um contato com histórico nunca pode ser apagado em cascata por causa de uma empresa.

```sql
CREATE TABLE leads (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  segment_id               uuid REFERENCES segments(id) ON DELETE SET NULL,
  source_id                uuid REFERENCES sources(id),
  import_job_id            uuid,     -- FK adicionada depois de import_jobs

  status                   lead_status NOT NULL DEFAULT 'new',
  owner_id                 uuid REFERENCES users(id),
  score                    int,      -- priorização futura
  notes                    text,

  -- contato preferencial para disparo
  primary_contact_point_id uuid REFERENCES contact_points(id) ON DELETE SET NULL,

  collected_at             timestamptz NOT NULL DEFAULT now(),
  last_interaction_at      timestamptz,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

-- GARANTIA 5: uma empresa = um lead ativo. Reimportar não cria lead duplicado.
CREATE UNIQUE INDEX leads_company_active_key
  ON leads (company_id) WHERE deleted_at IS NULL;

CREATE INDEX leads_status_idx      ON leads (status)     WHERE deleted_at IS NULL;
CREATE INDEX leads_segment_idx     ON leads (segment_id) WHERE deleted_at IS NULL;
CREATE INDEX leads_owner_idx       ON leads (owner_id)   WHERE deleted_at IS NULL;
CREATE INDEX leads_collected_idx   ON leads (collected_at DESC);
CREATE INDEX leads_contact_idx     ON leads (primary_contact_point_id);
-- índice composto para a query mais quente do painel
CREATE INDEX leads_board_idx
  ON leads (segment_id, status, collected_at DESC) WHERE deleted_at IS NULL;
```

### 4.5 Presença digital

```sql
CREATE TABLE web_presences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url            text NOT NULL,
  url_key        text NOT NULL,   -- normalizada: sem protocolo, sem www, sem barra final
  host           text NOT NULL,
  kind           web_presence_kind NOT NULL DEFAULT 'unknown',
  is_primary     boolean NOT NULL DEFAULT false,
  confidence     numeric(3,2),    -- 0.00–1.00 da classificação automática
  discovered_at  timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX web_presences_company_url_key
  ON web_presences (company_id, url_key);
CREATE INDEX web_presences_kind_idx ON web_presences (kind);
CREATE INDEX web_presences_host_idx ON web_presences (host);

CREATE TABLE website_checks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  web_presence_id   uuid NOT NULL REFERENCES web_presences(id) ON DELETE CASCADE,
  http_status       int,
  final_url         text,
  page_title        text,
  is_parking_page   boolean,
  is_reachable      boolean NOT NULL DEFAULT false,
  error             text,
  checked_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX website_checks_presence_idx
  ON website_checks (web_presence_id, checked_at DESC);
```

### 4.6 Templates

```sql
CREATE TABLE message_templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  segment_id         uuid REFERENCES segments(id) ON DELETE SET NULL,
  description        text,
  is_active          boolean NOT NULL DEFAULT true,
  current_version_id uuid,      -- FK adicionada depois
  created_by         uuid REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

-- Snapshot IMUTÁVEL. Editar template cria versão nova; nunca altera a antiga.
CREATE TABLE message_template_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
  version      int  NOT NULL,
  body         text NOT NULL,
  variables    text[] NOT NULL DEFAULT '{}',  -- extraídas do body na criação
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

ALTER TABLE message_templates
  ADD CONSTRAINT message_templates_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES message_template_versions(id) ON DELETE SET NULL;

CREATE TABLE attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      text NOT NULL,
  storage_key   text NOT NULL UNIQUE,   -- caminho local no MVP, S3 depois
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL,
  checksum      text NOT NULL,          -- sha256, evita upload duplicado
  width         int,
  height        int,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE template_version_attachments (
  template_version_id uuid NOT NULL
    REFERENCES message_template_versions(id) ON DELETE CASCADE,
  attachment_id       uuid NOT NULL REFERENCES attachments(id) ON DELETE RESTRICT,
  sort_order          int NOT NULL DEFAULT 0,
  PRIMARY KEY (template_version_id, attachment_id)
);
```

### 4.7 Campanhas, lotes e envios — a parte crítica

```sql
CREATE TABLE campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  template_version_id uuid NOT NULL REFERENCES message_template_versions(id),
  segment_id          uuid REFERENCES segments(id),
  filter_snapshot     jsonb NOT NULL DEFAULT '{}'::jsonb,  -- filtro usado na seleção
  batch_size          int  NOT NULL DEFAULT 10 CHECK (batch_size BETWEEN 1 AND 50),
  status              text NOT NULL DEFAULT 'draft',  -- draft|active|paused|completed
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

CREATE TABLE campaign_targets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_point_id uuid NOT NULL REFERENCES contact_points(id) ON DELETE RESTRICT,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  company_id       uuid REFERENCES companies(id) ON DELETE SET NULL,

  -- snapshot das variáveis no momento da seleção; o envio usa isto,
  -- então renomear a empresa depois não muda o que foi enviado
  render_vars      jsonb NOT NULL DEFAULT '{}'::jsonb,

  state            text NOT NULL DEFAULT 'pending',
     -- pending | reserved | sent | failed | skipped | excluded
  excluded_reason  text,     -- 'already_contacted' | 'suppressed' | 'invalid_phone'
  added_at         timestamptz NOT NULL DEFAULT now()
);

-- GARANTIA 6: um contato aparece no máximo uma vez por campanha.
CREATE UNIQUE INDEX campaign_targets_unique
  ON campaign_targets (campaign_id, contact_point_id);

CREATE INDEX campaign_targets_pending_idx
  ON campaign_targets (campaign_id, state) WHERE state = 'pending';

CREATE TABLE dispatch_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sequence_no     int  NOT NULL,          -- 1º, 2º, 3º lote da campanha
  requested_size  int  NOT NULL CHECK (requested_size BETWEEN 1 AND 50),
  reserved_count  int  NOT NULL DEFAULT 0,
  sent_count      int  NOT NULL DEFAULT 0,
  failed_count    int  NOT NULL DEFAULT 0,
  status          batch_status NOT NULL DEFAULT 'reserving',
  idempotency_key text NOT NULL,
  is_recontact    boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  UNIQUE (campaign_id, sequence_no)
);

CREATE TABLE recontact_approvals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id  uuid NOT NULL REFERENCES contact_points(id) ON DELETE CASCADE,
  reason            text NOT NULL,
  approved_by       uuid NOT NULL REFERENCES users(id),
  approved_at       timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  consumed_at       timestamptz,
  consumed_by_dispatch_id uuid
);

CREATE INDEX recontact_approvals_usable_idx
  ON recontact_approvals (contact_point_id)
  WHERE consumed_at IS NULL;
```

**A tabela que carrega a garantia principal:**

```sql
CREATE TABLE message_dispatches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ÂNCORA: o contato, não o lead.
  contact_point_id      uuid NOT NULL REFERENCES contact_points(id) ON DELETE RESTRICT,

  -- Contexto no momento do envio (pode desaparecer sem afetar o histórico).
  lead_id               uuid REFERENCES leads(id)     ON DELETE SET NULL,
  company_id            uuid REFERENCES companies(id) ON DELETE SET NULL,
  campaign_id           uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  batch_id              uuid REFERENCES dispatch_batches(id) ON DELETE SET NULL,
  campaign_target_id    uuid REFERENCES campaign_targets(id) ON DELETE SET NULL,
  template_version_id   uuid REFERENCES message_template_versions(id),

  -- 1 = primeiro contato de todos os tempos. 2+ = recontato.
  attempt_seq           int NOT NULL,
  recontact_approval_id uuid UNIQUE REFERENCES recontact_approvals(id),

  status                dispatch_status NOT NULL DEFAULT 'reserved',
  rendered_body         text,          -- exatamente o que foi enviado
  rendered_at           timestamptz,
  provider              text,          -- 'simulated' | 'whatsapp_cloud' | ...
  provider_message_id   text,
  error_code            text,
  error_message         text,

  reserved_at           timestamptz NOT NULL DEFAULT now(),
  sent_at               timestamptz,
  failed_at             timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dispatch_attempt_positive CHECK (attempt_seq >= 1),

  -- GARANTIA 7: recontato SEM aprovação explícita é fisicamente impossível.
  CONSTRAINT dispatch_recontact_requires_approval
    CHECK (attempt_seq = 1 OR recontact_approval_id IS NOT NULL),

  CONSTRAINT dispatch_sent_has_timestamp
    CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);

-- GARANTIA 8 — A MAIS IMPORTANTE DO SISTEMA INTEIRO.
-- Um contato só pode ter UMA tentativa viva por número de sequência.
-- 'failed' e 'canceled' ficam fora do índice: liberam a vaga para retry.
CREATE UNIQUE INDEX message_dispatches_contact_attempt_unique
  ON message_dispatches (contact_point_id, attempt_seq)
  WHERE status IN ('reserved', 'sending', 'sent');

-- GARANTIA 9: existe no máximo UM primeiro contato por telefone, para sempre.
-- Mesmo com múltiplas campanhas, abas, jobs ou reimportações concorrentes.
CREATE UNIQUE INDEX message_dispatches_first_contact_unique
  ON message_dispatches (contact_point_id)
  WHERE attempt_seq = 1 AND status IN ('reserved', 'sending', 'sent');

CREATE INDEX message_dispatches_batch_idx    ON message_dispatches (batch_id);
CREATE INDEX message_dispatches_campaign_idx ON message_dispatches (campaign_id, status);
CREATE INDEX message_dispatches_contact_idx
  ON message_dispatches (contact_point_id, sent_at DESC);
CREATE INDEX message_dispatches_sent_at_idx
  ON message_dispatches (sent_at DESC) WHERE status = 'sent';

-- Tentativas técnicas de entrega (retry de rede). N por dispatch.
CREATE TABLE message_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id  uuid NOT NULL REFERENCES message_dispatches(id) ON DELETE CASCADE,
  attempt_no   int  NOT NULL,
  request_id   text,
  http_status  int,
  provider_response jsonb,
  error_code   text,
  error_message text,
  duration_ms  int,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dispatch_id, attempt_no)
);
```

### 4.8 Histórico canônico

```sql
-- Append-only. NUNCA sofre UPDATE ou DELETE.
CREATE TABLE contact_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- A chave que faz o histórico sobreviver a tudo.
  contact_point_id  uuid NOT NULL REFERENCES contact_points(id) ON DELETE RESTRICT,

  event_type        contact_event_type NOT NULL,
  occurred_at       timestamptz NOT NULL DEFAULT now(),

  -- Contexto histórico (nullable: pode ter sido apagado depois).
  dispatch_id       uuid REFERENCES message_dispatches(id) ON DELETE SET NULL,
  lead_id           uuid REFERENCES leads(id)     ON DELETE SET NULL,
  company_id        uuid REFERENCES companies(id) ON DELETE SET NULL,
  campaign_id       uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  template_version_id uuid REFERENCES message_template_versions(id),

  -- Snapshot desnormalizado: sobrevive mesmo se as FKs virarem NULL.
  snapshot          jsonb NOT NULL DEFAULT '{}'::jsonb,
     -- { "company_name": "...", "segment": "...", "city": "...",
     --   "template_name": "...", "body_preview": "..." }

  note              text,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_events_contact_idx
  ON contact_events (contact_point_id, occurred_at DESC);
CREATE INDEX contact_events_type_idx
  ON contact_events (event_type, occurred_at DESC);
CREATE INDEX contact_events_campaign_idx ON contact_events (campaign_id);
```

**Trigger que mantém o rollup:**

```sql
CREATE OR REPLACE FUNCTION refresh_contact_point_stats() RETURNS trigger AS $$
BEGIN
  INSERT INTO contact_point_stats AS s (
    contact_point_id, contact_count, first_contacted_at, last_contacted_at,
    last_event_type, last_event_at, reply_count, status, updated_at
  )
  VALUES (
    NEW.contact_point_id,
    CASE WHEN NEW.event_type = 'message_sent' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'message_sent' THEN NEW.occurred_at END,
    CASE WHEN NEW.event_type = 'message_sent' THEN NEW.occurred_at END,
    NEW.event_type, NEW.occurred_at,
    CASE WHEN NEW.event_type = 'replied' THEN 1 ELSE 0 END,
    CASE
      WHEN NEW.event_type = 'opted_out'    THEN 'opted_out'::contact_status
      WHEN NEW.event_type = 'replied'      THEN 'replied'::contact_status
      WHEN NEW.event_type = 'message_sent' THEN 'contacted'::contact_status
      ELSE 'never_contacted'::contact_status
    END,
    now()
  )
  ON CONFLICT (contact_point_id) DO UPDATE SET
    contact_count = s.contact_count
      + CASE WHEN NEW.event_type = 'message_sent' THEN 1 ELSE 0 END,
    first_contacted_at = COALESCE(
      s.first_contacted_at,
      CASE WHEN NEW.event_type = 'message_sent' THEN NEW.occurred_at END),
    last_contacted_at = CASE
      WHEN NEW.event_type = 'message_sent'
        THEN GREATEST(COALESCE(s.last_contacted_at, NEW.occurred_at), NEW.occurred_at)
      ELSE s.last_contacted_at END,
    last_event_type = NEW.event_type,
    last_event_at   = GREATEST(s.last_event_at, NEW.occurred_at),
    reply_count = s.reply_count
      + CASE WHEN NEW.event_type = 'replied' THEN 1 ELSE 0 END,
    status = CASE
      WHEN s.status = 'opted_out'          THEN 'opted_out'::contact_status
      WHEN NEW.event_type = 'opted_out'    THEN 'opted_out'::contact_status
      WHEN NEW.event_type = 'replied'      THEN 'replied'::contact_status
      WHEN NEW.event_type = 'message_sent'
           AND s.status = 'never_contacted' THEN 'contacted'::contact_status
      ELSE s.status END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_events_stats_trigger
  AFTER INSERT ON contact_events
  FOR EACH ROW EXECUTE FUNCTION refresh_contact_point_stats();

-- Blindagem: histórico é append-only, sem exceção.
CREATE OR REPLACE FUNCTION forbid_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'contact_events é append-only (tentativa de %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_events_immutable
  BEFORE UPDATE OR DELETE ON contact_events
  FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
```

### 4.9 Idempotência, importação e auditoria

```sql
CREATE TABLE idempotency_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL,
  user_id       uuid REFERENCES users(id),
  endpoint      text NOT NULL,       -- 'POST /campaigns/:id/batches'
  request_hash  text NOT NULL,       -- sha256 do corpo canonicalizado
  status        text NOT NULL,       -- 'in_progress' | 'completed' | 'failed'
  response_code int,
  response_body jsonb,
  locked_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- GARANTIA 10: a mesma chave nunca executa duas vezes.
CREATE UNIQUE INDEX idempotency_keys_unique ON idempotency_keys (key, endpoint);
CREATE INDEX idempotency_keys_expiry_idx ON idempotency_keys (expires_at);

CREATE TABLE import_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      uuid REFERENCES sources(id),
  segment_id     uuid REFERENCES segments(id),
  filename       text,
  storage_key    text,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'uploaded',
     -- uploaded | analyzing | previewed | committing | completed | failed
  total_rows     int NOT NULL DEFAULT 0,
  valid_rows     int NOT NULL DEFAULT 0,
  invalid_rows   int NOT NULL DEFAULT 0,
  created_count  int NOT NULL DEFAULT 0,
  merged_count   int NOT NULL DEFAULT 0,
  skipped_count  int NOT NULL DEFAULT 0,
  review_count   int NOT NULL DEFAULT 0,
  error          text,
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  committed_at   timestamptz
);

ALTER TABLE leads ADD CONSTRAINT leads_import_job_fk
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE SET NULL;

CREATE TABLE import_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id     uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number        int  NOT NULL,
  raw               jsonb NOT NULL,
  normalized        jsonb,
  outcome           text,   -- created | merged | skipped | invalid | needs_review
  reason            text,
  matched_company_id       uuid REFERENCES companies(id) ON DELETE SET NULL,
  matched_contact_point_id uuid REFERENCES contact_points(id) ON DELETE SET NULL,
  was_already_contacted    boolean,
  errors            jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_job_id, row_number)
);

CREATE INDEX import_rows_outcome_idx ON import_rows (import_job_id, outcome);

-- Fila de revisão manual de possíveis duplicatas
CREATE TABLE dedupe_candidates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  left_company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  right_company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  similarity        numeric(4,3) NOT NULL,
  signals           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pending',  -- pending|merged|rejected
  resolved_by       uuid REFERENCES users(id),
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (left_company_id < right_company_id)  -- par canônico, sem A-B e B-A
);

CREATE UNIQUE INDEX dedupe_candidates_pair_unique
  ON dedupe_candidates (left_company_id, right_company_id);

CREATE TABLE audit_events (
  id           bigserial PRIMARY KEY,
  actor_id     uuid REFERENCES users(id),
  actor_type   text NOT NULL DEFAULT 'user',  -- user | system | job
  action       text NOT NULL,   -- 'lead.imported', 'message.sent', ...
  entity_type  text NOT NULL,
  entity_id    uuid,
  request_id   text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_events_action_idx ON audit_events (action, occurred_at DESC);
```

### 4.10 View de leitura do painel

Concentra a lógica de elegibilidade em um lugar só, para que frontend e backend nunca discordem:

```sql
CREATE VIEW lead_board AS
SELECT
  l.id                      AS lead_id,
  l.status                  AS lead_status,
  l.collected_at,
  l.last_interaction_at,
  c.id                      AS company_id,
  c.trade_name              AS company_name,
  c.city, c.state,
  c.website_status,
  s.id AS segment_id, s.name AS segment_name, s.color AS segment_color,
  cp.id                     AS contact_point_id,
  cp.phone_display,
  cp.phone_e164,
  COALESCE(st.contact_count, 0)          AS contact_count,
  st.first_contacted_at,
  st.last_contacted_at,
  COALESCE(st.status, 'never_contacted') AS contact_status,
  (sup.id IS NOT NULL)                   AS is_suppressed,
  sup.reason                             AS suppression_reason,
  -- ELEGIBILIDADE: a definição única de "disponível para contato"
  (
    cp.id IS NOT NULL
    AND sup.id IS NULL
    AND COALESCE(st.contact_count, 0) = 0
    AND NOT EXISTS (
      SELECT 1 FROM message_dispatches d
       WHERE d.contact_point_id = cp.id
         AND d.status IN ('reserved', 'sending', 'sent')
    )
  ) AS is_available
FROM leads l
JOIN companies c            ON c.id = l.company_id
LEFT JOIN segments s        ON s.id = COALESCE(l.segment_id, c.segment_id)
LEFT JOIN contact_points cp ON cp.id = l.primary_contact_point_id
LEFT JOIN contact_point_stats st ON st.contact_point_id = cp.id
LEFT JOIN suppressions sup  ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
WHERE l.deleted_at IS NULL AND c.deleted_at IS NULL;
```

---

## 5. Relacionamentos entre tabelas

### 5.1 Mapa

```
users ──┬──< leads.owner_id
        ├──< campaigns.created_by
        ├──< dispatch_batches.created_by
        ├──< recontact_approvals.approved_by
        └──< audit_events.actor_id

segments ──┬──< companies.segment_id
           ├──< leads.segment_id
           ├──< message_templates.segment_id
           └──< segments.parent_id  (auto-referência)

sources ──< import_jobs.source_id
        └──< leads.source_id

import_jobs ──< import_rows          (1:N, CASCADE)
            └──< leads.import_job_id  (SET NULL)

╔══════════════════════════════════════════════════════════════════╗
║  contact_points  — RAIZ IMORTAL                                  ║
║                                                                  ║
║   1:N  contact_point_aliases        (CASCADE)                    ║
║   1:1  contact_point_stats          (CASCADE, rollup)            ║
║   1:N  suppressions                 (CASCADE, 1 ativa)           ║
║   1:N  recontact_approvals          (CASCADE)                    ║
║   1:N  message_dispatches           (RESTRICT ← nunca cascateia) ║
║   1:N  contact_events               (RESTRICT ← nunca cascateia) ║
║   N:M  companies via company_contact_points                      ║
╚══════════════════════════════════════════════════════════════════╝

companies ──┬── 1:N  web_presences ── 1:N  website_checks
            ├── 1:1  leads (ativo)          [UNIQUE parcial]
            └── N:M  contact_points

message_templates ── 1:N  message_template_versions
                                │
                                ├── N:M  attachments
                                ├──< campaigns.template_version_id
                                └──< message_dispatches.template_version_id

campaigns ──┬── 1:N  campaign_targets   [UNIQUE (campaign, contact)]
            ├── 1:N  dispatch_batches   [UNIQUE (campaign, sequence_no)]
            └── 1:N  message_dispatches

dispatch_batches ── 1:N  message_dispatches ── 1:N  message_attempts
                                  │
                                  └── 1:1  contact_events (message_sent)
```

### 5.2 Política de deleção — a tabela mais importante desta seção

| Origem → Destino | Ação | Motivo |
|---|---|---|
| `companies` → `leads` | CASCADE | Lead sem empresa não faz sentido. |
| `companies` → `web_presences` | CASCADE | Presença é atributo da empresa. |
| `contact_points` → `message_dispatches` | **RESTRICT** | Nunca apagar histórico por acidente. |
| `contact_points` → `contact_events` | **RESTRICT** | Idem. É a memória do sistema. |
| `company_contact_points` → `contact_points` | **RESTRICT** | Apagar empresa nunca apaga contato. |
| `leads` → `contact_events.lead_id` | **SET NULL** | Evento sobrevive à morte do lead. |
| `leads` → `message_dispatches.lead_id` | **SET NULL** | Idem. Por isso existe o `snapshot` jsonb. |
| `campaigns` → `contact_events.campaign_id` | **SET NULL** | Idem. |
| `attachments` → uso em template | RESTRICT | Não perder mídia referenciada. |

**A regra que resume tudo:** nada que aponte para `contact_points` pode cascatear a deleção, e tudo que o histórico referencia por conveniência (`lead_id`, `campaign_id`) é `SET NULL` + `snapshot` jsonb. Assim, deletar todos os leads e reimportar deixa o histórico intacto e legível.

---

## 6. Estratégia de normalização de telefones

### 6.1 Princípios

1. **Uma única implementação, em Go.** Nunca normalizar em SQL, nunca no frontend. Duas implementações divergem, e divergência aqui significa contato duplicado.
2. **Biblioteca de verdade:** `github.com/nyaruka/phonenumbers` (port de libphonenumber). Não escrever regex própria para o caso geral.
3. **Região padrão configurável** (`BR`), mas números com `+` explícito respeitam o país informado.
4. **Versionada.** `normalization_version` na tabela permite renormalizar a base quando a regra mudar, sem perder rastreabilidade.

### 6.2 Pipeline

```
entrada bruta:  "(34) 9 9999-9999 / whatsapp"
      │
 [1] SANITIZE       remove tudo que não é dígito ou '+'
      │             preserva '+' só no início
      ▼             "34999999999"
 [2] PARSE          phonenumbers.Parse(input, "BR")
      │             falha → PhoneParseError (linha vai para needs_review)
      ▼
 [3] VALIDATE       IsValidNumber + tipo de linha
      │             inválido → registra, mas NÃO cria contact_point
      ▼
 [4] CANONICALIZE   Format(E164) → "+5534999999999"
      │
 [5] BR 9º DÍGITO   se BR ∧ mobile ∧ 8 dígitos após DDD:
      │             gera forma com 9 → essa vira a canônica
      │             a forma sem 9 vira ALIAS
      ▼
 [6] RESOLVE        busca contact_points.phone_e164
      │             se não achar, busca contact_point_aliases.alias_e164
      │             se não achar, cria novo contact_point + aliases
      ▼
saída: ContactPoint{ e164:"+5534999999999", display:"(34) 99999-9999" }
```

### 6.3 A regra do 9º dígito (a armadilha brasileira)

Celulares brasileiros migraram de 8 para 9 dígitos. A mesma pessoa aparece nas bases como:

```
+553499999999    (8 dígitos — base antiga)
+5534999999999   (9 dígitos — base atual)
```

Se tratados como contatos diferentes, o sistema envia mensagem duas vezes para a mesma pessoa — falha direta do requisito principal.

**Solução:** forma canônica = **sempre com 9 dígitos** para celulares BR. A forma de 8 dígitos é inserida em `contact_point_aliases`, e toda resolução consulta `contact_points` **e** `contact_point_aliases`.

```go
// Assinatura conceitual do value object.
package phone

type Number struct {
    e164     string
    display  string
    country  string
    areaCode string
    lineType LineType
    aliases  []string
}

// Parse é o ÚNICO ponto de entrada. Não existe construtor público alternativo.
func Parse(raw string, defaultRegion string) (Number, error)

func (n Number) E164() string      { return n.e164 }
func (n Number) Display() string   { return n.display }
func (n Number) Aliases() []string { return n.aliases }
func (n Number) IsMobile() bool    { return n.lineType == Mobile }
```

Tornar o campo `e164` privado sem construtor alternativo garante, **em tempo de compilação**, que nenhum telefone não-normalizado chegue ao repositório.

### 6.4 Formato de exibição

`phone_display` é derivado, nunca comparado:

| E.164 | Display |
|---|---|
| `+5534999999999` | `(34) 99999-9999` |
| `+553432221111` | `(34) 3222-1111` |
| `+13105551234` | `+1 310-555-1234` |

`phone_raw` guarda exatamente o que veio na origem, para depuração de importações.

### 6.5 Casos de borda tratados

| Caso | Tratamento |
|---|---|
| Número com ramal (`3222-1111 r. 45`) | Ramal descartado do E.164, preservado em `phone_raw` |
| Múltiplos números na mesma célula (`999.. / 888..`) | Split por `/ ; ,` e cada um vira um `contact_point`; o primeiro válido móvel vira primário |
| Número internacional sem `+` | Parse com região padrão; se resultar inválido → `needs_review` |
| Telefone fixo | Aceito como `contact_point`, mas marcado `line_type='fixed_line'` e **excluído por padrão** dos lotes de WhatsApp |
| `0800`, `4004` | Rejeitados na validação (não são contatos individuais) |
| Repetição óbvia (`99999-9999`, `00000-0000`) | Heurística de dígitos repetidos → `needs_review` |

---

## 7. Estratégia de deduplicação

Três níveis independentes, do mais forte ao mais fraco.

### 7.1 Nível 1 — Contato (determinístico, sem ambiguidade)

```
phone_e164 exato  →  match
   ↓ não achou
alias_e164 exato  →  match (mesmo contato, forma alternativa)
   ↓ não achou
cria novo contact_point
```

Garantido pelo índice único. **Zero heurística, zero falso positivo.** É por isso que o telefone é o âncora do sistema: é o único identificador confiável e estável dessa base.

### 7.2 Nível 2 — Empresa (em cascata, com fallback para revisão humana)

```
┌─ CNPJ presente e válido? ──────────► match determinístico (índice único)
│                                      confiança 1.00
├─ (name_key, city_key, state) igual? ► match determinístico (índice único)
│                                      confiança 0.95
├─ Compartilha contact_point + mesma cidade? ► match forte
│                                      confiança 0.90
├─ similarity(name_key) ≥ 0.85 na mesma cidade? ► MATCH AUTOMÁTICO
│                                      confiança = similarity
├─ similarity entre 0.60 e 0.85? ────► dedupe_candidates (REVISÃO MANUAL)
│                                      não mescla sozinho
└─ nenhum sinal ─────────────────────► cria empresa nova
```

Consulta de candidatos:

```sql
SELECT id, trade_name, similarity(name_key, $1) AS sim
  FROM companies
 WHERE deleted_at IS NULL
   AND city_key = $2 AND state = $3
   AND name_key % $1              -- operador trigram, usa o índice GIN
 ORDER BY sim DESC
 LIMIT 5;
```

**Normalização de `name_key`:**

```
"Barbearia Imperial LTDA - ME"
  → lower                      "barbearia imperial ltda - me"
  → unaccent                   "barbearia imperial ltda - me"
  → remove sufixo legal        "barbearia imperial"
     (ltda, me, epp, eireli, s/a, sa, mei, cia)
  → remove pontuação           "barbearia imperial"
  → colapsa espaços            "barbearia imperial"
```

Sufixos removidos apenas **no fim** da string, para não destruir nomes como "Clínica ME Odontologia".

### 7.3 Nível 3 — Lead

`UNIQUE (company_id) WHERE deleted_at IS NULL`. Uma empresa tem no máximo um lead ativo. Reimportar a mesma empresa **atualiza** o lead existente; não cria um segundo.

### 7.4 Política de merge de campos

Nunca sobrescrever cegamente. Cada campo tem uma política, e a decisão é registrada em `field_provenance`:

| Campo | Política |
|---|---|
| `cnpj` | fill-if-empty (nunca sobrescreve um CNPJ validado) |
| `trade_name` | prefer-longest-non-empty (nome mais completo tende a ser melhor) |
| `city`, `state` | fill-if-empty; conflito → `needs_review` |
| `segment_id` | fill-if-empty; conflito → mantém e registra em `audit_events` |
| `latitude/longitude` | prefer-newest-from-trusted-source |
| `website_status` | recalculado a partir das `web_presences`, nunca importado direto |
| **histórico de contato** | **imutável — nenhuma importação toca** |

### 7.5 Merge manual de empresas

Quando o usuário resolve um `dedupe_candidate` como duplicata:

1. Escolhe a empresa sobrevivente.
2. Move `company_contact_points` da perdedora (ignora conflito).
3. Move `web_presences` (ignora conflito de `url_key`).
4. Reaponta `leads`, `campaign_targets`, `message_dispatches.company_id`, `contact_events.company_id`.
5. Soft-delete da perdedora com `merged_into_id` preenchido.
6. Registra `audit_events` com o payload completo (merge é reversível na auditoria).

O histórico nunca é movido "de empresa para empresa" — ele já estava no contato, e o contato não mudou.

---

## 8. Arquitetura do histórico de contato

### 8.1 O erro que estamos evitando

```
❌ leads.sent = true
   → deleta o lead: história perdida
   → reimporta: volta como "novo", envia de novo
   → não sabe QUANDO, QUAL mensagem, QUANTAS vezes
```

```
✅ contact_events (append-only, chaveado em contact_point_id)
   → deleta o lead: história intacta
   → reimporta: resolve o telefone, encontra os eventos, mostra ✓
   → sabe quando, qual template, qual campanha, quantas vezes
```

### 8.2 Três tabelas, três responsabilidades distintas

| Tabela | Responde a | Natureza |
|---|---|---|
| `message_dispatches` | "Existe/existiu um envio para este contato?" | **Transacional.** Carrega os índices únicos. Sofre UPDATE de status. |
| `contact_events` | "O que aconteceu com este contato, e quando?" | **Imutável.** Append-only, com trigger que bloqueia UPDATE/DELETE. |
| `contact_point_stats` | "Quantas vezes? Qual a última?" | **Derivada.** Rollup por trigger, só por performance. |

A separação importa: o dispatch pode voltar de `sending` para `failed`, mas o evento de "mensagem enviada" nunca é reescrito. E a listagem de 5.000 leads não pode fazer `COUNT(*)` por linha — daí o rollup.

### 8.3 Por que `snapshot jsonb` no evento

`contact_events.lead_id` é `SET NULL` na deleção. Sem snapshot, o histórico ficaria assim:

```
05/09/2026 14:32 — mensagem enviada para +5534999999999 (empresa: ???)
```

Com snapshot:

```json
{
  "company_name": "Barbearia Imperial",
  "segment": "Barbearia",
  "city": "Uberlândia/MG",
  "template_name": "Barbearia 01",
  "template_version": 3,
  "body_preview": "Oi, Barbearia Imperial! Tudo bem?…"
}
```

O timeline continua legível para sempre, mesmo com todo o resto apagado. Este é o requisito de "histórico real" levado a sério.

### 8.4 Consulta canônica

Uma pergunta, uma consulta, usada por todo o sistema:

```sql
-- "Este número já recebeu alguma mensagem?"
SELECT EXISTS (
  SELECT 1 FROM message_dispatches
   WHERE contact_point_id = $1
     AND status IN ('reserved', 'sending', 'sent')
);
```

Em listagem, o caminho barato é `contact_point_stats.contact_count > 0`. O `EXISTS` acima é a verdade autoritativa e é reexecutado dentro da transação de reserva.

### 8.5 Reconciliação

Job periódico (`internal/jobs/reconcile_stats.go`) recalcula `contact_point_stats` a partir de `contact_events` e alerta em caso de divergência. Rollup é otimização; a fonte da verdade é o log de eventos, e o sistema precisa saber se eles divergiram.

---

## 9. Mecanismo de persistência do status "já enviado"

### 9.1 A cadeia completa

```
1. ENVIO OCORRE
   INSERT message_dispatches (contact_point_id, attempt_seq=1, status='sent')
   INSERT contact_events     (contact_point_id, 'message_sent', snapshot)
        │
        └─► trigger → contact_point_stats.contact_count += 1
                      contact_point_stats.last_contacted_at = now()
                      contact_point_stats.status = 'contacted'

2. BASE INTEIRA DE LEADS É APAGADA
   leads: DELETE  →  contact_events.lead_id vira NULL
   contact_points, message_dispatches, contact_events, stats: INTACTOS

3. NOVA IMPORTAÇÃO, 20 DIAS DEPOIS
   linha: "Barbearia Imperial; 34 99999-9999"
        │
        ├─ normaliza → +5534999999999
        ├─ resolve   → contact_point EXISTENTE (id X)
        ├─ cria lead novo apontando para contact_point X
        └─ contact_point_stats de X ainda diz: contact_count = 1

4. API RETORNA
   GET /leads → view lead_board
   {
     "company_name": "Barbearia Imperial",
     "contact": {
       "phone_display": "(34) 99999-9999",
       "status": "contacted",
       "contact_count": 1,
       "first_contacted_at": "2026-09-05T14:32:00Z",
       "last_contacted_at":  "2026-09-05T14:32:00Z"
     },
     "is_available": false
   }

5. FRONTEND EXIBE
   ✓ Enviado    (tooltip: "Mensagem enviada em 05/09/2026 às 14:32")
```

O check é **derivado**, nunca armazenado como booleano no lead. É consequência do histórico, exatamente como especificado.

### 9.2 Contrato de UI do campo "contato"

| Estado | Condição | Visual |
|---|---|---|
| Disponível | `is_available = true` | badge neutro + telefone |
| Já contatado | `contact_count ≥ 1` | `✓ Enviado` verde + tooltip com data/hora |
| Múltiplos contatos | `contact_count > 1` | `✓ 3 contatos` + tooltip com o timeline |
| Respondeu | `contact_status = 'replied'` | badge âmbar `Respondeu` |
| Não contatar | `is_suppressed = true` | badge vermelho com ícone de bloqueio + motivo |
| Em processamento | dispatch `reserved`/`sending` | badge pulsante `Enviando…` |
| Sem telefone | `contact_point_id IS NULL` | badge cinza `Sem contato` |

O tooltip carrega os últimos eventos via `GET /contact-points/:id/events` (lazy, no hover), evitando trazer histórico completo na listagem.

---

## 10. Estratégia para impedir envios duplicados

### 10.1 Matriz de ameaças

| # | Cenário | Defesa |
|---|---|---|
| 1 | Duplo clique no botão | Frontend desabilita + mesma `Idempotency-Key` |
| 2 | Refresh durante o processamento | `Idempotency-Key` retorna a resposta armazenada |
| 3 | Duas abas abertas na mesma campanha | Reserva no banco; a segunda encontra 0 elegíveis |
| 4 | Duas campanhas distintas com o mesmo contato | Índice único global em `message_dispatches` |
| 5 | Requisições HTTP concorrentes exatas | `SELECT … FOR UPDATE SKIP LOCKED` |
| 6 | Timeout de rede + retry do cliente | Idempotência + reserva já persistida |
| 7 | Reimportação do mesmo telefone | Resolução por `contact_point`; `stats` já indicam contato |
| 8 | Crash do backend no meio do lote | Dispatches em `reserved` são recuperados por job |
| 9 | Bug futuro na camada de aplicação | **Constraint do banco.** Última linha de defesa. |

### 10.2 A garantia real, em uma frase

```sql
CREATE UNIQUE INDEX message_dispatches_first_contact_unique
  ON message_dispatches (contact_point_id)
  WHERE attempt_seq = 1 AND status IN ('reserved', 'sending', 'sent');
```

Enquanto este índice existir, **é fisicamente impossível** que dois primeiros contatos coexistam para o mesmo telefone. Não depende do frontend, nem do handler, nem de o desenvolvedor lembrar de checar. Qualquer caminho de código que tente violar isso recebe `23505 unique_violation` e a transação inteira aborta.

O `WHERE status IN (...)` é o detalhe que faz a coisa funcionar na prática: um envio que **falhou** sai do índice, então o contato volta a ser elegível para retry — sem precisar de aprovação de recontato, porque a mensagem nunca chegou.

### 10.3 Reserva antes do envio (não depois)

A ordem importa muito:

```
❌ ERRADO: envia → registra
   Se o registro falhar, a mensagem já foi. Duplicidade garantida no retry.

✅ CERTO: reserva (transação curta) → envia → confirma
   Se qualquer coisa falhar depois da reserva, no pior caso a mensagem
   é enviada e não confirmada — e o retry esbarra na reserva existente.
```

Trade-off aceito conscientemente: **preferimos falhar para o lado de não enviar** do que para o lado de enviar duas vezes. Prioridade 2 do projeto.

### 10.4 A query de reserva

```sql
WITH eligible AS (
  SELECT ct.id AS target_id, ct.contact_point_id, ct.lead_id,
         ct.company_id, ct.render_vars
    FROM campaign_targets ct
    JOIN contact_points cp ON cp.id = ct.contact_point_id
    LEFT JOIN suppressions sup
           ON sup.contact_point_id = cp.id AND sup.revoked_at IS NULL
   WHERE ct.campaign_id = $1
     AND ct.state = 'pending'
     AND sup.id IS NULL
     AND cp.line_type <> 'fixed_line'
     AND NOT EXISTS (
       SELECT 1 FROM message_dispatches d
        WHERE d.contact_point_id = cp.id
          AND d.status IN ('reserved', 'sending', 'sent')
     )
   ORDER BY ct.added_at
   FOR UPDATE OF ct SKIP LOCKED      -- concorrentes pulam, não bloqueiam
   LIMIT $2                           -- 10
)
INSERT INTO message_dispatches
  (contact_point_id, lead_id, company_id, campaign_id, batch_id,
   campaign_target_id, template_version_id, attempt_seq, status)
SELECT contact_point_id, lead_id, company_id, $1, $3, target_id, $4, 1, 'reserved'
  FROM eligible
ON CONFLICT DO NOTHING       -- perdeu a corrida? apenas não reserva.
RETURNING id, contact_point_id, campaign_target_id;
```

`SKIP LOCKED` faz duas requisições concorrentes pegarem conjuntos **disjuntos** de alvos, sem deadlock e sem espera. `ON CONFLICT DO NOTHING` transforma a corrida perdida em "reservei menos que 10" — o que é um resultado correto, não um erro.

### 10.5 Recuperação de reservas órfãs

Se o processo morrer com dispatches em `reserved`/`sending`:

```sql
UPDATE message_dispatches
   SET status = 'failed',
       error_code = 'orphaned_reservation',
       failed_at  = now()
 WHERE status IN ('reserved', 'sending')
   AND reserved_at < now() - interval '15 minutes'
   AND provider_message_id IS NULL;   -- não tocar no que talvez saiu
```

A condição `provider_message_id IS NULL` é essencial: se o provider já devolveu um ID, a mensagem provavelmente saiu, e liberar a reserva causaria envio duplicado. Esses casos vão para uma fila de revisão manual em vez de serem liberados automaticamente.

---

## 11. Estratégia de idempotência

### 11.1 Escopo

Toda rota que **cria efeito colateral externo** exige `Idempotency-Key`:

- `POST /campaigns/:id/batches` (envio de lote) — **obrigatório**
- `POST /imports/:id/commit` — obrigatório
- `POST /contact-points/:id/recontact-approvals` — opcional mas recomendado

Leitura e atualização simples de estado interno não precisam.

### 11.2 Onde a chave nasce

No **clique**, não na renderização. `crypto.randomUUID()` gerado no `onClick` e mantido em `useRef` enquanto a mutation está em voo; TanStack Query reenvia a mesma chave em qualquer retry automático. Só após sucesso confirmado a chave é descartada.

Se a chave nascesse na renderização, um remount geraria chave nova e a proteção evaporaria.

### 11.3 Protocolo

```
POST /campaigns/{id}/batches
Idempotency-Key: 7f3a9c1e-...
Content-Type: application/json

{ "size": 10 }
```

```
┌─ requisição chega ────────────────────────────────────────────┐
│                                                               │
│  BEGIN;                                                       │
│  INSERT INTO idempotency_keys (key, endpoint, request_hash,   │
│                                status, locked_at)             │
│  VALUES ($k, $e, $h, 'in_progress', now())                    │
│  ON CONFLICT (key, endpoint) DO NOTHING                       │
│  RETURNING id;                                                │
│                                                               │
│  ┌── inseriu? (0 linhas = chave já existia) ─────────────┐    │
│  │                                                        │    │
│  │  SIM → sou o primeiro. Executo o lote de verdade.      │    │
│  │        Ao final: UPDATE status='completed',            │    │
│  │                  response_code, response_body          │    │
│  │        COMMIT                                          │    │
│  │                                                        │    │
│  │  NÃO → SELECT o registro existente                     │    │
│  │        ├ request_hash DIFERENTE                        │    │
│  │        │   → 422 idempotency_key_reuse                 │    │
│  │        │     ("mesma chave, corpo diferente")          │    │
│  │        ├ status = 'completed'                          │    │
│  │        │   → devolve response_body armazenado          │    │
│  │        │     + header Idempotent-Replay: true          │    │
│  │        │     ZERO efeito colateral novo                │    │
│  │        └ status = 'in_progress'                        │    │
│  │            → 409 batch_in_progress + Retry-After: 2    │    │
│  └────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

### 11.4 Por que duas camadas (chave **e** constraint)

São proteções para problemas diferentes, e nenhuma substitui a outra:

- A **chave de idempotência** protege contra *a mesma requisição* repetida (retry, refresh, duplo clique). Ela torna a operação repetível sem novo efeito.
- A **constraint no banco** protege contra *requisições diferentes* que colidem no mesmo contato (duas campanhas, duas abas, dois jobs). Chave de idempotência não ajuda aqui, porque as chaves são legitimamente distintas.

Sem a constraint, duas campanhas com chaves diferentes enviariam para o mesmo número. Sem a chave, um F5 criaria um segundo lote legítimo com contatos novos — que é comportamento correto do ponto de vista da constraint, mas errado do ponto de vista do usuário, que só quis ver a tela de novo.

### 11.5 Idempotência do lado do provider

Quando o WhatsApp real entrar, o `dispatch.id` (UUID) é enviado como `client_message_id` ao provider. Se o provider suportar deduplicação por esse campo, ganhamos uma terceira camada gratuitamente, cobrindo o intervalo entre "enviamos" e "recebemos a confirmação".

### 11.6 Limpeza

Chaves expiram em 7 dias (`expires_at`), removidas por job diário. Janela suficiente para qualquer retry realista, e mantém a tabela pequena.

---

## 12. Arquitetura de campanhas e lotes

### 12.1 Modelo mental

```
Campanha  = intenção      ("prospectar barbearias de Uberlândia com o template X")
Target    = alvo elegível (snapshot de quem entrou na campanha)
Lote      = um clique     ("enviar próximos 10")
Dispatch  = um envio      (a unidade protegida por constraint)
Attempt   = uma tentativa (retry técnico do mesmo dispatch)
```

Cada nível existe porque tem um ciclo de vida próprio. Colapsar dois deles quebra alguma garantia.

### 12.2 Ciclo de vida

```
CRIAÇÃO
  POST /campaigns  { name, template_version_id, filter }
        │
        ├─ resolve o filtro → lista de leads
        ├─ para cada lead: pega o contact_point primário
        ├─ EXCLUI já contatados     → target.state='excluded'
        │                              excluded_reason='already_contacted'
        ├─ EXCLUI suprimidos        → excluded_reason='suppressed'
        ├─ EXCLUI sem telefone      → excluded_reason='invalid_phone'
        ├─ EXCLUI fixos             → excluded_reason='not_mobile'
        └─ resto: target.state='pending' + render_vars congeladas
        │
        ▼
  campanha 'active' com contadores:
    total_targets, pending, excluded, sent, failed

ENVIO — repetido manualmente, N vezes
  POST /campaigns/:id/batches  { size: 10 }  + Idempotency-Key
        │
        ├─ TX 1: reserva ≤10 (§10.4). Se reservou 0 → 200 com sent:0
        ├─ despacha item a item, SEQUENCIALMENTE, com pausa configurável
        │    sucesso → status='sent' + contact_events + trigger
        │    falha   → status='failed' + libera a vaga
        └─ batch → 'completed' | 'partially_failed'
        │
        ▼
  PARA. Não agenda continuação. Não itera. Não faz nada.
  Próximo lote exige novo clique do usuário.
```

### 12.3 A regra de parada, explicitamente

O backend **não possui** nenhum agendador, worker de fila ou loop que continue enviando. `SendBatch` é uma função com início e fim: reserva no máximo `size`, despacha, retorna. A ausência de um scheduler é uma decisão de arquitetura, não uma lacuna a preencher depois.

Se restam 7 elegíveis e o pedido é 10, envia 7 e retorna `{ sent: 7, remaining: 0 }`. Sem erro — é o comportamento correto.

### 12.4 Resposta do lote

```json
{
  "batch": {
    "id": "…", "sequence_no": 3, "status": "completed",
    "requested_size": 10, "reserved_count": 10,
    "sent_count": 9, "failed_count": 1,
    "started_at": "…", "finished_at": "…"
  },
  "results": [
    { "dispatch_id": "…", "contact_point_id": "…",
      "company_name": "Barbearia Imperial", "status": "sent",
      "sent_at": "2026-09-06T10:15:02Z" },
    { "dispatch_id": "…", "contact_point_id": "…",
      "company_name": "Studio Alpha", "status": "failed",
      "error_code": "provider_unavailable",
      "error_message": "gateway retornou 503" }
  ],
  "campaign_progress": {
    "total_targets": 100, "sent": 29, "failed": 1,
    "pending": 50, "excluded": 20
  }
}
```

O frontend usa `campaign_progress` para atualizar os contadores sem refetch, e `results` para o toast detalhado.

### 12.5 Processamento sequencial

Envio sequencial, um item por vez, dentro do lote. Não existe lógica de intervalo "seguro", variação artificial de tempo, rotação de número ou qualquer mecanismo voltado a evitar limites da plataforma — o produto não tenta adivinhar ou contornar regras do WhatsApp. Se uma integração oficial for adicionada no futuro, ela deve respeitar as regras dessa integração, não as regras que este sistema inventar.

### 12.6 Lote de recontato

Fluxo separado, jamais o padrão:

```
POST /campaigns/:id/batches
{ "size": 5, "mode": "recontact",
  "approval_ids": ["uuid-1", "uuid-2", ...] }
```

Exige `approval_ids` explícitos, criados um a um via confirmação na UI. O backend valida: cada approval não consumida, não expirada, do contato correto. `attempt_seq` = `MAX(attempt_seq) + 1` do contato. A constraint do banco recusa qualquer tentativa sem approval.

---

## 13. Arquitetura Go

### 13.1 Estilo

Camadas com dependência apontando para dentro (ports & adapters), sem cerimônia excessiva. Go idiomático: interfaces pequenas definidas **onde são consumidas**, structs concretos retornados, erros como valores, `context.Context` como primeiro parâmetro em tudo que faz I/O.

```
transport (HTTP) ──► application (casos de uso) ──► domain (regras puras)
                              │
                              ▼
                     ports (interfaces)
                              ▲
                              │ implementadas por
                     adapters (postgres, whatsapp, storage, clock)
```

`domain` não importa nada do projeto. `application` importa só `domain`. `adapters` importam `domain` (para implementar as interfaces). `transport` importa `application`.

### 13.2 Bibliotecas

| Papel | Escolha | Razão |
|---|---|---|
| Router | `chi/v5` | Leve, `net/http` puro, middlewares componíveis |
| Driver PG | `pgx/v5` | Performance, tipos nativos, `pgxpool` |
| SQL | `sqlc` | Gera Go tipado a partir do SQL. Sem ORM, sem SQL solto em handler. |
| Migrations | `golang-migrate` | Up/down versionado, roda em CI |
| Telefone | `nyaruka/phonenumbers` | libphonenumber |
| Logs | `log/slog` | Stdlib, estruturado, sem dependência |
| Validação | `go-playground/validator/v10` | DTOs de entrada |
| UUID | `google/uuid` | — |
| Config | `caarlos0/env` + `.env` | Config por env var, tipada |
| Testes | stdlib + `testify/require` + `testcontainers-go` | Testes de repositório contra Postgres real |
| OpenAPI | `swaggo` ou spec escrita à mão | Gera tipos do frontend |

**Sem ORM.** As queries críticas deste sistema (reserva com `SKIP LOCKED`, `ON CONFLICT DO NOTHING`, índices parciais) são exatamente onde ORMs atrapalham. `sqlc` dá tipagem sem esconder o SQL.

### 13.3 Padrões estruturais

**Unit of Work / transaction manager.** O caso de uso decide a fronteira transacional; o repositório não conhece transações:

```go
type TxManager interface {
    WithTx(ctx context.Context, fn func(ctx context.Context) error) error
}

// No caso de uso:
func (s *DispatchService) SendBatch(ctx context.Context, cmd SendBatchCommand) (*BatchResult, error) {
    var reserved []Reservation
    // Transação 1: curta, só reserva.
    err := s.tx.WithTx(ctx, func(ctx context.Context) error {
        if err := s.idem.Begin(ctx, cmd.IdempotencyKey); err != nil {
            return err
        }
        batch, err := s.batches.Create(ctx, cmd.CampaignID, cmd.Size)
        if err != nil {
            return err
        }
        reserved, err = s.dispatches.Reserve(ctx, batch.ID, cmd.Size)
        return err
    })
    if err != nil {
        return nil, err
    }
    // Fora da transação: I/O externo NUNCA dentro de transação de banco.
    return s.dispatchAll(ctx, reserved)
}
```

Regra rígida: **nenhuma chamada de rede dentro de uma transação de banco.** Transações são curtas; I/O externo acontece entre elas.

**Ports definidos no domínio:**

```go
package domain

type ContactPointRepository interface {
    ResolveByPhone(ctx context.Context, e164 string) (*ContactPoint, error)
    Upsert(ctx context.Context, cp *ContactPoint) (*ContactPoint, error)
    HasBeenContacted(ctx context.Context, id uuid.UUID) (bool, error)
}

type MessageGateway interface {
    Send(ctx context.Context, msg OutboundMessage) (ProviderResult, error)
    Name() string
}

type LeadProvider interface {
    Name() string
    Search(ctx context.Context, q SearchQuery) ([]RawLead, Cursor, error)
}

type Clock interface{ Now() time.Time }   // injetável = testes determinísticos
```

**Erros de domínio tipados:**

```go
package domain

type ErrorCode string

const (
    ErrAlreadyContacted   ErrorCode = "already_contacted"
    ErrContactSuppressed  ErrorCode = "contact_suppressed"
    ErrInvalidPhone       ErrorCode = "invalid_phone"
    ErrRecontactRequired  ErrorCode = "recontact_approval_required"
    ErrBatchInProgress    ErrorCode = "batch_in_progress"
    ErrIdempotencyReuse   ErrorCode = "idempotency_key_reuse"
    ErrNoEligibleTargets  ErrorCode = "no_eligible_targets"
)

type Error struct {
    Code    ErrorCode
    Message string
    Details map[string]any
    cause   error
}

func (e *Error) Error() string { return e.Message }
func (e *Error) Unwrap() error { return e.cause }
```

O `transport` mapeia `ErrorCode` → HTTP status em um único lugar. Handlers não montam mensagens de erro à mão.

**Gateway simulado no MVP:**

```go
type SimulatedGateway struct {
    latency    time.Duration
    failureRate float64
    log        *slog.Logger
}

func (g *SimulatedGateway) Send(ctx context.Context, m OutboundMessage) (ProviderResult, error) {
    // Simula latência e falhas para exercitar todos os caminhos de erro
    // ANTES de existir integração real. Mesma interface do gateway real.
}
```

Toda a arquitetura de envio é validada de ponta a ponta sem depender de WhatsApp. Trocar por `WhatsAppCloudGateway` depois é uma linha na composição de dependências.

### 13.4 Composição de dependências

Sem framework de DI. Wiring explícito em `cmd/api/main.go`: cria pool, repositórios, serviços, handlers, servidor. Verboso e completamente rastreável — que é o objetivo.

---

## 14. Estrutura de pastas do backend

```
backend/
├── cmd/
│   ├── api/main.go            # wiring + servidor HTTP
│   └── worker/main.go         # jobs de manutenção (reconciliação, limpeza)
│
├── internal/
│   ├── domain/                # ZERO dependências do projeto
│   │   ├── contact/
│   │   │   ├── contact_point.go
│   │   │   ├── phone.go              # value object PhoneNumber
│   │   │   ├── phone_test.go         # bateria pesada de casos de borda
│   │   │   ├── suppression.go
│   │   │   └── repository.go         # ports
│   │   ├── company/
│   │   │   ├── company.go
│   │   │   ├── name_key.go           # normalização de nome
│   │   │   ├── web_presence.go
│   │   │   ├── classifier.go         # own_site vs social vs marketplace
│   │   │   └── repository.go
│   │   ├── lead/
│   │   ├── segment/
│   │   ├── outreach/
│   │   │   ├── template.go
│   │   │   ├── render.go             # {{variáveis}}
│   │   │   ├── campaign.go
│   │   │   ├── batch.go
│   │   │   ├── dispatch.go
│   │   │   └── gateway.go            # port MessageGateway
│   │   ├── history/
│   │   │   ├── contact_event.go
│   │   │   └── repository.go
│   │   ├── sourcing/
│   │   │   ├── provider.go           # port LeadProvider
│   │   │   └── raw_lead.go
│   │   ├── errors.go
│   │   └── clock.go
│   │
│   ├── application/           # casos de uso; orquestra transações
│   │   ├── leads/
│   │   │   ├── list_leads.go
│   │   │   ├── get_lead.go
│   │   │   └── update_lead_status.go
│   │   ├── dedupe/
│   │   │   ├── resolve_company.go
│   │   │   ├── resolve_contact.go
│   │   │   └── merge_companies.go
│   │   ├── importing/
│   │   │   ├── analyze_import.go     # dry-run + preview
│   │   │   ├── commit_import.go
│   │   │   └── pipeline.go           # os 8 estágios
│   │   ├── outreach/
│   │   │   ├── create_campaign.go
│   │   │   ├── send_batch.go         # ★ o caso de uso mais crítico
│   │   │   ├── approve_recontact.go
│   │   │   └── preview_message.go
│   │   ├── suppression/
│   │   ├── analytics/
│   │   │   └── dashboard_metrics.go
│   │   └── ports.go                  # TxManager, IdempotencyStore
│   │
│   ├── adapters/
│   │   ├── postgres/
│   │   │   ├── db.go                 # pool, health
│   │   │   ├── tx.go                 # TxManager via context
│   │   │   ├── queries/              # .sql de entrada do sqlc
│   │   │   │   ├── contact_points.sql
│   │   │   │   ├── leads.sql
│   │   │   │   ├── dispatches.sql    # ★ reserva com SKIP LOCKED
│   │   │   │   ├── events.sql
│   │   │   │   └── analytics.sql
│   │   │   ├── gen/                  # gerado por sqlc — não editar
│   │   │   ├── contact_repository.go
│   │   │   ├── lead_repository.go
│   │   │   ├── dispatch_repository.go
│   │   │   └── idempotency_store.go
│   │   ├── messaging/
│   │   │   ├── simulated/gateway.go  # MVP
│   │   │   └── whatsapp/gateway.go   # futuro
│   │   ├── providers/
│   │   │   ├── csv/provider.go
│   │   │   ├── manual/provider.go
│   │   │   └── googleplaces/provider.go   # futuro
│   │   ├── storage/
│   │   │   ├── local/store.go        # anexos em disco no MVP
│   │   │   └── s3/store.go           # futuro
│   │   └── httpclient/
│   │       └── website_checker.go
│   │
│   ├── transport/http/
│   │   ├── server.go
│   │   ├── router.go
│   │   ├── middleware/
│   │   │   ├── request_id.go
│   │   │   ├── logging.go
│   │   │   ├── recover.go
│   │   │   ├── auth.go
│   │   │   ├── idempotency.go
│   │   │   └── cors.go
│   │   ├── handlers/
│   │   │   ├── leads.go
│   │   │   ├── contacts.go
│   │   │   ├── segments.go
│   │   │   ├── templates.go
│   │   │   ├── campaigns.go
│   │   │   ├── imports.go
│   │   │   ├── analytics.go
│   │   │   └── health.go
│   │   ├── dto/                      # request/response, tags de validação
│   │   ├── errors.go                 # domain.ErrorCode → HTTP/problem+json
│   │   └── pagination.go
│   │
│   ├── jobs/
│   │   ├── reconcile_stats.go
│   │   ├── expire_reservations.go
│   │   ├── cleanup_idempotency.go
│   │   └── recheck_websites.go
│   │
│   ├── config/config.go
│   ├── observability/
│   │   ├── logger.go                 # slog + redaction
│   │   └── audit.go
│   └── testutil/
│       ├── containers.go             # testcontainers Postgres
│       └── fixtures.go
│
├── db/
│   ├── migrations/
│   │   ├── 000001_init.up.sql
│   │   ├── 000001_init.down.sql
│   │   └── …
│   └── seeds/
│       ├── segments.sql
│       └── dev_leads.sql
│
├── api/openapi.yaml           # fonte dos tipos do frontend
├── sqlc.yaml
├── Makefile
├── docker-compose.yml         # postgres + adminer
├── go.mod
└── .env.example
```

### 14.1 Regras de fronteira aplicadas em CI

Verificadas por `go vet` custom / `depguard` no lint:

- `internal/domain` não importa `internal/adapters` nem `internal/transport`
- `internal/transport` não importa `internal/adapters` diretamente
- Nenhum `database/sql` fora de `internal/adapters/postgres`
- Nenhum `net/http` client fora de `adapters`

Fronteira que não é verificada por ferramenta é fronteira que apodrece.

---

## 15. Arquitetura React

### 15.1 Regra número um

**Nenhuma regra de negócio em componente.** Se um `.tsx` decidir se um lead é elegível para contato, a arquitetura falhou — o backend já respondeu isso em `is_available`. O frontend renderiza a decisão; não a toma.

Camadas:

```
pages/          rota + composição. Sem lógica.
features/       tudo de um domínio: componentes, hooks, api, model, tipos
  └ api/        chamadas HTTP tipadas
  └ hooks/      wrappers de TanStack Query (useLeads, useSendBatch)
  └ model/      lógica pura de apresentação (formatação, agrupamento)
  └ components/ UI específica da feature
components/ui/  primitivos shadcn — sem conhecimento de domínio
lib/            client HTTP, formatadores, utilitários
```

### 15.2 Estado

| Tipo | Ferramenta | Exemplo |
|---|---|---|
| Servidor | **TanStack Query** | leads, campanhas, métricas |
| URL | **searchParams (React Router)** | filtros, paginação, ordenação |
| Local de UI | `useState` | modal aberto, aba ativa |
| Global de cliente | Context (mínimo) | tema, sessão, toasts |

**Filtros vivem na URL, não em estado.** Consequência: compartilhar link reproduz a tela, voltar no navegador funciona, F5 preserva o contexto, e a chave da query deriva naturalmente dos params.

Context **nunca** guarda dados de servidor. Essa é a regra que impede o projeto de virar um Redux improvisado.

### 15.3 Chaves de query e invalidação

```ts
export const queryKeys = {
  leads: {
    all: ['leads'] as const,
    list: (f: LeadFilters) => ['leads', 'list', f] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
  },
  campaigns: {
    all: ['campaigns'] as const,
    detail: (id: string) => ['campaigns', 'detail', id] as const,
    progress: (id: string) => ['campaigns', id, 'progress'] as const,
  },
  contacts: {
    events: (id: string) => ['contacts', id, 'events'] as const,
  },
  dashboard: { metrics: (r: DateRange) => ['dashboard', 'metrics', r] as const },
} as const;
```

Após `sendBatch`, invalidar `leads.all`, `campaigns.detail(id)` e `dashboard.metrics`. O `✓ Enviado` aparece porque o servidor reprocessou a verdade — **não** por atualização otimista.

### 15.4 A decisão sobre updates otimistas

**Nenhum update otimista em envio.** Envio é irreversível; mostrar `✓ Enviado` antes da confirmação do servidor é mentir para a usuária sobre um efeito que talvez não tenha ocorrido. Durante o lote, os itens ficam em estado `Enviando…` e só viram check com a resposta real.

Updates otimistas ficam reservados para ações reversíveis e baratas: mudar status de lead, favoritar, editar nota.

### 15.5 A tabela de leads

Componente mais importante da UI.

- **TanStack Table** para modelo de colunas/seleção/ordenação (headless — o visual é todo nosso)
- **Paginação server-side** (padrão 50/página); virtualização com `@tanstack/react-virtual` se passar de ~200 linhas visíveis
- **Seleção**: `Set<leadId>`, com "Selecionar disponíveis" chamando `POST /leads/selection` — a seleção em massa é resolvida pelo servidor, não iterando na página atual (que só tem 50 dos 80 disponíveis)
- **Estados**: skeleton por linha, empty state ilustrado com CTA, error state com retry
- Colunas: checkbox · empresa · segmento · cidade · WhatsApp+status · site · Instagram · status do lead · última interação · ações

### 15.6 Design system

Tokens em CSS variables desde o dia 1, mesmo sem dark mode ativo — trocar depois é editar um bloco `:root`, não caçar cor em componente.

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 4%;
  --muted: 240 5% 96%;
  --border: 240 6% 90%;
  --primary: 240 6% 10%;
  --success: 142 71% 45%;   /* ✓ enviado */
  --warning: 38 92% 50%;    /* respondeu */
  --danger: 0 72% 51%;      /* não contatar */
  --radius: 0.625rem;
}
```

Diretrizes visuais concretas:

- Escala de espaçamento 4/8 estrita — nada de `13px` improvisado
- Hierarquia por peso e cor, **não** por bordas. Máximo 1 borda por agrupamento visual.
- Densidade de tabela: `h-11` por linha, `px-4`, cabeçalho `text-xs uppercase tracking-wide text-muted-foreground`
- Transições 150–200ms, `ease-out`. Só `opacity` e `transform`.
- Números tabulares (`font-variant-numeric: tabular-nums`) em toda métrica
- `prefers-reduced-motion` respeitado
- Foco visível sempre (`ring-2 ring-offset-2`) — acessibilidade não é fase 2

Bibliotecas: `sonner` (toasts), `recharts` (gráficos), `lucide-react` (ícones), `cmdk` (command palette), `nuqs` (filtros tipados na URL).

### 15.7 Tipos

`api/openapi.yaml` → `openapi-typescript` → `src/types/api.d.ts`, gerado no `make generate`. **Nenhum tipo de resposta escrito à mão.** Se o backend mudar um campo, o build do frontend quebra — que é exatamente o que queremos.

---

## 16. Estrutura de pastas do frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx              # rotas + lazy loading
│   │   ├── providers.tsx           # QueryClient, Theme, Toaster
│   │   └── query-client.ts
│   │
│   ├── pages/                      # rota = composição, sem lógica
│   │   ├── DashboardPage.tsx
│   │   ├── LeadsPage.tsx
│   │   ├── LeadDetailPage.tsx
│   │   ├── CampaignsPage.tsx
│   │   ├── CampaignDetailPage.tsx
│   │   ├── TemplatesPage.tsx
│   │   ├── ImportPage.tsx
│   │   ├── SegmentsPage.tsx
│   │   ├── SuppressionPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── features/
│   │   ├── leads/
│   │   │   ├── api/leads.api.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useLeads.ts
│   │   │   │   ├── useLeadFilters.ts    # sincroniza com a URL
│   │   │   │   └── useLeadSelection.ts
│   │   │   ├── model/
│   │   │   │   ├── lead-columns.tsx     # definição das colunas
│   │   │   │   ├── contact-badge.ts     # estado → props do badge
│   │   │   │   └── filters.schema.ts    # zod
│   │   │   ├── components/
│   │   │   │   ├── LeadsTable.tsx
│   │   │   │   ├── LeadsToolbar.tsx
│   │   │   │   ├── LeadFiltersSheet.tsx
│   │   │   │   ├── QuickFilters.tsx
│   │   │   │   ├── ContactStatusBadge.tsx    # ★ o ✓ Enviado
│   │   │   │   ├── ContactHistoryTooltip.tsx
│   │   │   │   ├── WebsiteCell.tsx
│   │   │   │   ├── SelectionBar.tsx
│   │   │   │   └── LeadsEmptyState.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── campaigns/
│   │   │   ├── api/ hooks/ model/
│   │   │   └── components/
│   │   │       ├── CampaignWizard.tsx
│   │   │       ├── MessagePreview.tsx
│   │   │       ├── SendBatchButton.tsx      # ★ idempotency key nasce aqui
│   │   │       ├── BatchProgressDialog.tsx
│   │   │       ├── BatchResultSummary.tsx
│   │   │       └── RecontactConfirmDialog.tsx
│   │   │
│   │   ├── templates/
│   │   │   └── components/
│   │   │       ├── TemplateEditor.tsx
│   │   │       ├── VariablePicker.tsx
│   │   │       ├── TemplatePreview.tsx
│   │   │       └── AttachmentUploader.tsx
│   │   │
│   │   ├── imports/
│   │   │   └── components/
│   │   │       ├── FileDropzone.tsx
│   │   │       ├── ColumnMapper.tsx
│   │   │       ├── ImportPreviewTable.tsx   # criará/mesclará/ignorará
│   │   │       └── ImportSummary.tsx
│   │   │
│   │   ├── contacts/
│   │   │   └── components/ContactTimeline.tsx
│   │   ├── dashboard/
│   │   │   └── components/
│   │   │       ├── MetricCard.tsx
│   │   │       ├── LeadsBySegmentChart.tsx
│   │   │       ├── ContactsOverTimeChart.tsx
│   │   │       ├── FunnelChart.tsx
│   │   │       └── RecentActivity.tsx
│   │   ├── segments/
│   │   └── suppression/
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn — nada de domínio aqui
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── PageHeader.tsx
│   │   └── common/
│   │       ├── DataTable.tsx       # wrapper genérico de TanStack Table
│   │       ├── EmptyState.tsx
│   │       ├── ErrorState.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── CopyButton.tsx
│   │       └── StatusBadge.tsx
│   │
│   ├── lib/
│   │   ├── http.ts                 # fetch tipado, injeta Idempotency-Key
│   │   ├── api-error.ts            # problem+json → ApiError
│   │   ├── query-keys.ts
│   │   ├── format.ts               # data, telefone, número
│   │   ├── cn.ts
│   │   └── constants.ts
│   │
│   ├── hooks/
│   │   ├── useDebounce.ts
│   │   ├── useMediaQuery.ts
│   │   └── useIdempotencyKey.ts    # ★ chave estável por operação
│   │
│   ├── types/
│   │   ├── api.d.ts                # GERADO do OpenAPI
│   │   └── domain.ts
│   │
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css
│   │
│   └── main.tsx
│
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── components.json                 # shadcn
├── tsconfig.json
└── package.json
```

---

## 17. Contratos principais da API

Base: `/api/v1`. JSON. Erros em `application/problem+json` (RFC 9457). Paginação por cursor nas listagens grandes.

### 17.1 Leads

```http
GET /api/v1/leads
  ?segment_id=&city=&state=&status=&website_status=
  &contact_state=never|contacted|replied|suppressed
  &collected_from=&collected_to=&source_id=&q=
  &sort=collected_at:desc&cursor=&limit=50
```

```json
{
  "data": [{
    "id": "…",
    "company": {
      "id": "…", "name": "Barbearia Imperial",
      "city": "Uberlândia", "state": "MG",
      "website_status": "no_website"
    },
    "segment": { "id": "…", "name": "Barbearia", "color": "amber" },
    "contact": {
      "id": "…",
      "phone_display": "(34) 99999-9999",
      "status": "contacted",
      "contact_count": 1,
      "first_contacted_at": "2026-09-05T14:32:00Z",
      "last_contacted_at": "2026-09-05T14:32:00Z",
      "is_suppressed": false,
      "suppression_reason": null
    },
    "web_presences": [
      { "kind": "instagram", "url": "https://instagram.com/barbeariaimperial" }
    ],
    "status": "new",
    "is_available": false,
    "collected_at": "2026-09-01T09:00:00Z",
    "last_interaction_at": "2026-09-05T14:32:00Z"
  }],
  "meta": {
    "next_cursor": "…",
    "counts": {
      "total": 100,
      "available": 80,
      "contacted": 20,
      "suppressed": 3,
      "no_phone": 2
    }
  }
}
```

`meta.counts` é o que alimenta "100 encontrados / 80 disponíveis / 20 já contatados". Calculado no banco, sobre o filtro inteiro — não sobre a página.

```http
GET    /api/v1/leads/{id}
PATCH  /api/v1/leads/{id}            { "status": "interested", "notes": "…" }
DELETE /api/v1/leads/{id}            # soft delete; histórico permanece
POST   /api/v1/leads                 # criação manual
POST   /api/v1/leads/selection       # resolve seleção em massa server-side
       { "filters": {…}, "only_available": true, "limit": 500 }
       → { "lead_ids": [...], "contact_point_ids": [...], "count": 80 }
```

### 17.2 Contatos e histórico

```http
GET  /api/v1/contact-points/{id}
GET  /api/v1/contact-points/{id}/events?limit=50
```

```json
{
  "contact_point": {
    "id": "…", "phone_display": "(34) 99999-9999",
    "status": "contacted", "contact_count": 3
  },
  "events": [{
    "id": "…", "type": "message_sent",
    "occurred_at": "2026-09-05T14:32:00Z",
    "campaign": { "id": "…", "name": "Barbearias UDI - Setembro" },
    "template": { "name": "Barbearia 01", "version": 3 },
    "snapshot": {
      "company_name": "Barbearia Imperial",
      "body_preview": "Oi, Barbearia Imperial! Tudo bem?…"
    }
  }]
}
```

```http
POST   /api/v1/contact-points/{id}/suppressions   { "reason": "user_request" }
DELETE /api/v1/contact-points/{id}/suppressions   { "reason": "…" }
POST   /api/v1/contact-points/lookup              { "phone": "34 99999-9999" }
       → resolve, normaliza e informa se já foi contatado
```

### 17.3 Campanhas e lotes

```http
POST /api/v1/campaigns
{
  "name": "Barbearias UDI - Setembro",
  "template_version_id": "…",
  "filters": { "segment_id": "…", "city": "Uberlândia",
               "website_status": "no_website" },
  "batch_size": 10
}
```

```json
{
  "id": "…", "status": "active",
  "targets": {
    "total": 100, "pending": 80, "excluded": 20,
    "excluded_breakdown": {
      "already_contacted": 17, "suppressed": 2, "invalid_phone": 1
    }
  }
}
```

```http
GET  /api/v1/campaigns/{id}
GET  /api/v1/campaigns/{id}/targets?state=pending&cursor=&limit=50
GET  /api/v1/campaigns/{id}/batches

POST /api/v1/campaigns/{id}/batches
Idempotency-Key: <uuid>
{ "size": 10 }
```

Resposta em §12.4. Códigos: `200` sucesso (mesmo com `sent: 0`), `409` `batch_in_progress`, `422` `idempotency_key_reuse`.

```http
POST /api/v1/campaigns/{id}/preview
{ "target_id": "…" }
→ { "rendered_body": "Oi, Barbearia Imperial! Tudo bem?…",
    "attachments": [{ "id": "…", "url": "…", "filename": "…" }],
    "unresolved_variables": [] }

POST /api/v1/contact-points/{id}/recontact-approvals
{ "reason": "follow-up de 30 dias" }
→ { "approval_id": "…", "expires_at": "…",
    "previous_contacts": [{ "sent_at": "…", "campaign": "…" }] }
```

### 17.4 Templates, importação, catálogo, métricas

```http
GET    /api/v1/templates
POST   /api/v1/templates              # cria template + versão 1
POST   /api/v1/templates/{id}/versions
GET    /api/v1/templates/variables    # catálogo de {{variáveis}} disponíveis
POST   /api/v1/attachments            # multipart

POST   /api/v1/imports                # multipart; retorna colunas detectadas
POST   /api/v1/imports/{id}/analyze   # dry-run: o que cria/mescla/ignora
GET    /api/v1/imports/{id}/preview?outcome=needs_review&cursor=
POST   /api/v1/imports/{id}/commit    # Idempotency-Key obrigatório
GET    /api/v1/imports/{id}

GET    /api/v1/segments
POST   /api/v1/segments
PATCH  /api/v1/segments/{id}
GET    /api/v1/dedupe/candidates?status=pending
POST   /api/v1/dedupe/candidates/{id}/resolve
       { "action": "merge", "survivor_company_id": "…" }

GET    /api/v1/analytics/overview?from=&to=
GET    /api/v1/analytics/by-segment?from=&to=
GET    /api/v1/analytics/timeline?from=&to=&granularity=day
```

`analytics/overview`:

```json
{
  "totals": {
    "leads": 1240, "no_website": 890, "available": 612,
    "contacted": 278, "replied": 41, "interested": 18, "customers": 5
  },
  "rates": {
    "response_rate": 0.147,
    "interest_rate": 0.065,
    "conversion_rate": 0.018
  },
  "deltas": { "leads": 0.12, "contacted": 0.34, "replied": -0.05 }
}
```

---

## 18. Estratégia de tratamento de erros

### 18.1 Formato (RFC 9457)

```json
{
  "type": "https://prospect.local/errors/already-contacted",
  "title": "Contato já recebeu mensagem",
  "status": 409,
  "code": "already_contacted",
  "detail": "O número (34) 99999-9999 recebeu uma mensagem em 05/09/2026 às 14:32.",
  "instance": "/api/v1/campaigns/abc/batches",
  "request_id": "req_01J8X…",
  "errors": [
    { "field": "contact_point_id", "code": "already_contacted",
      "meta": { "last_contacted_at": "2026-09-05T14:32:00Z", "contact_count": 1 } }
  ]
}
```

`code` é máquina-legível e é o que o frontend liga. `detail` é humano e vai para o toast. `request_id` correlaciona com o log.

### 18.2 Mapeamento

| `code` | HTTP | Mensagem no frontend |
|---|---|---|
| `validation_failed` | 422 | Erro por campo no formulário |
| `already_contacted` | 409 | "Este contato já recebeu mensagem em {data}." |
| `contact_suppressed` | 409 | "Este número está na lista de não contatar." |
| `recontact_approval_required` | 409 | Abre o modal de confirmação de recontato |
| `batch_in_progress` | 409 | "Um envio já está em andamento. Aguarde." |
| `idempotency_key_reuse` | 422 | "Requisição inconsistente. Recarregue a página." |
| `no_eligible_targets` | 200 | "Nenhum contato disponível neste filtro." (não é erro) |
| `provider_unavailable` | 502 | "Serviço de envio indisponível. Nenhuma mensagem duplicada foi enviada." |
| `partial_batch_failure` | 207 | "7 de 10 enviadas. 3 falharam e continuam disponíveis." |

### 18.3 A mensagem que mais importa

Falha em lote **sempre** informa explicitamente sobre duplicidade:

> **Não foi possível enviar este lote.**
> Nenhuma mensagem duplicada foi enviada. 3 contatos continuam disponíveis.

Essa garantia não é retórica: ela é verdadeira por construção, porque a reserva acontece antes do envio e falha de reserva significa que nada saiu.

### 18.4 Falha parcial

Lote com sucesso parcial retorna `207 Multi-Status` com o array `results`. A UI mostra:

```
✓ 7 enviadas   ✗ 3 falharam (continuam disponíveis para retry)
```

Cada falha lista empresa e motivo. Nenhuma delas fica travada: o dispatch `failed` sai do índice único e o contato volta a ser elegível.

### 18.5 No frontend

```ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public detail: string,
    public requestId?: string,
    public fieldErrors?: FieldError[],
    public meta?: Record<string, unknown>,
  ) { super(detail); }
}
```

Handler central de mutation: `422` → erros no formulário; `409` com `recontact_approval_required` → abre modal; `5xx` → toast com `request_id` copiável. Retry automático **apenas** em `5xx` e timeout, nunca em `4xx`, e sempre com a mesma `Idempotency-Key`.

### 18.6 Erros de banco traduzidos

`23505` (unique_violation) é capturado no repositório e traduzido pelo nome da constraint:

```go
if pgErr.Code == "23505" {
    switch pgErr.ConstraintName {
    case "message_dispatches_first_contact_unique":
        return domain.NewError(domain.ErrAlreadyContacted,
            "contato já possui envio registrado")
    case "idempotency_keys_unique":
        return domain.NewError(domain.ErrBatchInProgress, "lote em andamento")
    }
}
```

Erro de banco nunca vaza para a API como 500 genérico quando temos significado de domínio para ele.

---

## 19. Estratégia de logs

### 19.1 Formato

`log/slog` em JSON. Um evento por linha.

```json
{
  "time": "2026-09-06T10:15:02.331Z",
  "level": "INFO",
  "msg": "message dispatched",
  "request_id": "req_01J8X…",
  "user_id": "usr_…",
  "action": "outreach.message.sent",
  "campaign_id": "cmp_…",
  "batch_id": "bat_…",
  "dispatch_id": "dsp_…",
  "contact_point_id": "cnt_…",
  "lead_id": "led_…",
  "phone_masked": "+55349****9999",
  "template_version_id": "tpl_…",
  "provider": "simulated",
  "duration_ms": 412
}
```

### 19.2 Correlação

`request_id` gerado no middleware (ou lido de `X-Request-ID`), colocado no `context`, e o logger é extraído do contexto em toda camada. Nenhuma função recebe logger por parâmetro; nenhuma usa logger global.

```go
logger := observability.FromContext(ctx).With(
    "campaign_id", campaignID, "batch_id", batchID)
```

O mesmo `request_id` é devolvido no header e no corpo do erro — a usuária copia do toast, e a linha exata aparece no log.

### 19.3 Redação de dados sensíveis

Telefone é PII. Nunca logar completo:

```go
func MaskPhone(e164 string) string {
    if len(e164) < 8 { return "***" }
    return e164[:6] + "****" + e164[len(e164)-4:]   // +55349****9999
}
```

**Nunca logados:** telefone completo, corpo renderizado da mensagem, hash de senha, token de sessão, credencial de provider. Corpos de mensagem vivem em `message_dispatches.rendered_body` (com controle de acesso), não no log.

### 19.4 Eventos obrigatórios

| `action` | Nível |
|---|---|
| `import.started` / `.completed` / `.failed` | INFO / ERROR |
| `lead.created` / `.merged` / `.updated` | INFO |
| `contact.created` / `.resolved_existing` | DEBUG |
| `contact.suppressed` / `.unsuppressed` | WARN |
| `dedupe.review_required` | INFO |
| `website.classified` | DEBUG |
| `campaign.created` | INFO |
| `batch.reserved` (com `reserved_count`) | INFO |
| `outreach.message.sent` | INFO |
| `outreach.message.failed` | ERROR |
| `outreach.duplicate_blocked` | **WARN** — sempre investigar |
| `recontact.approved` / `.executed` | WARN |
| `idempotency.replay` | INFO |
| `reservation.orphaned` | WARN |

`outreach.duplicate_blocked` em WARN é deliberado: se a constraint disparou, alguma camada acima falhou em filtrar. Nunca deve ser rotina.

### 19.5 Auditoria vs logs

Logs são operacionais, efêmeros, para depuração. `audit_events` é persistente, consultável pela UI e é o que responde "quem enviou o quê, quando". Ações que mudam estado escrevem nos dois.

---

## 20. Estratégia de importação

### 20.1 Fluxo em três etapas com preview obrigatório

```
1. UPLOAD      POST /imports (multipart)
               detecta delimitador, encoding, cabeçalho
               → sugere mapeamento de colunas
               NADA é escrito no banco final

2. ANALYZE     POST /imports/{id}/analyze   (dry-run completo)
               roda o pipeline inteiro, grava só em import_rows
               → preview: 340 novas | 120 mescladas | 12 revisão | 8 inválidas
               → e o número que importa:
                 "27 destas já foram contatadas anteriormente"

3. COMMIT      POST /imports/{id}/commit   + Idempotency-Key
               aplica em transação por chunk
               → estatísticas finais
```

O dry-run existe porque importação é a operação com maior potencial de sujar a base. A usuária vê exatamente o que vai acontecer antes de acontecer.

### 20.2 Pipeline (8 estágios)

```go
type ImportStage interface {
    Name() string
    Process(ctx context.Context, row *ImportRow) error
}

var pipeline = []ImportStage{
    ParseStage{},          // 1. jsonb bruto → struct, aplica mapeamento
    NormalizeStage{},      // 2. trim, unaccent, casing, name_key, city_key
    PhoneStage{},          // 3. E.164 + aliases + line_type
    ValidateStage{},       // 4. CNPJ, UF, telefone plausível
    ResolveContactStage{}, // 5. phone → contact_point existente ou novo
    ResolveCompanyStage{}, // 6. dedupe em cascata (§7.2)
    HistoryStage{},        // 7. marca was_already_contacted (não decide nada)
    PresenceStage{},       // 8. classifica URLs
}
```

Cada estágio é puro em relação ao banco final: só lê e escreve `import_rows`. Só o commit escreve nas tabelas reais. Isso torna o pipeline inteiro testável sem transação aberta.

### 20.3 Mapeamento de colunas

Auto-detecção por heurística de nome de cabeçalho, com override manual:

| Cabeçalho detectado | Campo |
|---|---|
| `nome`, `empresa`, `razao social`, `nome fantasia` | `trade_name` |
| `telefone`, `fone`, `whatsapp`, `celular`, `contato` | `phone` |
| `cidade`, `municipio` | `city` |
| `uf`, `estado` | `state` |
| `cnpj`, `documento` | `cnpj` |
| `site`, `website`, `url` | `website` |
| `instagram`, `insta`, `@` | `instagram` |
| `segmento`, `categoria`, `ramo` | `segment` |

O mapeamento fica salvo em `import_jobs.column_mapping` e é reaproveitado como sugestão em importações futuras da mesma fonte.

### 20.4 Commit transacional

Chunks de 500 linhas, uma transação por chunk. Falha em um chunk não perde os anteriores; `import_rows` registra até onde foi, e o commit é retomável.

```
BEGIN
  para cada linha do chunk:
    contact_point  ← INSERT … ON CONFLICT (phone_e164) DO UPDATE
                       SET last_seen_at = now()      ← nunca toca o histórico
    aliases        ← INSERT … ON CONFLICT DO NOTHING
    company        ← INSERT ou UPDATE conforme política de merge (§7.4)
    vínculo        ← INSERT company_contact_points ON CONFLICT DO NOTHING
    lead           ← INSERT … ON CONFLICT (company_id) WHERE deleted_at IS NULL
                       DO UPDATE SET last_seen…      ← não recria
    web_presences  ← INSERT … ON CONFLICT (company_id, url_key) DO NOTHING
    contact_event  ← 'imported_seen'  (rastreia reaparecimento, não é contato)
COMMIT
```

**O `ON CONFLICT DO UPDATE` do `contact_point` nunca toca `contact_point_stats`, `message_dispatches` ou `contact_events`.** É a linha de código mais importante da importação: é ela que faz o `✓ Enviado` sobreviver.

### 20.5 O que a importação nunca faz

- ❌ Deletar `contact_events`
- ❌ Zerar `contact_point_stats`
- ❌ Remover `suppressions`
- ❌ Sobrescrever `message_dispatches`
- ❌ Recriar `contact_point` já existente (resolve por E.164 + alias)
- ❌ Marcar como "novo" um contato com histórico

Estes seis itens viram testes de regressão explícitos, executados em CI a cada commit.

### 20.6 Reversão

`import_jobs` permite "desfazer" apenas o que aquela importação **criou** (`import_rows.outcome = 'created'`), e só se nada tiver sido contatado desde então. Merges não são revertidos automaticamente — vão para revisão manual.

---

## 21. Arquitetura futura de coleta

### 21.1 Port

```go
type LeadProvider interface {
    Name() string
    Capabilities() ProviderCapabilities
    Search(ctx context.Context, q SearchQuery) (SearchResult, error)
}

type SearchQuery struct {
    Segment  string
    City     string
    State    string
    Radius   int
    Limit    int
    Cursor   string
}

// Formato NEUTRO. Nenhum campo específico de provider vaza daqui.
type RawLead struct {
    ExternalID   string
    Name         string
    Phones       []string
    Address      Address
    Websites     []string
    SocialLinks  []string
    Category     string
    Metadata     map[string]any   // payload cru, para depuração
    Provider     string
    CollectedAt  time.Time
}
```

O domínio conhece apenas `RawLead`. Trocar de provider não toca em nenhuma regra de negócio — só o adapter muda.

### 21.2 Providers previstos

| Provider | Fase | Nota |
|---|---|---|
| `ManualProvider` | MVP | Cadastro pela UI |
| `CSVProvider` | MVP | Arquivo |
| `GooglePlacesProvider` | Fase 2 | **API oficial**, com chave e cota. Verificar ToS quanto a armazenamento e retenção de dados. |
| `PublicRegistryProvider` | Fase 3 | Dados públicos de CNPJ (Receita/Brasil API) — enriquecimento, não descoberta |
| `MapsScraperProvider` | ⚠️ | Provavelmente viola ToS. Não implementar sem avaliação jurídica. |

### 21.3 Convergência com a importação

Coleta e importação compartilham o mesmo pipeline. `SearchJob` produz `RawLead[]`, que vira `import_rows`, que passa pelos mesmos 8 estágios. **Uma única implementação de dedupe e normalização**, alimentada por duas origens. Duplicar essa lógica seria a forma mais fácil de introduzir divergência de dedupe.

```
CSVProvider ────┐
ManualProvider ─┼──► RawLead[] ──► import_rows ──► pipeline ──► banco
GoogleProvider ─┘                                  (o mesmo)
```

### 21.4 Enriquecimento de presença digital

Job assíncrono, desacoplado da coleta:

```
lead sem web_presence classificada
   → busca por nome+cidade (provider de busca)
   → coleta URLs candidatas
   → classifica cada host:
        instagram.com, facebook.com      → social
        linktr.ee, beacons.ai, bio.link  → linktree
        wa.me, api.whatsapp.com          → whatsapp_link
        ifood, doctoralia, booksy, …     → marketplace
        google.com/maps                  → google_business
        domínio próprio                  → own_site (verifica HTTP)
   → website_status derivado:
        tem own_site alcançável           → has_website
        só social/marketplace             → no_website
        nada encontrado                   → unknown
        own_site mas parking/erro         → review_required
```

`review_required` existe porque a classificação automática erra, e um lead classificado errado como "tem site" é uma oportunidade perdida silenciosamente. Melhor pedir revisão do que decidir mal.

### 21.5 Rate limiting e cota

Cada provider declara seus limites; o worker respeita com token bucket e backoff exponencial. `search_jobs` guarda cursor para retomar de onde parou. Cota consumida é registrada para não estourar o orçamento da API.

---

## 22. Riscos técnicos

Ordenados por probabilidade × impacto.

### 22.1 Legais e de conformidade — o risco de maior impacto

| Risco | Impacto | Mitigação |
|---|---|---|
| **LGPD** — prospecção B2B por WhatsApp trata dado pessoal | Alto | Base legal: legítimo interesse (art. 7º, IX) para contato B2B. Obrigatório: opt-out em toda mensagem, `suppressions` respeitado globalmente, registro de origem do dado (`sources`, `field_provenance`), política de retenção. Vale consulta jurídica antes do volume crescer. |
| **ToS do WhatsApp** — API não-oficial derruba número | Alto | Preferir WhatsApp Cloud API oficial. Bibliotecas não-oficiais são risco de banimento permanente. |
| **ToS de fontes de dados** — scraping de Google Maps | Alto | Usar Places API oficial. Não implementar scraper sem avaliação. |
| **Spam / denúncia** | Médio | Lote máximo pequeno, envio manual, delay entre mensagens, mensagem relevante e identificada, opt-out visível. A arquitetura de lotes já ajuda aqui. |

Nenhum desses é resolvível com código. São decisões de produto que a arquitetura precisa **acomodar** — e ela acomoda: supressão global, auditoria completa, envio manual.

### 22.2 Integridade de dados

| Risco | Mitigação |
|---|---|
| Normalização diverge entre versões e cria contatos fantasmas | `normalization_version` + job de renormalização + `contact_point_aliases` + bateria de testes de propriedade sobre a função de parse |
| Merge de empresas acidental (falso positivo do trigram) | Threshold conservador (0.85 automático); zona 0.60–0.85 vai para revisão manual; merge registrado em `audit_events` e reversível |
| Rollup `contact_point_stats` diverge dos eventos | Job de reconciliação + alerta. `contact_events` é a fonte da verdade. |
| Perda de histórico por `ON DELETE CASCADE` mal colocado | Política de FK documentada (§5.2) + teste que apaga todos os leads e verifica que o histórico sobrevive |
| Telefone compartilhado entre empresas distintas | Modelado como N:N intencionalmente. **Consequência aceita:** contatar a empresa A "queima" o telefone para a empresa B. Alternativa (permitir 2 envios ao mesmo número) violaria o requisito principal. Decisão consciente. |

### 22.3 Concorrência

| Risco | Mitigação |
|---|---|
| Envio duplicado por corrida | Índice único parcial + `SKIP LOCKED` + idempotência (§10) |
| Deadlock em reserva concorrente | `SKIP LOCKED` evita espera; ordenação consistente de locks |
| Reserva órfã após crash | Job de expiração com salvaguarda de `provider_message_id` |
| Zona cinzenta: enviou mas não confirmou | Salvaguarda + fila de revisão manual. **Não resolvível 100%** — é o problema dos dois generais. Escolhemos errar para o lado de não reenviar. |

### 22.4 Performance

| Risco | Mitigação |
|---|---|
| Listagem lenta com histórico agregado | Rollup denormalizado `contact_point_stats` (existe só por isso) |
| Dedupe fuzzy custoso em base grande | Índice GIN trigram + filtro obrigatório por cidade/UF antes do `similarity` |
| Importação de 50k linhas travando a API | Processamento em chunks + job assíncrono + progresso via polling |
| `COUNT(*)` exato para `meta.counts` | Aceitável até ~100k; depois, contagem aproximada + contagem exata só do subconjunto elegível |

### 22.5 Produto

| Risco | Mitigação |
|---|---|
| Detecção de site errada (falso "tem site") | Estado `review_required` explícito + revisão manual + reprocessamento |
| Taxa de resposta baixa torna o esforço inútil | Métricas por segmento e por template desde o dia 1; o dashboard existe para responder isso |
| Complexidade da arquitetura atrasar o MVP | Roadmap incremental; gateway simulado permite validar tudo sem integração externa |

---

## 23. Roadmap do MVP

Fases entregáveis, cada uma funcional por si.

### Fase 0 — Fundação (2–3 dias)

- [ ] Monorepo: `backend/`, `frontend/`, `docker-compose.yml`
- [ ] Postgres via Docker + `golang-migrate` + `sqlc` configurados
- [ ] Migration 1: schema completo (§4) com **todos** os índices e constraints
- [ ] Seeds: 6 segmentos iniciais + usuário owner
- [ ] Esqueleto Go: chi, slog, config, health check, middleware de request_id
- [ ] Esqueleto React: Vite, Tailwind, shadcn, TanStack Query, router, AppShell
- [ ] `Makefile`: `make dev`, `make migrate`, `make generate`, `make test`

**Pronto quando:** `make dev` sobe tudo e a SPA fala com `/health`.

### Fase 1 — Núcleo de contatos ★ (3–4 dias)

O coração. Nada visual ainda; correção acima de tudo.

- [ ] Value object `PhoneNumber` + **bateria pesada de testes** (todos os casos de §6.5)
- [ ] `contact_points` + aliases + regra do 9º dígito
- [ ] `contact_events` + trigger de rollup + trigger de imutabilidade
- [ ] `suppressions`
- [ ] Repositórios com `testcontainers` contra Postgres real
- [ ] **Teste de regressão crítico:** cria contato → registra evento → apaga tudo de leads → reinsere → histórico intacto e `contact_count` correto

**Pronto quando:** o teste acima passa. Esta é a fase que valida a premissa do produto inteiro.

### Fase 2 — Leads e painel (4–5 dias)

- [ ] CRUD de `companies`, `leads`, `segments`
- [ ] View `lead_board` + `GET /leads` com filtros, cursor e `meta.counts`
- [ ] AppShell definitivo: sidebar, topbar, tokens de design
- [ ] `LeadsTable` com TanStack Table, seleção, skeleton, empty state
- [ ] `ContactStatusBadge` — o `✓ Enviado` com tooltip de histórico
- [ ] Filtros rápidos + filtros avançados sincronizados com a URL
- [ ] Página de detalhe do lead com timeline de contato

**Pronto quando:** dá para navegar 1.000 leads seed com filtros fluidos e o check aparece corretamente.

### Fase 3 — Importação CSV (3–4 dias)

- [ ] Upload + detecção de colunas + mapeamento manual
- [ ] Pipeline de 8 estágios sobre `import_rows`
- [ ] Dedupe em cascata + `dedupe_candidates`
- [ ] Dry-run com preview: criará / mesclará / ignorará / **já contatados**
- [ ] Commit transacional em chunks
- [ ] UI de importação em 3 passos
- [ ] **Teste crítico:** importar a mesma planilha 2× → zero duplicata, histórico intacto

**Pronto quando:** importar duas vezes o mesmo arquivo é uma operação segura e visivelmente sem efeito na segunda vez.

### Fase 4 — Templates (2 dias)

- [ ] `message_templates` + versionamento imutável
- [ ] Renderização de `{{variáveis}}` com validação
- [ ] Upload de anexos (storage local)
- [ ] Editor com preview ao vivo e picker de variáveis

### Fase 5 — Campanhas e envio ★ (4–5 dias)

A segunda fase crítica.

- [ ] `campaigns` + `campaign_targets` com exclusão automática de já contatados
- [ ] `SendBatch` com reserva `SKIP LOCKED` (§10.4)
- [ ] Middleware de idempotência + `idempotency_keys`
- [ ] `SimulatedGateway` com latência e falhas configuráveis
- [ ] `contact_events` gravados no sucesso; reserva liberada na falha
- [ ] `RecontactApproval` + modal de confirmação
- [ ] UI: wizard, preview, "Enviar próximos 10", progresso, resumo do lote
- [ ] **Testes de concorrência:** 10 goroutines disparando o mesmo lote simultaneamente → exatamente N envios, nunca N+1

**Pronto quando:** o teste de concorrência passa e o teste de duplo-commit com a mesma `Idempotency-Key` retorna a mesma resposta sem novo efeito.

### Fase 6 — Dashboard (2–3 dias)

- [ ] `analytics/overview`, `by-segment`, `timeline`
- [ ] Cards de métrica com delta período a período
- [ ] Gráficos: leads por segmento, contatos ao longo do tempo, funil, conversão por segmento
- [ ] Atividade recente

### Fase 7 — Acabamento (2–3 dias)

- [ ] Dark mode (tokens já preparados)
- [ ] Command palette (`cmdk`)
- [ ] Responsividade (tabela → cards no mobile)
- [ ] Toasts, microinterações, estados de erro completos
- [ ] Página de supressão (do not contact)
- [ ] Página de revisão de duplicatas
- [ ] Auditoria consultável

**Total estimado do MVP: 22–29 dias de trabalho.**

### Depois do MVP

| Fase | Escopo |
|---|---|
| 8 | WhatsApp Cloud API real (troca o gateway; o resto não muda) |
| 9 | `GooglePlacesProvider` + `search_jobs` |
| 10 | Detecção automática de presença digital |
| 11 | Follow-up sequenciado (sempre manual, nunca automático) |
| 12 | Multiusuário, autenticação completa, papéis |
| 13 | Deploy (Fly.io / Railway) + backup automatizado |

### Ordem inegociável

**Fase 1 antes de qualquer tela.** A tentação será construir a UI bonita primeiro. Se o núcleo de contatos estiver errado, toda a UI acima dele estará mostrando dados errados com muito estilo. A Fase 1 é onde o produto ganha ou perde.

---

## Apêndice A — Checklist de invariantes

Regras que devem ser verdade **sempre**. Cada uma vira um teste automatizado.

1. Nenhum `contact_point` com `phone_e164` duplicado
2. Nenhum contato com dois `message_dispatches` ativos com o mesmo `attempt_seq`
3. Nenhum `attempt_seq > 1` sem `recontact_approval_id`
4. Nenhuma `recontact_approval` consumida por dois dispatches
5. `contact_events` nunca sofre UPDATE ou DELETE
6. `contact_point_stats.contact_count` == `COUNT(contact_events WHERE 'message_sent')`
7. Contato suprimido nunca recebe dispatch novo
8. Apagar todos os leads não altera nenhuma linha de `contact_events`
9. Reimportar a mesma planilha não cria company, lead ou contact_point duplicado
10. `lead_board.is_available = false` sempre que `contact_count > 0`
11. Toda `Idempotency-Key` repetida retorna a resposta original sem efeito novo
12. Nenhum lote envia mais que `requested_size`

## Apêndice B — Glossário

| Termo | Significado neste sistema |
|---|---|
| **Contact point** | Telefone normalizado em E.164. Entidade imortal, âncora do histórico. |
| **Company** | Identidade estável do negócio. Sobrevive a recoletas. |
| **Lead** | Oportunidade comercial sobre uma empresa. Volátil, tem pipeline. |
| **Dispatch** | Um envio a um contato. A unidade protegida por constraint. |
| **Attempt** | Tentativa técnica de entregar um dispatch (retry de rede). |
| **Batch** | Um clique em "Enviar próximos 10". Unidade de idempotência. |
| **Target** | Alvo dentro de uma campanha, com variáveis congeladas. |
| **Suppression** | Registro de do-not-contact. Global e permanente. |
| **Disponível** | Tem telefone móvel, não suprimido, `contact_count = 0`, sem dispatch ativo. |
| **Recontato** | Envio a contato já contatado. Sempre exige aprovação explícita de uso único. |
