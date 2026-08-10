---
status: experimental
domain: brainiac
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Arquitetura Técnica — Kernel Brainiac

## Stack

Tudo abaixo lido de `requirements.txt`, `Dockerfile`, `docker-compose.yml` e `main.py`.

| Camada | Tecnologia | Justificativa (rastreada) |
|---|---|---|
| Runtime | Python 3.12-slim (imagem base do `Dockerfile`) | Mesma stack dos demais agentes |
| Framework | FastAPI 0.110.0 | Validação automática via Pydantic (`PayloadNotificarAdmin`) |
| Servidor | Uvicorn 0.28.0 | ASGI; `reload=True` no `__main__`, sem reload no container |
| HTTP Client | requests 2.31.0 | Chamadas síncronas a Kernel, OpenRouter, Evolution e Telegram |
| Config | python-dotenv 1.0.1 | `.env` **local à pasta**, não o compartilhado da raiz |
| IA | OpenRouter, modelo de `OPENROUTER_MODEL` (default no código: `openai/gpt-5.6-luna`) | Modelo barato: tarefa curta, saída JSON pequena — não precisa do modelo caro usado pelo Kalel |
| Banco | **nenhum** | Toda verdade vive no Postgres do Kernel, consumido por HTTP |

**4 dependências apenas.** Não há `sqlite3`, ORM, driver de Postgres nem cliente de cache.

---

## Diferença estrutural vs. Cortex (origem do fork)

O Brainiac nasceu de uma cópia do `orbita-cortex` em 2026-08-05. O que mudou na
arquitetura:

| Elemento | Cortex | Brainiac |
|---|---|---|
| Camada de persistência | SQLite `orbita_cortex.db`, tabela `matriz_inteligencia` | **Não existe** |
| Módulo de banco | `database_cortex.py` | **Não existe** |
| Camada de classificação analítica | `POST /processar` + prompt de perfil de cliente | **Removida** |
| Conector de cliente específico | `conectores/thieco.py`, `TENANT_POR_INSTANCIA_ADMIN` | **Removido** — resolução 100% via API |
| Origem da config | `.env` compartilhado da raiz do workspace | `.env` local à pasta |
| Escopo de tenants | thieco + lane + whitelabel | Somente Kernel |

Resultado: o Brainiac é um serviço **stateless em termos de negócio** — a única coisa que
ele guarda é estado operacional volátil (ver [[modelo-de-dados-brainiac]]).

---

## Camadas do Sistema

```
┌────────────────────────────────────────────────────────────────┐
│                     CAMADA DE ENTRADA                          │
│  Kalel        → GET  /api/v1/brainiac/atendimento              │
│  Kernel (API) → POST /api/v1/brainiac/notificar-admin          │
│  Evolution    → POST /webhook/evolution                        │
│  Docker       → GET  /health                                   │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│              CAMADA DE IDENTIDADE E AUTORIZAÇÃO                 │
│  _resolver_tenant_admin  → instância "${slug}-admin"           │
│                            → GET /internal/tenant-by-slug       │
│  _telefone_e_admin_autorizado → GET /internal/admin-autorizado  │
│  FAIL CLOSED: erro de rede = nega                               │
│  Supressão de eco: IDS_ENVIADOS_PELO_BRAINIAC                   │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│              CAMADA DE INTERPRETAÇÃO (única IA)                 │
│  _classificar_pedido_relatorio                                  │
│  OpenRouter | temperature 0.0 | timeout 15s | JSON estrito      │
│  Saída: {tipo, unidade, periodo_dias}                           │
│  Falha ⇒ tipo=None ⇒ mensagem de ajuda                          │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                 CAMADA DE DADOS (remota, HTTP)                  │
│  GET /internal/cliente-atendimento    (contexto p/ Kalel)       │
│  GET /internal/relatorio-sob-demanda  (conteúdo do relatório)   │
│  Header X-Internal-Key | timeout 5-10s                          │
│  ⚠ O Brainiac NUNCA fala com o Postgres diretamente             │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                    CAMADA DE ENTREGA                            │
│  _formatar_resposta_relatorio → texto WhatsApp                  │
│  POST {EVOLUTION}/message/sendText/{instancia}                  │
│  Normalização de DDI (55) | linkPreview:false | timeout 10s     │
│  _registrar_envio_proprio (anti-eco)                            │
└──────────────────────────┬─────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│              CAMADA DE OBSERVABILIDADE                          │
│  _alertar_telegram   → alerta a Willians, cooldown 15min/instância│
│  _reportar_custo_agente → POST /internal/agente-custo           │
│  print("🧠 BRAINIAC -> ...") → log do container                 │
│  Todas best-effort: nunca propagam exceção                      │
└────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados — Relatório sob demanda (caminho principal)

```
1.  Gestor manda "como tá o faturamento essa semana?" no WhatsApp
        ↓
2.  Evolution API → POST /webhook/evolution (event: messages.upsert)
        ↓
3.  Filtros de ruído: evento errado / sem texto / payload inválido → 200 "ignorado"
        ↓
4.  fromMe=true?
      ├─ id ∈ IDS_ENVIADOS_PELO_BRAINIAC → eco da própria resposta → ignora
      └─ id desconhecido → self-chat do gestor → segue (mensagem real)
        ↓
5.  _resolver_tenant_admin("barbearia-jp-admin")
      → strip "-admin" → GET /internal/tenant-by-slug?slug=barbearia-jp
      → (tenant_id, nome_tenant)   |   None → ignora
        ↓
6.  _telefone_e_admin_autorizado(tenant_id, telefone)
      → GET /internal/admin-autorizado
      → False (inclusive por erro de rede) → ignora SEM responder
        ↓
7.  _classificar_pedido_relatorio(texto)
      → OpenRouter, temperature 0.0
      → {"tipo":"faturamento","unidade":null,"periodo_dias":7}
      → _reportar_custo_agente(...) em paralelo lógico (best-effort)
        ↓
8a. tipo=None → _mensagem_ajuda_relatorio(nome_tenant)
8b. tipo válido → GET /internal/relatorio-sob-demanda
        ├─ 403        → encerra sem responder
        ├─ encontrado:false → "Nada a reportar pra esse período/unidade."
        ├─ sucesso    → _formatar_resposta_relatorio
        └─ exceção    → "Deu um erro buscando esse relatório..."
        ↓
9.  POST {EVOLUTION}/message/sendText/{instancia}
      ├─ ok      → _registrar_envio_proprio(resp.json())
      └─ falha   → log + _alertar_telegram(cooldown por instância)
        ↓
10. 200 {"status": "ok"} para a Evolution API
```

---

## Decisões Técnicas

### Por que nenhum banco próprio?
A verdade de negócio (vendas, clientes, unidades, quem é admin) já vive no Postgres do
Kernel, com regras testadas nas rotas `/internal/*`. Um banco no agente criaria uma segunda
verdade e um problema de sincronização. O Brainiac trocou o SQLite herdado do Cortex por
chamadas HTTP — mais latência, uma verdade só. Ver [[registro-de-decisoes-brainiac]] RD-002.

### Por que um modelo barato, e não o mesmo do Kalel?
Comentário literal no código: *"tarefa curta (poucas linhas de entrada, JSON pequeno de
saída), não precisa do modelo mais caro que o Kalel usa pra atendimento de cliente"*. A
tarefa é classificação de intenção com 4 rótulos, não geração de conversa.

### Por que `temperature 0.0`?
Mesma pergunta do gestor deve rotear sempre para o mesmo relatório. Variação aqui vira
resposta errada ao dono do negócio.

### Por que resolver tenant pelo nome da instância, e não por dicionário?
O slug do tenant já está embutido em `${slug}-admin` (convenção do `whatsappService.js` do
Kernel). Resolver no backend elimina a necessidade de tocar no agente a cada cliente novo —
onboarding vira zero-deploy do lado do Brainiac.

### Por que `requests` síncrono em vez de `httpx` async?
Herdado do Cortex e mantido: o volume é uma mensagem de gestor por vez. As rotas são
`async def` do FastAPI mas fazem I/O bloqueante — aceitável no volume atual, e um ponto a
revisitar se o número de tenants crescer (o event loop fica bloqueado durante os até 15s da
chamada à OpenRouter).

### Por que autorização também antes do "não entendi"?
Sem isso, uma mensagem automática de outro agente caindo no canal admin virava "não
entendi", que voltava, gerando loop infinito entre os dois bots — comportamento já observado
no piloto original (comentário no código; incidente equivalente registrado em
`kernel/backend/routes/internal.js`).

### Por que supressão de eco por id de mensagem, e não por `fromMe`?
O canal admin é pareado no **número pessoal do gestor**. Quando ele escreve para si mesmo,
a mensagem chega com `fromMe = true` — exatamente a mesma marca de uma mensagem enviada
pela nossa API. `fromMe` sozinho não distingue "pergunta real" de "eco da nossa resposta";
o id da mensagem distingue.

---

## Porta, Container e Execução

| Item | Valor |
|---|---|
| Porta interna | 5010 |
| Publicação | `127.0.0.1:5010:5010` — **não exposta à rede do host** |
| Container | `kernel_brainiac` |
| Restart policy | `unless-stopped` |
| Redes | `default` + `orbita_shared` (external, compartilhada com o backend do Kernel) |
| Usuário | `appuser` (não-root, criado no `Dockerfile`) |
| Healthcheck | a cada 30s em `/health`, timeout 10s, start-period 15s, 3 retries |

```bash
# Dev (host, com reload) — main.py __main__: uvicorn 127.0.0.1:5010
python3 main.py

# Container
docker compose up -d --build     # dentro de Kernel-brainiac/
```

**Dependência de infraestrutura:** a rede `orbita_shared` precisa existir previamente
(`external: true`). O comentário do `docker-compose.yml` registra que o nome do container do
backend em dev local é `orbita-test_api` e que isso muda quando a stack for renomeada antes
do deploy na VPS nova.

---

## Segurança

| Item | Estado | Observação |
|---|---|---|
| Autenticação nas rotas do Brainiac | ❌ Ausente | **PA-01** — qualquer um que alcance a porta 5010 pode disparar WhatsApp arbitrário via `notificar-admin`. Hoje mitigado só pelo bind em `127.0.0.1` e pela rede Docker |
| Autenticação para o Kernel | ✅ `X-Internal-Key` (`INTERNAL_SERVICE_KEY`) | Chave ausente vira `""` → o Kernel responde 401 |
| Autorização do gestor | ✅ Delegada ao Kernel, **fail closed** | Erro de rede nega |
| Segredos no repositório | ✅ `.env` real fora do Git | `.gitignore` criado em 2026-08-10 junto com o repo |
| Stack trace exposto ao chamador | ✅ Nunca | `repr` da exceção só no log do container |
| Rate limiting | ❌ Ausente | Cada mensagem de admin autorizado gera uma chamada paga à OpenRouter |
| CORS | ❌ Não configurado | Serviço não é consumido por browser |
| TLS | ❌ Não no serviço | Esperado terminar em proxy reverso na VPS — **não decidido no código** |
| Log de dados sensíveis | ⚠ Telefones aparecem em `print()` | Log de container, não persistido em arquivo pelo serviço |

**Recomendação do @architect (não implementada, requer decisão do Willians):** antes de o
Brainiac sair da rede local, `POST /api/v1/brainiac/notificar-admin` e
`GET /api/v1/brainiac/atendimento` deveriam exigir a mesma `X-Internal-Key` que o Brainiac
já usa para falar com o Kernel — a chave já existe nos dois lados, o custo de adoção é um
`Depends` no FastAPI e nenhuma infraestrutura nova. `POST /webhook/evolution` não pode usar
o mesmo esquema (o chamador é a Evolution API) e precisaria de outra estratégia, como
`apikey` no header ou um path secreto.

---

## Escala e limites conhecidos

| Limite | Origem | Impacto |
|---|---|---|
| Estado só em memória | `_ULTIMO_ALERTA_TELEGRAM`, `IDS_ENVIADOS_PELO_BRAINIAC` | **Uma réplica só.** Escalar horizontalmente quebra tanto o cooldown quanto a supressão de eco |
| I/O bloqueante em rota `async` | `requests` dentro de `async def` | Chamada lenta à OpenRouter (até 15s) bloqueia o event loop |
| Sem retry | Todos os envios | Mensagem perdida é perdida; só gera alerta |
| Set de ids esvaziado por inteiro aos 200 | `_registrar_envio_proprio` | Em volume alto, eco pode voltar a ser tratado como pergunta |

[[indice-brainiac]] · [[prd-brainiac]] · [[modelo-de-dados-brainiac]] · [[integracoes-brainiac]]
