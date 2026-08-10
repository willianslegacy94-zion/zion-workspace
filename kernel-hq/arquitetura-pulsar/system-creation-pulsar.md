---
status: archived
domain: pulsar
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# System Creation Threshold — Agente Órbita Pulsar

Resposta às 6 perguntas obrigatórias antes da criação do agente.
Status: **threshold aprovado** — construção em curso.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | PMEs não têm capacidade operacional para responder leads 24/7, enviar cobranças personalizadas no momento certo ou qualificar prospects em background. O atendimento humano é lento, inconsistente e não escala. Sistemas genéricos de chatbot não se adaptam ao contexto e às regras de negócio de cada empresa. |
| **2. Para quem?** | Willians (dono da Zion Ops, integrador) e as PMEs clientes (tenants) que contratam o agente para operar sobre os seus leads e canais de comunicação. |
| **3. Qual é o output esperado?** | Um motor de IA conversacional multi-tenant com duas camadas: (1) Passiva — responde mensagens recebidas de leads com contexto do FAQ do tenant e histórico da conversa; (2) Ativa — dispara mensagens proativas contextualizadas (cobrança, boas-vindas, alertas) via webhook a partir de eventos de sistemas externos. |
| **4. Quais inputs o sistema precisa para funcionar?** | Tenant configurado com `tenant_id`, `nome_empresa`, `faq_contexto` e feature flags. Mensagem do lead com `session_id` e `mensagem`. Para disparos ativos: `telefone_destino`, `tipo_evento`, e dados do evento (valor, chave Pix, etc.). |
| **5. Qual é o primeiro artefato concreto?** | Endpoint `/api/v1/pulsar/chat` respondendo com a IA no contexto do tenant `tenant_pme_pulsar` (Soluções Alpha Consultoria) pré-cadastrado no banco. |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Opera lógica de negócio própria: isolamento de contexto por tenant, qualificação passiva de leads com extração de metadados pelo Claude, feature flags por tenant que alteram o comportamento do agente, histórico de conversa persistido por `session_id`. Não é uma integração simples — é um motor de atendimento autônomo reutilizável. |

---

## Status do threshold

**Status:** aprovado
**Data de aprovação:** 2026-06-24
**Estado atual:** construção em curso — arquivos core criados, pendente instalação e testes

---

## Links relacionados

[[indice-pulsar]] — mapa de todos os artefatos do agente
[[prd-pulsar]] — PRD completo com problema, objetivo e escopo
