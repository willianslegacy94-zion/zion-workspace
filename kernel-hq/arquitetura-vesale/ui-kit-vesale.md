---
status: draft
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-16
owner: willians
---

# UI Kit — Drogaria Vesale

> Referência: [[design-system-vesale]]
> Ferramenta principal: nenhuma — o sistema não usa uma biblioteca de componentes formal, e sim classes utilitárias Tailwind repetidas ad hoc por tela (ver código em `vesale/src/components/`). O inventário abaixo continua útil como intenção de design, mas "implementado" aqui quer dizer "o padrão visual existe nas telas reais", não "existe como componente reaproveitável nomeado".

## Inventário de componentes

### Componentes atômicos

| Componente | Variantes | Estados | Status | Onde está |
|---|---|---|---|---|
| Button | primary (azul marinho), danger (vermelho), secondary (contorno neutro) | default, hover, active, disabled, loading | planejado | — |
| Input | text, number, search | default, focus, error, disabled | planejado | — |
| Badge | success, warning, danger | — | planejado | — |
| Logo (marca) | "DROGARIA" + "VESALE" (header), símbolo isolado (favicon/mobile) | — | planejado | — |

### Componentes compostos

| Componente | O que contém | Status | Onde está |
|---|---|---|---|
| FormField | Label + Input + texto de erro | planejado | — |
| CardProduto | nome, código, preço, quantidade em estoque — usado no PDV | planejado | — |
| TabelaPrecificacao | produto, custo travado, preço, margem, badge de alerta (RF-019/RF-021) | planejado | — |
| ModalUploadNotaFiscal | dropzone de arquivo XML/PDF + status de processamento | planejado | — |

### Layouts (patterns)

| Layout | Uso | Status | Onde está |
|---|---|---|---|
| Sidebar + navegação | estrutura base de qualquer página autenticada — logo no topo, módulos em lista vertical (com agrupamento, ex. Compras), usuário logado e "Sair" numa barra superior fina | implementado desde 2026-09-17 (era header fixo no topo) | `src/components/shared/Sidebar.tsx`, `Topbar.tsx` |
| Layout PDV | busca de produto em destaque, lista da venda em andamento, total e finalização sempre visíveis | planejado | — |
| Layout de tabela financeira | filtro de período + tabela + totais | planejado | — |

### Templates de tela

| Template | Uso | Status | Onde está |
|---|---|---|---|
| Login | autenticação (RF-001) | implementado | `src/app/(auth)/login/page.tsx` |
| PDV | tela principal do operador de caixa (Módulo 3) | implementado — primeiro artefato do sistema (ver [[system-creation-vesale]]) | `src/app/(app)/pdv/page.tsx` |
| Estoque | cadastro de produto + sinalização de estoque baixo/validade (Módulo 2, RF-004/RF-007) | implementado | `src/app/(app)/estoque/page.tsx` |
| Notas Fiscais de Entrada | upload e conciliação (Módulo 4) | implementado | `src/app/(app)/notas-fiscais/page.tsx` |
| Precificação e CMV | painel de margem (Módulo 5, RF-019 a RF-022) | implementado | `src/app/(app)/rentabilidade/page.tsx` |
| Financeiro | contas a pagar/receber (RF-023/024) + painel de caixa com diferença de fechamento (RF-034) | implementado — fluxo de caixa consolidado (RF-025) e DRE (RF-026) ainda planejados | `src/app/(app)/financeiro/page.tsx` |
| Relatórios de vendas | total, ticket médio, mais vendidos, por forma de pagamento | implementado | `src/app/(app)/relatorios/page.tsx` |
| Painel | resumo do dia pro gestor (RF-035) | implementado | `src/app/(app)/painel/page.tsx` |
| Fornecedores | cadastro/edição direto, com pedidos/valor/último pedido (RF-031) | implementado | `src/app/(app)/fornecedores/page.tsx` |

## Assets

| Asset | Tipo | Formato | Onde está |
|---|---|---|---|
| Logo | marca "DROGARIA VESALE" + símbolo isolado (cruz) | ainda só a foto da fachada (`LogoVesale.png`) — **sem arquivo vetorial da marca completa**; a cruz isolada foi redesenhada como SVG inline (`src/components/shared/PharmacyCross.tsx`) reproduzindo o círculo vermelho/cruz branca da foto, usada na sidebar e no login | pendência de vetorial completo segue registrada em [[registro-de-decisoes-vesale]]; símbolo isolado resolvido em 2026-09-15 |
| Ícones | sistema de ícones da UI | a definir (biblioteca de ícones padrão, ex. Lucide) | — |

## Regras de uso

- Nunca adaptar um componente fora da biblioteca sem registrar a decisão em [[registro-de-decisoes-vesale]].
- Todo novo componente começa como planejado/draft — não vai direto para aprovado sem uso real validado com a cliente.
- Os componentes atômicos/compostos/layouts seguem "planejado" porque não foram extraídos como componentes reaproveitáveis nomeados — o padrão visual existe, repetido por tela em Tailwind. Reclassificar pra "construído" se/quando isso for extraído (ex.: um `<Button>` de verdade).

---

# Links relacionados

[[design-system-vesale]] — fonte de verdade dos princípios e tokens que este UI Kit materializa
[[ux-flows-vesale]] — validação de se os componentes funcionam na prática, quando houver uso real
