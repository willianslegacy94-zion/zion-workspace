---
status: draft
domain: kernelmei
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Índice — KernelMei

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/arquitetura-kernelmei/` com sufixo `-kernelmei`.
Código-fonte real em `kernelmei/` (fora do Obsidian).

**O que é o KernelMei:** whitelabel multi-tenant para confeitarias/doceiras. Mesmo domínio de negócio do [[indice-lane-confeitaria|lane-confeitaria]] (CRM em funil, agenda de produção, financeiro/CMV), reconstruído para várias clientes no mesmo código-base e no mesmo banco, com marca e módulos por tenant e um painel de onboarding próprio.

---

## Aviso de leitura — esta documentação é retroativa

Os artefatos abaixo foram escritos **a partir do código**, em 2026-08-10, não antes dele. O repositório não tem PRD, README, story nem commit message — **o git local tem zero commits**. A única fonte de intenção são os comentários de código, que neste projeto explicam rationale e não apenas mecânica.

Onde a intenção não era evidenciável, está marcado como pendente de confirmação do Willians, nunca preenchido por dedução (Artigo IV — No Invention). As 8 pendências abertas estão consolidadas no final de [[registro-de-decisoes-kernelmei]].

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-kernelmei]] | As 6 perguntas respondidas retroativamente, com rastreio por arquivo — e a seção do que o threshold **não** conseguiu responder (o significado de "Mei", a existência de cliente real, a relação com o lane-confeitaria) |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-kernelmei]] | @pm | Contexto de whitelabel nascendo de um sistema single-tenant, problema de escala por instalação, dois perfis de usuário (confeiteira e SuperAdmin), escopo entregue vs. lacunas reais, e métricas derivadas das garantias verificáveis do código |
| [[requisitos-funcionais-kernelmei]] | @pm | 60 RFs em 9 módulos + 8 RNFs, cada um marcado como **OK** (fim a fim), **S/T** (service pronto, sem tela) ou **STUB** — 38 OK, 18 sem tela, 4 stub/não portados |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-kernelmei]] | @architect | Stack (Next.js 16 + Prisma 7 + PostgreSQL + NextAuth v5 + `jose`), herança dupla (lane-confeitaria + kernel-foodservice), camadas, o Prisma Extension de isolamento e por que ele existe, sessões duplas, feature flags, observabilidade, Docker multi-stage, e a seção 9 com as lacunas técnicas reais |
| [[modelo-de-dados-kernelmei]] | @data-engineer | 19 entidades e 5 enums, a heurística de quem carrega `tenantId` e por quê, atributos das entidades de plataforma, o que difere do lane, índices compostos, regras de cálculo puras e ciclo de vida do tenant |

---

## Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente | O que cobre |
|---|---|---|
| [[design-system-kernelmei]] | @ux-design-expert | O mecanismo de branding por tenant (token estável, valor variável), os 3 níveis do token com fallback de fábrica, os 8 tokens de marca, a superfície configurável e seus limites, e o inventário das 4 famílias de componentes |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-kernelmei]] | @pm / todos | 15 decisões reconstruídas a partir de comentários de código (schema nascendo multi-tenant, isolamento por extension motivado por 2 bugs reais no kernel-foodservice, kill-switch em vez de exclusão, sessão de admin fora do NextAuth, provisionamento transacional, integração meia-ponte com o Quasar) + **8 pendências que exigem decisão do Willians** |

---

## Ordem de leitura recomendada

```
system-creation-kernelmei
        ↓
   prd-kernelmei
        ↓
requisitos-funcionais-kernelmei
        ↓
arquitetura-kernelmei  ←→  design-system-kernelmei
        ↓
modelo-de-dados-kernelmei
        ↓
registro-de-decisoes-kernelmei (atualização contínua)
```

Quem só tem 5 minutos: [[registro-de-decisoes-kernelmei]], seção "Pendências que exigem decisão do Willians".

---

## Estado real do sistema (2026-08-10)

| Dimensão | Estado |
|---|---|
| Fundação multi-tenant | **Completa e verificada** — isolamento provado por `scripts/verificar-isolamento.ts`, kill-switch testado |
| Painel de plataforma (`/admin`) | Funcional — provisionar, ativar/desativar, redefinir senha, logs de erro |
| Camada de serviço | Praticamente completa — 17 services, 8 módulos de Server Actions |
| Interface de tenant | **Parcial** — `/crm`, `/clientes` e `/configuracoes` existem; `/dashboard`, `/agenda`, `/financeiro` e `/projecao` estão no menu e **não têm página** |
| Versionamento | **Zero commits, sem remote** — código em cópia única, numa máquina só |
| Deploy | Nunca — sem VPS, sem domínio, sem tenant real |
| Testes | **Nenhum** — Vitest instalado, `npm test` mapeado, zero arquivos de teste |

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-kernelmei  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-kernelmei  ←  RF muda de estado (S/T vira OK, por exemplo)
  - arquitetura-kernelmei            ←  decisão técnica estrutural
  - modelo-de-dados-kernelmei        ←  entidade ou campo alterado no schema Prisma
  - design-system-kernelmei          ←  token ou mecanismo de branding alterado
```

---

## Próximos artefatos a criar (backlog de governança)

| Artefato | Quando criar |
|---|---|
| `ui-kit-kernelmei` | Quando as 4 telas faltantes existirem. Hoje um inventário cobriria menos da metade do produto e ficaria desatualizado na sessão seguinte |
| `ux-flows-kernelmei` | Mesma condição. Documentar jornadas com 4 de 7 destinos em 404 exigiria supor o fluxo pretendido — proibido pelo Artigo IV |
| `playbook-devops-kernelmei` | No primeiro deploy real. O `docker-compose.yml` já traz a lição do lane sobre `build migrate` antes do `run`; o playbook consolida o resto |
| Estratégia de teste documentada | Quando existir o primeiro teste. As funções puras (`precificacaoService`, `faixaDePeso`, `dataMinimaEntrega`, `resolveFeatures`) são o alvo de maior retorno |
| Contrato da integração multi-tenant com o Quasar | Quando o padrão `buscar_tenant_whitelabel` for construído do lado do Quasar — hoje `classificarDesistencia` sempre devolve `INDEFINIDO` |
| Registro do primeiro tenant real | Quando houver cliente de verdade. Os únicos tenants que o código já criou foram `verif-a-*`/`verif-b-*`, apagados ao final do script |

---

## Links relacionados

[[folder-purpose]] — registro desta pasta na estrutura do kernel-hq
[[ecosystem-guide]] — posição do KernelMei no ecossistema
[[indice-lane-confeitaria]] — sistema de origem da regra de negócio
[[system-creation-threshold]] — as 6 perguntas na sua forma canônica
