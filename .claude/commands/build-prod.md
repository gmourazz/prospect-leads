---
description: Commita, builda e publica o Prospect inteiro (backend no Fly, frontend no Netlify)
allowed-tools: Bash, Read
---

Repositório de trabalho: `C:\Users\geovannamoura\Documents\Geovanna\prospect-leads` (é o clone real,
com git — nunca a pasta `prospect-leads-main`, que é uma cópia antiga sem `.git`). Todos os
passos abaixo rodam a partir de lá.

## 1. Ver o que mudou

`cd` para o repositório e rode `git status --short` e `git diff`. Se não houver nada para
commitar, pule para o passo 3.

## 2. Commitar

Agrupe as mudanças por assunto (como nos commits anteriores deste repo — cada bug/feature
vira um commit separado, nunca um commit genérico "várias correções"). Para cada grupo:

- `git add` só dos arquivos daquele grupo
- Escreva a mensagem em português, sem emoji, no estilo dos commits já existentes: título curto
  explicando o quê, corpo em prosa explicando por quê (não uma lista de bullets técnicos)
- Termine a mensagem com a linha de atribuição Co-Authored-By especificada nas instruções ativas
  desta sessão (não invente uma, use a que estiver vigente)
- `git commit`

Nunca invente uma mudança de código para "ter algo pra commitar" — se não há nada de
substância, pule esta seção.

## 3. Portão de qualidade (não pule mesmo com pressa)

Rode, e pare tudo se qualquer um falhar (reporte o erro, não prossiga para push/deploy):

```
cd backend && go build ./... && go vet ./... && go test ./...
cd ../frontend && npx tsc --noEmit && npm run build
```

## 4. Push

`git push origin main`. Se o push falhar (branch divergente etc.), pare e reporte — nunca
force push sem perguntar.

## 5. Deploy do backend (Fly)

```
cd backend
flyctl deploy
```

Se `flyctl` não for reconhecido, tente com o caminho completo:
`"$USERPROFILE/.fly/bin/flyctl.exe" deploy` (bash) ou equivalente em PowerShell.

Se falhar por falta de autenticação (`no access token available`), pare e peça para a usuária
rodar `flyctl auth login` uma vez no terminal dela (é um login interativo via navegador, você
não consegue fazer isso sozinho) — depois disso o token fica salvo e os próximos deploys não
precisam de login de novo.

Depois do deploy, confirme com `curl -s https://prospect-backend.fly.dev/health`.

## 6. Deploy do frontend (Netlify)

O site já está linkado (`frontend/.netlify/state.json` aponta pro site certo — não rode
`netlify link` de novo, não crie um site novo).

```
cd frontend
npm run build
netlify deploy --prod
```

Se falhar por falta de login, mesma lógica do Fly: peça para a usuária rodar `netlify login`
uma vez (interativo, precisa do navegador dela) e avise que depois disso pode rodar
`/build-prod` de novo.

## 7. Relatório final

Resuma em poucas linhas, em português: o que foi commitado (títulos dos commits), se o build
do Fly e o deploy do Netlify foram bem-sucedidos, e as URLs de produção. Se algum passo parou
no meio (portão de qualidade, falta de login), diga exatamente onde parou e o que falta para
a usuária destravar.
