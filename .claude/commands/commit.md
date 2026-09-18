Analise as alterações feitas nessa sessão de trabalho. Use o histórico da conversa e, se necessário, `git diff HEAD` para identificar o que mudou.

**IMPORTANTE: apenas exiba a mensagem abaixo. Não execute `git commit`, não faça staging, não rode nenhum comando git.**

Gere uma mensagem de commit **exatamente** neste formato:

```
<emoji> <tipo>: <resumo curto em português (máx 72 chars)>

<descrição das alterações uma por linha com "-", em português>
```

---

**Emojis e tipos disponíveis (gitmoji):**

| Emoji | Tipo     | Quando usar                         |
| ----- | -------- | ----------------------------------- |
| ✨    | feat     | nova funcionalidade                 |
| 🐛    | fix      | correção de bug                     |
| ♻️    | refactor | refatoração sem mudar comportamento |
| 🎨    | style    | ajuste visual / UI / CSS            |
| 📝    | docs     | documentação                        |
| ⚡️    | perf     | melhoria de performance             |
| 🔧    | chore    | configuração, build, deps           |
| 🚚    | chore    | mover / renomear arquivos           |
| 💡    | docs     | comentários no código               |
| 🗑️    | chore    | remoção de código/arquivo           |

**Regras:**

- Escolha o emoji/tipo que representa a **mudança dominante** da sessão
- Se houver múltiplos tipos, use o mais significativo e liste os demais na descrição
- Resumo: imperativo, minúsculas, sem ponto final
- Descrição: específica mencione componentes, páginas e comportamentos alterados
- Agrupe alterações relacionadas em um único bullet
- Não mencione nomes de arquivos soltos contextualize o que o arquivo faz

**Exemplo de saída esperada:**

```
✨ feat: ajustes no modal e alteração em massa da apuração de serviços

- Modal individual: botão laranja abre direto em edição; clicar na
  descrição abre em visualização
- Footer do modal: "Fechar" (vermelho) na visualização; "Cancelar" +
  "Salvar" na edição nunca exibidos juntos
- Alteração em Massa: modal reescrito com campos corretos de serviços
  (Serviço Apurado NBS + Anexo Simples Nacional)
- Filtro de Competência removido da barra de filtros do list view
- Colunas obrigatórias ampliadas para 5: Cód. Serviço, Serviço Apurado,
  Descrição, Valor e Anexo
```
