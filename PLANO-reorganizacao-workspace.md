# Replicar padrão datameet-workspace no orbita-workspace (Zion/Orbita)

> **Como retomar esta sessão:** este documento foi gerado originalmente em 2026-07-17 (fora do `orbita-workspace`) e **revalidado em 2026-08-10** dentro do próprio repo, porque o estado tinha mudado desde a análise original. Ele é self-contained — não depende de contexto de conversa anterior. Antes de executar qualquer passo: (1) rode `git status` neste repo e em cada um dos sub-repos listados na seção "Estado observado" para confirmar que nada mudou desde esta revalidação; (2) se algo mudou, revalide a seção correspondente antes de agir; (3) siga a ordem dos passos — cada um assume que o anterior foi concluído; (4) **não commitar nada automaticamente** — cada commit descrito abaixo precisa de autorização explícita no momento, mesmo que o usuário já tenha aprovado o plano como um todo.

## Contexto

`orbita-workspace` (remote `https://github.com/willianslegacy94-zion/zion-workspace`) é o workspace de agência multi-cliente (barbearia, jurídico, academia, imobiliária, loja, família de produtos whitelabel `orbita-*`/`Kernel`) — diferente do `datameet-workspace`, que é uma única empresa com poucos repos padronizados (API+front). Esse plano adapta o padrão do `datameet-workspace` (orquestrador leve + guardrails de IA) para esse cenário mais heterogêneo, sem copiar 1:1.

Decisões já confirmadas pelo usuário na sessão original (2026-07-17):

1. Substituir a camada AIOX pelo padrão enxuto do `datameet-workspace` (skills sob demanda + subagents com contrato + hooks simples).
2. Extrair os repos aninhados (que têm `.git` próprio) para pastas irmãs + `repos.list`.
3. Destrackear `node_modules` do git agora.

Decisões confirmadas na revalidação de 2026-08-10:

4. `orbita-lobo` foi descontinuado de verdade (removido da VPS, domínio `depositolobo.online` desativado — confirmado em `academia-sandro/PROGRESS.md`) — não faz mais parte deste plano. A documentação órfã `kernel-hq/arquitetura-orbita-lobo/` (12 arquivos, untracked) já foi apagada.
5. `sistema-orbita-whitelabel` **não** foi descontinuado — foi renomeado localmente para a pasta `kernel/` e rebatizado comercialmente como **"Kernel"** (02/08/2026, domínio `kercellwc.online` registrado, ainda sem deploy). O remote GitHub continua `sistema-orbita-whitelabel.git` (nome do repo remoto não mudou, só a pasta local e o nome comercial). A documentação `kernel-hq/arquitetura-orbita-whitelabel/` continua válida e **não deve ser apagada**. Este plano passa a tratar `kernel/` como o sucessor direto de `sistema-orbita-whitelabel` em todos os passos abaixo.

**Garantia exigida pelo usuário: não pode quebrar a integração Obsidian.** O guia `Integração Obsidian x Claude.md` (já existe na raiz deste repo) recomenda vault **por projeto**, dentro do `docs/` de cada sistema — que é exatamente o que `sistema-thieco/docs/00-governance`, `vilamill-sistema/docs/00-governance` e `kernel/docs/00-governance` já são hoje. Como esses `docs/` vivem dentro de cada repo (não na raiz do workspace), mover o repo inteiro (código + docs + `.git`) para a pasta irmã preserva o vault de cada projeto intacto. Isso na verdade _implementa_ o Método 1 do próprio guia, que hoje está sendo mascarado por tudo estar misturado num vault único na raiz. O vault raiz (`.obsidian/` + `basescholl.md`, `junhomdtl.md`, `Projeto Ivystore.md`, `Integração Obsidian x Claude.md`) **não é tocado** em nenhum passo deste plano.

---

## Estado observado (revalidado em 2026-08-10 — revalidar de novo antes de agir se mais tempo tiver passado)

### Os repos aninhados com `.git` próprio dentro do escopo original (4 de 5 — `orbita-lobo` saiu)

| Repo                        | Remote                                                                                                        | Estrutura                                                               | Gerenciador confirmado                                                                                                                                           | Mudanças não commitadas | Trackeado no repo pai? |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| `kernel` (era `sistema-orbita-whitelabel`) | `github.com/willianslegacy94-zion/sistema-orbita-whitelabel.git`                                                                | root-level (`package.json` na raiz) + `backend/`+`frontend/` internos  | `yarn` (yarn.lock na raiz)                                                                                                                                       | 1 arquivo | 0 arquivos |
| `sistema-thieco`            | `github.com/willianslegacy94-zion/sistema-thieco.git`                                                                     | split `backend/` + `frontend/`, `yarn.lock` solto na raiz **e também** dentro de `backend/`/`frontend/` | **`npm`** dentro de `backend/` e `frontend/` (cada um com seu próprio `package-lock.json`, que coexiste com `yarn.lock` local) — ambíguo, mesma cautela do plano original: não usar o `yarn.lock` da raiz como referência sem confirmar | 4 arquivos | **95 arquivos** — únicos entre os 4 rastreados individualmente no repo pai |
| `vilamill-sistema`          | `github.com/willianslegacy94-zion/vilamill-sistema`                                                                       | root-level (`package.json`, `prisma/schema.prisma`)                     | **ambíguo**: `yarn.lock` E `package-lock.json` coexistindo na raiz — **confirmar com o usuário qual é o real antes de escrever o script de check/bootstrap** (pendência não resolvida desde a análise original) | 20 arquivos | 0 arquivos |
| `ivsstore-sistema`          | `github.com/willianslegacy94-zion/ivvstore-sistema.git` (⚠️ nome do remote é `ivvstore`, com dois "v", diferente do nome da pasta local — não é erro de digitação deste plano) | split `backend/` + `frontend/`                                          | **`npm`** confirmado (`package-lock.json` em `backend/` e `frontend/`, sem `yarn.lock`)                                                                          | 3 arquivos | 0 arquivos |

### Repos novos com `.git` próprio, descobertos na revalidação — **fora do escopo aprovado, decisão pendente**

Não faziam parte da análise de 17/07 e da decisão original do usuário. Antes de incluir qualquer um no Passo 1/4, perguntar explicitamente se entram no `repos.list`.

| Repo | Remote | Mudanças não commitadas | Observação |
|---|---|---|---|
| `lanchonete-sistema` | `github.com/willianslegacy94-zion/lanchonete-sistema.git` | 6 arquivos | Tem `agent-memory` AIOX próprio (`.claude/agent-memory/aiox-devops/`), sugerindo já foi trabalhado com o padrão AIOX antigo. |
| `lane-confeitaria` | `github.com/willianslegacy94-zion/lane-confeitaria.git` | 1 arquivo | Next.js (`.next/` presente). |
| `kernel-foodservice` | **sem remote configurado** (só local) | 174 arquivos | Next.js + Prisma. Provável variante do produto Kernel para foodservice, ainda não publicada no GitHub. |
| `kernelmei` | **sem remote configurado** (só local) | 80 arquivos | Next.js + Vitest. Provável variante do produto Kernel para MEI, ainda não publicada no GitHub. |

### Pastas novas sem `.git` próprio, descobertas na revalidação — informativo, não fazem parte de nenhum passo

`kernel-academia`, `Kernel-Kalel`, `Kernel-brainiac` (Python/FastAPI, parecem novos agentes IA na linha da "Holding de Robôs" — Horizon/Pulsar/Quasar/Cortex/Insight —, não documentados ainda no `ecosystem-guide.md`), `evolution-api` (config de deploy da Evolution API), `orbita-black-prospeccao` (Python, bate com "Motor Ativo de Prospecção" já mapeado em memória), `sdr-crm` (Node.js), `thieco-docs-soltos-2026-07` (docs/migração soltos do Thieco). Nenhuma ação necessária — só registrado para não confundir uma futura revalidação.

### Pastas sem `.git` próprio já conhecidas (fora de escopo desta rodada, confirmado 17/07 e ainda válido)

`kernel-hq` (ex-`orbita-black`), `orbita-cortex`, `orbita-horizon`, `orbita-insight`, `orbita-pulsar`, `orbita-quasar`, `academia-sandro` — são pastas comuns commitadas direto no repo pai, sem histórico próprio. Não fazem parte da decisão aprovada (extrair exigiria criar `git init` + remote novo — decisão separada, perguntar ao usuário quando chegar a vez).

### `node_modules` trackeado

`node_modules/` (raiz) e `.aiox-core/node_modules/` seguem no índice do git apesar de `node_modules` estar no `.gitignore`. Não revalidado a contagem exata nesta rodada — reconferir com `git ls-files node_modules | wc -l` antes do Passo 2.

### Camada AIOX a arquivar (tudo untracked no git — mover, não apagar) — não revalidado em detalhe nesta rodada, `.aiox-core/` ainda presente na raiz

- `.aiox-core/` (framework completo)
- `.claude/agents/`: `aiox-analyst.md`, `aiox-architect.md`, `aiox-data-engineer.md`, `aiox-dev.md`, `aiox-devops.md`, `aiox-pm.md`, `aiox-po.md`, `aiox-qa.md`, `aiox-sm.md`, `aiox-ux.md`, `brad-frost.md`, `copy-chief.md`, `cyber-chief.md`, `dan-mall.md`, `data-chief.md`, `dave-malouf.md`, `db-sage.md`, `design-chief.md`, `design-system.md`, `legal-chief.md`, `nano-banana-generator.md`, `oalanicolas.md`, `pedro-valerio.md`, `sop-extractor.md`, `squad-chief.md`, `squad.md`, `story-chief.md`, `tools-orchestrator.md`, `traffic-masters-chief.md`
- `.claude/rules/*` (agent-authority, agent-handoff, agent-memory-imports, coderabbit-integration, handoff-consolidation, ids-principles, mcp-usage, story-lifecycle, tool-examples, tool-response-filtering, workflow-execution)
- `.claude/commands/AIOX`, `.claude/commands/synapse`
- `.claude/skills/AIOX`, `.claude/skills/synapse`
- `.claude/CLAUDE.md` (o atual — será substituído pelo novo no padrão datameet)
- `.claude/hooks/enforce-git-push-authority.cjs`, `.claude/hooks/synapse-engine.cjs`, `.claude/hooks/README.md`

### Skills que NÃO são AIOX — confirmado por leitura do conteúdo, manter/reaproveitar

- `.claude/skills/architect-first` — metodologia genérica de arquitetura-primeiro, reaproveitável.
- `.claude/skills/checklist-runner` — motor genérico de checklist `.md`, reaproveitável.
- `.claude/skills/coderabbit-review` — integração CodeRabbit CLI via WSL, ortogonal ao AIOX.
- `.claude/skills/tech-search` — pesquisa técnica via WebSearch/WebFetch, genérica.
- `.claude/skills/mcp-builder`, `.claude/skills/skill-creator` — têm `LICENSE.txt`, são skills padrão da Anthropic (não fazem parte do AIOX), manter.

### `.gitignore` — já cobre `.claude/settings.local.json`. Nenhuma ação necessária nesse ponto (não revalidado em detalhe nesta rodada).

---

## O que NÃO mexer (fora de escopo / risco)

- Qualquer `git add -A`, `git reset`, `git checkout .` no repo pai ou nos sub-repos — todos têm mudanças não commitadas que precisam sobreviver à reorganização.
- `.obsidian/`, as 4 notas soltas da raiz (`basescholl.md`, `junhomdtl.md`, `Projeto Ivystore.md`), `Integração Obsidian x Claude.md`.
- As 7 pastas sem `.git` próprio já conhecidas (ver tabela acima) e as pastas novas sem `.git` descobertas na revalidação.
- Planilhas grandes (`Controle de Vendas - 2026.xlsx`, `Controle --- 2026.xlsx`, ~20-26MB cada) e contratos (`.docx`/`.pdf`) — só observação registrada, sem ação neste plano.
- A pasta duplicada `vilamill-sistema/00-governance/00-governance/` — parece erro/duplicação, mas não é desta rodada; só reportar se o usuário perguntar.
- `kernel-hq/arquitetura-orbita-whitelabel/` — **não é resquício morto**, é a documentação viva do `kernel/`. Não apagar.
- Os 4 repos novos com `.git` próprio (`lanchonete-sistema`, `lane-confeitaria`, `kernel-foodservice`, `kernelmei`) — não entram em nenhum passo até decisão explícita do usuário.

---

## Checklist de execução

### Passo 1 — Extrair os repos aninhados do escopo aprovado para pastas irmãs

Ordem sugerida: começar pelos 3 sem ambiguidade de gerenciador (`kernel`, `ivsstore-sistema`, `sistema-thieco`), deixar `vilamill-sistema` (ambíguo) por último, após confirmar com o usuário. `orbita-lobo` saiu da lista (descontinuado).

Para cada repo, com `orbita-workspace` como `$BASE` (`/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace`) e destino em `$BASE/../<nome>`:

- [ ] `mv "$BASE/<nome>" "$BASE/../<nome>"` (mv simples preserva `.git` interno e o working tree com as mudanças não commitadas)
- [ ] Dentro do novo local, `cd` e rodar `git status` — deve mostrar exatamente as mesmas mudanças pendentes de antes da mudança de pasta
- [ ] De volta em `$BASE`, checar se o nome da pasta aparecia como arquivos individuais trackeados no repo pai (confirmado nesta revalidação só para `sistema-thieco/**`, 95 arquivos; os outros 3 têm 0) — se sim, `git rm -r --cached <nome>` (fica staged, **não commitar ainda**)
- [ ] Repetir para os 4

### Passo 2 — Destrackear `node_modules`

- [ ] Reconferir `git ls-files node_modules | wc -l` (contagem não revalidada nesta rodada)
- [ ] `git rm -r --cached node_modules` no repo pai (raiz do `orbita-workspace`)
- [ ] Se `.aiox-core/` ainda não foi arquivado (passo 3), rodar também `git rm -r --cached .aiox-core/node_modules` — ou pular, já que arquivar `.aiox-core/` inteiro no passo 3 resolve isso junto
- [ ] Deixar staged junto com o passo 1 — **não commitar ainda**

### Passo 3 — Arquivar a camada AIOX

- [ ] Criar `Desktop/Ops/_archive-aiox-orbita-workspace/` (fora do repo)
- [ ] Mover para lá: `.aiox-core/`, os arquivos de agente AIOX/squad listados na seção "Estado observado", `.claude/rules/`, `.claude/commands/AIOX`, `.claude/commands/synapse`, `.claude/skills/AIOX`, `.claude/skills/synapse`, `.claude/CLAUDE.md` (o atual), `.claude/hooks/enforce-git-push-authority.cjs`, `.claude/hooks/synapse-engine.cjs`
- [ ] Confirmar que `.claude/skills/architect-first`, `checklist-runner`, `coderabbit-review`, `tech-search`, `mcp-builder`, `skill-creator` **permanecem** (não são AIOX)

### Passo 4 — Criar a nova camada enxuta (espelhando datameet-workspace)

- [ ] `repos.list` na raiz:
  ```
  kernel|../kernel
  sistema-thieco|../sistema-thieco
  vilamill-sistema|../vilamill-sistema
  ivsstore-sistema|../ivsstore-sistema
  ```
  (se o usuário decidir incluir os 4 repos novos, somar as linhas correspondentes depois de confirmado)
- [ ] `Makefile` + `scripts/{doctor,bootstrap,check,dev}.sh` no molde do `datameet-workspace`, mas os scripts precisam:
  - Detectar por repo se o `package.json` está na raiz (todos os 4 do escopo aprovado têm) ou em `backend/`+`frontend/` (`sistema-thieco`, `ivsstore-sistema`, `kernel` têm ambos os níveis)
  - Usar `npm` para `sistema-thieco` (backend/frontend) e `ivsstore-sistema`; `yarn` para `kernel`; para `vilamill-sistema`, usar o que o usuário confirmar na pendência abaixo
  - Pular graciosamente (não abortar o batch) quando um script (`lint`/`test`/`check`) não existir no `package.json` do repo
- [ ] `docs/ai/{CONTEXT_ENGINEERING,CONVENTIONS,SUBAGENTS,MCP_POLICY,COMMANDS}.md` adaptados do `datameet-workspace`, com `COMMANDS.md` documentando o contrato repo a repo (já que aqui não é uniforme como no datameet)
- [ ] `.claude/agents/`: começar com `engineer.md` (genérico, cobre as stacks Node/Express/Prisma/Vite dos repos) e `code-reviewer.md`. Não recriar os ~25 agentes do AIOX.
- [ ] `.claude/skills/`: `gitflow`, `pull-request`, `workspace-contract` (adaptados do datameet-workspace com os nomes de repo trocados). Skills de padrão por repo, só sob demanda.
- [ ] `.claude/hooks/` + `settings.json` novos: format/lint + pre-commit-check apontando para `make check`; `permissions.allow` restrito a `make/yarn/npm/git/gh`
- [ ] Espelhar em `.cursor/skills/` e `.codex/agents/` + `.agents/skills/` (mesma lógica do datameet-workspace) — `.gemini`, `.kimi`, `.antigravity` ficam fora, não fazem parte deste padrão
- [ ] `CLAUDE.md`/`AGENTS.md` novos na raiz, resumindo comandos + fluxo obrigatório
- [ ] Conferir `.gitignore` depois de tudo — remover eventuais entradas de pastas que deixaram de existir na raiz

### Passo 5 — Confirmar que o Obsidian não foi tocado

- [ ] `.obsidian/`, as 4 notas da raiz e `Integração Obsidian x Claude.md` continuam exatamente onde estavam (checagem simples de `ls`)
- [ ] Comunicar ao usuário (não é ação): cada repo extraído (`sistema-thieco`, `vilamill-sistema`, `kernel`) já pode ser aberto como vault Obsidian independente via seu próprio `docs/`, como o Método 1 do guia recomenda

---

## Pendências que exigem resposta do usuário antes de fechar o Passo 1/4 por completo

1. **`vilamill-sistema`**: tem `yarn.lock` e `package-lock.json` coexistindo na raiz — qual é o gerenciador real em uso hoje? *(pendência original, ainda não resolvida)*
2. **`sistema-thieco`**: agora tem `yarn.lock` coexistindo com `package-lock.json` dentro de `backend/` e `frontend/` também (não só na raiz, como achado na análise original) — confirmar se o `npm` continua sendo o gerenciador real antes de escrever o script de check/bootstrap.
3. **Os 4 repos novos** (`lanchonete-sistema`, `lane-confeitaria`, `kernel-foodservice`, `kernelmei`) entram no `repos.list`/Passo 1 desta rodada, ou ficam fora por enquanto?

## Verificação final

- Em cada repo extraído: `git status` e `git log -1` mostram o mesmo estado de antes (histórico e mudanças não commitadas intactas)
- No repo pai: `git status` não lista mais arquivos dentro das pastas extraídas nem dentro de `node_modules/`
- `make doctor` novo roda sem erro e lista os repos habilitados no `repos.list`
- `make bootstrap` e `make check` rodam por repo, pulando graciosamente onde o script não existir
- Abrir o vault Obsidian da raiz e confirmar que as 4 notas continuam aparecendo

---

_Plano gerado em sessão de análise via Claude Code (datameet-workspace → orbita-workspace) em 2026-07-17. Revalidado e atualizado em 2026-08-10 dentro do próprio `orbita-workspace`: `orbita-lobo` removido do escopo (descontinuado, docs órfãs apagadas), `sistema-orbita-whitelabel` atualizado para `kernel` (rename), 4 novos repos aninhados descobertos e registrados como pendência de decisão. Pendente de execução, aguardando autorização passo a passo dentro deste próprio repo._
