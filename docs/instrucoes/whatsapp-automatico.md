# WhatsApp automático

Envio automático de WhatsApp para leads, com o ritmo controlado pelo backend
(não pela máquina que roda o envio). Implementado em 2026-09-14.

## Como funciona

1. Na tela **Leads**, seleciona os leads e clica em **Enviar automático**.
2. Escolhe o template (precisa ser um template marcado como canal WhatsApp).
3. Os leads entram numa fila no banco de dados.
4. O **bridge** — um processo Node separado que roda numa máquina com WhatsApp
   pareado — pergunta ao backend "posso enviar algo?" repetidamente. O backend
   responde com uma mensagem ou com "espera X segundos".
5. A página **Fila do WhatsApp** (menu lateral) mostra estado da sessão,
   quantos estão na fila, quantos já saíram hoje e o botão de pausa.

A fila **começa pausada**. Nada sai até você liberar em "Fila do WhatsApp" →
Retomar.

## Rodando o bridge em outra máquina

O bridge não precisa estar na mesma máquina onde o backend roda (aliás não
deve: veja "Por que local" abaixo). Para rodar em qualquer computador com
Node 20+:

```bash
git clone <repo> prospect-leads      # ou copie só a pasta whatsapp-bridge/
cd prospect-leads/whatsapp-bridge
npm install
cp .env.example .env
```

Edite `.env`:

```
API_URL=https://prospect-backend.fly.dev/api/v1
API_EMAIL=<seu email de login do Prospect>
API_PASSWORD=<sua senha>
```

```bash
npm start
```

Na primeira vez aparece um QR code no terminal — escaneie em **WhatsApp →
Aparelhos conectados → Conectar aparelho**, no celular cujo número vai
enviar as mensagens. O pareamento fica salvo em `whatsapp-bridge/auth/` (uma
pasta local, criada automaticamente) e não é pedido de novo, mesmo depois de
reiniciar o processo.

**Enquanto esse terminal estiver aberto, a fila anda.** Fechou o terminal,
parou — não existe envio automático sem esse processo rodando em algum lugar.
Pode deixar rodando em qualquer máquina ligada: um notebook, um mini PC, uma
VPS pessoal (não a mesma infra do backend — ver seção abaixo).

Se quiser manter rodando em segundo plano em vez de um terminal aberto, uma
opção simples é `pm2` (`npm i -g pm2 && pm2 start src/index.js --name wa-bridge`
dentro de `whatsapp-bridge/`) ou equivalente do sistema (systemd, Agendador de
Tarefas do Windows como serviço, etc.) — não incluído por padrão porque exige
julgamento sobre o ambiente de cada máquina.

## Por que o bridge roda numa máquina comum, não no servidor

Uma sessão de WhatsApp Web aberta a partir de um datacenter (Fly, AWS etc.) é
por si só um sinal de automação — nenhum usuário real acessa o WhatsApp de um
servidor. Rodando numa máquina comum, a sessão sai de um IP residencial
normal, como qualquer pessoa usando WhatsApp Web.

O bridge só faz conexões **de saída**: ele pergunta ao backend se há trabalho.
Por isso não precisa de porta aberta, IP fixo nem túnel — só acesso de saída
à internet (`https://prospect-backend.fly.dev`).

## O risco, sem rodeios

O bridge usa **Baileys**, um cliente não oficial do WhatsApp Web. Automatizar
envio para quem nunca procurou o número é o padrão que o WhatsApp mais
pune — a punição é restringir ou banir o número, e não existe configuração
que elimine esse risco, só medidas que reduzem a chance.

A API oficial (WhatsApp Cloud API) foi avaliada e descartada: exige número
comercial verificado e templates pré-aprovados pela Meta, e mensagem de
prospecção fria (primeiro contato, sem a pessoa ter dado opt-in) não passa
nessa revisão.

**Decisão tomada:** seguir com Baileys mesmo assim, com a mitigação mais forte
possível — descrita abaixo — e aceitando que o número usado pode ser
restringido. Use um número que você pode perder sem prejuízo.

## O que protege o número

O ritmo é decidido inteiramente pelo **backend**, nunca pelo bridge: o bridge
nunca recebe uma lista, só uma mensagem de cada vez, e frequentemente ouve
"ainda não".

| Camada | Onde | Padrão de fábrica |
|---|---|---|
| Intervalo aleatório entre mensagens | backend | 90–240s |
| Teto diário | backend | 20 |
| Janela de dias e horários | backend | seg–sex, 9h–18h |
| Pausa longa a cada N mensagens | backend | a cada 5 → pausa de 25 min |
| Variação do texto (spintax) | backend | sorteada a cada envio |
| Checagem se o número tem WhatsApp | bridge | antes de cada envio |
| Simulação de leitura e digitação | bridge | por mensagem |
| Parada automática se o WhatsApp reclamar | ambos | pausa a fila inteira |

Os padrões são propositalmente tímidos. Ajustáveis em **Configurações**, mas
aumentar esses números é exatamente o que aumenta o risco de restrição.

### Spintax nos templates

Mensagens idênticas em série são o sinal de spam mais forte que existe.
Escreva alternativas entre chaves simples no corpo do template (só nos
templates de canal WhatsApp — email não usa isso):

```
{Oi|Olá|Opa}, {{nome_curto}}! {Tudo bem|Tudo certo|Como vai}?
```

O backend sorteia uma opção por envio, então duas mensagens da mesma fila
raramente saem idênticas.

## Quando algo dá errado

- **QR code aparece de novo do nada** — a sessão caiu, escaneie de novo.
- **"sessão encerrada pelo WhatsApp" / badge "Restringido" ou "Desconectado"
  na Fila do WhatsApp** — o número foi desconectado ou restringido pelo
  WhatsApp. O bridge para sozinho e a fila é pausada automaticamente (kill
  switch). **Não reconecte por impulso** — entenda o motivo antes de tentar
  de novo.
- **Confirmação de envio pendente** — se a mensagem saiu do WhatsApp mas a
  confirmação não chegou ao backend (queda de rede, bridge derrubado no meio),
  ela fica salva em `whatsapp-bridge/pending-report.json` e é reenviada
  automaticamente na próxima vez que rodar `npm start`. Não apague esse
  arquivo: é ele que impede a mesma mensagem de ser considerada perdida e
  reenviada em dobro.
- **Mensagem presa "enviando" por muito tempo** (bridge caiu no meio de um
  envio) — o backend libera sozinho qualquer mensagem parada em "sending" há
  mais de 10 minutos, devolvendo-a para a fila.

## Notas técnicas (para quem for mexer no código depois)

Dois bugs só apareceram testando ponta a ponta contra um Postgres real, e vale
saber deles antes de tocar em `internal/application/whatsapp_agent.go` ou
`internal/adapters/postgres/whatsapp_agent.go`:

1. **O intervalo tem que ser cobrado no momento em que a mensagem é
   entregue ao bridge (`Claim`), nunca em quando o resultado é reportado
   de volta (`ReportResult`).** Cobrar no report permite que um bridge
   travado, duplicado ou que nunca responde receba uma segunda mensagem
   imediatamente — a fila esvazia na velocidade do HTTP, não no ritmo
   configurado.

2. **Quem mede quanto falta do intervalo tem que ser o Postgres, nunca o
   Go.** `next_allowed_at` é escrito pelo banco (`now() + intervalo`);
   comparar isso com `time.Now()` do processo Go importa qualquer diferença
   de relógio entre as duas máquinas direto para o ritmo de envio. A
   consulta correta faz o próprio Postgres calcular
   `next_allowed_at - now()` e devolve isso pronto (ver `AgentState.WaitFor`
   em `whatsapp_agent.go`).

Ambos os pontos têm testes de regressão manuais documentados no histórico de
commit da feature — reproduza-os (dois `claim` seguidos sem `report` no meio;
`next_allowed_at` correto mesmo com relógios dessincronizados) antes de mexer
nessa lógica de novo.
