---
status: draft
domain: quasar
source: claude
created: 2026-06-25
updated: 2026-08-07
owner: willians
---

# Comportamento — Órbita Quasar

Define como o concierge age em cada cenário e o que governa suas decisões.

---

## Identidade do concierge

O Quasar não tem uma persona fixa global. A identidade é montada em runtime a partir da configuração do tenant — mas desde a integração do Lane Confeitaria (2026-07-30), `produto` também decide a persona, não só `nome_empresa`:

```
"Você é o assistente concierge de elite da empresa '{nome_empresa}',
operando pelo módulo de alta tecnologia Órbita Quasar."
```

O `nome_empresa` vem do banco (`tenants_config.nome_empresa`) pro tenant original de mentoria e pro Thieco. **Exceção real:** `produto == "lane"` tem persona nomeada própria — "Mel", da equipe da Confeitaria Artesanal da Lane. Regra explícita: nunca se identifica como robô/IA/assistente virtual, nem se perguntada diretamente. Detalhe completo em `FAQ_LANE_CONFEITARIA` (`database.py`).

---

## O que define o comportamento por tenant

Três variáveis controlam o comportamento em runtime:

**`faq_contexto`** — o que o concierge sabe sobre o negócio.
É um texto livre cadastrado pelo tenant. Pode incluir: preços, horários, links de checkout, regras de renovação, diferenciais do produto. O concierge usa esse contexto como única fonte de verdade para responder perguntas de negócio.

**`flag_agendamento_ia`** — se o concierge pode agendar.
Quando `true`, as tools são injetadas no payload do LLM e o concierge ganha autonomia para verificar disponibilidade e confirmar calls diretamente. Quando `false`, o concierge só conversa.

**`flag_fechamento_comercial`** — se o concierge pode fechar vendas.
Quando `true`, o concierge tem autorização para conduzir o fechamento e enviar links de checkout/renovação que estejam no `faq_contexto`. Quando `false`, o concierge não inicia processos comerciais.

---

## Quando o concierge usa uma tool

O LLM decide autonomamente quando acionar uma tool. As condições que levam a essa decisão:

- `flag_agendamento_ia = true` (tools disponíveis no payload)
- O cliente expressa intenção de agendar: "quero marcar", "tem horário", "posso reservar para..."
- A mensagem contém data e/ou hora, mesmo que implícita

O LLM não pede confirmação antes de chamar a tool — executa em background e responde ao cliente com o resultado integrado à mensagem.

**Nem toda ação de "progresso" é decisão do LLM.** `registrar_progresso_atendimento` (produto="lane" — cria/avança o card `Atendimento` no Lane Confeitaria a cada mensagem) é chamada automaticamente pelo código, não é uma tool que o modelo decide acionar — um evento estrutural (1ª vs. N-ésima mensagem da conversa) é mais confiável em código do que esperado de uma decisão do LLM a cada turno.

**Loop de tool-calling, não 1 rodada fixa (corrigido 2026-08-02):** o modelo pode encadear várias ferramentas na mesma mensagem — ex.: checar catálogo+agenda numa rodada, e só depois, com o resultado em mãos, chamar `registrar_pedido` numa rodada seguinte. Detalhe do bug real que isso corrigiu em `registro-de-decisoes-quasar.md` e `fluxos-conversacionais-quasar.md`.

**Silêncio condicional (só produto="lane"):** antes de processar qualquer mensagem, o Quasar consulta ao vivo se o cartão (Pedido ou Atendimento) do contato já está na fila marcada como "atendimento humano" no Lane Confeitaria — se sim, não chama o LLM, não responde nada. Sem estado duplicado do lado do Quasar: assim que a Lane mover o card, a mensagem seguinte já reflete isso.

**Silêncio por assunto (só produto="thieco", 2026-08-07) — diferente do silêncio da Lane acima:** a Lane silencia a CONVERSA INTEIRA (consulta uma fila externa). O Theo não tem fila equivalente do lado do sistema-thieco, então o mecanismo é outro: uma tool própria (`manter_silencio_mesmo_assunto`) que o LLM aciona quando reconhece, pelo próprio histórico da conversa, que já escalou aquele tópico específico pro humano (`acionar_atendimento_humano`) e o cliente insistiu no MESMO assunto antes de qualquer resposta humana aparecer. Se o cliente perguntar algo DIFERENTE, o Theo responde normalmente — não é silêncio de conversa, é silêncio de tópico. Não precisa de estado novo: a própria mensagem fixa de transbordo, já registrada como turno "assistant" no histórico, é o sinal que o modelo usa pra reconhecer "já escalei isso".

**Preço real via tool, não mais texto estático (só produto="thieco", 2026-08-07):** `calcular_total_servicos` consulta `GET /agendamentos/servicos` do sistema-thieco (catálogo real) e soma o total em Python (nunca deixa o LLM fazer a conta de cabeça) — a tabela de preços que ainda vive no `faq_contexto` virou só fallback pro caso da API estar fora do ar. Primeira ferramenta do Quasar a puxar dado ao vivo de um sistema-tenant fora do fluxo de agendamento mock.

---

## Sequência de decisão do LLM em cada mensagem

```
Mensagem do cliente recebida
         │
         ▼
Flag de agendamento ativa?
    ├─ NÃO → resposta conversacional direta com base no faq_contexto
    └─ SIM → LLM avalia a intenção
                 │
                 ├─ sem intenção de agendar → resposta conversacional direta
                 └─ com intenção de agendar → aciona tool
                              │
                              ▼
                    checar_disponibilidade_agenda(data_hora)
                              │
                    ┌─────────┴─────────┐
                  LIVRE             OCUPADO
                    │                   │
                    ▼                   ▼
           confirmar_agendamento   oferecer alternativas
           _call(nome, email,      (LLM sugere outros
           data_hora)              horários disponíveis)
                    │
                    ▼
           resposta final ao cliente com confirmação
```

---

## Contexto do cliente por sessão

O concierge recebe `nome_cliente`, `email_cliente` e (canais WhatsApp) `contato_cliente` em cada requisição e os inclui no system prompt. Isso garante que o LLM saiba com quem está falando em toda a sessão.

**Correção real (2026-08-02):** `webhook_evolution` nunca passava `nome_cliente` de verdade — sempre caía no default genérico "Cliente", mesmo o WhatsApp trazendo `pushName` no payload. Corrigido: `pushName` vira palpite inicial. Regra explícita (produto="lane"): a persona **nunca pede o telefone** do cliente (já vem automático, é redundante e passa a impressão de sistema desorientado) — mas **sempre confirma o nome de verdade** na etapa de fechamento, já que `pushName` pode ser apelido/nome de família, não necessariamente quem vai constar no pedido.

**Primeiro nome só, cortado em código (só produto="thieco", 2026-08-07):** `pushName` do WhatsApp as vezes vem com nome completo (ex.: "Thiago Leandro") — o Theo deve chamar o cliente só pelo primeiro nome. Em vez de confiar só no prompt (testado antes e o modelo não respeitava de forma confiável em toda mensagem da conversa), `nome_cliente = nome_cliente.split()[0]` acontece **em código**, no início de `gerar_resposta_quasar`, antes de o nome entrar em qualquer bloco do system prompt — garante o comportamento correto independente de decisão do LLM.

O histórico de até 10 mensagens anteriores é recuperado do SQLite e injetado antes da mensagem atual — o concierge lembra o que foi dito na sessão sem precisar que o cliente repita contexto.

---

## Tom e estilo

A instrução de estilo no system prompt é mínima e deliberada:
> "Seja elegante, direto, prestativo e use parágrafos curtos."

O comportamento detalhado de tom é delegado ao LLM com base no `faq_contexto` do tenant. Um tenant de mentoria executiva vai naturalmente gerar respostas mais formais; um tenant de academia pode ser mais casual — sem que isso precise ser configurado explicitamente.

**Regra de "mistura" adicionada em 2026-08-02** (calibrada com conversas reais da Lane, ver `registro-de-decisoes-quasar.md`): a instrução genérica de adaptação de linguagem deixou de ser "espelha o cliente, ou usa tom padrão se não estiver claro" (um ou outro) e virou uma mistura constante — a base do `faq_contexto` (jeito de falar do tenant) nunca desaparece, só a camada de formalidade/gíria por cima varia conforme o registro do cliente na conversa. Vale pra todo tenant, não só o Lane.

---

## Fallback em caso de erro

Se a chamada ao OpenRouter falhar (timeout > 20s ou exceção), o endpoint retorna:
```
"Olá! Estou otimizando meu calendário de mentorias.
Poderia tentar reagendar ou enviar sua dúvida em instantes?"
```

É uma mensagem de fallback hardcoded que mantém o tom de concierge sem revelar o erro técnico.
