---
status: draft
domain: quasar
source: claude
created: 2026-06-25
updated: 2026-08-02
owner: willians
---

# Fluxos Conversacionais — Órbita Quasar

Mapeia os cenários de conversa que o engine precisa executar corretamente.
Os fluxos de agendamento são os mais críticos — envolvem 2 chamadas ao LLM e execução de código Python.

---

## Fluxo 1 — Conversa simples (sem tool)

`flag_agendamento_ia` pode estar em qualquer valor. O cliente não demonstra intenção de agendar.

```
Cliente: "Oi, quem é você?"

→ Chamada ao LLM (sem tools no payload ou com tools disponíveis mas não acionadas)
→ Claude responde com base no system_prompt e faq_contexto

Resposta: "Olá! Sou o concierge da Scale Up Mentorias..."
```

Uma única chamada ao LLM. Sem execução de tool.

---

## Fluxo 2 — Tentativa de agendar horário OCUPADO

`flag_agendamento_ia = true`. Cliente pede horário que já está na `AGENDA_OCUPADA`.

```
Cliente: "Quero marcar minha call para 25/06 às 14h"

→ 1ª chamada ao LLM
  → Claude recebe tools disponíveis
  → Claude decide acionar: checar_disponibilidade_agenda("2026-06-25 14:00")
  → retorna tool_calls (sem texto ao cliente ainda)

→ Execução local: calendar_mock.checar_disponibilidade_agenda("2026-06-25 14:00")
  → retorna: "Indisponível. O horário 2026-06-25 14:00 já está ocupado por outro cliente."

→ 2ª chamada ao LLM
  → histórico + tool_call anterior + resultado da tool injetados
  → Claude gera resposta final

Resposta: "Infelizmente o horário das 14h já está reservado.
           Tenho disponibilidade às 13h, 13h30, 16h ou 17h no dia 25/06. Qual prefere?"
```

---

## Fluxo 3 — Agendamento em horário LIVRE + confirmação

`flag_agendamento_ia = true`. Cliente pede horário disponível.

```
Cliente: "E às 16h, está disponível?"

→ 1ª chamada ao LLM
  → Claude aciona: checar_disponibilidade_agenda("2026-06-25 16:00")

→ Execução local
  → "2026-06-25 16:00" não está em AGENDA_OCUPADA
  → retorna: "Disponível. O horário 2026-06-25 16:00 está totalmente livre."

→ 2ª chamada ao LLM
  → Claude pode acionar confirmar_agendamento_call("João Silva", "joao@email.com", "2026-06-25 16:00")
  → ou pode perguntar ao cliente se quer confirmar (depende do contexto)

→ Execução local (se confirmação):
  → adiciona "2026-06-25 16:00" em AGENDA_OCUPADA
  → retorna: "Sucesso! Reunião agendada para João Silva (joao@email.com) no dia 2026-06-25 16:00."

→ 2ª chamada ao LLM (com resultado da confirmação)
Resposta: "Perfeito! Horário confirmado. Sua call está agendada.
           Um convite será enviado para seu e-mail em instantes."
```

---

## Fluxo 4 — Fechamento comercial

`flag_fechamento_comercial = true`. Cliente pergunta sobre renovação.

```
Cliente: "Quero renovar minha mentoria"

→ Chamada ao LLM
  → Claude identifica intenção de renovação
  → Claude busca no faq_contexto o link de renovação
  → Instrução no system_prompt: "Fechamento Comercial ativo: True.
     Você tem autorização para conduzir o fechamento e enviar links de checkout/renovação."

Resposta: "Fico feliz em te ajudar com a renovação!
           Você pode renovar diretamente pelo link: https://scaleup.com/renovar
           Qualquer dúvida sobre o processo, é só falar."
```

Nenhuma tool é acionada. O LLM usa o `faq_contexto` para extrair o link e conduz o fechamento com autonomia.

---

## ⚠️ Correção de 2026-08-02: não é mais "2 chamadas fixas"

**A seção abaixo descrevia um design que continha um bug real**, descoberto e corrigido em 2026-08-02 (detalhe completo em `registro-de-decisoes-quasar.md`): a 2ª chamada nunca reenviava `tools`/`tool_choice` — o modelo ficava impossibilitado de pedir uma 2ª ferramenta depois de ver o resultado da 1ª, mesmo quando precisava (ex.: checar catálogo+agenda e só DEPOIS chamar `registrar_pedido`, no domínio do Lane Confeitaria). Isso nunca quebrou visivelmente no tenant original (agendamento de mentoria — geralmente 1 tool basta), mas é um bug real, não uma limitação intencional.

**Comportamento real desde a correção:** loop de até 5 rodadas — cada chamada ao OpenRouter reenvia `tools`/`tool_choice="auto"`; o loop só para quando uma resposta vem sem `tool_calls`. Os exemplos dos Fluxos 2 e 3 abaixo (2 chamadas) continuam válidos como **caso mais comum**, mas a estrutura de dados na seção seguinte foi atualizada pra refletir o loop real, não o design antigo.

## Sequência de N chamadas — estrutura de dados

### 1ª chamada (com tool_calls na resposta)

```python
# Payload enviado ao OpenRouter
{
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [{"role": "system", ...}] + historico,
    "tools": TOOLS_DEFINITION,
    "tool_choice": "auto",
    "temperature": 0.1
}

# Resposta do Claude
{
    "choices": [{
        "message": {
            "role": "assistant",
            "tool_calls": [{
                "id": "call_xxx",
                "function": {
                    "name": "checar_disponibilidade_agenda",
                    "arguments": '{"data_com_hora": "2026-06-25 16:00"}'
                }
            }]
        }
    }]
}
```

### Chamada seguinte (injetando resultado da tool — **com `tools` de novo**)

```python
mensagens_atuais = mensagens_atuais + [
    message_out,               # resposta com tool_calls (pode ter mais de uma, tool-calling paralelo)
    *[
        {
            "role": "tool",
            "tool_call_id": tc["id"],
            "name": tc["function"]["name"],
            "content": executar_tool_call(tc),   # 1 mensagem "tool" por tool_call — obrigatório
        }
        for tc in message_out["tool_calls"]
    ],
]

# Chamada seguinte — CRÍTICO: reenvia tools/tool_choice, senão o modelo não
# pode pedir uma 2ª ferramenta mesmo precisando (bug corrigido 2026-08-02)
{
    "model": OPENROUTER_MODEL,
    "messages": [{"role": "system", ...}] + mensagens_atuais,
    "tools": ferramentas_disponiveis,
    "tool_choice": "auto",
    "temperature": 0.1,
}

# Loop continua enquanto a resposta tiver tool_calls (até 5 rodadas);
# encerra na primeira resposta com finish_reason de texto puro (sem tool_calls)
```

### Fluxo real do Lane Confeitaria — 2+ rodadas de tool-calling na mesma mensagem

```
Cliente: "Quero fechar: 1,5kg beijinho, chocolate, sábado, pix"

Rodada 1 → modelo chama consultar_catalogo_bolos + consultar_disponibilidade_agenda (paralelo)
Rodada 2 → com os resultados em mãos, modelo chama registrar_pedido
Rodada 3 → sem mais tool_calls, gera o texto final com valor/sinal reais

Sem o loop (design antigo, com bug): a Rodada 2 nunca aconteceria — a
"chamada seguinte" já teria sido feita sem tools, e o modelo só conseguiria
gerar texto dizendo "vou registrar agora" sem nunca chamar a ferramenta.
```

---

## Casos de borda

| Situação | Comportamento atual |
|---|---|
| `tenant_id` inexistente | HTTP 404 com mensagem "Tenant inválido no Quasar." |
| OpenRouter timeout (> 20s) | captura exceção, retorna fallback hardcoded sobre otimização de calendário |
| Tool desconhecida retornada pelo LLM | retorna string "Ferramenta desconhecida." como resultado |
| Histórico vazio (primeira mensagem da sessão) | `gerenciar_memoria(..., recuperar=True)` retorna lista vazia — LLM começa sem contexto anterior |
| Mais de 10 mensagens na sessão | apenas as 10 mais antigas são recuperadas (LIMIT 10) — mensagens além disso não são vistas pelo LLM |
| Cartão (Pedido/Atendimento) do contato já está em fila de atendimento humano (só produto="lane") | `gerar_resposta_quasar` retorna `None` sem chamar o LLM — endpoint/webhook não enviam nada, silêncio total até a Lane mover o card |
| Modelo pede 2+ ferramentas na mesma rodada (tool-calling paralelo) | cada uma recebe sua própria mensagem `"role": "tool"` — enviar só uma causa erro do provider ("No tool output found for function call") |
| Foto sem legenda (WhatsApp, só produto="lane") | texto neutro ("Cliente enviou uma foto de referência.") substitui a mensagem vazia, pro modelo saber que tem imagem anexada mesmo sem contexto textual |

---

## Cenários de teste (`test_local.py`)

| Teste | Mensagem | Resultado esperado |
|---|---|---|
| 1 | "Oi, quem é você?" | resposta conversacional sem tool |
| 2 | "Quero marcar minha call para 25/06 às 14h" | tool checa 14h → ocupado → LLM oferece alternativas |
| 3 | "E às 16h, está disponível?" | tool checa 16h → livre → LLM confirma ou oferece confirmação |
| 4 | `confirmar_agendamento_call` direto | tool adiciona 16h em AGENDA_OCUPADA e retorna confirmação |
| 5 | recuperar histórico do SQLite | lista de mensagens em ordem cronológica para a sessão |
