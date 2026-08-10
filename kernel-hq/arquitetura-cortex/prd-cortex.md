---
status: stable
domain: cortex
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# PRD — Órbita Cortex

## 1. Contexto

A Holding de Robôs da Zion Ops opera com múltiplos agentes especializados (Horizon, Pulsar, Quasar) que atendem clientes em canais distintos. Cada agente toma decisões locais — sem visão do estado real do cliente no ecossistema. Um aluno com 90% de progresso pode receber suporte básico do Horizon enquanto nenhum agente aciona a oferta de Mentoria VIP. O Órbita Cortex é o cérebro analítico central da Holding: um motor de classificação que processa dados comportamentais de clientes, chama IA para raciocinar sobre o perfil, e grava flags operacionais no banco central que todos os agentes consultam.

## 2. Problema

**Dor específica:** Agentes da Holding operam em silos, sem inteligência compartilhada, gerando comportamentos contraditórios ou oportunidades perdidas.

**Como se manifesta:**
- Cliente com churn risk alto não é acolhido proativamente pelo Horizon
- Lead com 80% de progresso no curso nunca recebe oferta de Mentoria VIP do Pulsar
- Agentes tomam decisões com dados locais e desatualizados
- Nenhuma entidade centraliza o valor do cliente (LTV acumulado) para priorizar atendimento
- Sem fonte única de verdade, métricas de negócio são inconsistentes entre agentes

**Por que ainda não foi resolvida:** Os agentes foram construídos como unidades autônomas. Adicionar lógica analítica em cada um criaria duplicação, acoplamento e inconsistência. A solução exige uma camada separada com autoridade exclusiva sobre a classificação.

## 3. Objetivo

Após o Cortex existir:
- Todo evento de plataforma (compra, acesso, progresso) gera uma classificação analítica imediata
- O flag `churn_risk` orienta o Horizon a priorizar acolhimento antes que o aluno abandone
- O flag `upsell_product` orienta Pulsar e Quasar a oferecer o produto certo no momento certo
- O LTV acumulado de cada cliente é registrado e atualizado automaticamente
- Todos os agentes consultam a mesma fonte de verdade — zero comportamento contraditório

## 4. Usuário

**Quem:**
- **Willians (integrador/dono):** conecta plataformas ao Cortex via POST, monitora o banco
- **Plataformas externas (produtores de evento):** enviam dados comportamentais via webhook
- **Horizon / Pulsar / Quasar (consumidores):** leem os flags do banco para adaptar comportamento

**Estado no uso:**
- Plataforma: envia evento automaticamente após ação do cliente (compra, aula concluída, login)
- Agentes: consultam o banco antes de responder para personalizar a abordagem
- Willians: audita o banco para verificar classificações e ajustar regras via prompt

**Contexto:** API REST sem interface visual. Integrado via n8n, Make ou webhook direto da plataforma. O Cortex não conversa com o cliente final — apenas classifica e armazena.

## 5. Hipótese de solução

Um motor FastAPI com banco SQLite local que:
1. Recebe payload de plataforma com dados comportamentais do cliente
2. Chama Claude 3.5 Sonnet via OpenRouter com `temperature: 0.0` para classificação determinística
3. Grava/atualiza dois flags operacionais: `churn_risk` (booleano) e `upsell_product` (string)
4. Acumula LTV e atualiza progresso a cada evento recebido
5. Isola clientes por `tenant_id` para suporte multi-tenant

**Por que faz sentido:** A lógica de classificação é de responsabilidade da IA — o Cortex fornece os dados brutos e o contexto das regras. Claude 3.5 Sonnet (temperature 0.0) garante determinismo: mesma entrada = mesmo flag. O banco SQLite é o canal de comunicação passivo entre o Cortex e os agentes.

**Risco central:** A qualidade da classificação depende da completude do payload enviado pela plataforma. Dados ausentes ou imprecisos geram flags incorretos. Responsabilidade do integrador garantir que o evento contenha dias ativos, progresso e valor reais.

## 6. Escopo

**Dentro:**
- Endpoint `POST /api/v1/cortex/processar` para ingestão de eventos
- Classificação via IA com prompt determinístico (temperature 0.0)
- Dois flags operacionais: `churn_risk` e `recomendacao_upsell`
- Acumulação de LTV por `ON CONFLICT DO UPDATE`
- Isolamento de cliente por `tenant_id`
- Banco SQLite local (`orbita_cortex.db`) como canal passivo de comunicação

**Fora:**
- Envio de mensagens ou notificações para clientes
- Interface visual de administração
- Autenticação Bearer Token na API (backlog F2)
- Webhook de saída para os agentes (agentes leem o banco diretamente)
- Lógica conversacional de qualquer tipo

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Comportamentos contraditórios entre agentes | frequente | 0% — fonte única de verdade |
| Tempo de processamento por evento | — | < 15 segundos (inclui IA) |
| Cobertura de clientes classificados | 0% | 100% dos eventos de plataforma |
| LTV acumulado correto | calculado manualmente | automático, atualizado por evento |
| Upsell acertado (produto certo para o perfil) | inconsistente | > 85% de aderência ao perfil real |

## 8. Requisitos de alto nível

**Funcionais:**
- Endpoint de ingestão com payload padronizado (tenant_id, email, nome, valor, progresso, dias)
- Classificação IA determinística retornando JSON puro com `churn_risk` e `upsell_product`
- Persistência com upsert: novo cliente cria registro, cliente existente atualiza flags e acumula LTV
- Busca do `.env` global na raiz do workspace (não local ao projeto)

**Não funcionais:**
- `temperature: 0.0` no modelo para garantir determinismo das classificações
- Timeout de 15 segundos na chamada ao OpenRouter
- SQLite como banco local — zero dependência de servidor externo
- Graceful error: falha na IA retorna `{"status": "erro"}` sem expor stack trace
- Limpeza preventiva de markdown nas respostas da IA antes do `json.loads`
