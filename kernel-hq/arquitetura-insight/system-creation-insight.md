---
status: stable
domain: orbita-insight
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# System Creation Threshold — Órbita Insight

Resposta às 6 perguntas obrigatórias antes da criação do sistema.
Status: **threshold aprovado** — construção em curso.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | Infoprodutores não têm visibilidade sobre o comportamento de consumo dos seus alunos em tempo real. Churn por abandono precoce, oportunidades de upsell perdidas e alunos travados sem suporte acontecem por falta de alertas inteligentes e acionáveis no momento certo. |
| **2. Para quem?** | Infoprodutores digitais (criadores de cursos, mentorias e produtos de conhecimento) que operam em plataformas de área de membros como Hotmart, Kiwify ou similares. |
| **3. Qual é o output esperado?** | Um engine SaaS via API que recebe métricas de consumo de um aluno (dias desde a compra, progresso de aulas, valor pago) e devolve um insight comercial humanizado, classificado por regra de negócio (churn, upsell ou reengajamento), pronto para ser enviado ao WhatsApp do produtor. |
| **4. Quais inputs o sistema precisa para funcionar?** | Por chamada de API: número WhatsApp do produtor, nome e e-mail do aluno, nome do produto, valor pago, dias desde a compra, e percentual de progresso nas aulas. Variável de ambiente: `OPENROUTER_API_KEY` na raiz da workspace. |
| **5. Qual é o primeiro artefato concreto?** | Endpoint `POST /api/v1/insight/analise` que classifica o aluno em uma das 3 regras (churn, upsell, reengajamento) e gera um insight textual via Claude 3.5 Sonnet, salvando o log no banco SQLite local. |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Opera sobre lógica de negócio proprietária (3 regras de classificação comportamental), persiste histórico auditável de insights gerados, expõe API com contrato formal (Pydantic), e é projetado para ser consumido por integrações externas (webhooks de plataformas, automações de WhatsApp). Não é suporte a outro sistema — é o motor analítico do produto Órbita Insight. |

---

## Status do threshold

**Status:** aprovado
**Data de aprovação:** 2026-06-25
**Estado atual:** MVP em desenvolvimento local, API funcional

---

## Links relacionados

[[indice-insight]] — mapa de todos os artefatos do sistema
[[prd-insight]] — PRD completo com problema, objetivo e escopo
