---
status: experimental
domain: brainiac
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Modelo de Dados — Kernel Brainiac

## Resumo em uma linha

**O Brainiac não tem banco de dados.** Nenhum arquivo `database*.py`, nenhum SQLite,
nenhum driver de Postgres em `requirements.txt` (só `fastapi`, `uvicorn`, `requests`,
`python-dotenv`). Todo dado de negócio é buscado por HTTP no backend do Kernel a cada
requisição e descartado em seguida.

Este documento existe para registrar **por que não há persistência**, **que estado
volátil existe** e **de que dados de terceiros o serviço depende**.

---

## 1. Por que não há persistência própria

Herdado por remoção do fork: o Cortex original mantinha `orbita_cortex.db` com a tabela
`matriz_inteligencia` (ver [[modelo-de-dados-cortex]]). O fork do Brainiac removeu isso
deliberadamente — comentário literal em `main.py`:

> *"sem SQLite local — tudo que o Brainiac sabe vem do próprio backend do Kernel via
> `WHITELABEL_API_URL`/`INTERNAL_SERVICE_KEY`"*

Consequências arquiteturais:
- **Uma verdade só.** Cliente, admin, unidade, venda e estoque existem apenas no Postgres
  do Kernel. Não há risco de divergência entre o que o agente acha e o que o painel mostra.
- **Sem migration própria.** Mudança de schema do Kernel não exige deploy do Brainiac,
  desde que o contrato `/internal/*` não mude.
- **Sem backup próprio.** Perder o container do Brainiac não perde nenhum dado.
- **Custo:** latência de rede em todo caminho, e indisponibilidade do Kernel degrada
  imediatamente todas as capacidades do agente.

---

## 2. Estado volátil em memória (o único "dado" do Brainiac)

Duas estruturas de módulo, vivas apenas enquanto o processo roda.

### 2.1 `IDS_ENVIADOS_PELO_BRAINIAC: set[str]`

| Atributo | Valor |
|---|---|
| Conteúdo | `key.id` das mensagens que o próprio Brainiac enviou pela Evolution API |
| Escrita | `_registrar_envio_proprio(resposta_evolution)` — em `notificar_admin` e no envio da resposta do webhook |
| Leitura | `webhook_evolution_admin`, ao avaliar eventos `fromMe = true` |
| Remoção | Consumo único: id reconhecido é descartado (`.discard`) ao suprimir o eco |
| Cap | Se `len(...) > 200`, o set inteiro é esvaziado (`.clear()`) antes de adicionar |
| Persistência | Nenhuma — restart zera |

**Motivo de existir:** o canal admin é pareado no número pessoal do gestor. Quando ele
escreve "para si mesmo", o evento chega com `fromMe = true` — a mesma marca de uma
mensagem enviada pela nossa API. Sem esse registro, o Brainiac tentaria classificar o
próprio relatório como se fosse uma pergunta nova.

**Risco conhecido (PA-02):** o cap é destrutivo em bloco, não LRU. Sob volume alto, ids
recentes são descartados junto com os antigos.

### 2.2 `_ULTIMO_ALERTA_TELEGRAM: dict[str, float]`

| Atributo | Valor |
|---|---|
| Chave | `chave_cooldown` — hoje sempre o nome da instância Evolution |
| Valor | `time.monotonic()` do último alerta enviado |
| Janela | `_COOLDOWN_ALERTA_SEGUNDOS = 900` (15 min) |
| Escrita/leitura | `_alertar_telegram(mensagem, chave_cooldown)` |
| Limpeza | **Nenhuma** — cresce com o número de instâncias distintas que já falharam |
| Persistência | Nenhuma — restart zera e o próximo alerta sai imediatamente |

**Motivo de existir:** sem cooldown, uma instância desconectada por horas gera um alerta
por mensagem, inviabilizando o canal de alerta (mesmo raciocínio de
[[registro-de-decisoes-cortex]] RD-008).

### 2.3 Constantes de domínio (imutáveis, código)

| Constante | Tipo | Conteúdo |
|---|---|---|
| `TIPOS_RELATORIO` | `set[str]` | `faturamento`, `produtos_mais_vendidos`, `servicos_mais_realizados`, `estoque_parado` |
| `LABEL_POR_TIPO_RELATORIO` | `dict[str, str]` | Rótulo humano de cada tipo, usado na mensagem de ajuda |
| `_COOLDOWN_ALERTA_SEGUNDOS` | `int` | `900` |

`TIPOS_RELATORIO` é o **contrato de acoplamento** com o Kernel: precisa continuar sendo um
subconjunto de `TIPOS_RELATORIO_SOB_DEMANDA` em
`kernel/backend/routes/internal.js`, senão o backend responde 422.

---

## 3. Estruturas de dados em trânsito

### 3.1 `PayloadNotificarAdmin` (Pydantic — única validação formal do serviço)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `instancia` | `str` | Sim | Nome da instância Evolution (ex.: `barbearia-jp-admin`). Não é `tenant_id` — o chamador já sabe a convenção |
| `telefone` | `str` | Sim | Telefone do admin; normalizado internamente (só dígitos, prefixo `55` se faltar) |
| `mensagem` | `str` | Sim | Texto pronto do relatório/notificação |

Campo ausente ou tipo errado → HTTP 422 automático do FastAPI.

### 3.2 Saída de `_classificar_pedido_relatorio`

| Chave | Tipo | Domínio | Fallback |
|---|---|---|---|
| `tipo` | `str \| None` | Um dos 4 de `TIPOS_RELATORIO` | `None` (⇒ mensagem de ajuda) |
| `unidade` | `str \| None` | Slug minúsculo, dinâmico por tenant — **não validado localmente** | `None` (⇒ todas as unidades) |
| `periodo_dias` | `int` | `>= 1` | `1` |

**Nota de desenho:** `unidade` é intencionalmente não validada no agente — as unidades são
dinâmicas por tenant, e o backend ignora slug inexistente caindo em "todas as unidades".
Isso evita ter que sincronizar uma lista de unidades dentro do Brainiac.

### 3.3 `cliente` (repassado ao Kalel, produzido pelo Kernel)

Campos observados em `GET /internal/cliente-atendimento`
(`kernel/backend/routes/internal.js`) e repassados **sem transformação**:

| Campo | Origem |
|---|---|
| `nome`, `contato`, `unidade`, `tipo` | tabela `clientes` do tenant |
| `primeira_visita`, `ultima_visita`, `total_visitas` | tabela `clientes` |
| `dias_desde_ultima_visita` | calculado no backend |
| `churn_risk` | `1` se `dias_desde_ultima_visita > 45`, senão `0` — **regra determinística, sem IA** |

O `LIMITE_DIAS_CHURN = 45` vive no Kernel, **não** no Brainiac. Mudar essa regra não requer
deploy do agente.

### 3.4 `resultados[]` (relatório, produzido pelo Kernel)

Cada item consumido por `_formatar_resposta_relatorio` tem `unidade`, `titulo` e
`mensagem`. Quando uma unidade não teve movimento no período, o backend ainda a inclui com
`titulo: "Sem dados"` — decisão do Kernel, para que a unidade não desapareça da resposta.

---

## 4. Dados de terceiros dos quais o Brainiac depende

| Entidade | Onde vive | Como o Brainiac acessa | Se sumir |
|---|---|---|---|
| `tenants` (id, slug, nome, ativo) | Postgres do Kernel | `GET /internal/tenant-by-slug` | Não resolve a instância → ignora a mensagem |
| `usuarios` role=`admin` (telefone) | Postgres do Kernel | `GET /internal/admin-autorizado` | Fail closed → não responde ninguém |
| `clientes` | Postgres do Kernel | `GET /internal/cliente-atendimento` | Kalel perde o contexto, mas segue atendendo |
| `unidades` (slug, ativo) | Postgres do Kernel | Implícito no relatório | Relatório sai vazio |
| Vendas / produtos / serviços / estoque | Postgres do Kernel | `GET /internal/relatorio-sob-demanda` | Mensagem de erro graciosa ao gestor |
| `agente_custos` | Postgres do Kernel | `POST /internal/agente-custo` (escrita) | Telemetria perdida, atendimento intacto |

**Único ponto de escrita do Brainiac em dado persistente de terceiros:**
`agente_custos`, via `POST /internal/agente-custo`, com `agente = "brainiac"`. A coluna
`agente_custos.agente` tem `CHECK` que precisa aceitar `'brainiac'` — migration já aplicada
e testada no Kernel (`kernel/BACKLOG.md`, 2026-08-05).

---

## 5. Evolução do modelo (backlog, não implementado)

| Cenário | Consequência para este documento |
|---|---|
| Rodar mais de uma réplica do Brainiac | Exige mover `IDS_ENVIADOS_PELO_BRAINIAC` e `_ULTIMO_ALERTA_TELEGRAM` para armazenamento compartilhado (ex.: Redis). Hoje o serviço é **single-replica por construção** |
| Retry automático de envio falho | Exige uma fila persistente — não existe hoje |
| Auditoria de perguntas do gestor | Exigiria persistência nova ou um endpoint de log no Kernel — **não documentado no código, perguntar ao Willians se é desejado** |
| Novo tipo de relatório | Alterar `TIPOS_RELATORIO` + `LABEL_POR_TIPO_RELATORIO` **e** `TIPOS_RELATORIO_SOB_DEMANDA` no backend do Kernel, nos dois lados |

[[indice-brainiac]] · [[arquitetura-brainiac]] · [[prd-brainiac]]
