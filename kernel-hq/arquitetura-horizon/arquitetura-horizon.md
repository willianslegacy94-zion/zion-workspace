---
status: stable
domain: horizon
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Arquitetura Técnica — Agente Órbita Horizon

> Referência: [[prd-horizon]] | [[requisitos-funcionais-horizon]]

---

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Framework API | FastAPI 0.110 | Tipagem via Pydantic, docs automáticas no `/docs`, sintaxe limpa | Performance de I/O intensivo seria melhor com async nativo — mas requests síncrono é suficiente para escala atual |
| Runtime | Python 3.x + Uvicorn 0.28 | Ecossistema Python dominante em IA/automação; Uvicorn como servidor ASGI | Não é a linguagem mais rápida — suficiente para volume de tenants EAD |
| Banco de dados | SQLite (arquivo local) | Zero configuração, zero dependência externa, portátil, suficiente para base de alunos de plataformas EAD individuais | Não suporta escritas concorrentes pesadas — se um tenant tiver alto volume simultâneo, migrar para PostgreSQL |
| Cliente HTTP | requests 2.31 | Simples, síncrono, zero config — adequado para chamadas únicas ao OpenRouter por request | Sem suporte a async — se escala exigir concorrência, migrar para httpx |
| IA | Claude 3 Haiku via OpenRouter | Modelo mais rápido e barato do ecossistema Claude — suficiente para suporte de nível 1 (FAQ, login, acesso) | Raciocínio mais limitado que Sonnet — adequado para respostas curtas e diretas, inadequado para raciocínio consultivo complexo |
| CSV import | pandas 2.2.1 | Leitura robusta de CSV com tratamento de NaN e mapeamento de colunas | Dependência pesada para uma operação de import pontual — aceitável pois já é padrão no ecossistema do integrador |
| Variáveis de ambiente | python-dotenv 1.0.1 | Padrão de mercado para separar configuração de código | — |

**Diferença fundamental vs. Pulsar:** Horizon usa Claude 3 **Haiku** (mais barato, mais rápido, adequado para FAQ/suporte) enquanto o Pulsar usa Claude 3.5 **Sonnet** (mais caro, raciocínio superior, necessário para qualificação de leads e contexto consultivo).

---

## 2. Camadas do sistema

```
[Canal Externo — WhatsApp Bot / Chat / n8n / Make]
         ↓  ↑  (HTTP/REST via JSON — sem auth por ora)
[FastAPI — main.py]
    └── POST /api/v1/horizon/chat
         ↓  (1) buscar_regras_locais(tenant_id)
         ↓  (2) autenticar_aluno_base(tenant_id, email)  ← só se flag_validar_aluno = 1
         ↓  (3) gerenciar_memoria_local()
[SQLite — orbita_horizon.db]
    ├── tenants_config
    ├── alunos_base
    └── historico_conversas
         ↓  (4) requisitar_claude_horizon(system_prompt, historico)
[OpenRouter Gateway — services/openrouter.py]
         ↓  ↑  (HTTPS / requests)
[Claude 3 Haiku — OpenRouter API]
```

**Canal externo:** Qualquer sistema que consuma a API — bot WhatsApp, widget de chat EAD, n8n, Make. Horizon não conhece o canal; responde com payload estruturado (`acao` + `resposta_ia`).

**FastAPI (main.py):** Roteamento, orquestração dos 4 passos (buscar config → autenticar aluno → memória → IA). Não contém lógica de banco (delegada às funções helpers) nem lógica de IA (delegada ao openrouter.py).

**SQLite (orbita_horizon.db):** 3 tabelas. Acesso direto via `sqlite3` nativo — sem ORM para manter zero dependência extra.

**OpenRouter Gateway (services/openrouter.py):** Única função: montar payload e chamar a API do Claude 3 Haiku. Encapsula URL, headers, modelo, temperature e tratamento de erro.

---

## 3. Fluxo de dados

### Fluxo completo com `flag_validar_aluno = 1`

```
POST /api/v1/horizon/chat
  → buscar_regras_locais(tenant_id)
      → 404 se tenant não existir
  → autenticar_aluno_base(tenant_id, email_autenticacao)
      → return imediato com msg de rejeição se e-mail ausente ou não encontrado
      → se encontrado: enriquecer faq_contexto com nome e status do aluno
  → gerenciar_memoria_local(role="user", content=mensagem)     # persiste msg do aluno
  → gerenciar_memoria_local(recuperar=True)                    # puxa últimas 6 msgs
  → montar system_prompt com FAQ enriquecido + nome_usuario + regras comportamentais
  → requisitar_claude_horizon(system_prompt, historico)
  → gerenciar_memoria_local(role="assistant", content=resposta_ia)
  → detectar [ACIONAR_TRANSBORDO] na resposta
      → se presente: remover tag + adicionar aviso + return { acao: GATILHO_HUMANO_DETECTADO }
      → se ausente:  return { acao: MANTER_NA_IA, resposta_ia: resposta_limpa }
```

### Fluxo com `flag_validar_aluno = 0` (Horizon Puro)

```
POST /api/v1/horizon/chat
  → buscar_regras_locais(tenant_id)
  → [bloco de autenticação IGNORADO]
  → nome_usuario = "Interlocutor"
  → gerenciar_memoria_local + requisitar_claude_horizon + detecção de transbordo
  → return { acao, resposta_ia }
```

---

## 4. Estrutura de arquivos

```
orbita-horizon/
├── .env                        # OPENROUTER_API_KEY
├── requirements.txt            # Dependências Python
├── database.py                 # Schema SQLite + helpers CRUD + import CSV
├── main.py                     # FastAPI — rota, auth de aluno, orquestração
├── BACKLOG.md                  # Pendências e resultado do teste inicial
├── Cópia de Base de Clientes...csv  # Base de alunos de teste (TheMembers/Zion Academy)
├── orbita_horizon.db           # Banco SQLite gerado pelo init
└── services/
    └── openrouter.py           # Gateway Claude 3 Haiku via OpenRouter
```

---

## 5. Autenticação e segurança

**Estado atual (v1.0):**
- **Sem autenticação de API:** qualquer chamada ao endpoint com `tenant_id` válido é aceita — adequado para ambiente local de desenvolvimento
- **Validação de aluno:** proteção de negócio — o aluno não recebe resposta sem e-mail cadastrado quando `flag_validar_aluno = 1`
- **Chave OpenRouter:** apenas no `.env`, nunca exposta em logs ou responses
- **SQLite local:** não exposto à rede — acesso apenas pelo processo Python local
- **Erros tratados:** falha no OpenRouter retorna string amigável em PT-BR sem stack trace

**Planejado (F2 do backlog):**
- Bearer Token simples em `Authorization: Bearer <TOKEN>` para proteger o endpoint antes de exposição a canal externo real

---

## 6. Estratégia de escala

**Gargalos previstos:**
- SQLite com importações de CSV grandes (>10k alunos por tenant)
- Latência do OpenRouter em horários de pico

**Estratégia atual (suficiente para plataformas EAD individuais):**
- SQLite suporta dezenas de leituras simultâneas sem problema
- Uma escrita por request — volume de alunos por turno não atinge limite do SQLite
- Timeout de 12s no OpenRouter cobre latência normal do Haiku (mais rápido que o Sonnet)

**O que exige reescrita acima de X:**
- Se Horizon operar 10+ tenants com base de alunos >50k cada → migrar `alunos_base` para PostgreSQL com índice em `(tenant_id, email)`
- Se volume de mensagens simultâneas se tornar gargalo → adicionar fila assíncrona
- Se logs e auditoria de acesso se tornarem requisito → adicionar tabela de `audit_log`

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | 2026-06-24 | Criação inicial — FastAPI + SQLite + OpenRouter/Claude 3 Haiku + pandas para import CSV |
