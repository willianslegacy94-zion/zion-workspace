---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-07-29
owner: willians
---

# System Creation Threshold — Jocley Grill

Resposta às 6 perguntas obrigatórias antes da criação do sistema.
Status: **threshold aprovado** — sistema em produção local (dev), pronto para deploy.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | Lanchonete (bebidas, lanches e espetos de churrasco) sem PDV digital: sem visão de mesas nem de comandas de balcão/retirada, sem CMV calculado (custo de cardápio feito de cabeça ou em planilha), sem separação de acesso entre quem atende mesa, quem opera caixa, quem cozinha e quem gerencia — e sem inteligência financeira (ranking de pratos, pico de horário, DRE) para o dono decidir com dado em vez de intuição. |
| **2. Para quem?** | Jocley (dono — visão de resultado, financeiro e CMV), um Supervisor (gestão operacional e de equipe, sem acesso ao financeiro estratégico), atendentes no tablet/celular (só cardápio + mesas + balcão), caixa (mesas + balcão + cardápio + estoque) e cozinha (KDS dedicado). |
| **3. Qual é o output esperado?** | PDV web com dois fluxos de venda (Mesas e Balcão), cupom térmico 80mm, split payment com bandeira de cartão opcional, cálculo automático de CMV a partir de ficha técnica, KDS de cozinha, dashboard financeiro nos moldes do vilamill-sistema, inteligência financeira (rankings, pico de horário, DRE, projeção/break-even) nos moldes do sistema-thieco, e uma tela de Usuários para o dono/supervisor criar login da equipe sem depender de deploy. |
| **4. Quais inputs o sistema precisa para funcionar?** | 12 mesas cadastradas, cardápio com produtos (preço + categoria), fichas técnicas dos pratos com insumos e custo unitário de cada insumo, taxas por forma de pagamento (e opcionalmente por bandeira), e os logins da equipe (nome, usuário, senha, papel). |
| **5. Qual é o primeiro artefato concreto?** | Grid de mesas com abertura de comanda, adição de itens do cardápio e fechamento com split payment + cupom — o mesmo núcleo operacional replicado do vilamill-sistema, adaptado para o domínio de lanchonete (mesas + balcão, em vez de só mesas). |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Integra PDV (mesas + balcão), cálculo de CMV, gestão de estoque, KDS de cozinha, controle financeiro completo (dashboard + inteligência financeira + despesas + lançamentos), gestão de time e gestão de usuários — cada módulo alimenta os outros (ex.: fechamento de comanda deduz estoque, que alimenta CMV, que alimenta o Resultado do dashboard). Não é suporte a outro sistema: é a operação completa da lanchonete. |

---

## Origem — reaproveitamento consciente de dois sistemas irmãos

Diferente de Thieco e Villamill (que nasceram do zero), a Jocley Grill foi desenhada explicitamente como **combinação deliberada** de padrões já validados em produção no mesmo workspace:

- **vilamill-sistema** — origem do layout claro, do dashboard financeiro (cards de Receita Bruta/CMV/Despesas/Resultado), do fluxo de PDV por mesas, do cupom térmico 80mm e do split payment.
- **sistema-thieco** — origem da estrutura de menu lateral agrupado, do módulo de Inteligência Financeira (rankings, DRE, projeção), da Gestão de Time (Feedbacks/PDCA/Sugestões/Timeline), de Despesas com recorrência e da tela de Configurações (notificações + taxas por forma de pagamento).

Nenhum código foi copiado — os dois sistemas foram estudados (exploração de código real) e seus **padrões** foram reimplementados do zero em Next.js/Prisma, com ajustes de domínio (CMV calculado automaticamente em vez de manual; pico de horário, que nenhum dos dois tinha pronto; papéis de acesso próprios da lanchonete).

---

## Status do threshold

**Status:** aprovado
**Data de aprovação:** 2026-07-29 (construção e aprovação no mesmo dia — sessão única)
**Estado atual:** sistema funcional, testado ponta a ponta (build de produção limpo, RBAC validado ao vivo para os 5 papéis, fluxo de venda completo com dedução de estoque e cálculo de taxa confirmados via requisições reais)

---

## Links relacionados

[[indice-jocley-lanchonete]] — mapa de todos os artefatos do sistema
[[prd-jocley-lanchonete]] — PRD completo com problema, objetivo e escopo
