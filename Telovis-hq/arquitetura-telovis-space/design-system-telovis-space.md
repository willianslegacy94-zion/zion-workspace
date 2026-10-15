---
status: draft
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-14
owner: willians
---

# Design System — TeloVis Space

> Referência: [[ui-kit-telovis-space]]

## Princípios

1. **O mapa é a tela.** A HUD fica nas bordas, translúcida, e nunca cobre o centro do mapa.
2. **Pixel art sem arquivo de arte.** Avatares, mesas e veículos são desenhados em canvas 2D em
   runtime (`game/*-draw.ts`), o que permite paletas e combinações sem spritesheet.
3. **Verde = conectado.** Esmeralda marca o que está ativo: anel sob o colega cuja mídia está
   ligada, status Disponível, botões de mic/câmera ligados.
4. **Estado legível sem som.** Círculo do raio de 150px em volta de você, salas que acendem ao
   entrar, ausente aparece apagado com o status ao lado do nome.

## Cores

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#0f1220` | fundo das páginas (login, dashboard) |
| `--foreground` | `#e2e8f0` | texto |
| superfícies | `slate-800/900/950` | painéis, HUD |
| ativo | `emerald-400/500` | mídia ativa, disponível, ações principais |
| atenção | `amber-400` | status de ausência |
| erro | `red-500/10` + texto vermelho | mensagens de erro |

Tipografia: `ui-sans-serif, system-ui`. Sem fonte de marca definida.

## Pendências

- Identidade visual da marca TeloVis Space (logo, fonte) não definida.
- Shadcn/UI previsto na spec original, ainda não adotado — componentes são Tailwind direto.
