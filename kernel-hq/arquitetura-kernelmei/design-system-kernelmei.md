---
status: draft
domain: kernelmei
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Design System — KernelMei

> **Escopo deste documento.** Diferente de um design system de sistema single-tenant, aqui o objeto não é "a paleta do produto" — é o **mecanismo pelo qual cada tenant tem a sua**. Só isso está evidenciado no código (`src/app/globals.css`, `src/lib/theme.ts`, `src/app/layout.tsx`). Princípios de design, tipografia e voz **não existem** no repositório e não foram inventados aqui.

## 1. O princípio central: nome de token estável, valor variável

O sistema resolve branding por tenant sem tocar em nenhuma classe de componente. O comentário no `globals.css` enuncia a regra:

> *"as classes Tailwind abaixo nunca mudam de nome, só o valor por trás delas muda por tenant"*

Um componente escreve `text-brand-rose` uma vez e serve todas as confeitarias. Nenhum componente lê `Tenant.branding`; nenhum componente tem cor condicional.

---

## 2. Os três níveis do token

```
1. Tailwind (@theme inline, globals.css)
   --color-brand-rose: var(--tenant-rose, #e3a9b5)
                        └── camada 2 ──┘  └─ camada 3 ─┘

2. CSS custom property escrita em runtime (src/app/layout.tsx)
   style={{ "--tenant-rose": branding.corPrimaria }}

3. Fallback de fábrica — usado quando a camada 2 não escreve nada
```

A elegância está na camada 3: `brandingParaCssVars()` **só escreve a variável se o tenant configurou aquela cor**. Não há valor default no JavaScript, não há merge de objeto de tema, não há `?? DEFAULT_COLOR` espalhado. O `var(..., fallback)` do CSS cobre sozinho. Um tenant que configurou só a cor primária herda todo o resto do tema de fábrica, sem uma linha de código a mais.

---

## 3. Tokens de marca

| Token Tailwind | Variável de tenant | Fallback de fábrica |
|---|---|---|
| `brand-rose` | `--tenant-rose` | `#e3a9b5` |
| `brand-rose-light` | `--tenant-rose-light` | `#e8aeb8` |
| `brand-rose-vivid` | `--tenant-rose-vivid` | `#f06fa0` |
| `brand-cream` | `--tenant-cream` | `#ede8d0` |
| `brand-cream-light` | `--tenant-cream-light` | `#f0ebda` |
| `brand-gold` | `--tenant-gold` | `#c9a227` |
| `brand-ink` | `--tenant-ink` | `#1a1a1a` |
| `brand-brown` | `--tenant-brown` | `#4a2c1d` |

**O tema de fábrica é a paleta real da Confeitaria Artesanal da Lane.** O comentário do `globals.css` diz isso literalmente: *"tema 'de fábrica', herdado da paleta real da Confeitaria Artesanal da Lane"*.

> **Ponto de atenção de produto.** Um whitelabel cujo default visual é a marca de uma cliente específica significa que toda confeitaria nova, antes de configurar branding, se parece com a Lane. Não há registro no código de que isso tenha sido avaliado como decisão consciente ou aceito como provisório. **Vale confirmar com o Willians** se o tema de fábrica deveria ser neutro. Ver [[registro-de-decisoes-kernelmei]].

---

## 4. Superfície configurável por tenant

`TenantBranding` (`src/types/next-auth.d.ts`) declara cinco campos:

| Campo | Efeito hoje |
|---|---|
| `corPrimaria` | escreve `--tenant-rose` **e** `--tenant-rose-vivid` |
| `corFundo` | escreve `--tenant-cream` **e** `--tenant-cream-light` |
| `corDourado` | escreve `--tenant-gold` |
| `logoUrl` | **declarado, nunca consumido** — nenhum componente renderiza logo |
| `slogan` | **declarado, nunca consumido** |

Dois detalhes reais do mapeamento:

- **Um campo alimenta dois tokens.** `corPrimaria` sobrescreve tanto o rosa suave quanto o rosa vívido com o **mesmo valor**, colapsando uma distinção que o tema de fábrica faz (`#e3a9b5` vs `#f06fa0`). O mesmo vale para `corFundo`. Um tenant customizado perde essa gradação — provavelmente aceitável para reduzir o formulário de onboarding a três cores, mas é uma perda real de nuance, não um detalhe de implementação.
- **`--tenant-ink` e `--tenant-brown` não são configuráveis.** Texto e marrom são sempre os de fábrica, mesmo com branding completo.

---

## 5. Onde o tema é aplicado

`src/app/layout.tsx` (raiz) resolve o branding a partir da sessão e aplica as variáveis no elemento raiz — o que faz o tema valer inclusive para `/login` e `/admin`, não só para as telas de tenant.

**Dívida de documentação encontrada:** o comentário do `globals.css` aponta para `src/components/TenantThemeProvider.tsx`. **Esse arquivo não existe.** A lógica vive em `src/lib/theme.ts`, aplicada no `layout.tsx`. Provável renomeação sem atualização do comentário — inofensiva, mas induz a erro em leitura futura.

---

## 6. Componentes existentes

Inventário factual, sem juízo de completude. 13 componentes em 4 famílias:

| Família | Componentes |
|---|---|
| `layout/` | `AppShell` (cabeçalho, nav dupla `sm:`/mobile, logout) |
| `crm/` | `KanbanBoard`, `PedidoCard`, `PedidoForm`, `AtendimentoCard`, `EtiquetaAtendimentoHumano` |
| `configuracoes/` | `FilasManager`, `CardapioManager` |
| `admin/` | `AdminDashboard`, `AdminSidebar`, `AdminTenantsPanel`, `AdminUsersPanel`, `AdminLogsPanel`, `NovoTenantForm` |

Helpers de apresentação: `src/lib/currency.ts` (`formatarReal`) e `src/lib/utils.ts` (`cn`).

**Observação de arquitetura visual:** o `/admin` usa um layout próprio com `AdminSidebar`, distinto do `AppShell` de tenant — coerente com a separação de sessões descrita em [[arquitetura-kernelmei]]. Os painéis do `/admin` são os únicos consumidores de SWR e são os únicos componentes que buscam dado no cliente.

---

## 7. O que este documento não cobre — e por quê

Não há no repositório: princípios de design declarados, escala tipográfica (o `body` usa `Arial, Helvetica, sans-serif`, embora `--font-geist-sans` esteja declarado no `@theme`), escala de espaçamento, guia de voz e tom, estados de componente documentados, ou qualquer arquivo de brand context como o `docs/brand/brand-context.md` do lane-confeitaria.

Documentar isso exigiria inventar, o que o Artigo IV proíbe. Um `ui-kit-kernelmei` e um `ux-flows-kernelmei` também ficaram de fora por razão adicional: com 4 das 7 telas do menu ainda inexistentes, qualquer inventário ou jornada documentada agora estaria desatualizada na próxima sessão. Ambos estão registrados como backlog em [[indice-kernelmei]].

---

## Links relacionados

[[indice-kernelmei]] — mapa completo dos artefatos do sistema
[[prd-kernelmei]] — produto, usuário e escopo
[[arquitetura-kernelmei]] — onde o branding se encaixa nas camadas
[[design-system-lane-confeitaria]] — design system do sistema de origem, com os tokens que viraram o tema de fábrica daqui
