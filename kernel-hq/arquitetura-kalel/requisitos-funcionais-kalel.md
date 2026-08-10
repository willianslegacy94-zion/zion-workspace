---
status: experimental
domain: kalel
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Requisitos Funcionais — Kernel Kalel

Todos os RFs abaixo estão implementados em `Kernel-Kalel/main.py` salvo onde indicado como gap.

## Módulo 1 — Canais de Entrada

### RF-01 — Healthcheck
- **Rota:** `GET /health` → `{"status": "ok"}`
- Usado pelo `HEALTHCHECK` do Dockerfile (intervalo 30s, timeout 10s, start-period 15s, 3 tentativas)

### RF-02 — Rota HTTP de conversa
- **Rota:** `POST /api/v1/kalel/chat`
- **Payload (`PayloadConversa`):** `tenant_id` (obrigatório), `session_id` (obrigatório), `mensagem` (obrigatório), `nome_cliente` (default `"Cliente"`), `contato_cliente` (opcional), `unidade` (default `""`), `imagem_url` (opcional — URL pública ou data URI)
- **Resposta:** `{"acao": "MANTER_NA_IA", "resposta_ia": "<texto>"}` com `media_type="application/json; charset=utf-8"`
- **Resposta quando o texto final é `None`:** `{"acao": "ATENDIMENTO_HUMANO_ATIVO", "resposta_ia": null}` — caminho herdado do Quasar; hoje o núcleo não retorna `None` deliberadamente em nenhum ponto

### RF-03 — Webhook da Evolution API
- **Rota:** `POST /webhook/evolution`
- **Filtros de descarte (todos retornam 200 com `status: "ignorado"`):** payload não-JSON; `event != "messages.upsert"`; `key.fromMe == true`; `instance` ou remetente ausentes; mensagem sem texto e sem mídia reconhecida; instância sem tenant mapeado
- **Extração de texto (`_extrair_texto_mensagem`):** `conversation` → `extendedTextMessage.text` → `imageMessage.caption`
- **Nunca lança:** exceção no processamento vira `{"status": "erro"}` — a Evolution API só espera um 200 rápido

### RF-04 — Resolução de tenant por instância
- **Chamada:** `GET {WHITELABEL_API_URL}/internal/resolve-instancia?instancia={instance}`, header `X-Internal-Key`, timeout 5s
- **Retorno usado:** `tenant_id`, `unidade_slug`, `tenant_nome`
- **Motivo do match no banco (não split de string):** o nome da instância é `{tenantSlug}-{unidadeSlug}` e os dois pedaços podem conter hífen — só o backend sabe desambiguar
- **Falha ou 404:** mensagem descartada com `status: "ignorado"`

### RF-05 — Chave de sessão
- `session_id = f"{instancia}:{telefone}"` no fluxo de WhatsApp
- `nome_cliente` vem de `data.pushName`, com fallback `"Cliente"`

---

## Módulo 2 — Contexto e Prompt

### RF-06 — Pacote de conteúdo da unidade
- **Chamada:** `GET {WHITELABEL_API_URL}/internal/unidade-atendimento?tenant_id=&unidade=`, timeout 5s
- **Falha ou resposta não-ok:** tratado como **tenant inválido** → `HTTPException 404` ("Tenant inválido no Kalel.")
- **Campos consumidos:** `nome_tenant`, `nome_unidade`, `nome_assistente`, `tom_voz`, `horario`, `endereco`, `mapa_url`, `instagram`, `equipe[]`, `link_agendamento`, `precos[{nome, preco}]`, `regras_atendimento`, `mensagem_transbordo`

### RF-07 — Montagem do FAQ (`_montar_faq`)
Só entram no prompt os blocos efetivamente preenchidos pelo admin:

| Bloco | Condição | Regra embutida no texto |
|---|---|---|
| PERSONA | `nome_assistente` ou `tom_voz` | — |
| HORÁRIO DE FUNCIONAMENTO | `horario` | — |
| ENDEREÇO | `endereco` (+ `mapa_url` se houver) | — |
| INSTAGRAM | `instagram` | — |
| EQUIPE | `equipe` | lista separada por vírgula |
| AGENDAMENTO | `link_agendamento` | "SÓ envie esse link quando o cliente pedir explicitamente para agendar/marcar um horário" |
| TABELA DE PREÇOS | `precos` | "NUNCA informe preços que não estejam nesta lista" |
| REGRAS DE ATENDIMENTO | `regras_atendimento` | — |
| TRANSBORDO PARA HUMANO | `mensagem_transbordo` | executar `acionar_atendimento_humano` **antes** e responder o texto exato configurado |

### RF-08 — Nome do assistente
- `nome_assistente` do tenant tem precedência; `NOME_PADRAO_AGENTE = "Kalel"` é fallback
- `nome_empresa` = `nome_tenant` → `nome_unidade` → `"Atendimento"`

### RF-09 — Contexto do cliente via Brainiac
- **Chamada:** `GET {BRAINIAC_URL}/api/v1/brainiac/atendimento?tenant_id=&contato=[&unidade=]`, timeout 3s
- **Só executa** quando há `contato_cliente`
- **Campos usados no prompt:** `nome`, `contato`, `unidade`, `total_visitas`, `ultima_visita`, `dias_desde_ultima_visita`, `churn_risk`
- **`churn_risk` verdadeiro** vira a instrução "ALTO — cliente sumido há mais de 45 dias, priorize acolhimento"
- **Best-effort:** qualquer falha retorna `None` e a conversa segue sem esse bloco

### RF-10 — Saudação e apresentação
- `saudacao_por_horario()` calcula em `America/Sao_Paulo`: `<6h` = "Boa noite"; `<12h` = "Bom dia"; `<18h` = "Boa tarde"; senão "Boa noite"
- O bloco de apresentação (`"{saudação}! Aqui é o {nome_assistente}, atendente digital da {nome_empresa}."`) só entra quando `len(historico) <= 1` — ou seja, primeira mensagem daquela sessão
- Instrução explícita: uma única saudação na mensagem inteira, e não repetir a apresentação nas próximas

### RF-11 — Adaptação de linguagem
Regra fixa no system prompt: base imutável (frases curtas, direto ao ponto, o tom cadastrado pelo tenant) + camada variável (espelha o registro do cliente — gíria com gíria, formal com formal), sem sacrificar clareza nem as regras de negócio.

---

## Módulo 3 — Geração de Resposta

### RF-12 — Chamada ao modelo
- **Endpoint:** `POST https://openrouter.ai/api/v1/chat/completions`, timeout 20s
- **Modelo:** `OPENROUTER_MODEL` (default `openai/gpt-5.6-luna`)
- **Parâmetros:** `temperature: 0.1`, `tools` com as 3 ferramentas, `tool_choice: "auto"`, `usage: {"include": true}`
- **Mensagens:** system prompt + histórico (últimas 10) + mensagens de tool acumuladas

### RF-13 — Loop de tool-calling
- Máximo de **5 rodadas**; se estourar, loga e usa `FALLBACK_RESPOSTA`
- A cada rodada, tokens e custo são somados (`prompt_tokens`, `completion_tokens`, `cost`)
- Resposta sem `tool_calls` encerra o loop
- Qualquer exceção no bloco inteiro → `FALLBACK_RESPOSTA` (`"Olá! Já te retorno em instantes, só um momento."`)

### RF-14 — Visão (foto de referência)
- Se `imagem_url` existir, a **última** mensagem do histórico é substituída por bloco multimodal `[{type: "text"}, {type: "image_url"}]`
- No WhatsApp, o conteúdo real vem de `POST {EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/{instancia}` (timeout 20s) e vira data URI `data:{mimetype};base64,...` — mídia do WhatsApp é E2E criptografada, o webhook só traz metadados
- Foto sem legenda vira o texto neutro `"Cliente enviou uma foto de referência."`

### RF-15 — Telemetria de custo
- **Chamada:** `POST {WHITELABEL_API_URL}/internal/agente-custo`, timeout 5s
- **Corpo:** `agente: "kalel"`, `origem: "kalel_chat"`, `modelo`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `custo_usd`, `session_id`, `unidade`, `tenant_id` (convertido para `int`)
- Não executa quando `tenant_id` é vazio; falha nunca afeta a conversa

---

## Módulo 4 — Ferramentas (Function Calling)

### RF-16 — `acionar_atendimento_humano`
- **Parâmetro:** `motivo` (string, obrigatório) — resumo curto do que o cliente precisa
- **Efeito:** `POST /internal/transbordo` com `tenant_id`, `unidade`, `contato_cliente`, `nome_cliente`, `motivo` (timeout 5s)
- **Do lado do Kernel:** dispara WhatsApp ao admin do tenant e grava em `notificacoes` (tipo `transbordo_humano`)
- **Falha:** devolve texto de erro ao modelo, que ainda assim responde ao cliente

### RF-17 — `confirmar_agendamento` / `cancelar_agendamento`
- **Parâmetros:** nenhum — o backend acha o agendamento pelo telefone
- **Efeito:** `POST /internal/agendamentos/confirmar` ou `/cancelar` com `tenant_id` (int) e `contato`, timeout 5s
- **Alvo:** próximo agendamento futuro do telefone com status `pendente` ou `confirmado`
- **HTTP 404:** "Não encontrei nenhum agendamento pendente ou confirmado pra esse cliente."
- **Sem `contato_cliente`:** ferramenta responde que não conseguiu identificar o telefone
- **Regra no prompt:** depois de usar a ferramenta, contar o resultado com as próprias palavras e nunca inventar horário

### RF-18 — Ferramenta desconhecida
Qualquer `function.name` fora das três acima retorna `"Ferramenta desconhecida."` ao modelo.

---

## Módulo 5 — Saída no WhatsApp

### RF-19 — Envio de texto
- `POST {EVOLUTION_API_URL}/message/sendText/{instancia}` com `{number, text, linkPreview: false}`, timeout 15s
- `linkPreview: false` evita que o WhatsApp gere thumbnail quando a resposta tem link — o cliente veria como "mensagem com imagem"
- Só envia quando `EVOLUTION_API_KEY` está definida

### RF-20 — Envio com imagem
- `POST /message/sendMedia/{instancia}` com `{number, mediatype: "image", media, caption, fileName: "unidade.jpg"}`
- **Gatilho (`_deve_enviar_imagem`):** a unidade tem `imagem_url` **e** `link_agendamento`, **e** o link aparece literalmente na resposta gerada
- **GAP CONHECIDO:** `GET /internal/unidade-atendimento` do Kernel **não devolve** o campo `imagem_url` — logo esse caminho nunca dispara hoje. Herança do Quasar. Precisa de decisão do Willians: adicionar o campo no backend ou remover a função

### RF-21 — Alerta de falha de envio
- Resposta não-ok da Evolution API → `_alertar_telegram` com cooldown de 900s (15min) por instância
- Mensagem: instância, telefone e HTTP status, com o diagnóstico "Provável instância desconectada — cliente não recebeu resposta"
- **No-op** se `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_CHAT_ID` estiverem ausentes — que é o estado atual do `.env`

---

## Backlog (não implementado)

| ID | Requisito | Origem |
|---|---|---|
| F1 | Campo `imagem_url` no `/internal/unidade-atendimento` (ou remoção do RF-20) | gap encontrado nesta documentação |
| F2 | Aviso de opt-out na primeira mensagem enviada a um cliente novo | `kernel/BACKLOG.md` |
| F3 | Tela de Configurações para editar `nome_assistente`/`tom_voz` | `kernel/BACKLOG.md` |
| F4 | Cobrança/Pix na conversa (Pix Copia e Cola ou link de cartão) | `kernel/BACKLOG.md`, cenários A e B |
| F5 | Retry automático de envio pela Evolution API (hoje só alerta) | herdado do padrão do Cortex, RD-008 |

[[indice-kalel]] · [[prd-kalel]]
