---
status: stable
domain: governance
source: claude
created: 2026-05-20
updated: 2026-07-30
owner: willians
---

# System Creation Threshold

Define o que precisa estar respondido antes de abrir uma pasta para um novo sistema dentro de `kernel-hq`.

Não é sobre ter tudo pronto. É sobre ter clareza suficiente para começar sem construir no vazio.

---

## Por que esse threshold existe

Pasta criada sem clareza vira acúmulo. O sistema passa a existir como intenção — não como construção real. O threshold existe para separar o que está sendo construído do que ainda está sendo cogitado.

---

## Perguntas obrigatórias

Antes de criar qualquer pasta de sistema, as seis perguntas abaixo precisam ter resposta. Não precisa ser perfeita. Precisa ser real.

### 1. Qual problema esse sistema resolve?

Descreva o problema em termos concretos — não a solução, o problema.

> Exemplo (Thieco): a barbearia opera sem controle financeiro digital. Comissões são calculadas manualmente, taxas de maquininha não são rastreadas por unidade, e o resultado do dia exige consolidação manual.

---

### 2. Para quem?

Identifique quem vai usar o output do sistema.

> Exemplo (Thieco): Thieco Leandro (dono — visão de resultado) e barbeiros Igor Hidalgo e Kauã dos Santos (operação do caixa).
> Exemplo (Villamill): operadores de caixa (Emilly, Melissa) durante o serviço, e o admin (Willians) para fechamento e relatórios.

---

### 3. Qual é o output esperado?

O que a pessoa ou empresa recebe quando o sistema funciona?

> Exemplo (Thieco): sistema de caixa web com registro de vendas, cálculo automático de comissão por tipo de item (serviço vs. produto) e relatório financeiro por unidade e barbeiro.
> Exemplo (Villamill): PDV web com atualização em tempo real (polling 3s), ciclo completo de mesa e relatório financeiro consolidado do dia.

---

### 4. Quais inputs o sistema precisa para funcionar?

O que precisa existir no mundo real para o sistema processar?

> Exemplo (Thieco): produtos e serviços cadastrados com preço e custo, tabela de comissão por tipo de item, taxas de maquininha por unidade e bandeira de cartão.
> Exemplo (Villamill): 15 mesas cadastradas, cardápio com 130+ produtos (preço e custo), fichas técnicas dos pratos, insumos com nível mínimo definido.

---

### 5. Qual é o primeiro artefato concreto?

Não o sistema completo. O primeiro entregável real — algo que já existe ou pode existir em dias, não meses.

> Exemplo (Thieco): tela de registro de venda com seleção de barbeiro, tipo de item e forma de pagamento — gerando comissão e total líquido automaticamente.
> Exemplo (Villamill): grid de mesas com abertura de pedido, adição de itens do cardápio e fechamento com forma de pagamento.

---

### 6. Por que isso é um sistema e não uma pasta de apoio?

O que diferencia esse sistema de material de suporte a outro sistema já existente?

> Exemplo (Thieco): integra PDV, comissionamento e relatório financeiro — cada módulo alimenta o outro. Não é suporte a outro sistema: é a operação completa da barbearia.
> Exemplo (Villamill): integra PDV, gestão de estoque e controle financeiro — cada módulo alimenta os outros. É a espinha operacional do restaurante.

---

## Exemplos de aplicação

### Thieco → Sistema de Caixa Barbearia (threshold aprovado)

| Pergunta | Resposta |
|---|---|
| Problema | Barbearia operando sem controle financeiro digital: comissões calculadas manualmente, taxas de maquininha não rastreadas por unidade, resultado do dia exigindo consolidação manual |
| Para quem | Thieco Leandro (dono, visão de resultado) e barbeiros Igor Hidalgo e Kauã dos Santos (operação do caixa) |
| Output | Sistema de caixa web com registro de vendas, cálculo automático de comissão por tipo de item e relatório financeiro por unidade e barbeiro |
| Inputs | Produtos e serviços cadastrados com preço e custo, tabela de comissão por tipo de item, taxas de maquininha por unidade e bandeira de cartão |
| Primeiro artefato | Tela de registro de venda com seleção de barbeiro, tipo de item e forma de pagamento — gerando comissão e total líquido automaticamente |
| Por que é um sistema | Integra PDV, comissionamento e relatório financeiro — cada módulo alimenta o outro. Não é suporte a outro sistema: é a operação completa da barbearia |

**Status:** threshold aprovado. Sistema em produção desde 2024.

---

### Villamill → PDV Restaurante/Bar (threshold aprovado)

| Pergunta | Resposta |
|---|---|
| Problema | Restaurante/bar sem PDV digital: estado das mesas desconhecido remotamente, split payment sem registro, estoque divergente por falta de rastreio, cancelamentos sem auditoria, resultado do dia exigindo consolidação manual |
| Para quem | Operadores de caixa (Emilly, Melissa) durante o serviço e admin (Willians) para fechamento e relatórios |
| Output | PDV web com polling em tempo real (3s), ciclo completo de mesa (abertura → pedido → fechamento com split payment → dedução de estoque) e relatório financeiro consolidado |
| Inputs | 15 mesas cadastradas, cardápio com 130+ produtos (preço e custo), fichas técnicas dos pratos, insumos com nível mínimo definido |
| Primeiro artefato | Grid de mesas com abertura de pedido, adição de itens e fechamento com forma de pagamento — substituindo controle manual por tela no tablet |
| Por que é um sistema | Integra PDV, gestão de estoque e controle financeiro — cada módulo alimenta os outros. É a espinha operacional do restaurante |

**Status:** threshold aprovado. Sistema em produção desde abril 2026.

---

## Sistemas aprovados (histórico)

| Sistema | Pasta | Data de aprovação | Status |
|---|---|---|---|
| Thieco — Sistema de Caixa Barbearia | `arquitetura-thieco` | 2026-05 | Em produção |
| Villamill — PDV Restaurante | `arquitetura-villamill` | 2026-05 | Em produção |
| Órbita Horizon — Suporte EAD | `arquitetura-horizon` | 2026-06-24 | Stable |
| Órbita Pulsar — Atendimento + Disparos PME | `arquitetura-pulsar` | 2026-06-24 | Stable |
| Órbita Cortex — Cérebro Analítico | `arquitetura-cortex` | 2026-06-25 | Stable |
| Órbita Insight — BI Preditivo | `arquitetura-insight` | 2026-06-25 | Stable |
| Motor de Prospecção | `arquitetura-prospeccao` | 2026-06-25 | Stable |
| Órbita Quasar — Concierge Alto Ticket | `arquitetura-quasar` | 2026-06-25 | Draft |
| IVSSTORE — ERP Vestuário/Perfumaria | `arquitetura-ivsstore` | 2026-06 | MVP local |
| Kernel — Caixa SaaS | `arquitetura-kernel` | 2026-06-24 | Stable |
| Jocley Lanchonete — PDV + CMV + Inteligência Financeira | `arquitetura-jocley-lanchonete` | 2026-07-29 | Testado em dev, pendente deploy |
| Lane Confeitaria — CRM + Agenda + Inteligência Financeira | `arquitetura-lane-confeitaria` | 2026-07-30 | Testado em dev com banco PostgreSQL real (Docker local), pendente deploy |
| KernelMei — Whitelabel Multi-Tenant de Confeitaria | `arquitetura-kernelmei` | 2026-08-10 (retroativo) | Draft — fundação multi-tenant verificada por script, UI parcial, sem commits, sem deploy |

---

## Regra operacional

> Se você não consegue responder as seis perguntas, não crie a pasta. Se a pasta já existe sem essas respostas, ela está em estado de intenção — não de sistema.

Quando o threshold for aprovado, registre as respostas em `system-creation-{nome}.md` dentro da pasta do sistema e inicie a construção pelos frameworks de [[00-indice|00-governance-systems]].
