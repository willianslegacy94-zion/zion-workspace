---
status: stable
domain: prospeccao
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Requisitos Funcionais — Kernel: Motor Ativo de Prospecção

> Referência: [[prd-prospeccao]]

---

## Módulo 1 — Carga de Leads (database.py)

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-01 | Criar banco SQLite `orbita_black.db` com tabela `leads_prospeccao` se não existir | Alta | Implementado |
| RF-02 | Importar leads de arquivo CSV mapeando colunas: `E-mail Admin`, `Contrato - Contato`, `Telefone` | Alta | Implementado |
| RF-03 | Ignorar leads sem telefone válido ou sem email | Alta | Implementado |
| RF-04 | Usar "Gestor" como nome fallback quando `Contrato - Contato` estiver vazio | Média | Implementado |
| RF-05 | Evitar duplicatas de email usando `INSERT OR IGNORE` (IntegrityError) | Alta | Implementado |
| RF-06 | Exibir total de leads inseridos ao final da importação | Baixa | Implementado |

---

## Módulo 2 — Motor de Disparo em Lote

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-07 | Endpoint `GET /api/v1/black/disparar-lote` que aceita parâmetro `limite` (padrão: 5) | Alta | Implementado |
| RF-08 | Buscar leads com `status_disparo = 'PENDENTE'` respeitando o limite por chamada | Alta | Implementado |
| RF-09 | Gerar mensagem personalizada com o nome do lead interpolado via f-string | Alta | Implementado |
| RF-10 | Atualizar `status_disparo` para `'ENVIADO'` imediatamente após gerar a mensagem | Alta | Implementado |
| RF-11 | Retornar JSON com: status, total disparado e fila com id/nome/telefone/mensagem de cada lead | Alta | Implementado |
| RF-12 | Não reprocessar leads já com status diferente de PENDENTE | Alta | Implementado |

---

## Módulo 3 — Recebimento de Respostas (Webhook)

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-13 | Endpoint `POST /api/v1/black/webhook-resposta` que recebe `telefone_remetente` e `texto_mensagem` | Alta | Implementado |
| RF-14 | Identificar lead pelo campo `telefone` no banco | Alta | Implementado |
| RF-15 | Retornar `status: desconhecido` se telefone não localizado na base | Média | Implementado |
| RF-16 | Encaminhar `texto_mensagem` para classificação por IA antes de atualizar o banco | Alta | Implementado |

---

## Módulo 4 — Classificação por IA (services/openrouter.py)

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-17 | Chamar Claude 3.5 Sonnet via OpenRouter API com a resposta do lead | Alta | Implementado |
| RF-18 | System prompt que instrui a IA a retornar exatamente uma de três palavras: INTERESSADO / RECUSADO / NEUTRO | Alta | Implementado |
| RF-19 | `temperature: 0.0` para garantir resposta determinística e sem variação | Alta | Implementado |
| RF-20 | Timeout de 12 segundos na chamada HTTP para evitar travamento do webhook | Alta | Implementado |
| RF-21 | Fallback: retornar `NEUTRO` em caso de exceção na chamada à API | Alta | Implementado |
| RF-22 | Carregar `OPENROUTER_API_KEY` do arquivo `.env` na raiz do workspace (dois níveis acima) | Alta | Implementado |

---

## Módulo 5 — Transbordo Comercial

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-23 | Se classificação = `INTERESSADO`: atualizar `status_disparo` para `'INTERESSADO'` | Alta | Implementado |
| RF-24 | Se classificação = `RECUSADO`: atualizar `status_disparo` para `'RECUSADO'` | Alta | Implementado |
| RF-25 | Se classificação = `NEUTRO`: atualizar `status_disparo` para `'RESPONDIDO'` | Alta | Implementado |
| RF-26 | Logar alerta em console com nome e telefone do lead INTERESSADO | Média | Implementado |
| RF-27 | Retornar JSON com `status`, `classificacao` e `acao` para o chamador do webhook | Alta | Implementado |
| RF-28 | Gancho comentado para `POST /cards` na API do Trello ao detectar INTERESSADO | Alta | Comentado (pronto para ativar) |

---

## Módulo 6 — Estados da Fila (status_disparo)

| Estado | Transições permitidas | Quem transiciona |
|---|---|---|
| `PENDENTE` | → ENVIADO | Motor de disparo (RF-10) |
| `ENVIADO` | → RESPONDIDO, INTERESSADO, RECUSADO | Webhook de resposta (RF-23/24/25) |
| `RESPONDIDO` | → INTERESSADO (re-análise futura) | Manual ou nova lógica |
| `INTERESSADO` | — (estado final positivo) | — |
| `RECUSADO` | — (estado final negativo) | — |

---

## Requisitos Não Funcionais

| ID | Requisito | Categoria |
|---|---|---|
| RNF-01 | API disponível em `http://127.0.0.1:5000` com reload automático em desenvolvimento | Disponibilidade |
| RNF-02 | Tempo de resposta do endpoint de classificação < 15s (inclui latência OpenRouter) | Performance |
| RNF-03 | SQLite como banco — zero configuração de servidor, arquivo único portável | Simplicidade |
| RNF-04 | Chave da API nunca hardcoded — sempre via `.env` | Segurança |
| RNF-05 | Falha na IA não pode derrubar o webhook — fallback NEUTRO obrigatório | Resiliência |
| RNF-06 | FastAPI com tipagem via Pydantic em todos os modelos de entrada | Qualidade |
