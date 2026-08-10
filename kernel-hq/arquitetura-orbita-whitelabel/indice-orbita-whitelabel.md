---
status: stable
domain: orbita-whitelabel
source: claude
created: 2026-06-24
updated: 2026-08-03
owner: willians
---

# Índice — Sistema Orbita Whitelabel (produto: Kernel)

> Ponto de entrada para toda a documentação técnica do produto.

---

## O que é este sistema

**Sistema Orbita** é um produto SaaS whitelabel de gestão de caixa e comissões para estabelecimentos de serviços (barbearias, salões, clínicas, e similares). Um único código-base serve múltiplos clientes com branding, terminologia e módulos configurados por variáveis de ambiente — sem hardcode de regras de negócio específicas.

O sistema nasce do `sistema-thieco` (instância real da Barbearia Thieco Leandro) e é generalizado como produto de prateleira.

---

## Camada 1 — O quê

| Documento | Pergunta respondida |
|---|---|
| [[prd-orbita-whitelabel]] | O que é o produto, para quem, quais problemas resolve? |
| [[requisitos-funcionais-orbita-whitelabel]] | O que o sistema faz, módulo a módulo? |

---

## Camada 2 — Como sustenta

| Documento | Pergunta respondida |
|---|---|
| [[arquitetura-orbita-whitelabel]] | Como os componentes se conectam? Qual é o stack e o fluxo de dados? |
| [[modelo-de-dados-orbita-whitelabel]] | Quais entidades existem? Quais são seus atributos e relacionamentos? |

---

## Camada 3 — Como aparece

| Documento | Pergunta respondida |
|---|---|
| [[design-system-orbita-whitelabel]] | Quais são os tokens visuais e o sistema de branding por tenant? |

---

## Camada 4 — Funciona?

| Documento | Pergunta respondida |
|---|---|
| [[registro-de-decisoes-orbita-whitelabel]] | Por que o sistema é como é? Quais mudanças aconteceram e por quê? |

---

## Trabalho em andamento

| Documento | Pergunta respondida |
|---|---|
| [[backlog-tarefas-orbita-whitelabel]] | O que falta pra terminar a migração multi-tenant/Supabase em curso? Status fase a fase. |

---

## Ordem de leitura recomendada

```
prd ──→ requisitos-funcionais ──→ arquitetura ──→ modelo-de-dados
                                                       │
                                            registro-de-decisoes
```

**Onboarding de novo cliente:** leia o PRD → requisitos-funcionais → `onboarding-novo-cliente.md` (kernel-hq).

**Implementar nova feature:** leia os requisitos-funcionais → arquitetura → modelo-de-dados → registro-de-decisoes.

**Debug de bug:** leia arquitetura → modelo-de-dados.

---

## Fluxo de atualização

Toda mudança no sistema deve refletir nos documentos:

```
código alterado
      │
      ├── regra nova/mudada?       → requisitos-funcionais
      ├── estrutura de dados nova? → modelo-de-dados
      ├── componente/fluxo novo?   → arquitetura
      ├── decisão de design nova?  → registro-de-decisoes
      └── novo módulo visual?      → design-system
```

---

## Diferença em relação ao sistema-thieco

| Aspecto | sistema-thieco | sistema-orbita-whitelabel |
|---|---|---|
| Clientes | 1 (Barbearia Thieco Leandro) | N clientes por deploy — **1 banco compartilhado** (multi-tenant real, `tenant_id` em toda tabela, desde 2026-07-10) |
| Unidades | Tambore + Mutinga (hardcoded) | `UNIDADE_PADRAO` só faz o bootstrap inicial — CRUD completo desde 2026-07-28 (`routes/unidades.js` + aba "Unidades" em Configurações, admin-only): criar, editar nome, ativar/inativar; `useUnidades()` no front busca a lista real em vez de fallback estático |
| Terminologia | "Barbeiro", "Barbearia" | Mapa de labels por nicho (barbearia / salao / clinica / generico) — ainda build-time (`VITE_NICHO`), um valor por deployment |
| Taxas de pagamento | PagBank — específicas por unidade | Configuráveis por unidade desde 2026-07-28 — coluna `unidades.taxas` (JSONB), `calcularValorLiquido()` lê por `tenant_id`+`unidade` (antes: chave string tenant-wide em `configuracoes`) |
| Módulos | Todos sempre ativos | Feature flags — cada tenant ativa só o que usa, guardadas em `tenants.features` (JSONB) e resolvidas **em runtime no login**, embutidas no JWT |
| Branding | Visual fixo | Guardado em `tenants.branding` (JSONB), resolvido **em runtime** via `GET /public/tenants/:slug` (URL `/t/:slug`) — não mais build-time |
| Dados históricos | 8.580 vendas reais importadas | Banco limpo — cliente novo começa do zero. A Thieco permanece permanentemente no `sistema-thieco` — não há plano de migrá-la para este sistema, esse banco multi-tenant é só para clientes novos |
| Comissão do dono | Thieco = 0% (hardcoded) | Qualquer profissional com `percentual_comissao = 0` |
| Onboarding de cliente novo | — | Painel Admin (`/admin`, desde 2026-08-02) — tela própria, auth separada, não é mais `INSERT` manual. Não sobe infraestrutura nova |
| Motor de Agendamento / Campanhas / Notificações avançadas | Rotas públicas escopadas só por `unidade` (2 valores hardcoded); templates com `NOME_BARBEARIA` fixo; taxas/remetente WhatsApp em chaves string na tabela `configuracoes` | Paridade de funcionalidade desde 2026-07-13 (ver [[registro-de-decisoes-orbita-whitelabel]]) — rotas públicas escopadas por `tenantSlug` + `unidade`; `{nome_barbearia}` resolvido de `tenants.nome`; remetente WhatsApp/link de avaliação viram coluna de `unidades`; cron itera todos os tenants ativos |
| Atendimento via WhatsApp + IA (Cortex/Quasar) | Instância Evolution API `{prefixo}-{canal}`, tenant fixo em dicionário Python (`INSTANCIA_ADMIN_POR_TENANT`); conexão direta ao Postgres (`THIECO_DATABASE_URL` + role `cortex_readonly`) | Paridade desde 2026-07-28 (ver [[registro-de-decisoes-orbita-whitelabel]]) — instância `{tenantSlug}-{unidadeSlug}`, resolvida dinamicamente via `GET /internal/resolve-instancia`; nenhuma conexão direta ao Postgres, tudo mediado por `routes/internal.js` com `authenticateInternal`; FAQ do Quasar vem de `unidades.atendimento_ia` (JSONB), editável pelo admin do tenant |
