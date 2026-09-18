# This is NOT the Next.js you know

Este projeto usa Next.js 16 — APIs, convenções e estrutura de arquivos têm mudanças reais em relação a versões anteriores (ex.: `src/proxy.ts` em vez de `middleware.ts`). Consulte `node_modules/next/dist/docs/` antes de escrever código novo que dependa de convenções do Next.

## Governança

Este código implementa o sistema especificado em
`../Kernel Workspace/kernel-hq/arquitetura-vesale/` (PRD, requisitos funcionais,
arquitetura técnica, modelo de dados, design system). Mudança de regra de
negócio ou de modelo de dados deve ser refletida lá — ver
`registro-de-decisoes-vesale.md`.

## Estado atual (2026-09-17)

Implementado: Módulo PDV completo (RF-008 a RF-013, RF-029, RF-033, RF-034 —
busca, carrinho, desconto, recibo com impressão, fechamento de caixa com
diferença calculada, confirmação de receita por item controlado via RN-013),
Módulo Estoque (RF-004, RF-007, RF-027/RF-028 — cadastro de produto,
sinalização de estoque baixo e de validade próxima, lote/validade por
produto), Módulo Notas Fiscais de Entrada (RF-014 a RF-018, RF-032 — upload
de XML com lote/validade extraídos, criação de produto novo direto do item,
lançamento manual de itens quando só a chave de acesso foi bipada e o XML
ainda não chegou), Fornecedores (RF-031 — cadastro direto, pedidos/valor/
último pedido por fornecedor), Painel (RF-035 — resumo do dia pro gestor),
Relatórios de vendas (RF-030), Módulo Financeiro parcial (RF-023/RF-024 —
contas a pagar/receber; RF-025 fluxo de caixa consolidado e RF-026 DRE ainda
não) e Módulo 5 — Precificação e CMV (RF-019 a RF-022 — custo travado e preço
lado a lado com margem calculada, alerta visual de margem negativa/zerada,
edição de preço de venda sem nunca tocar no custo travado, CMV do período
por intervalo de datas). RF-026 (DRE simplificado) segue pendente mesmo com
o Módulo 5 pronto, pois falta RF-025 (fluxo de caixa consolidado) do qual
também depende.

A navegação da aplicação foi redesenhada (sidebar fixa à esquerda no lugar do
navbar horizontal, ver `src/components/shared/Sidebar.tsx`), mantendo a
paleta de marca (`vesale-navy`/`vesale-red`) calibrada a partir da fachada
real — ver `design-system-vesale.md`. A sidebar já lista os módulos ainda não
construídos (Validades, Clientes, Receitas/Controlados, Perdas, Auditoria,
Assistente IA) com badge "Em breve", sem tela nem rota por trás ainda.
