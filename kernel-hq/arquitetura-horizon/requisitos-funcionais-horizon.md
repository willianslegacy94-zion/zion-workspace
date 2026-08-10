---
status: archived
domain: horizon
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Requisitos Funcionais — Agente Órbita Horizon

> Referência: [[prd-horizon]]

---

## Módulo 1 — Gestão de Tenants

| ID | Requisito | Prioridade | Onde |
|---|---|---|---|
| RF-01 | Criar ou substituir um tenant com `tenant_id`, `nome_empresa`, `faq_contexto` e as 2 feature flags | Alta | `INSERT OR REPLACE INTO tenants_config` |
| RF-02 | Feature flag `flag_validar_aluno`: quando ativa (1), exige e-mail válido na `alunos_base` antes de responder — nega acesso se não encontrado | Alta | `autenticar_aluno_base()` |
| RF-03 | Feature flag `flag_permitir_transbordo`: quando ativa (1), o agente instrui o Claude a emitir `[ACIONAR_TRANSBORDO]` quando o aluno exigir atendimento humano | Alta | system prompt |
| RF-04 | Banco inicializa automaticamente com tenant de demonstração `tenant_teste_01` (Zion Academy) com ambas as flags ativas e FAQ com link de login da TheMembers | Alta | `init_horizon_db()` |
| RF-05 | Função `popular_ambiente_teste()` importa CSV de base de alunos, mapeando colunas `E-mail Admin` e `Contrato - Contato` / `Nome da plataforma` — insere até 15 registros de amostra | Alta | `database.py __main__` |

**Regras de negócio:**

| ID | Regra |
|---|---|
| RN-01 | `flag_validar_aluno = 0` ("Horizon Puro"): agente responde para qualquer mensagem sem validação de identidade — usado para tenants de suporte público |
| RN-02 | `flag_validar_aluno = 1`: e-mail ausente ou não encontrado na base resulta em resposta de rejeição imediata sem chamada ao OpenRouter — zero custo de IA |

---

## Módulo 2 — Autenticação de Aluno

| ID | Requisito | Prioridade | Função |
|---|---|---|---|
| RF-06 | Receber `email_autenticacao` opcional no payload do chat | Alta | campo `PayloadConversa` |
| RF-07 | Quando `flag_validar_aluno = 1`, buscar o e-mail em `alunos_base` filtrando por `tenant_id` — comparação case-insensitive com strip de espaços | Alta | `autenticar_aluno_base()` |
| RF-08 | Se e-mail não encontrado: retornar resposta de rejeição padronizada com nome da empresa, sem chamar o OpenRouter | Alta | return antecipado em `processar_conversa()` |
| RF-09 | Se e-mail encontrado: enriquecer o `faq_contexto` com nome e status da assinatura do aluno antes de montar o system prompt | Alta | `faq_contexto += ...` |
| RF-10 | Campo `nome_usuario` padrão é "Interlocutor" — substituído pelo nome real do aluno quando encontrado | Média | variável local |

**Regras de negócio:**

| ID | Regra |
|---|---|
| RN-03 | Aluno com `status_assinatura` diferente de "ATIVA" ainda é autenticado — o status é informado ao Claude no contexto para que ele decida como tratar |
| RN-04 | `email_autenticacao` ausente com `flag_validar_aluno = 1` resulta em rejeição imediata — o campo é opcional no payload mas obrigatório para autenticação |

---

## Módulo 3 — Chat Receptivo

| ID | Requisito | Prioridade | Onde |
|---|---|---|---|
| RF-11 | Receber mensagem com `tenant_id`, `session_id`, `mensagem` e `email_autenticacao` (opcional) | Alta | `POST /api/v1/horizon/chat` |
| RF-12 | Persistir mensagem do usuário como `role: user` no histórico antes de chamar a IA | Alta | `gerenciar_memoria_local()` |
| RF-13 | Recuperar as últimas 6 mensagens do histórico (`ORDER BY timestamp ASC LIMIT 6`) para compor o contexto | Alta | `gerenciar_memoria_local(recuperar=True)` |
| RF-14 | Montar system prompt com: nome da empresa, FAQ enriquecido com dados do aluno (se autenticado), nome do usuário e regras comportamentais fixas | Alta | string f-literal em `processar_conversa()` |
| RF-15 | Chamar Claude 3 Haiku via OpenRouter com `temperature: 0.3` e timeout de 12 segundos | Alta | `requisitar_claude_horizon()` |
| RF-16 | Persistir resposta da IA como `role: assistant` no histórico | Alta | `gerenciar_memoria_local()` |
| RF-17 | Detectar tag `[ACIONAR_TRANSBORDO]` na resposta da IA | Alta | `if "[ACIONAR_TRANSBORDO]" in resposta_ia` |
| RF-18 | Quando transbordo detectado: remover a tag da resposta, adicionar aviso de sinalização ao aluno, retornar com `acao: GATILHO_HUMANO_DETECTADO` | Alta | bloco if em `processar_conversa()` |
| RF-19 | Quando sem transbordo: retornar com `acao: MANTER_NA_IA` e a resposta limpa | Alta | return final |

**Regras de negócio:**

| ID | Regra |
|---|---|
| RN-05 | O campo `acao` no response é o contrato com o canal externo: `MANTER_NA_IA` = continuar no bot; `GATILHO_HUMANO_DETECTADO` = transferir para humano |
| RN-06 | A tag `[ACIONAR_TRANSBORDO]` nunca é exposta ao aluno — é removida antes do retorno |
| RN-07 | Falha no OpenRouter retorna string de erro em PT-BR com `acao: MANTER_NA_IA` — nunca expõe exception ao canal externo |
| RN-08 | Histórico de 6 mensagens cobre 3 turnos completos (user + assistant × 3) — suficiente para contexto de dúvidas de suporte sem explodir o context window do Haiku |

---

## Módulo 4 — Infraestrutura

| ID | Requisito | Prioridade | Onde |
|---|---|---|---|
| RF-20 | Banco SQLite criado automaticamente no startup via `init_horizon_db()` com as 3 tabelas | Alta | `database.py` |
| RF-21 | Importação de CSV via `popular_ambiente_teste(caminho_csv)` — executada diretamente via `python database.py <caminho_csv>` | Alta | `database.py __main__` |
| RF-22 | Servidor sobe em `127.0.0.1:5000` via Uvicorn com `reload=True` para desenvolvimento | Alta | `main.py __main__` |
| RF-23 | Documentação automática Swagger disponível em `/docs` sem autenticação | Média | FastAPI padrão |

**Planejado (backlog):**

| ID | Requisito | Prioridade | Item |
|---|---|---|---|
| RF-P1 | Autenticação Bearer Token em todas as rotas de negócio | Alta | F2 |
| RF-P2 | Endpoint `DELETE /historico/{session_id}` para limpeza de sessões | Média | F3 |
| RF-P3 | Webhook de transbordo para CRM externo (stub comentado no `main.py` ~linha 88) | Média | F4 |
| RF-P4 | Frontend mínimo HTML/JS para teste sem curl | Baixa | F1 |
