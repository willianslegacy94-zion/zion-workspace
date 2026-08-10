---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-05-24
owner: willians
---

# System Creation Threshold — Villa Mill Tamboré PDV & Management

Resposta às 6 perguntas obrigatórias antes da criação do sistema.
Status: **threshold aprovado** — sistema em produção.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | Restaurante/bar operando sem PDV digital: estado das mesas desconhecido sem ir ao salão, split payment sem registro estruturado, consumo de insumos não rastreado causando divergência de estoque, cancelamentos sem auditoria, e resultado financeiro do dia exigindo consolidação manual. |
| **2. Para quem?** | Operadores de caixa (Emilly, Melissa) que gerenciam o salão durante o serviço, e o admin (Willians) que acompanha resultado, estoque e despesas. |
| **3. Qual é o output esperado?** | Um PDV web com atualização em tempo real (polling 3s) que gerencia o ciclo completo de uma mesa — abertura, pedido, fechamento com split payment e dedução automática de estoque — mais visão financeira consolidada do dia. |
| **4. Quais inputs o sistema precisa para funcionar?** | 15 mesas cadastradas, cardápio com 130+ produtos (com preço e custo), fichas técnicas dos pratos, insumos em estoque com nível mínimo definido, e formas de pagamento disponíveis (dinheiro, PIX, crédito, débito). |
| **5. Qual é o primeiro artefato concreto?** | Grid de mesas com abertura de pedido, adição de itens do cardápio e fechamento com forma de pagamento — substituindo o controle manual por uma tela acessível no tablet durante o serviço. |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Integra PDV (mesas + pedidos + pagamentos), gestão de estoque (insumos + fichas técnicas + dedução automática), controle financeiro (faturamento + despesas + DRE do dia) e autenticação com perfis distintos — cada módulo alimenta os outros. Não é suporte a outro sistema: é a espinha operacional do restaurante. |

---

## Status do threshold

**Status:** aprovado
**Data de aprovação:** abril 2026 (construção iniciada em 2026-04-29)
**Estado atual:** sistema em produção, módulos principais implementados

---

## Links relacionados

[[indice-villamill]] — mapa de todos os artefatos do sistema
[[prd-villamill]] — PRD completo com problema, objetivo e escopo
