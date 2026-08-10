---
status: stable
domain: kernel
source: claude
created: 2026-06-24
updated: 2026-07-10
owner: willians
---

# Design System — Sistema Orbita Whitelabel

> Referência: [[arquitetura-kernel]]

---

## Filosofia

O design system do Orbita é baseado em **tokens CSS custom properties** injetados em `:root` via `frontend/src/lib/theme.js`. Nenhuma cor específica de cliente é hardcoded nos componentes — tudo passa pelos tokens `--cor-*` consumidos via classes Tailwind (`gold`, `onix`, `surface`) definidas em `tailwind.config.js`.

Desde 2026-07-10 (ver [[registro-de-decisoes-kernel]]), os valores de origem não vêm mais de `VITE_COR_*` no build — vêm de `tenants.branding` (JSONB no banco), buscado em runtime via `GET /public/tenants/:slug` e passado como argumento pra `applyTenantTheme(modo, branding)`. No primeiro paint (antes do fetch resolver), usa-se um branding neutro (`BRANDING_PADRAO`) — mesma paleta de fábrica descrita abaixo.

Duas fontes possíveis para os tokens (ver [[arquitetura-kernel]] § Sistema de Tema):
1. **Paleta de fábrica** — sem nenhuma cor customizada em `tenants.branding`, os valores vêm de 24 constantes hex exatas em `theme.js` (idênticas ao sistema-thieco original).
2. **Paleta personalizada** — com `corPrimaria`/`corFundo`/`corSuperficie` configurados em `tenants.branding`, os valores são derivados por `lighten()`/`darken()` sobre as 3 cores base do tenant.

---

## Paleta de fábrica (identidade visual padrão, sem customização)

Valores exatos usados quando o tenant não configurou nenhuma cor em `tenants.branding`. Nunca alterar sem entender que isso muda a identidade visual de todo cliente que não personalizou.

### Modo escuro (padrão ao abrir pela 1ª vez)

| Token CSS | Hex | Uso |
|---|---|---|
| `--cor-fundo` | `#0F0E0A` | Background da aplicação |
| `--cor-superficie` | `#161410` | Superfície base (sidebar, header) |
| `--cor-onix-50` | `#2A2820` | Onix claro |
| `--cor-onix-100` | `#1E1C16` | Onix médio |
| `--cor-surface-card` | `#1C1A14` | Fundo de card (`card-premium`) |
| `--cor-surface-hover` | `#242018` | Hover de card, fundo de input (`input-dark`) |
| `--cor-surface-border` | `#2E2A1E` | Bordas |
| `--cor-primaria` (gold) | `#D4AF37` | Dourado — botões, destaques, ícones ativos |
| `--cor-primaria-light` (gold-light) | `#F0E6C8` | Texto sobre fundo dourado, tons claros |
| `--cor-primaria-dark` (gold-dark) | `#C9A227` | Bordas/gradiente do dourado |
| `--cor-primaria-muted` (gold-muted) | `#9C7B1E` | Labels, texto secundário sobre fundo escuro |
| `--cor-primaria-shine` (gold-shine) | `#F5D76E` | Brilho/gradiente animado |

### Modo claro

| Token CSS | Hex | Uso |
|---|---|---|
| `--cor-fundo` | `#F7F4EC` | Background creme |
| `--cor-superficie` | `#FFFFFF` | Superfície base |
| `--cor-onix-50` | `#E9E4D5` | Onix claro |
| `--cor-onix-100` | `#DED7C2` | Onix médio |
| `--cor-surface-card` | `#FFFFFF` | Fundo de card |
| `--cor-surface-hover` | `#F1ECDD` | Hover de card, fundo de input |
| `--cor-surface-border` | `#DDD3B8` | Bordas |
| `--cor-primaria` (gold) | `#A9791E` | Dourado aprofundado — mesmo hue, mais escuro pra contraste sobre branco |
| `--cor-primaria-light` (gold-light) | `#D9B65C` | — |
| `--cor-primaria-dark` (gold-dark) | `#8A6117` | — |
| `--cor-primaria-muted` (gold-muted) | `#6E4E12` | — |
| `--cor-primaria-shine` (gold-shine) | `#C9973A` | — |

O dourado é **aprofundado**, nunca trocado por outra cor, no modo claro — mantém a mesma identidade em ambos os modos.

---

## Tokens de tenant (personalização)

Quando o cliente configura pelo menos uma cor em `tenants.branding`, `theme.js` deriva o resto por fórmula a partir de 3 cores base:

| Campo em `tenants.branding` | Aplica em | Fallback se ausente |
|---|---|---|
| `corPrimaria` | `--cor-primaria` (modo claro) | Paleta de fábrica |
| `corPrimariaEscuro` | `--cor-primaria` (modo escuro) | `corPrimaria`, depois paleta de fábrica |
| `corFundo` / `corFundoEscuro` | `--cor-fundo` | Paleta de fábrica |
| `corSuperficie` / `corSuperficieEscuro` | `--cor-superficie` | Paleta de fábrica |

Os demais tokens (`onix-50/100`, `surface-card/hover/border`, `primaria-light/dark/muted/shine`) são sempre derivados de `fundo`/`superficie`/`primaria` via `lighten()`/`darken()` — nunca configuráveis individualmente.

---

## Paleta semântica fixa (não customizável por tenant)

| Cor | Uso |
|---|---|
| `emerald-400/500` | Sucesso, valores positivos, saldo disponível |
| `amber-400/500` | Aviso, combo esgotado, taxa/desconto |
| `red-400/500` | Erro, exclusão, valores negativos, saldo zerado |
| `blue-400/500` | Informativo — combo na fila, ações secundárias |
| `purple-400` | Ícone do módulo de Combos |
| `zinc-400/500` | Texto/estado neutro (ex.: combo encerrado) |

---

## Tipografia

| Fonte | Uso |
|---|---|
| **Playfair Display** (serif) | Títulos de página e seção (`font-serif font-bold`) — identidade premium |
| **Inter** (sans) | Todo o resto — labels, corpo, inputs, botões |

Carregadas via Google Fonts com `media="print" onload="this.media='all'"` (não bloqueia o render inicial no mobile).

| Uso | Classe Tailwind |
|---|---|
| Título de página | `font-serif font-bold text-xl text-gold` |
| Label de campo | `text-[11px] text-gold-muted uppercase tracking-wider` |
| Valor financeiro | `text-sm font-bold text-gold tabular-nums` |
| Texto de corpo | `text-sm text-gold-light` |
| Texto de apoio | `text-[10px] text-gold-muted/60` |

---

## Componentes base

Classes utilitárias definidas em `frontend/src/index.css` (camada `@layer components`), consumindo os tokens `--cor-*` via Tailwind:

### Card
```css
.card-premium {
  @apply bg-surface-card rounded-xl border border-surface-border shadow-card transition-all duration-300;
}
.card-premium:hover { @apply border-gold-muted shadow-gold-sm; }
```

### Botão primário (dourado)
```css
.btn-gold {
  @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm
         bg-gold-gradient text-onix-300 shadow-gold-sm
         hover:shadow-gold active:scale-95 transition-all duration-200 cursor-pointer;
}
```

### Botão destrutivo
```
border border-red-500/30 text-red-400 hover:bg-red-500/10
```
Sem preenchimento sólido — o vermelho é reservado para bordas/texto, mantendo a hierarquia visual dourada como cor de ação primária.

### Input
```css
.input-dark {
  @apply bg-surface-hover border border-surface-border rounded-lg px-3 py-2
         text-gold-light text-sm placeholder-gold-muted
         focus:outline-none focus:border-gold focus:ring-1 transition-colors duration-200;
}
```

### Badge de nível (metas Bronze/Prata/Ouro)
```
bronze: text-amber-600 bg-amber-900/10 border-amber-700/30
prata:  text-zinc-300 bg-zinc-500/10 border-zinc-500/30
ouro:   text-gold bg-gold/10 border-gold/30
```

### Badge de status de combo
```
em_uso:    text-emerald-400 bg-emerald-500/10 border-emerald-500/30
na_fila:   text-blue-400 bg-blue-500/10 border-blue-500/30
encerrado: text-zinc-400 bg-zinc-500/10 border-zinc-500/30
```

---

## Layout geral

```
┌─────────────────────────────────────────┐
│  Header (mobile) / Sidebar (desktop)    │
│  logo | branding.nome (via tenant) | nav items │
├─────────────────────────────────────────┤
│                                         │
│  Main content area                      │
│  bg-[var(--cor-fundo)]                  │
│                                         │
│  ┌──────────┐  ┌──────────┐             │
│  │  Card    │  │  Card    │             │
│  │ surface  │  │ surface  │             │
│  └──────────┘  └──────────┘             │
│                                         │
└─────────────────────────────────────────┘
```

- Mobile: sidebar como menu hambúrguer deslizante
- Desktop: sidebar fixa à esquerda (240px)
- Conteúdo: `max-w-5xl mx-auto px-4` para não esticar em telas grandes

---

## Labels e terminologia

Todos os textos visíveis de módulos são lidos de `labels.*` (carregado de `config/labels.js`):

```jsx
import { labels } from '../config/labels';
// labels.profissional = 'Barbeiro' | 'Especialista' | 'Colaborador' conforme VITE_NICHO
```

Textos fixos (não relacionados a nicho) permanecem hardcoded nos componentes: "Valor", "Data", "Desconto", "Forma de Pagamento", "Observação", etc.

---

## Formatação financeira

Padrão brasileiro em todo o sistema:

```js
new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
// → R$ 1.234,56
```

Datas exibidas em `dd/mm/yyyy`. Internamente armazenadas como `DATE` (YYYY-MM-DD) no banco.

---

## Logo

`branding.logoUrl` (campo de `tenants.branding`, resolvido via `useTenantConfig()`) aponta para o logo do tenant — URL pública (CDN, S3, etc.), não mais caminho relativo ao deploy.

Se não configurado: exibe apenas o texto `branding.nome` em fonte bold.

---

## Responsividade

| Breakpoint | Comportamento |
|---|---|
| < 768px (mobile) | Layout vertical, sidebar como hamburger, campos empilhados |
| ≥ 768px (tablet) | Grid 2 colunas em dashboards, sidebar sempre visível |
| ≥ 1024px (desktop) | Grid 3–4 colunas, sidebar fixa 240px |

Telas críticas (RegistroVenda, Dashboard) são otimizadas para celular — operação diária ocorre majoritariamente em dispositivos móveis.
