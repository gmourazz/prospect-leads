# WhatsApp Bridge

Sessão local do WhatsApp Web que esvazia a fila de envio do Prospect.

## O risco, primeiro

Isso usa o Baileys, um cliente **não oficial** do WhatsApp Web. Automatizar
envio em massa para quem nunca te procurou é exatamente o padrão que o
WhatsApp detecta e pune, e a punição é a restrição ou o banimento do número —
não existe configuração que elimine esse risco, só medidas que o reduzem.

Use um número que você pode perder sem prejuízo, e comece devagar.

## Como rodar

```bash
cd whatsapp-bridge
npm install
cp .env.example .env     # preencha API_EMAIL e API_PASSWORD
npm start
```

Na primeira execução aparece um QR code no terminal. No celular:
**WhatsApp › Aparelhos conectados › Conectar aparelho**. O pareamento fica
salvo em `auth/` e não é pedido de novo.

Enquanto o terminal estiver aberto, o bridge envia. Fechou, parou — não existe
envio automático sem esse processo rodando.

## Por que roda aqui e não no servidor

Uma sessão de WhatsApp Web aberta a partir de um datacenter (Fly, AWS, etc.)
é por si só um sinal de automação, porque nenhum usuário real acessa o
WhatsApp de um servidor. Rodando na sua máquina, a sessão sai do mesmo IP
residencial e da mesma região do seu celular.

O bridge só faz conexões **de saída** — ele pergunta ao backend se há trabalho.
Por isso não precisa de porta aberta, IP fixo nem túnel.

## O que protege o número

O ritmo é decidido pelo backend, não aqui. O bridge nunca recebe uma lista:
pede **uma** mensagem por vez e frequentemente ouve "ainda não".

| Camada | Onde |
|---|---|
| Intervalo aleatório entre mensagens (padrão 90–240s) | backend |
| Teto diário (padrão 20) | backend |
| Janela de dias e horários (padrão seg–sex, 9h–18h) | backend |
| Pausa longa a cada N mensagens (padrão 5 msgs → 25 min) | backend |
| Variação do texto por sorteio de spintax | backend |
| Checagem se o número tem WhatsApp antes de enviar | bridge |
| Simulação de leitura e digitação | bridge |
| Parada automática se o WhatsApp reclamar | ambos |

Os padrões são propositalmente tímidos. Ajuste em **Configurações** no site.

### Spintax nos templates

Mensagens idênticas em série são o sinal de spam mais forte que existe. Escreva
alternativas entre chaves simples e o backend sorteia uma por envio:

```
{Oi|Olá|Opa}, {{nome_curto}}! {Tudo bem|Tudo certo|Como vai}?
```

Só vale para templates de WhatsApp — e-mail não usa spintax.

## Quando algo dá errado

- **QR code aparece de novo do nada** — a sessão caiu. Escaneie outra vez.
- **"sessao encerrada pelo WhatsApp"** — o número foi desconectado ou
  restringido. O bridge para e a fila é pausada sozinha no backend. Não
  reconecte por impulso: entenda o motivo antes.
- **Confirmação pendente** — se o envio saiu mas a confirmação não chegou ao
  backend, ela fica em `pending-report.json` e é reenviada no próximo `npm start`.
  Não apague esse arquivo: é ele que impede a mesma mensagem de sair duas vezes.
