---
status: archived
domain: pulsar
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# PRD — Agente Órbita Pulsar

## 1. Contexto

A Zion Ops atende PMEs que precisam automatizar o atendimento e a comunicação com leads e clientes. Hoje, essas empresas dependem de atendimento humano manual ou de plataformas genéricas de chatbot sem personalização real. O Órbita Pulsar é o motor de IA da Zion Ops: um agente conversacional multi-tenant que opera sobre o contexto de cada cliente (FAQ, regras de negócio, flags de automação) e responde ou dispara mensagens com inteligência.

## 2. Problema

**Dor específica:** PMEs perdem leads por demora no atendimento e não conseguem manter comunicação proativa (cobranças, boas-vindas, alertas) sem custo operacional alto.

**Como se manifesta:**
- Lead envia mensagem fora do horário comercial e não recebe resposta
- Cobrança de mensalidade atrasada é feita manualmente, com inconsistência
- Qualificação de leads (faturamento, potencial de upsell) depende de reunião humana
- Empresas diferentes precisam de agentes com contextos completamente distintos
- Sistemas de chatbot genéricos não reconhecem as regras de cada negócio

**Por que ainda não foi resolvida:** Plataformas como ManyChat ou Typebot são genéricas e caras. Integrações diretas com Claude/GPT exigem desenvolvimento customizado. A PME não tem equipe técnica para construir e manter isso.

## 3. Objetivo

Após o agente existir:
- Um lead que envia mensagem para uma PME recebe resposta imediata com o contexto real do negócio
- Uma cobrança em aberto gera uma mensagem Pix personalizada sem intervenção humana
- O sistema identifica em background se o lead tem perfil de upsell ou alto ticket
- Um novo tenant é configurado em minutos com suas próprias regras e FAQ
- O histórico de cada conversa é preservado para contexto contínuo

## 4. Usuário

**Quem:**
- **Willians (integrador/dono):** configura tenants, monitora o agente, consome a API
- **Sistemas externos dos tenants:** disparam webhooks de eventos (cobrança, boas-vindas)
- **Canal de comunicação (WhatsApp, chat):** envia e recebe mensagens dos leads via API

**Estado no uso:**
- Integrador: configuração e monitoramento — quer simplicidade e previsibilidade
- Canal externo: operacional — espera resposta rápida com payload limpo e parseável
- Lead (usuário final indireto): quer resposta relevante e rápida

**Contexto:** API REST consumida por sistemas externos. Não há interface visual própria — o frontend é sempre o canal do tenant (WhatsApp, landing page, CRM).

## 5. Hipótese de solução

Um motor FastAPI multi-tenant com banco SQLite local, que:
1. Armazena contexto de cada PME (FAQ + flags de automação)
2. Mantém histórico de conversa por `session_id`
3. Chama Claude 3.5 Sonnet via OpenRouter com prompt enriquecido pelo contexto do tenant
4. Extrai metadados de qualificação em background sem exposição ao lead
5. Dispara mensagens proativas com templates contextualizados por tipo de evento

**Por que faz sentido:** O valor está na camada de orquestração de contexto — não no modelo de IA em si. Claude já resolve o raciocínio; Pulsar resolve o isolamento de tenant, a persistência de histórico e a automação de tags de saída.

**Risco central:** A qualidade das respostas depende diretamente do `faq_contexto` configurado pelo tenant. FAQ ruim = respostas ruins. Responsabilidade do integrador garantir um contexto rico.

## 6. Escopo

**Dentro:**
- Multi-tenant via `tenant_id` com feature flags independentes por tenant
- Camada passiva: chat receptivo com histórico de contexto (últimas 8 mensagens)
- Camada ativa: disparos proativos via webhook (cobrança, boas-vindas, alertas genéricos)
- Qualificação silenciosa de leads: etapa atual, perfil de qualificação, dados adicionais
- Tags de automação na resposta: `[ENVIAR_ARQUIVO_XYZ]`, `[PERFIL_UPSELL]`, `[ACIONAR_TRANSBORDO]`
- Autenticação por Bearer Token no header de todas as rotas (exceto `/health`)
- Banco SQLite local — zero dependência de cloud para o banco de dados

**Fora:**
- Envio real de mensagens WhatsApp (Pulsar gera o payload; o canal externo envia)
- Interface visual de configuração de tenants
- Autenticação OAuth ou multi-usuário
- Integração direta com CRM ou ERP
- Agendamento de disparos (cron jobs)

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Tempo de resposta ao lead | horas (humano) | < 3 segundos (IA) |
| Configuração de novo tenant | horas de desenvolvimento | < 5 minutos via POST /tenants |
| Precisão do contexto na resposta | inconsistente | resposta dentro do FAQ em > 90% dos casos |
| Qualificação de leads capturada | zero | etapa e perfil preenchidos após 3ª mensagem |
| Disparo de cobrança sem erro | manual com risco de falha | 100% automatizado com payload correto |

## 8. Requisitos de alto nível

**Funcionais:**
- CRUD de tenants com `faq_contexto` e 3 feature flags
- Endpoint de chat receptivo com histórico de contexto e parse de metadados
- Endpoint de disparo ativo com templates por `tipo_evento`
- Consulta de histórico completo por `session_id`
- Inicialização automática do banco com tenant de demonstração

**Não funcionais:**
- Resposta da IA em < 15 segundos (timeout configurado no OpenRouter)
- Autenticação obrigatória em todas as rotas de negócio
- SQLite como banco local — sem dependência de servidor externo
- `temperature: 0.2` no modelo para minimizar alucinações em contexto de negócio
- Graceful error: falha no OpenRouter retorna mensagem de erro em PT-BR sem expor stack trace
