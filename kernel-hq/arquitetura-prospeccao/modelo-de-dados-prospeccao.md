---
status: stable
domain: prospeccao
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Modelo de Dados — Kernel: Motor Ativo de Prospecção

> Referência: [[prd-prospeccao]] | [[arquitetura-prospeccao]]

---

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| `leads_prospeccao` | Um contato da carteira de clientes que está na fila de abordagem ativa | Controla quem foi contactado, quando, com qual resultado e qual é o próximo passo |

> O sistema tem intencionalmente uma entidade única. Toda a lógica de estado e histórico está concentrada aqui. Tabelas adicionais só fazem sentido quando a Evolution API estiver integrada (log de mensagens enviadas/recebidas).

---

## Atributos — leads_prospeccao

| Atributo | Tipo SQLite | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | sim | sim | identificador único auto-incrementado |
| nome | TEXT | não | não | nome do contato — fallback "Gestor" quando coluna vazia no CSV |
| email | TEXT UNIQUE | não | não | email único do lead — constraint UNIQUE evita duplicatas na importação |
| telefone | TEXT | não | não | telefone no formato original do CSV (ex: `41 988389442`) — string, não numérico |
| status_disparo | TEXT DEFAULT 'PENDENTE' | sim | não | estado atual do lead na fila — domínio: PENDENTE / ENVIADO / RESPONDIDO / INTERESSADO / RECUSADO |
| historico_conversa | TEXT DEFAULT '[]' | não | não | campo reservado para histórico futuro em JSON serializado — não utilizado na v1.0 |

---

## Origem dos dados

| Campo no banco | Coluna no CSV | Regra de mapeamento |
|---|---|---|
| nome | `Contrato - Contato` | Usar valor se não nulo e não vazio; senão "Gestor" |
| email | `E-mail Admin` | Normalizado: `.strip().lower()` |
| telefone | `Telefone` | Usar como string; ignorar lead se valor for nulo |

**Filtros de exclusão na importação:**
- Email nulo → linha ignorada
- Telefone nulo → linha ignorada
- Email duplicado → `IntegrityError` capturado, linha ignorada silenciosamente

**Volume carregado:** 1829 leads (de 1857 linhas brutas no CSV — 28 excluídos por email ou telefone inválido)

---

## Estados e ciclo de vida

```
PENDENTE → ENVIADO → RESPONDIDO
                  → INTERESSADO
                  → RECUSADO
```

| Estado | Significado operacional | Quem transiciona | Transições válidas |
|---|---|---|---|
| `PENDENTE` | Lead aguardando abordagem na fila | Estado inicial na importação | → ENVIADO |
| `ENVIADO` | Mensagem gerada e entregue ao canal (WhatsApp via Evolution API) | Motor de disparo | → RESPONDIDO, INTERESSADO, RECUSADO |
| `RESPONDIDO` | Lead respondeu mas sem intenção clara (NEUTRO na IA) | Webhook de resposta | → INTERESSADO (re-análise futura) |
| `INTERESSADO` | Lead demonstrou interesse — quer reunião, pediu info ou foi receptivo | Webhook + classificação IA | — (estado final positivo) |
| `RECUSADO` | Lead pediu para não incomodar, foi hostil ou negou explicitamente | Webhook + classificação IA | — (estado final negativo) |

---

## Relacionamentos

Não há relacionamentos nesta versão — entidade única e isolada. O `telefone` é a chave de lookup para identificar o lead no webhook de resposta (não é FK formal, mas funciona como identificador natural de negócio).

---

## Propriedade e acesso

| Operação | Quem executa | Endpoint / Função |
|---|---|---|
| Criar tabela | Sistema (init) | `init_black_db()` em `database.py` |
| Importar leads | Willians (manual) | `python database.py` |
| Ler leads PENDENTES | Motor de disparo | `GET /disparar-lote` |
| Atualizar para ENVIADO | Motor de disparo | `GET /disparar-lote` |
| Ler por telefone | Webhook | `POST /webhook-resposta` |
| Atualizar para INTERESSADO/RECUSADO/RESPONDIDO | Webhook + IA | `POST /webhook-resposta` |

---

## Ciclo de retenção

| Entidade | Retenção | Excluído após | Nunca excluir |
|---|---|---|---|
| `leads_prospeccao` | permanente | nunca | histórico de abordagem é auditoria comercial |

---

## DDL de referência

```sql
CREATE TABLE IF NOT EXISTS leads_prospeccao (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    nome             TEXT,
    email            TEXT UNIQUE,
    telefone         TEXT,
    status_disparo   TEXT DEFAULT 'PENDENTE',
    historico_conversa TEXT DEFAULT '[]'
);
```
