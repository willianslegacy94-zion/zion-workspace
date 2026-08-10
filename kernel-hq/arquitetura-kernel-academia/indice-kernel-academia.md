---
status: draft
domain: kernel-academia
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Índice — Kernel Academia

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/arquitetura-kernel-academia/` com sufixo `-kernel-academia`.
Código-fonte real em `Kernel Workspace/kernel-academia/` (fora do Obsidian) — **sem `.git`, não versionado nem no monorepo pai, nunca deployado**.

> **Não confundir com [[arquitetura-academiasandro]].** São dois sistemas diferentes: `academia-sandro` é o sistema em produção de **um** cliente real (Centro de Treinamento Sandro Freire); `kernel-academia` é o produto whitelabel multi-tenant derivado dele, sem cliente real ainda. Documentação reconstruída a partir do código em 2026-08-10, não de um kickoff.

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-kernel-academia]] | As 6 perguntas respondidas retroativamente por leitura do código; origem dupla (domínio de `academia-sandro` + padrão whitelabel de `kernel-foodservice`); tabela comparativa "não confundir"; 4 perguntas abertas para o Willians |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | O que cobre |
|---|---|
| [[prd-kernel-academia]] | Contexto (de sistema de um cliente a produto whitelabel), problema, objetivo, dois públicos (operador da plataforma + academia cliente), hipótese, escopo, métricas propostas |
| [[requisitos-funcionais-kernel-academia]] | 51 RFs em 10 módulos: plano de controle da plataforma, multi-tenancy/branding/features, auth, alunos, agenda, financeiro (parcelas), preços/pacotes, portal do aluno, captação pública por slug, observabilidade/notificações |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | O que cobre |
|---|---|
| [[arquitetura-kernel-academia]] | Stack, herança dupla (academia-sandro + kernel-foodservice), camadas do sistema, modelo de multi-tenancy, fluxos de dados, integrações, fronteiras de segurança, estratégia de escala, **8 bloqueantes pro primeiro cliente real** (o mais grave: marca do cliente de origem — Centro de Treinamento Sandro Freire — vazada em texto de consentimento LGPD e mensagens de WhatsApp do produto whitelabel), histórico de versão |
| [[modelo-de-dados-kernel-academia]] | 16 models herdados de `academia-sandro` + `tenantId` em 15 deles, entidades `Tenant`/`SuperAdmin` novas, regras de cálculo herdadas, lacunas de modelo |

---

## Lacunas de artefato (sem Camada 3/4 ainda)

`design-system-`, `ui-kit-`, `ux-flows-kernel-academia` **não foram criados** — UI herdada do `academia-sandro` sem mudança visual documentada além de `Tenant.branding` (slogan, logo, cor primária, cor de fundo). Criar se/quando a modulação de UI exigir decisão de design própria.

---

## Governança — Memória viva do sistema

| Documento | O que cobre |
|---|---|
| [[registro-de-decisoes-kernel-academia]] | Decisões reconstruídas por `mtime` + nome de migration (sem histórico de commit) — do scaffold em 2026-07-10 até a criação desta documentação |

---

## Ordem de leitura recomendada

```
system-creation-kernel-academia
        ↓
   prd-kernel-academia
        ↓
requisitos-funcionais-kernel-academia
        ↓
arquitetura-kernel-academia
        ↓
modelo-de-dados-kernel-academia
        ↓
registro-de-decisoes-kernel-academia (atualização contínua)
```

---

## Próximos artefatos a criar / decisões pendentes (backlog de governança)

| Item | Quando resolver |
|---|---|
| **Marca do Sandro Freire vazada no produto whitelabel** (title/description, termo LGPD, mensagens WhatsApp, `EVOLUTION_INSTANCE_NAME` default) | Bloqueante crítico — antes de qualquer tenant real além do demo |
| Instância de WhatsApp única compartilhada entre tenants | Mesmo risco já registrado em [[arquitetura-kernel-foodservice]] (R1) — padrão repetido em 3 sistemas da família `kernel*` |
| `/api/cron/limpar-comprovantes` sem autenticação; comprovantes em `public/` sem controle de acesso | Antes de qualquer dado real de aluno/pagamento |
| Primeiro commit no git local | Projeto inteiro sem versionamento — qualquer perda de disco perde tudo |
| Existe cliente real na fila, ou é produto de prateleira? | Pergunta 2 do threshold, sem resposta no código |
| `academia-sandro` migra pra cá ou os dois convivem para sempre? | Decisão de produto/negócio, não técnica |
| Registrar formalmente a família `kernel*` (`kernel/`, `kernel-academia/`, `kernel-foodservice/`, `kernelmei/`) em algum documento — hoje só existe implicitamente nos comentários de cada repo | `folder-purpose.md`/`ecosystem-guide.md` já cobrem cada sistema individualmente; falta a visão de família |
| Precificação do vertical academia | `kernel-hq-arquitetura/06-precificação-Kernel.md` só cobre o nicho de barbearia |

---

## Links relacionados

[[arquitetura-academiasandro]] — sistema de origem do domínio de negócio (cliente real, não confundir)
[[arquitetura-kernel-foodservice]] — origem do padrão whitelabel (Tenant/SuperAdmin/ErrorLog/login global)
[[arquitetura-kernel]] — produto Kernel original, raiz de toda a família de verticais
[[arquitetura-kernelmei]] — outro vertical da família `kernel*`, mesmo movimento aplicado à confeitaria
