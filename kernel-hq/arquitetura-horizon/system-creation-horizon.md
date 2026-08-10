---
status: stable
domain: horizon
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# System Creation Threshold — Agente Órbita Horizon

Resposta às 6 perguntas obrigatórias antes da criação do agente.
Status: **threshold aprovado** — construção concluída e testada.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | Plataformas de infoprodutos e cursos online (EAD) recebem volume alto de suporte repetitivo — dúvidas sobre login, acesso, certificados, senha. Atendimento humano não escala, e chatbots genéricos não conseguem validar se quem está perguntando realmente é aluno ativo. O Horizon resolve isso: atende apenas alunos autenticados por e-mail, com contexto real do FAQ da plataforma. |
| **2. Para quem?** | Willians (integrador/dono da Zion Ops) e plataformas de membros (tenants) que contratam o agente para operar suporte automatizado a alunos — caso inicial: Zion Academy na TheMembers. |
| **3. Qual é o output esperado?** | Um motor de atendimento IA conversacional que (1) valida se o e-mail do usuário é aluno ativo no tenant antes de responder, (2) responde dúvidas institucionais com o FAQ da plataforma, (3) detecta solicitação de humano e emite sinal de transbordo. |
| **4. Quais inputs o sistema precisa para funcionar?** | Tenant configurado com `tenant_id`, `nome_empresa`, `faq_contexto` e 2 feature flags. Base de alunos importada no banco (`alunos_base`). Requisição de chat com `tenant_id`, `session_id`, `mensagem` e `email_autenticacao`. |
| **5. Qual é o primeiro artefato concreto?** | Endpoint `/api/v1/horizon/chat` respondendo com a IA no contexto do `tenant_teste_01` (Zion Academy), com validação de aluno por e-mail e histórico de contexto persistido. |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Possui lógica de negócio própria: autenticação de aluno por e-mail antes de qualquer resposta, isolamento de contexto por tenant, feature flags que alteram o comportamento (validar aluno vs. Horizon puro), histórico de conversa persistido por `session_id`, detecção de transbordo com sinal estruturado ao canal. Não é uma integração simples com a IA — é um motor de suporte especializado para plataformas EAD. |

---

## Status do threshold

**Status:** aprovado
**Data de aprovação:** 2026-06-24
**Estado atual:** construção concluída — banco inicializado, CSV importado, servidor testado

---

## Links relacionados

[[indice-horizon]] — mapa de todos os artefatos do agente
[[prd-horizon]] — PRD completo com problema, objetivo e escopo
