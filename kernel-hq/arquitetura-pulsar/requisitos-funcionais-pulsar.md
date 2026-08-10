---
status: archived
domain: pulsar
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Requisitos Funcionais — Agente Órbita Pulsar

> Referência: [[prd-pulsar]]

---

## Módulo 1 — Gestão de Tenants

| ID | Requisito | Prioridade | Endpoint |
|---|---|---|---|
| RF-01 | Criar ou substituir um tenant com `tenant_id`, `nome_empresa`, `faq_contexto` e as 3 feature flags | Alta | `POST /tenants` |
| RF-02 | Consultar configuração completa de um tenant por `tenant_id` | Alta | `GET /tenants/{tenant_id}` |
| RF-03 | Banco inicializa automaticamente com tenant de demonstração `tenant_pme_pulsar` (Soluções Alpha Consultoria) com todas as flags ativas | Alta | `init_pulsar_db()` no startup |
| RF-04 | Feature flag `flag_enviar_documentos`: quando ativa, o agente instrui o Claude a inserir a tag `[ENVIAR_ARQUIVO_XYZ]` quando solicitado um documento previsto no FAQ | Média | — |
| RF-05 | Feature flag `flag_qualificar_lead`: quando ativa, o agente instrui o Claude a mapear faturamento e perfil em background e inserir `[PERFIL_UPSELL]` quando detectado potencial de alto ticket | Média | — |
| RF-06 | Feature flag `flag_permitir_transbordo`: quando ativa, o agente instrui o Claude a encerrar com `[ACIONAR_TRANSBORDO]` quando o lead exigir atendimento humano | Alta | — |

---

## Módulo 2 — Camada Passiva (Chat Receptivo)

| ID | Requisito | Prioridade | Endpoint |
|---|---|---|---|
| RF-07 | Receber mensagem de lead com `tenant_id`, `session_id` e `mensagem` | Alta | `POST /api/v1/pulsar/chat` |
| RF-08 | Criar ou atualizar registro do lead em `leads_dados` com `nome` e `email` quando fornecidos | Alta | automático no chat |
| RF-09 | Persistir mensagem do lead como `role: user` em `historico_conversas` antes de chamar a IA | Alta | automático |
| RF-10 | Recuperar as últimas 8 mensagens do histórico para compor o contexto da chamada ao Claude | Alta | `gerenciar_memoria(recuperar=True)` |
| RF-11 | Montar system prompt com: nome da empresa, FAQ do tenant, nome/etapa/perfil do lead e feature flags ativas | Alta | `processar_conversa_receptiva()` |
| RF-12 | Chamar Claude 3.5 Sonnet via OpenRouter com `temperature: 0.2` e timeout de 15 segundos | Alta | `requisitar_claude_pulsar()` |
| RF-13 | Persistir resposta da IA como `role: assistant` em `historico_conversas` | Alta | automático |
| RF-14 | Parsear metadados `##META##{"etapa": "X", "perfil": "Y"}` do final da resposta e atualizar `leads_dados` silenciosamente | Média | automático |
| RF-15 | Remover o bloco de metadados da resposta antes de retorná-la ao canal externo | Alta | `resposta_limpa` |
| RF-16 | Retornar no response: `session_id`, `resposta` (texto limpo), `flags` (transbordo/enviar_arquivo/perfil_upsell) e `qualificacao` (etapa/perfil) | Alta | response body |

**Regras de negócio:**

| ID | Regra |
|---|---|
| RN-01 | `session_id` é o identificador único da conversa — cada canal/lead deve gerar um `session_id` único e estável |
| RN-02 | Histórico limitado a 8 mensagens (4 turnos) para controle de tokens enviados ao modelo |
| RN-03 | Falha no parse de metadados é silenciosa — lead mantém etapa e perfil anteriores sem erro |
| RN-04 | Falha no OpenRouter retorna string de erro em PT-BR — nunca expõe exceção ao canal externo |

---

## Módulo 3 — Camada Ativa (Disparos via Webhook)

| ID | Requisito | Prioridade | Endpoint |
|---|---|---|---|
| RF-17 | Receber evento de sistema externo com `tenant_id`, `telefone_destino`, `nome_cliente` e `tipo_evento` | Alta | `POST /api/v1/disparos/webhook` |
| RF-18 | Gerar mensagem de cobrança com valor pendente e chave Pix quando `tipo_evento = "cobranca"` | Alta | template inline |
| RF-19 | Gerar mensagem de boas-vindas quando `tipo_evento = "boas_vindas"` | Alta | template inline |
| RF-20 | Gerar mensagem genérica de atualização para eventos não mapeados | Média | fallback inline |
| RF-21 | Salvar mensagem gerada no histórico como `role: assistant` usando `telefone_destino` como `session_id` | Alta | `gerenciar_memoria()` |
| RF-22 | Retornar `status`, `destino` e `mensagem_gerada` para o sistema externo realizar o envio real | Alta | response body |

**Regras de negócio:**

| ID | Regra |
|---|---|
| RN-05 | Pulsar não envia a mensagem — apenas gera e retorna o payload. O canal externo (WhatsApp, SMS) é responsável pelo envio real |
| RN-06 | `telefone_destino` é usado como `session_id` no histórico — permite que o lead responda e a IA tenha contexto do disparo anterior |
| RN-07 | `valor_pendente` e `chave_pix` são obrigatórios apenas para `tipo_evento = "cobranca"` |

---

## Módulo 4 — Histórico e Infraestrutura

| ID | Requisito | Prioridade | Endpoint |
|---|---|---|---|
| RF-23 | Consultar histórico completo de uma conversa por `session_id` (limite 50 mensagens) | Média | `GET /leads/{session_id}/history` |
| RF-24 | Health check sem autenticação retornando `status: ok` e identificação do agente | Alta | `GET /health` |
| RF-25 | Todas as rotas de negócio requerem `Authorization: Bearer <WEBHOOK_TOKEN>` — retorna 401 sem header, 403 com token inválido | Alta | `verify_token()` |
| RF-26 | Banco SQLite inicializado automaticamente no startup da aplicação via `lifespan` | Alta | `init_pulsar_db()` |
