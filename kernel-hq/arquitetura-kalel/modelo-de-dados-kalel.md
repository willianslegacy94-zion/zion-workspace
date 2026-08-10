---
status: experimental
domain: kalel
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Modelo de Dados — Kernel Kalel

## Princípio central

O Kalel tem **um único dado próprio**: o histórico da conversa. Tudo o mais que ele usa (tenant, unidade, preços, equipe, agenda, cliente) pertence ao banco PostgreSQL do Kernel e é buscado por HTTP a cada mensagem.

> `database.py`: "Kalel não guarda config de negócio localmente (isso vem inteiro do backend do Kernel) — o único estado local é o histórico de conversa, pra dar memória de curto prazo ao concierge entre mensagens da mesma sessão."

---

## Banco de Dados

| Atributo | Valor |
|---|---|
| Engine | SQLite |
| Arquivo | `kalel.db` (caminho relativo ao working dir do processo — `/app` no container) |
| Inicialização | `init_kalel_db()` chamado no import de `main.py`, idempotente (`CREATE TABLE IF NOT EXISTS`) |
| Persistência no Docker | **Nenhum volume declarado** — o arquivo vive na camada gravável do container |
| Fora da imagem | `.dockerignore` exclui `*.db`; por isso o `chown appuser /app` no Dockerfile é necessário para criar o arquivo na primeira execução |

**Consequência operacional:** `docker compose down` / recriação do container **apaga o histórico de conversas**. Como o histórico é memória de curto prazo (10 mensagens) e não fonte de verdade de nada, a perda é tolerável — mas é um comportamento a confirmar com o Willians antes do deploy em produção, caso ele espere auditoria de conversa.

---

## Entidade: `historico_conversas`

Tabela única do Kalel.

| Campo | Tipo SQLite | Padrão | Descrição |
|---|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | — | Ordem de inserção — é o critério real de recência |
| `session_id` | TEXT | — | Conversa. No WhatsApp: `"{instancia}:{telefone}"`; via HTTP: o que o chamador mandar |
| `tenant_id` | TEXT | — | Tenant do Kernel. Sempre presente no filtro de leitura |
| `role` | TEXT | — | `"user"` ou `"assistant"` |
| `content` | TEXT | — | Texto da mensagem |
| `timestamp` | DATETIME | `CURRENT_TIMESTAMP` | Registro temporal — **não usado para ordenar** |

**Sem índices declarados.** Com volume real, o par (`session_id`, `tenant_id`) é o candidato natural a índice.

---

## Por que ordenar por `id` e não por `timestamp`

```sql
SELECT role, content FROM historico_conversas
WHERE session_id = ? AND tenant_id = ?
ORDER BY id DESC LIMIT 10;
-- resultado revertido em Python para voltar à ordem cronológica
```

O comentário no código explica: `CURRENT_TIMESTAMP` do SQLite tem granularidade de 1 segundo, insuficiente para desempatar mensagens seguidas na mesma conversa. O `id` autoincremental é o único critério confiável de recência.

**Janela de memória:** 10 mensagens (5 turnos, aproximadamente). O que sai da janela é esquecido pelo agente, mas continua na tabela.

---

## Ciclo de vida de uma conversa

```
Cliente manda mensagem
        ↓
INSERT (session_id, tenant_id, 'user', texto)
        ↓
SELECT das 10 mais recentes  →  contexto do modelo
        ↓
[se veio foto] última mensagem do histórico em memória é trocada
por bloco multimodal — a versão em texto continua no banco
        ↓
Modelo responde (eventualmente após rodadas de tool-calling)
        ↓
INSERT (session_id, tenant_id, 'assistant', resposta)
        ↓
Próxima mensagem → ciclo reinicia; nada é apagado
```

**Nota sobre a imagem:** a foto nunca é gravada. O banco guarda só o texto/legenda da mensagem; o data URI base64 existe apenas na chamada ao modelo. Decisão implícita, mas correta em tamanho e em privacidade.

**Nota sobre `resposta_final_texto` nulo:** se o modelo devolvesse `content: null`, o `INSERT` de assistant gravaria `NULL`. Caminho não observado na prática.

---

## Dados que o Kalel **não** guarda (e onde eles vivem)

| Dado | Fonte real | Como o Kalel obtém |
|---|---|---|
| Nome do tenant / unidade | `tenants`, `unidades` (Kernel) | `GET /internal/unidade-atendimento` |
| Persona, tom de voz, regras | `unidades.atendimento_ia` (JSON) | idem |
| Horário de funcionamento | `jornada_unidade` | idem (formatado pelo Kernel como `Seg: 09:00-19:00` por dia, separado por barra vertical) |
| Equipe | `profissionais` (ativos) | idem |
| Preços | `catalogo` (categoria `servico`/`combo`, ativos) | idem |
| Cliente, visitas, churn | `clientes` (Kernel) | Brainiac → `GET /internal/cliente-atendimento` |
| Agendamentos | `agendamentos` (Kernel) | `POST /internal/agendamentos/confirmar` e `.../cancelar` |
| Custo de IA | `agente_custos` (Kernel) | `POST /internal/agente-custo` |
| Transbordo | `notificacoes` (Kernel) | `POST /internal/transbordo` |

**Regra de ouro:** se o dado importa para o negócio, ele mora no PostgreSQL do Kernel. O SQLite do Kalel é descartável.

---

## Entidades do Kernel escritas por causa do Kalel

Não são do Kalel, mas ele é quem provoca a escrita — relevante para quem for auditar:

| Tabela (Kernel) | Escrita provocada | Campo relevante |
|---|---|---|
| `agente_custos` | uma linha por mensagem respondida | `agente = 'kalel'`, `origem = 'kalel_chat'`; o `CHECK` foi ampliado para aceitar `'brainiac'`/`'kalel'` além de `'cortex'`/`'quasar'` |
| `notificacoes` | uma linha por transbordo | `tipo = 'transbordo_humano'`, `nivel = 'aviso'` |
| `agendamentos` | transição de status | `'confirmado'` (com `confirmado_cliente_em`) ou `'cancelado'` |

---

## Evolução do schema (backlog)

| Versão | Mudança | Motivação |
|---|---|---|
| v1.1 | Volume Docker para `kalel.db` | Preservar histórico entre recriações de container |
| v1.2 | Índice em (`session_id`, `tenant_id`) | Custo do `SELECT` cresce linearmente com o volume da tabela |
| v1.3 | Política de expurgo (por idade ou por sessão) | A tabela cresce indefinidamente — nada apaga hoje |
| v2.0 | Histórico no PostgreSQL do Kernel | Se auditoria de conversa virar requisito de produto |

[[indice-kalel]] · [[arquitetura-kalel]] · [[prd-kalel]]
