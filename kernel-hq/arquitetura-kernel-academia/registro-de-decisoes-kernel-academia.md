---
status: draft
domain: kernel-academia
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Registro de Decisões — Kernel Academia

Decisões cronológicas com o que mudou, por que, e o impacto. Entradas novas sempre **no final** do arquivo (ver [[system-rules]], seção `ordem-de-entradas-em-logs`).

> **Fonte primária deste registro é atípica.** O repositório `kernel-academia/` não tem `.git` — não existe commit, mensagem, PR ou issue pra reconstruir decisão nenhuma. As datas abaixo vêm de `mtime` de arquivo e de nome de migration (aproximação, não histórico auditável), cruzadas com comentários de código e com o `.env`, que aqui é incomumente explícito sobre riscos (ex.: o aviso duplicado pra nunca apontar pro Supabase do `academia-sandro`). Onde não havia evidência, não há decisão registrada — só o fato observado.

---

## 2026-07-10 — Scaffold criado, README nunca editado

`mtime` de `README.md`, `AGENTS.md`, `eslint.config.mjs`, `tsconfig.json` e `postcss.config.mjs` marca o nascimento do projeto como `create-next-app` padrão. O `README.md` permanece o boilerplate original até a data desta documentação (2026-08-10) — nenhuma linha própria do projeto foi escrita nele.

**Impacto:** sem README próprio, a única fonte de contexto sobre o projeto sempre foi o código em si — reforça por que esta documentação precisou ser reconstruída por leitura, não por captura de intenção original.

---

## 2026-08-03 — Infraestrutura de container

`Dockerfile` multi-stage e `.dockerignore` adicionados. Sem comentário explicando a escolha específica de porta ou stage — segue o mesmo padrão multi-stage (deps → builder → runner) já usado em outros sistemas Next.js do workspace (ver [[arquitetura-kernel-foodservice]], [[arquitetura-kernelmei]]).

---

## 2026-08-09 — Schema nasce multi-tenant, sem estágio single-tenant neste repositório

Migration `20260809120232_init_multitenant` cria `tenants`, `super_admins` e `tenantId` em todas as tabelas de negócio numa única migration — o mesmo padrão já registrado em [[registro-de-decisoes-kernelmei]] e [[registro-de-decisoes-kernel-foodservice]] (irmãos da família `kernel*`).

**Por quê (inferido pelo padrão repetido nos 3 sistemas, sem comentário específico neste repo):** nascer multi-tenant elimina a janela de backfill arriscado que um retrofit exigiria.

**Mesmo dia, migration `20260809195433_error_logs`:** captura automática de erro por tenant via `onRequestError`, implementada em `instrumentation-node.ts` separado — comentário do código explica que isso evita puxar o Prisma Client pro bundle de Edge Runtime, restrição conhecida do Next.js.

**Mesmo dia, `docker-compose.yml` na forma atual:** Postgres local próprio (porta 5441, container `kernel-academia-db`), app em loopback (3012), rede externa `orbita_shared`, volume de comprovantes, serviços one-off `migrate`/`seed`. O `.env` ganhou o aviso duplicado: *"NUNCA aponte isso pro Supabase de produção do academia-sandro — schema incompatível (multi-tenant) e dado real de aluno/pagamento em jogo."*

**Impacto:** a separação de banco entre `kernel-academia` (Postgres local, Docker) e `academia-sandro` (Supabase, produção real) é uma decisão de segurança deliberada e explícita, não incidental — o próprio `.env` documenta o risco que essa separação previne.

---

## 2026-08-10 — Criação desta documentação; achado o vazamento de marca do cliente de origem

Pasta `arquitetura-kernel-academia/` criada por leitura completa do código, sem acesso a histórico de commit. Registrados **8 bloqueantes** pro primeiro cliente real (ver [[arquitetura-kernel-academia]] §9), em ordem de gravidade — o mais grave, não presente nos outros sistemas da família `kernel*`:

**Marca do Centro de Treinamento Sandro Freire vazada no produto whitelabel.** `layout.tsx` (title/description), `TermosAceite.tsx` (texto de consentimento LGPD), as 4 mensagens de `src/lib/whatsapp.ts` e o valor default de `EVOLUTION_INSTANCE_NAME` citam "Centro de Treinamento Sandro Freire" / `academia-sandro` diretamente. Como este é um fork copiado do sistema do Sandro (domínio herdado, ver [[system-creation-kernel-academia]]), esses textos nunca foram generalizados. **Risco concreto:** um lead de um tenant diferente assinaria um termo de consentimento LGPD identificando a academia errada, e receberia cobrança/mensagem assinada com a marca de outro negócio.

**Pendências que exigem decisão do Willians, sem as quais este documento não sai de `status: draft`:**
1. Corrigir o vazamento de marca do Sandro Freire antes de qualquer tenant além do demo (bloqueante crítico, não é débito técnico comum)
2. Existe cliente real na fila, ou este é produto de prateleira sem cliente definido?
3. `academia-sandro` vai migrar pra este sistema, ou os dois vão conviver permanentemente como produtos separados?
4. Instância de WhatsApp única compartilhada entre tenants (mesmo risco R1 já registrado em [[registro-de-decisoes-kernel-foodservice]]) — aceitável pro primeiro cliente, ou bloqueia?
5. Se `git init` + primeiro commit deve acontecer antes de qualquer mudança nova no código — hoje uma perda de disco apaga o projeto inteiro sem recuperação possível

---

## Links relacionados

[[system-creation-kernel-academia]] — threshold e as 4 perguntas abertas
[[arquitetura-kernel-academia]] — os 8 bloqueantes referenciados acima, em detalhe técnico
[[indice-kernel-academia]] — mapa completo dos artefatos
