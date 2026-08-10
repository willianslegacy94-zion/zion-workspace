---
status: draft
domain: orbita-quasar
source: claude
created: 2026-06-25
updated: 2026-08-02
owner: willians
---

# Modelo de Dados — Órbita Quasar

---

## Banco de dados

SQLite. Arquivo único: `orbita_quasar.db` na raiz do projeto.
Criado e populado via `python database.py` antes de subir o servidor.

---

## Tabela: tenants_config

Configuração de cada empresa que usa o Quasar. Um tenant = uma empresa.

| Coluna | Tipo | Descrição |
|---|---|---|
| `tenant_id` | TEXT PRIMARY KEY | Identificador único do tenant. Gerado externamente (ex: `tenant_quasar_vip`) |
| `nome_empresa` | TEXT | Nome da empresa — injetado diretamente no system prompt |
| `faq_contexto` | TEXT | Contexto livre de negócio: preços, regras, links, diferenciais. É o "cérebro" do concierge para aquele tenant |
| `flag_agendamento_ia` | BOOLEAN (default 1) | Habilita Function Calling de calendário |
| `flag_fechamento_comercial` | BOOLEAN (default 0) | Habilita condução de fechamento comercial e envio de links de checkout |

**Tenants reais cadastrados (atualizado 2026-08-02 — bem além do seed original de mentoria):**

| tenant_id | unidade | nome_empresa | flag_agendamento_ia | flag_fechamento_comercial |
|---|---|---|---|---|
| `tenant_quasar_vip` | — | Scale Up Mentorias (seed original, fictício) | true | true |
| `sistema_thieco` | `mutinga` | Barbearia Thieco Leandro | 0 | 0 |
| `sistema_thieco` | `tambore` | Barbearia Thieco Leandro | 0 | 0 |
| `lane_confeitaria` | `""` (single-tenant) | Confeitaria Artesanal da Lane | 1 | 1 |

**Nota importante:** as flags `flag_agendamento_ia`/`flag_fechamento_comercial` só controlam o par `TOOLS_DEFINITION` genérico (usado por thieco/whitelabel) — pro produto `lane`, as ferramentas disponíveis (`LANE_TOOLS_DEFINITION`) são decididas direto pelo branch `if produto == "lane":` em `main.py`, essas flags não têm efeito nesse caso.

`faq_contexto` de `lane_confeitaria` = `FAQ_LANE_CONFEITARIA` (`database.py`) — extraído literalmente do material real da cliente (nunca inventado), com seção de calibragem de tom baseada em conversas reais da Lane (adicionada 2026-08-02).

Tenants do `whitelabel` **não** ficam nesta tabela — config buscada em tempo real na API do whitelabel (`buscar_tenant_whitelabel`), sem seed local nenhum.

---

## Tabela: historico_conversas

Memória persistente das conversas. Usada para reconstruir o contexto de cada sessão.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | — |
| `session_id` | TEXT | Identificador da sessão (gerado pelo canal que consome o Quasar) |
| `tenant_id` | TEXT | Garante isolamento — histórico de um tenant nunca mistura com outro |
| `role` | TEXT | `'user'` ou `'assistant'` |
| `content` | TEXT | Texto da mensagem |
| `timestamp` | DATETIME DEFAULT CURRENT_TIMESTAMP | Ordem cronológica |

**Recuperação:** `SELECT role, content WHERE session_id = ? AND tenant_id = ? ORDER BY timestamp ASC LIMIT 10`

O limite de 10 mensagens é a janela de memória ativa do concierge por sessão.

---

## Calendário (em memória — não persistido no banco)

Não é uma tabela SQLite. É um dicionário Python em `tools/calendar_mock.py`:

```python
AGENDA_OCUPADA = [
    "2026-06-25 14:00",
    "2026-06-25 15:00"
]
```

Agendamentos confirmados via `confirmar_agendamento_call` são **adicionados a essa lista em tempo de execução** — não persistem se o processo reiniciar.

**Substituição futura:** a integração real com Google Calendar ou Calendly substitui este dicionário. A interface das duas funções (`checar_disponibilidade_agenda` e `confirmar_agendamento_call`) permanece a mesma — só a implementação interna muda.

---

## Isolamento entre tenants

O par `(session_id, tenant_id)` é o eixo de isolamento:

- `buscar_tenant(tenant_id)` — cada tenant carrega sua própria configuração
- `gerenciar_memoria(session_id, tenant_id, ...)` — cada sessão é gravada e recuperada com o tenant_id como filtro obrigatório

Não existe nenhum endpoint ou função que acesse dados sem filtrar por `tenant_id`.

---

## Ciclo de vida dos dados

| Dado | Persistência | Quando some |
|---|---|---|
| Configuração do tenant | **não sobrevive a rebuild do container** (gap descoberto 2026-08-02) | `orbita_quasar.db` está no `.dockerignore`, sem volume no `docker-compose.yml` — `docker compose up -d --build` recria do zero. Registrado como bloqueio de produção em `kernel-hq-arquitetura/12-backlog-painel-admin-cortex-quasar.md` |
| Histórico de conversa | mesmo problema acima — nunca apagado por TTL, mas apagado por rebuild | idem |
| Imagem enviada pelo cliente (`imagem_url`) | **nunca persistida** — só existe na chamada atual ao modelo | some assim que a resposta é gerada; só o texto/legenda da mensagem vira histórico |
| Agenda de horários ocupados (tenant original, mock) | em memória (Python dict) | ao reiniciar o processo do servidor |
| Agenda/pedido real (Thieco, Lane Confeitaria) | no Postgres de cada sistema, não no Quasar | não afetada pelo rebuild do Quasar |
