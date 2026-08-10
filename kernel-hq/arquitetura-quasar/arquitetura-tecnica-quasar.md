---
status: draft
domain: orbita-quasar
source: claude
created: 2026-06-25
updated: 2026-08-07
owner: willians
---

# Arquitetura Técnica — Órbita Quasar

---

## Stack

| Camada | Tecnologia | Versão |
|---|---|---|
| API | FastAPI + Uvicorn | rodando em Docker (`Dockerfile` próprio), porta **5003** (5000 é do Cortex, que roda ao lado) |
| Runtime | Python | 3.12 (`python:3.12-slim`) |
| Banco de dados | SQLite | arquivo `orbita_quasar.db` — **não persistido** entre rebuilds do container (ver Limitações) |
| LLM | via OpenRouter, modelo configurável por `OPENROUTER_MODEL` (env) | default atual: `openai/gpt-5.6-luna` — não é mais fixo em Claude 3.5 Sonnet |
| HTTP client | requests | |
| Config | python-dotenv | `.env` compartilhado da raiz do workspace (`OPENROUTER_API_KEY`, `EVOLUTION_API_KEY` etc.) |
| Mensageria | Evolution API (WhatsApp) | container `evolution_api`, rede Docker `orbita_shared` — mesmo gateway pra todos os tenants |

---

## Estrutura de arquivos

```
orbita-quasar/
├── main.py              — FastAPI app + endpoint + webhook + orquestração (loop de tool-calling)
├── database.py          — criação do schema SQLite, seed de tenants (thieco, whitelabel, lane) e FAQs
├── docker-compose.yml   — env vars por tenant (LANE_CONFEITARIA_API_URL etc.), rede orbita_shared
├── Dockerfile            — python:3.12-slim, usuário não-root
├── requirements.txt     — dependências
├── orbita_quasar.db     — banco SQLite (gerado em runtime, dentro do container — não sai dele)
├── test_local.py        — suite de testes sem API externa (mock do OpenRouter, desatualizada)
└── tools/
    ├── __init__.py
    ├── calendar_mock.py       — tools de calendário (tenant original, mentoria)
    └── lane_confeitaria.py    — tools do Lane Confeitaria (catálogo, agenda, cliente, pedido,
                                  atendimento humano, progresso de atendimento, visão de comprovante)
```

---

## Endpoint

```
POST /api/v1/quasar/chat
```

**Payload (campos comuns a todo tenant, mais os específicos do Lane):**
```json
{
  "tenant_id": "lane_confeitaria",
  "session_id": "sess_abc123",
  "mensagem": "Quero um bolo de 1,5kg de beijinho",
  "nome_cliente": "Maria Silva",
  "email_cliente": "suporte@orbita.com",
  "contato_cliente": "5511999999999",
  "produto": "lane",
  "imagem_url": "data:image/jpeg;base64,... (opcional — foto de referência ou comprovante)"
}
```

**Resposta:**
```json
{
  "acao": "MANTER_NA_IA",
  "resposta_ia": "Perfeito! Horário confirmado para..."
}
```
Ou, quando o cartão do contato está em atendimento humano (só produto="lane"):
```json
{ "acao": "ATENDIMENTO_HUMANO_ATIVO", "resposta_ia": null }
```
Content-Type explícito `application/json; charset=utf-8` — sem isso, clientes como `Invoke-RestMethod` do Windows PowerShell 5.1 corrompem acentos/emoji na resposta (bug real encontrado e corrigido em 2026-08-02).

`tenant_id` e `session_id` são os dois eixos de isolamento: toda memória e configuração são buscadas e gravadas a partir desse par. `produto` diferencia o conjunto de ferramentas/persona (`thieco` | `whitelabel` | `lane`).

Existe também `POST /webhook/evolution` — recebido diretamente da Evolution API (evento `messages.upsert`), mesma lógica de orquestração de `gerar_resposta_quasar`, mas resolve `tenant_id`/`produto`/`contato_cliente` a partir da instância e do remetente do WhatsApp, não de um payload explícito.

---

## Fluxo de uma requisição

```
POST /api/v1/quasar/chat
        │
        ▼
buscar_tenant(tenant_id) [ou buscar_tenant_whitelabel, se produto="whitelabel"]
→ nome_empresa, faq_contexto, flags
        │
        ▼
gerenciar_memoria(session_id, tenant_id, "user", mensagem)
gerenciar_memoria(session_id, tenant_id, recuperar=True)
→ histórico (até 10 msgs do SQLite)
        │
        ▼
Se produto="lane": registrar_progresso_atendimento() — automático, não é
decisão do LLM (cria/avança o card Atendimento no Lane Confeitaria)
        │
        ▼
Se produto="lane" e cartão do contato em fila de atendimento humano:
  → retorna None (silêncio) — endpoint/webhook não enviam nada
        │
        ▼
Se imagem_url presente: última mensagem do histórico vira bloco multimodal
(texto + image_url)
        │
        ▼
Monta system_prompt dinâmico com:
  - nome_empresa, nome_cliente, faq_contexto, capacidades (flags)
  - regra de "mistura" de tom (base do tenant + registro do cliente)
        │
        ▼
LOOP de tool-calling (até 5 rodadas — corrigido em 2026-08-02, antes era
fixo em no máximo 1 rodada):
  chamada ao OpenRouter, sempre reenviando tools/tool_choice="auto"
        │
        ├─ resposta tem tool_calls?
        │       │ SIM
        │       ▼
        │  executa cada tool_call (1 mensagem "role":"tool" por chamada —
        │  tool-calling paralelo do modelo é suportado)
        │  volta pro topo do loop com o resultado injetado no histórico
        │
        └─ NÃO → texto final, sai do loop
        │
        ▼
gerenciar_memoria(session_id, tenant_id, "assistant", resposta_final)
        │
        ▼
return {"acao": "MANTER_NA_IA", "resposta_ia": resposta_final}
  (Content-Type: application/json; charset=utf-8 explícito)
```

---

## Function Calling (Tool Use)

Ativado apenas quando `flag_agendamento_ia = true`.

### Definição das tools (injetadas no payload da API)

**`checar_disponibilidade_agenda`**
- Input: `data_com_hora` (string `"YYYY-MM-DD HH:MM"`)
- Output: string indicando disponível ou ocupado
- Implementação: `tools/calendar_mock.py` — dicionário em memória de horários bloqueados

**`confirmar_agendamento_call`**
- Input: `data_com_hora`
- Output: string confirmando o agendamento
- Implementação: `tools/calendar_mock.py` — adiciona o horário no dicionário e retorna confirmação

### Tools sempre disponíveis, independente de `flag_agendamento_ia` (Thieco/whitelabel)

**`acionar_atendimento_humano`** — válvula de segurança de transbordo, disponível em todo tenant não-lane (lane tem `silenciar_fora_de_escopo` em paralelo). Notifica o admin (WhatsApp real via Cortex/whitelabel) e devolve a mensagem fixa de transbordo.

**`manter_silencio_mesmo_assunto`** (2026-08-07, só thieco/whitelabel) — companheira da anterior: quando o cliente insiste no MESMO assunto já escalado (reconhecido pelo próprio histórico, sem fila externa), o LLM chama esta em vez de responder texto; o loop de tool-calling retorna `None` sem gravar turno "assistant". Ver `comportamento-quasar.md`.

**`calcular_total_servicos`** (2026-08-07, só produto="thieco") — Input: `servicos` (array de strings, nomes como o cliente disse). Chama `GET {THIECO_API_URL}/agendamentos/servicos?unidade=X` (endpoint público real do sistema-thieco), casa cada nome por substring case-insensitive contra o catálogo (preferindo o match mais curto quando ambíguo — ex.: "corte" bate com "Corte" e não com "Combo - Corte + Barba"), soma em Python (`float(preco_venda)`, nunca deixa o LLM calcular) e devolve texto formatado com o total. Primeira tool do Quasar que substitui um dado antes estático do `faq_contexto` por consulta ao vivo a um sistema-tenant real, fora do fluxo de agendamento mock.

### Sequência de 2 chamadas ao LLM

```
Rodada 1  → modelo analisa a mensagem e decide usar 1+ tools (paralelo)
          → retorna tool_calls (não retorna texto ao cliente ainda)

Tool execution → Python executa cada função correspondente localmente
              → 1 mensagem "role":"tool" por tool_call

Rodada 2..N → modelo recebe histórico + tool_calls anteriores + resultados
            → decide se chama MAIS uma tool (ex.: registrar_pedido, depois
              de ver catálogo/agenda) ou já responde em texto final

Encerra na primeira resposta sem tool_calls (até 5 rodadas — ver detalhe
completo do bug corrigido em `fluxos-conversacionais-quasar.md`)
```

`temperature = 0.1` em toda chamada com tools disponíveis (decisão precisa) — a versão antiga usava `0.2` na "2ª chamada" assumindo que ela nunca mais chamaria tool; como isso não é mais garantido (pode haver rodada 3, 4...), todas as chamadas do loop usam a mesma temperatura.

---

## Banco de dados

Dois módulos independentes no mesmo SQLite:

**`tenants_config`** — configuração de cada empresa
```sql
tenant_id TEXT PRIMARY KEY
nome_empresa TEXT
faq_contexto TEXT
flag_agendamento_ia BOOLEAN DEFAULT 1
flag_fechamento_comercial BOOLEAN DEFAULT 0
```

**`historico_conversas`** — memória persistente por sessão
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
session_id TEXT
tenant_id TEXT
role TEXT          -- 'user' | 'assistant'
content TEXT
timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
```

Recuperação: `SELECT ... WHERE session_id = ? AND tenant_id = ? ORDER BY timestamp ASC LIMIT 10` — imagem (`imagem_url`) nunca é persistida aqui, só o texto/legenda; a foto só existe na chamada atual ao modelo.

`tenants_config` hoje tem 3 tenants reais: `sistema_thieco` (2 linhas, uma por unidade — mutinga/tambore), `lane_confeitaria` (single-tenant). Tenants do whitelabel **não** ficam nesta tabela — `produto="whitelabel"` busca config em tempo real na API do whitelabel (`buscar_tenant_whitelabel`), sem nenhuma linha local.

---

## Inicialização

`database.py` cria as tabelas e faz `INSERT OR REPLACE` dos tenants seed — chamado automaticamente no startup do container (não precisa rodar manualmente).

Subir via Docker Compose (forma real de rodar hoje, não `uvicorn` direto):
```bash
docker compose up -d --build
```
Porta publicada: `127.0.0.1:5003`. `Dockerfile` roda `uvicorn main:app --host 0.0.0.0 --port 5003` como usuário não-root.

---

## Limitações atuais

O calendário é mock em memória — reiniciar o processo zera os agendamentos confirmados (só afeta o tenant original de mentoria; Lane Confeitaria e Thieco usam agenda real via API do próprio sistema).
SQLite não suporta concorrência pesada — adequado para MVP e volume baixo-médio.
`OPENROUTER_API_KEY` sem fallback — se a variável não existir, as chamadas falham com 401, cai no fallback genérico hardcoded (`FALLBACK_RESPOSTA`).
Sem retry logic na chamada ao OpenRouter — timeout de 20 segundos por rodada, depois retorna mensagem de fallback hardcoded.
**`orbita_quasar.db` não é persistido entre rebuilds do container** (descoberto 2026-08-02 — arquivo está no `.dockerignore`, sem volume no `docker-compose.yml`). Todo `docker compose up -d --build` apaga o histórico de conversa de **todos** os tenants. Bloqueia deploy real em produção até ter um volume nomeado — registrado em `kernel-hq-arquitetura/12-backlog-painel-admin-cortex-quasar.md`.
Sem rate limiting nem log persistente de custo por tenant — todos dividem a mesma `OPENROUTER_API_KEY` sem rastreio de gasto (mesmo item do backlog acima).
Falha de envio via Evolution API (instância desconectada, HTTP não-2xx) **alerta mas não retenta** (desde 2026-08-05, ver `registro-de-decisoes-quasar.md`) — `_alertar_telegram()` avisa Willians, mas a resposta da IA já foi gerada (custo pago) e o cliente final não recebe nada até a instância ser reconectada manualmente. Não há checagem prévia de `connectionStatus` antes de gerar a resposta.
