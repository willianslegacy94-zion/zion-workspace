---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-02
owner: willians
---

# System Creation Threshold — Lane Confeitaria

Resposta às 6 perguntas obrigatórias antes da criação do sistema.
Status: **threshold aprovado** — sistema implementado e testado localmente (sem banco real conectado), pendente de deploy.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | A Confeitaria Artesanal da Lane (confeitaria de bolos e docinhos sob encomenda, MEI solo) opera sem nenhum sistema digital: pedidos são negociados e fechados por WhatsApp sem funil organizado, a capacidade de produção (5 bolos/dia) é controlada de memória — com risco real de overbooking —, e não há visão financeira nenhuma (receita, CMV por sabor, lucro real, quais clientes voltam a comprar, quais faixas de peso vendem mais). |
| **2. Para quem?** | Lane (dona, única usuária do sistema — MEI solo), que acumula os papéis de atendimento, produção e gestão financeira sozinha. |
| **3. Qual é o output esperado?** | Sistema web com CRM em kanban (filas configuráveis, limite de 7 nunca exposto como restrição técnica), Agenda de produção com limite diário configurável (bloqueio automático de overbooking), Dashboard com inteligência financeira (receita/despesas/lucro/fluxo de caixa), CMV por sabor, quadro de metas, calculadora de projeção de ganhos, identificação de clientes recorrentes e ranking de bolos vendidos por faixa de peso (5/10/15kg). |
| **4. Quais inputs o sistema precisa para funcionar?** | Catálogo de sabores de bolo e menu de docinhos por cento (já pré-carregados via seed, extraídos do material de divulgação real da cliente), preço por sabor a ser definido manualmente pela Lane (não fornecido de antemão), custos de insumos por receita (para o CMV, também cadastro manual), e os valores de acréscimo do negócio (cartão, glitter, topper). |
| **5. Qual é o primeiro artefato concreto?** | Tela de login + Dashboard com identidade visual da marca (Epic 1), seguida do funil de pedidos com cadastro completo (cliente, sabores, peso, precificação automática de sinal) — o núcleo operacional que substitui o controle manual por WhatsApp. |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Integra CRM (funil de pedidos), Agenda (capacidade de produção) e Financeiro (CMV, metas, projeção, recorrência, ranking) — cada módulo alimenta os outros: um pedido no CRM gera agendamento na Agenda e é a base de todo o cálculo financeiro. Não é apoio a outro sistema: é a operação completa da confeitaria. |

---

## Origem — kickoff direto com a cliente, sem sistema irmão de referência de domínio

Diferente de outros sistemas do portfólio (ex.: Jocley Lanchonete, que reaproveitou padrões de dois sistemas irmãos do mesmo domínio), o Lane Confeitaria nasceu de um kickoff direto com a cliente (conversa + imagens reais de cardápio/divulgação), sem um sistema irmão do mesmo domínio de negócio (confeitaria) já em produção no workspace.

A **stack e os padrões de interface** foram conscientemente reaproveitados de três sistemas já validados:
- **sdr-crm** — origem do conceito de funil com `stage`/fila, portado para o novo schema Prisma (não o servidor Express original).
- **academia-sandro** — origem do padrão de agenda com limite diário configurável, do NextAuth v5 + Prisma 7 + `prisma.config.ts`, e do padrão mobile-first.
- **lanchonete-sistema** — origem do dashboard financeiro com Recharts + SWR.

O **domínio de negócio (confeitaria)** e todas as regras (sinal 50%, cancelamento 24h, até 2 sabores por bolo, docinhos por cento) vieram integralmente do briefing real da cliente — nenhuma regra de negócio foi inventada ou herdada de outro sistema.

---

## Status do threshold

**Status:** aprovado
**Data de aprovação:** 2026-07-30 (kickoff, PRD, arquitetura, 17 stories e implementação completa na mesma sessão)
**Estado atual (atualizado 2026-08-02):** sistema funcional e **validado ponta a ponta contra um banco PostgreSQL real** (container Docker local, `lane-confeitaria-db`) — build de produção limpo (24 rotas), lint limpo, 30 testes unitários passando, `prisma migrate dev` aplicada com sucesso, `npm run db:seed` populou 44 sabores + 12 docinhos, login real via NextAuth (fluxo CSRF completo) testado via `curl`, navegação autenticada (Dashboard, CRM) e escrita real (criação de fila) confirmadas refletindo na UI. Desde então, o sistema ganhou uma segunda camada inteira de escopo — atendimento automático via IA (Quasar, persona "Mel"), Kanban dirigido por conversa de WhatsApp real, visão computacional e validação de pagamento — detalhada em [[registro-de-decisoes-lane-confeitaria]] e [[requisitos-funcionais-lane-confeitaria]] (Módulos 7-9). O threshold original permanece válido; o sistema não deixou de ser "CRM + Agenda + Financeiro de confeitaria", só passou a ter um canal de atendimento automatizado alimentando o CRM.

---

## Links relacionados

[[indice-lane-confeitaria]] — mapa de todos os artefatos do sistema
[[prd-lane-confeitaria]] — PRD completo com problema, objetivo e escopo
