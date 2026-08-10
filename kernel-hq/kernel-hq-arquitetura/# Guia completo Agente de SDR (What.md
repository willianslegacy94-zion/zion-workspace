# Guia completo: Agente de SDR (WhatsApp + Claude/OpenRouter + CRM próprio)

Este documento reúne tudo que construímos na conversa: a arquitetura, o passo a passo,
e o conteúdo completo de cada arquivo do projeto. Cole este arquivo na sua sessão do
Claude Code (ou copie os blocos manualmente) para recriar o projeto do zero.

## Visão geral da arquitetura

- **CRM próprio**: Node.js + Express + SQLite (`better-sqlite3`), sem infra externa.
- **Painel visual**: HTML/CSS/JS puro servido pelo próprio Express — kanban por estágio
  do funil, com indicador de urgência (tempo desde a última interação).
- **Agente conversacional**: roda no webhook do WhatsApp, usa o histórico do CRM como
  contexto, e chama a API do Claude (direto na Anthropic **ou** via OpenRouter) com
  *tools* que agem sobre o próprio CRM (`update_lead_stage`, `schedule_meeting`,
  `add_note`, `escalate_to_human`).
- **WhatsApp**: integração via WhatsApp Business Cloud API (Meta).

## Estrutura de pastas

```
sdr-crm/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── server.js
├── db.js
├── data/                 (criada automaticamente — guarda o crm.db)
├── lib/
│   ├── crmService.js     (funções de acesso ao CRM, usadas por rotas e pelo agente)
│   ├── whatsapp.js        (envia/interpreta mensagens da WhatsApp Cloud API)
│   └── claudeAgent.js     (persona, tools, e o loop de conversa — Anthropic ou OpenRouter)
├── routes/
│   ├── leads.js
│   ├── interactions.js
│   └── meetings.js
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## Passo a passo para recriar

1. Crie a pasta do projeto e entre nela:
   ```bash
   mkdir sdr-crm && cd sdr-crm
   mkdir -p lib routes public data
   ```
2. Crie cada arquivo abaixo com o conteúdo exato indicado (o Claude Code consegue fazer
   isso automaticamente se você colar este guia inteiro e pedir "crie esse projeto").
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Copie o `.env.example` para `.env` e preencha suas chaves:
   ```bash
   cp .env.example .env
   ```
5. Edite o `SYSTEM_PROMPT` em `lib/claudeAgent.js` com os dados reais da sua empresa
   (produto, critérios de qualificação, tom de voz) — é a parte que mais importa.
6. Rode:
   ```bash
   npm start
   ```
   e abra `http://localhost:3000` para ver o painel.

O restante do fluxo (testar o agente sem WhatsApp de verdade, configurar o webhook na
Meta, trocar de provedor entre Anthropic e OpenRouter, fazer deploy) está documentado
no próprio `README.md` do projeto, incluído abaixo.

---

## Arquivos do projeto


**`.env.example`**

```bash
# Porta do servidor
PORT=3000

# Token que você escolhe e cadastra no painel da Meta ao configurar o webhook do WhatsApp
WHATSAPP_VERIFY_TOKEN=troque-este-token

# Qual provedor de LLM o agente usa: "anthropic" (padrão) ou "openrouter"
LLM_PROVIDER=anthropic

# --- Se LLM_PROVIDER=anthropic ---
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-5

# --- Se LLM_PROVIDER=openrouter ---
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-5
# Opcionais, só aparecem no ranking público do OpenRouter:
OPENROUTER_SITE_URL=
OPENROUTER_SITE_NAME=

# Credenciais da WhatsApp Business Cloud API (Meta)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
```

**`.gitignore`**

```
node_modules/
data/*.db
data/*.db-*
.env
```

**`package.json`**

```json
{
  "name": "sdr-crm",
  "version": "1.0.0",
  "description": "CRM próprio para alimentar um agente de SDR conversacional (WhatsApp + Claude)",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "nanoid": "^3.3.7"
  }
}
```

**`db.js`**

```javascript
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "data", "crm.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    company TEXT,
    role TEXT,
    source TEXT,
    stage TEXT NOT NULL DEFAULT 'novo',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','cancelada')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_interactions_lead ON interactions(lead_id);
  CREATE INDEX IF NOT EXISTS idx_meetings_lead ON meetings(lead_id);
`);

// Estágios válidos do funil do SDR
const STAGES = ["novo", "qualificando", "reuniao_marcada", "ganho", "perdido"];

module.exports = { db, STAGES };
```

**`server.js`**

```javascript
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const leadsRouter = require("./routes/leads");
const interactionsRouter = require("./routes/interactions");
const meetingsRouter = require("./routes/meetings");
const crm = require("./lib/crmService");
const whatsapp = require("./lib/whatsapp");
const agent = require("./lib/claudeAgent");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/leads", leadsRouter);
app.use("/api/leads", interactionsRouter);
app.use("/api", meetingsRouter);

/**
 * Webhook do WhatsApp (Meta Cloud API).
 *
 * Fluxo: recebe a mensagem -> acha/cria o lead -> salva como interação inbound ->
 * roda o agente (Claude + tools do CRM) -> salva a resposta -> envia de volta pro WhatsApp.
 *
 * Responde 200 pra Meta imediatamente (ela exige resposta rápida) e processa
 * a conversa de forma assíncrona logo em seguida.
 */
app.post("/api/whatsapp/webhook", (req, res) => {
  res.sendStatus(200); // confirma o recebimento pra Meta antes de processar

  const incoming = whatsapp.parseIncomingMessage(req.body);
  if (!incoming) return; // não era mensagem de texto (status, mídia, etc.) — ignora

  handleIncomingMessage(incoming).catch((err) => {
    console.error("[webhook] Erro ao processar mensagem:", err);
  });
});

async function handleIncomingMessage({ from, name, text }) {
  const lead = crm.getOrCreateLeadByPhone(from, name);
  crm.addInteraction(lead.id, "inbound", text);

  const reply = await agent.runAgent(lead.id);

  crm.addInteraction(lead.id, "outbound", reply);
  await whatsapp.sendWhatsAppMessage(from, reply);
}

// Verificação do webhook exigida pela Meta (GET com hub.challenge)
app.get("/api/whatsapp/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "troque-este-token";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CRM rodando em http://localhost:${PORT}`);
});
```

**`lib/crmService.js`**

```javascript
const { nanoid } = require("nanoid");
const { db } = require("../db");

function getLeadByPhone(phone) {
  return db.prepare("SELECT * FROM leads WHERE phone = ?").get(phone);
}

function getLeadById(id) {
  return db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
}

function createLead({ name, phone, company, role, source, notes }) {
  const id = nanoid();
  db.prepare(
    `INSERT INTO leads (id, name, phone, company, role, source, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, phone, company || null, role || null, source || "whatsapp", notes || null);
  return getLeadById(id);
}

// Usado pelo webhook: acha o lead pelo telefone, ou cria um registro mínimo se for a primeira mensagem
function getOrCreateLeadByPhone(phone, fallbackName) {
  const existing = getLeadByPhone(phone);
  if (existing) return existing;
  return createLead({ name: fallbackName || phone, phone, source: "whatsapp" });
}

function getInteractions(leadId) {
  return db.prepare("SELECT * FROM interactions WHERE lead_id = ? ORDER BY created_at ASC").all(leadId);
}

function addInteraction(leadId, direction, message, channel = "whatsapp") {
  const id = nanoid();
  db.prepare(
    `INSERT INTO interactions (id, lead_id, direction, channel, message) VALUES (?, ?, ?, ?, ?)`
  ).run(id, leadId, direction, channel, message);
  db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(leadId);
  return db.prepare("SELECT * FROM interactions WHERE id = ?").get(id);
}

function updateStage(leadId, stage) {
  db.prepare("UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(stage, leadId);
  return getLeadById(leadId);
}

function addNote(leadId, note) {
  const lead = getLeadById(leadId);
  const combined = lead.notes ? `${lead.notes}\n${note}` : note;
  db.prepare("UPDATE leads SET notes = ?, updated_at = datetime('now') WHERE id = ?").run(combined, leadId);
  return getLeadById(leadId);
}

function scheduleMeeting(leadId, scheduledAt, notes) {
  const id = nanoid();
  db.prepare(
    `INSERT INTO meetings (id, lead_id, scheduled_at, notes) VALUES (?, ?, ?, ?)`
  ).run(id, leadId, scheduledAt, notes || null);
  updateStage(leadId, "reuniao_marcada");
  return db.prepare("SELECT * FROM meetings WHERE id = ?").get(id);
}

module.exports = {
  getLeadByPhone,
  getLeadById,
  createLead,
  getOrCreateLeadByPhone,
  getInteractions,
  addInteraction,
  updateStage,
  addNote,
  scheduleMeeting,
};
```

**`lib/whatsapp.js`**

```javascript
const GRAPH_VERSION = "v20.0";

/**
 * Extrai a mensagem de texto de um payload de webhook da Meta.
 * Retorna null se o evento não for uma mensagem de texto (ex: status de entrega, mídia, etc.)
 */
function parseIncomingMessage(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== "text") return null;

    const contact = value.contacts?.[0];

    return {
      from: message.from, // telefone no formato E.164 sem "+"
      name: contact?.profile?.name || null,
      text: message.text.body,
      messageId: message.id,
    };
  } catch (err) {
    console.error("Falha ao interpretar payload do webhook:", err);
    return null;
  }
}

/**
 * Envia uma mensagem de texto pelo WhatsApp Cloud API.
 * Requer WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN no ambiente.
 */
async function sendWhatsAppMessage(to, text) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn(
      "[whatsapp] WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN não configurados — mensagem não enviada:",
      text
    );
    return { simulated: true };
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[whatsapp] Erro ao enviar mensagem:", data);
    throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = { parseIncomingMessage, sendWhatsAppMessage };
```

**`lib/claudeAgent.js`**

```javascript
const crm = require("./crmService");

// "anthropic" (API direta da Anthropic) ou "openrouter"
const PROVIDER = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5";

const MAX_TOOL_ITERATIONS = 5;

/**
 * PERSONA E REGRAS DO AGENTE
 * ---------------------------------------------------------------
 * Edite os campos entre [COLCHETES] para o seu negócio. Isso é o que mais
 * vai influenciar a qualidade das conversas — vale a pena investir tempo aqui.
 */
const SYSTEM_PROMPT = `
Você é [NOME DO AGENTE], SDR da [NOME DA EMPRESA], conversando por WhatsApp.

## O que a empresa vende
[Descreva em 2-3 frases o produto/serviço e o problema que ele resolve]

## Seu objetivo nesta conversa
Qualificar o lead e, se fizer sentido, agendar uma reunião com um vendedor humano.
Você NÃO fecha vendas nem faz demonstrações — seu papel é entender o contexto do lead
e decidir o próximo passo certo.

## Critérios de qualificação
Um lead é qualificado quando você entende:
- [Critério 1, ex: porte da empresa / número de funcionários]
- [Critério 2, ex: orçamento ou budget disponível]
- [Critério 3, ex: tem autoridade para decidir ou vai influenciar a decisão]
- [Critério 4, ex: tem uma dor ativa relacionada ao que vocês resolvem]

Não faça essas perguntas como um formulário. Converse naturalmente, uma pergunta por vez,
e use os dados que a pessoa já deu — não repita perguntas.

## Tom de voz
- Direto, humano, sem parecer script. Frases curtas.
- Nunca invente preços, prazos ou funcionalidades que você não tem certeza.
- Se perguntarem se você é um assistente/IA, responda com honestidade.

## Quando usar as ferramentas
- Assim que entender o contexto do lead, registre com \`add_note\`.
- Quando o lead demonstrar fit real (bate os critérios acima), chame \`update_lead_stage\`
  com "qualificando" e proponha agendar uma reunião.
- Se o lead topar um horário, chame \`schedule_meeting\`.
- Se o lead disser claramente que não tem interesse ou não é o momento, chame
  \`update_lead_stage\` com "perdido".
- Se surgir uma objeção que você não sabe responder, pedido de desconto, reclamação,
  ou qualquer sinal de urgência/frustração, chame \`escalate_to_human\` e avise o lead
  que alguém do time vai continuar a conversa.

## Regras rígidas
- Nunca prometa algo que não foi dito explicitamente nas informações acima.
- Nunca finja ser humano se perguntado diretamente.
- Uma pergunta por mensagem. Mensagens curtas (WhatsApp, não email).
`.trim();

// Definição neutra das tools — convertida para o formato de cada provedor mais abaixo
const TOOL_DEFS = [
  {
    name: "update_lead_stage",
    description: "Atualiza o estágio do lead no funil de vendas do CRM.",
    parameters: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          enum: ["novo", "qualificando", "reuniao_marcada", "ganho", "perdido"],
        },
      },
      required: ["stage"],
    },
  },
  {
    name: "schedule_meeting",
    description: "Agenda uma reunião com o lead e move o estágio para 'reuniao_marcada'.",
    parameters: {
      type: "object",
      properties: {
        scheduled_at: {
          type: "string",
          description: "Data e hora combinadas com o lead, em ISO 8601 (ex: 2026-07-25T15:00:00)",
        },
        notes: { type: "string", description: "Contexto da reunião para o vendedor humano" },
      },
      required: ["scheduled_at"],
    },
  },
  {
    name: "add_note",
    description: "Registra uma anotação sobre o lead no CRM (contexto, respostas de qualificação, etc.)",
    parameters: {
      type: "object",
      properties: { note: { type: "string" } },
      required: ["note"],
    },
  },
  {
    name: "escalate_to_human",
    description: "Sinaliza que um humano do time de vendas precisa assumir a conversa.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Por que a conversa precisa de um humano" },
      },
      required: ["reason"],
    },
  },
];

function toAnthropicTools() {
  return TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
}

function toOpenAITools() {
  return TOOL_DEFS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function executeTool(leadId, name, input) {
  switch (name) {
    case "update_lead_stage":
      crm.updateStage(leadId, input.stage);
      return { ok: true, stage: input.stage };

    case "schedule_meeting":
      crm.scheduleMeeting(leadId, input.scheduled_at, input.notes);
      return { ok: true, scheduled_at: input.scheduled_at };

    case "add_note":
      crm.addNote(leadId, input.note);
      return { ok: true };

    case "escalate_to_human":
      crm.addNote(leadId, `[ESCALADO PARA HUMANO] ${input.reason}`);
      console.warn(`[agente] Lead ${leadId} escalado para humano: ${input.reason}`);
      return { ok: true, escalated: true };

    default:
      return { ok: false, error: `Tool desconhecida: ${name}` };
  }
}

function interactionsToMessages(interactions) {
  return interactions.map((i) => ({
    role: i.direction === "inbound" ? "user" : "assistant",
    content: i.message,
  }));
}

// ---------------------------------------------------------------------------
// Provedor: Anthropic (API nativa, /v1/messages)
// ---------------------------------------------------------------------------

async function callAnthropic(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada no .env");

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: toAnthropicTools(),
      messages,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API error: ${JSON.stringify(data)}`);
  return data;
}

async function runAnthropicAgent(leadId, history) {
  let messages = history;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await callAnthropic(messages);

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    }

    messages = [...messages, { role: "assistant", content: response.content }];

    const toolResults = response.content
      .filter((b) => b.type === "tool_use")
      .map((b) => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: JSON.stringify(executeTool(leadId, b.name, b.input)),
      }));

    messages = [...messages, { role: "user", content: toolResults }];
  }

  return fallbackReply(leadId);
}

// ---------------------------------------------------------------------------
// Provedor: OpenRouter (API compatível com OpenAI, /chat/completions)
// ---------------------------------------------------------------------------

async function callOpenRouter(messages) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY não configurada no .env");

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      // Opcionais, só afetam ranking público no site do OpenRouter
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost",
      "X-Title": process.env.OPENROUTER_SITE_NAME || "SDR CRM",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 1024,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      tools: toOpenAITools(),
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OpenRouter API error: ${JSON.stringify(data)}`);
  return data;
}

async function runOpenRouterAgent(leadId, history) {
  let messages = history;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const data = await callOpenRouter(messages);
    const choice = data.choices[0];
    const message = choice.message;

    if (choice.finish_reason !== "tool_calls" || !message.tool_calls?.length) {
      return (message.content || "").trim();
    }

    // Modelo pediu tool(s): guarda a mensagem do assistente e responde cada tool_call
    messages = [...messages, message];

    const toolMessages = message.tool_calls.map((call) => {
      let input = {};
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        // argumentos malformados — segue com objeto vazio, a tool trata o que faltar
      }
      const result = executeTool(leadId, call.function.name, input);
      return { role: "tool", tool_call_id: call.id, content: JSON.stringify(result) };
    });

    messages = [...messages, ...toolMessages];
  }

  return fallbackReply(leadId);
}

// ---------------------------------------------------------------------------

function fallbackReply(leadId) {
  crm.addNote(leadId, "[AVISO] Agente atingiu limite de chamadas de ferramentas nesta rodada.");
  return "Deixa eu confirmar uma informação aqui e já te retorno, tudo bem?";
}

/**
 * Roda o agente para um lead: monta o histórico, chama o provedor configurado,
 * executa as tools que o modelo pedir, e retorna o texto final para enviar ao lead.
 */
async function runAgent(leadId) {
  const interactions = crm.getInteractions(leadId);
  const history = interactionsToMessages(interactions);

  return PROVIDER === "openrouter" ? runOpenRouterAgent(leadId, history) : runAnthropicAgent(leadId, history);
}

module.exports = { runAgent, SYSTEM_PROMPT, TOOL_DEFS };
```

**`routes/leads.js`**

```javascript
const express = require("express");
const { nanoid } = require("nanoid");
const { db, STAGES } = require("../db");

const router = express.Router();

// GET /api/leads?stage=qualificando -> lista leads (com filtro opcional por estágio)
router.get("/", (req, res) => {
  const { stage } = req.query;
  const rows = stage
    ? db.prepare("SELECT * FROM leads WHERE stage = ? ORDER BY updated_at DESC").all(stage)
    : db.prepare("SELECT * FROM leads ORDER BY updated_at DESC").all();
  res.json(rows);
});

// GET /api/leads/:id -> um lead + interações + reuniões
router.get("/:id", (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

  const interactions = db
    .prepare("SELECT * FROM interactions WHERE lead_id = ? ORDER BY created_at ASC")
    .all(lead.id);
  const meetings = db
    .prepare("SELECT * FROM meetings WHERE lead_id = ? ORDER BY scheduled_at ASC")
    .all(lead.id);

  res.json({ ...lead, interactions, meetings });
});

// GET /api/leads/by-phone/:phone -> usado pelo webhook do WhatsApp para achar/criar o lead
router.get("/by-phone/:phone", (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE phone = ?").get(req.params.phone);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
  res.json(lead);
});

// POST /api/leads -> cria lead
router.post("/", (req, res) => {
  const { name, phone, company, role, source, notes } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "name e phone são obrigatórios" });
  }

  const existing = db.prepare("SELECT * FROM leads WHERE phone = ?").get(phone);
  if (existing) return res.status(409).json({ error: "Já existe um lead com esse telefone", lead: existing });

  const id = nanoid();
  db.prepare(
    `INSERT INTO leads (id, name, phone, company, role, source, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, phone, company || null, role || null, source || "manual", notes || null);

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  res.status(201).json(lead);
});

// PUT /api/leads/:id -> atualiza dados gerais do lead
router.put("/:id", (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

  const fields = ["name", "phone", "company", "role", "source", "notes"];
  const updates = fields.filter((f) => req.body[f] !== undefined);
  if (updates.length === 0) return res.status(400).json({ error: "Nada para atualizar" });

  const setClause = updates.map((f) => `${f} = ?`).join(", ");
  const values = updates.map((f) => req.body[f]);
  db.prepare(`UPDATE leads SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(
    ...values,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id));
});

// PUT /api/leads/:id/stage -> muda o estágio no funil (usado pelo agente)
router.put("/:id/stage", (req, res) => {
  const { stage } = req.body;
  if (!STAGES.includes(stage)) {
    return res.status(400).json({ error: `stage inválido. Use um de: ${STAGES.join(", ")}` });
  }
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

  db.prepare("UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(
    stage,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id));
});

// DELETE /api/leads/:id
router.delete("/:id", (req, res) => {
  const result = db.prepare("DELETE FROM leads WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Lead não encontrado" });
  res.status(204).send();
});

module.exports = router;
```

**`routes/interactions.js`**

```javascript
const express = require("express");
const { nanoid } = require("nanoid");
const { db } = require("../db");

const router = express.Router();

// POST /api/leads/:leadId/interactions -> registra uma mensagem (inbound do lead ou outbound do agente)
router.post("/:leadId/interactions", (req, res) => {
  const { direction, message, channel } = req.body;
  if (!["inbound", "outbound"].includes(direction) || !message) {
    return res.status(400).json({ error: "direction ('inbound'|'outbound') e message são obrigatórios" });
  }

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.leadId);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

  const id = nanoid();
  db.prepare(
    `INSERT INTO interactions (id, lead_id, direction, channel, message) VALUES (?, ?, ?, ?, ?)`
  ).run(id, lead.id, direction, channel || "whatsapp", message);

  db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(lead.id);

  res.status(201).json(db.prepare("SELECT * FROM interactions WHERE id = ?").get(id));
});

// GET /api/leads/:leadId/interactions -> histórico completo (para montar o contexto que vai pra API do Claude)
router.get("/:leadId/interactions", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM interactions WHERE lead_id = ? ORDER BY created_at ASC")
    .all(req.params.leadId);
  res.json(rows);
});

module.exports = router;
```

**`routes/meetings.js`**

```javascript
const express = require("express");
const { nanoid } = require("nanoid");
const { db } = require("../db");

const router = express.Router();

// POST /api/leads/:leadId/meetings -> agenda reunião (o agente chama isso quando qualifica o lead)
router.post("/leads/:leadId/meetings", (req, res) => {
  const { scheduled_at, notes } = req.body;
  if (!scheduled_at) return res.status(400).json({ error: "scheduled_at é obrigatório (ISO 8601)" });

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.leadId);
  if (!lead) return res.status(404).json({ error: "Lead não encontrado" });

  const id = nanoid();
  db.prepare(
    `INSERT INTO meetings (id, lead_id, scheduled_at, notes) VALUES (?, ?, ?, ?)`
  ).run(id, lead.id, scheduled_at, notes || null);

  db.prepare("UPDATE leads SET stage = 'reuniao_marcada', updated_at = datetime('now') WHERE id = ?").run(lead.id);

  res.status(201).json(db.prepare("SELECT * FROM meetings WHERE id = ?").get(id));
});

// PUT /api/meetings/:id -> atualiza status (realizada/cancelada)
router.put("/meetings/:id", (req, res) => {
  const { status, notes } = req.body;
  const meeting = db.prepare("SELECT * FROM meetings WHERE id = ?").get(req.params.id);
  if (!meeting) return res.status(404).json({ error: "Reunião não encontrada" });

  db.prepare("UPDATE meetings SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?").run(
    status || null,
    notes || null,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM meetings WHERE id = ?").get(req.params.id));
});

module.exports = router;
```

**`public/index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Funil · CRM SDR</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">◆</span>
        <span class="brand-name">Funil</span>
      </div>
      <div class="topbar-actions">
        <span class="live-dot" id="liveDot"></span>
        <span class="topbar-meta" id="leadCount">— leads</span>
        <button class="btn-primary" id="newLeadBtn">+ Novo lead</button>
      </div>
    </header>

    <main class="board" id="board" aria-live="polite">
      <!-- colunas geradas via JS -->
    </main>
  </div>

  <!-- Drawer de detalhe do lead -->
  <aside class="drawer" id="drawer">
    <div class="drawer-inner">
      <button class="drawer-close" id="drawerClose" aria-label="Fechar">✕</button>
      <div id="drawerContent"></div>
    </div>
  </aside>
  <div class="scrim" id="scrim"></div>

  <!-- Modal novo lead -->
  <div class="modal" id="modal">
    <form class="modal-card" id="newLeadForm">
      <h2>Novo lead</h2>
      <label>Nome<input name="name" required placeholder="Ana Souza" /></label>
      <label>Telefone (WhatsApp)<input name="phone" required placeholder="+55 11 91234-5678" /></label>
      <label>Empresa<input name="company" placeholder="Acme Ltda." /></label>
      <label>Cargo<input name="role" placeholder="Head de Vendas" /></label>
      <label>Origem<input name="source" placeholder="site, indicação, evento…" /></label>
      <div class="modal-actions">
        <button type="button" class="btn-ghost" id="cancelNewLead">Cancelar</button>
        <button type="submit" class="btn-primary">Criar lead</button>
      </div>
    </form>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

**`public/style.css`**

```css
:root {
  --bg: #12161B;
  --panel: #1A2029;
  --panel-2: #1F2630;
  --border: #262E38;
  --text: #E7EBEF;
  --muted: #8A94A3;
  --accent: #4FD1C5;
  --accent-dim: #2C6E68;
  --fresh: #3FCF8E;
  --aging: #F0B429;
  --stale: #F0554F;
  --font-ui: "Inter", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
}

.app { min-height: 100vh; display: flex; flex-direction: column; }

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 28px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: rgba(18, 22, 27, 0.9);
  backdrop-filter: blur(8px);
  z-index: 10;
}

.brand { display: flex; align-items: center; gap: 10px; }
.brand-mark { color: var(--accent); font-size: 18px; }
.brand-name { font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }

.topbar-actions { display: flex; align-items: center; gap: 14px; }
.topbar-meta { color: var(--muted); font-family: var(--font-mono); font-size: 13px; }

.live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--fresh);
  box-shadow: 0 0 0 4px rgba(63, 207, 142, 0.15);
}

.btn-primary {
  background: var(--accent);
  color: #0A1613;
  border: none;
  font-weight: 600;
  font-size: 13.5px;
  padding: 9px 16px;
  border-radius: 7px;
  cursor: pointer;
  transition: filter 0.15s ease;
}
.btn-primary:hover { filter: brightness(1.08); }
.btn-primary:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }

.btn-ghost {
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--border);
  font-weight: 500;
  font-size: 13.5px;
  padding: 9px 16px;
  border-radius: 7px;
  cursor: pointer;
}
.btn-ghost:hover { color: var(--text); border-color: var(--muted); }

.board {
  flex: 1;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(270px, 1fr);
  gap: 16px;
  padding: 20px 28px 32px;
  overflow-x: auto;
}

.column { display: flex; flex-direction: column; min-width: 0; }

.column-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 6px 4px 12px;
  border-bottom: 2px solid var(--stage-color, var(--border));
  margin-bottom: 12px;
}
.column-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.column-count { font-family: var(--font-mono); color: var(--muted); font-size: 12px; }

.column-cards { display: flex; flex-direction: column; gap: 10px; min-height: 40px; }

.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 13px 14px;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.1s ease;
}
.card:hover { border-color: var(--accent-dim); transform: translateY(-1px); }
.card:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.card-name { font-weight: 600; font-size: 14px; }
.heat { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.heat.fresh { background: var(--fresh); box-shadow: 0 0 0 3px rgba(63,207,142,0.12); }
.heat.aging { background: var(--aging); box-shadow: 0 0 0 3px rgba(240,180,41,0.12); }
.heat.stale { background: var(--stale); box-shadow: 0 0 0 3px rgba(240,85,79,0.12); }

.card-company { color: var(--muted); font-size: 12.5px; margin-bottom: 8px; }
.card-meta { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 11px; color: var(--muted); }

.empty-column {
  color: var(--muted);
  font-size: 12.5px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 16px 12px;
  text-align: center;
}

/* Drawer */
.scrim {
  position: fixed; inset: 0; background: rgba(8,10,13,0.6);
  opacity: 0; pointer-events: none; transition: opacity 0.2s ease; z-index: 20;
}
.scrim.open { opacity: 1; pointer-events: auto; }

.drawer {
  position: fixed; top: 0; right: 0; height: 100vh; width: min(420px, 92vw);
  background: var(--panel); border-left: 1px solid var(--border);
  transform: translateX(100%); transition: transform 0.25s ease; z-index: 21;
  overflow-y: auto;
}
.drawer.open { transform: translateX(0); }
.drawer-inner { padding: 24px; }
.drawer-close {
  background: none; border: none; color: var(--muted); font-size: 16px;
  cursor: pointer; float: right; padding: 4px;
}
.drawer-close:hover { color: var(--text); }

.lead-title { font-size: 19px; font-weight: 700; margin: 0 0 4px; }
.lead-sub { color: var(--muted); font-size: 13px; margin-bottom: 18px; }

.stage-select {
  background: var(--panel-2); color: var(--text); border: 1px solid var(--border);
  border-radius: 6px; padding: 7px 10px; font-family: var(--font-ui); font-size: 13px;
  margin-bottom: 20px; width: 100%;
}

.section-label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--muted); margin: 20px 0 10px; font-weight: 600;
}

.timeline { display: flex; flex-direction: column; gap: 8px; }
.msg {
  padding: 10px 12px; border-radius: 8px; font-size: 13.5px; line-height: 1.45;
  max-width: 92%;
}
.msg.inbound { background: var(--panel-2); align-self: flex-start; }
.msg.outbound { background: var(--accent-dim); align-self: flex-end; color: #EAFBF9; }
.msg-time { display: block; font-family: var(--font-mono); font-size: 10px; color: var(--muted); margin-top: 4px; }

.meeting-item {
  background: var(--panel-2); border-radius: 8px; padding: 10px 12px; font-size: 13px;
}
.meeting-time { font-family: var(--font-mono); font-weight: 600; }
.meeting-status { color: var(--muted); font-size: 11.5px; text-transform: capitalize; }

.empty-note { color: var(--muted); font-size: 13px; }

/* Modal */
.modal {
  position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
  background: rgba(8,10,13,0.6); z-index: 30;
}
.modal.open { display: flex; }
.modal-card {
  background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
  padding: 24px; width: min(380px, 90vw); display: flex; flex-direction: column; gap: 12px;
}
.modal-card h2 { margin: 0 0 4px; font-size: 17px; }
.modal-card label { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: var(--muted); }
.modal-card input {
  background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text); padding: 8px 10px; font-family: var(--font-ui); font-size: 13.5px;
}
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }

@media (max-width: 720px) {
  .board { grid-auto-flow: row; grid-auto-columns: unset; grid-template-columns: 1fr; }
}
```

**`public/app.js`**

```javascript
const STAGES = [
  { key: "novo", label: "Novo", color: "#8A94A3" },
  { key: "qualificando", label: "Qualificando", color: "#4FD1C5" },
  { key: "reuniao_marcada", label: "Reunião marcada", color: "#F0B429" },
  { key: "ganho", label: "Ganho", color: "#3FCF8E" },
  { key: "perdido", label: "Perdido", color: "#F0554F" },
];

const board = document.getElementById("board");
const leadCountEl = document.getElementById("leadCount");
const drawer = document.getElementById("drawer");
const drawerContent = document.getElementById("drawerContent");
const scrim = document.getElementById("scrim");
const modal = document.getElementById("modal");

async function fetchLeads() {
  const res = await fetch("/api/leads");
  return res.ok ? res.json() : [];
}

function heatLevel(updatedAt) {
  const hours = (Date.now() - new Date(updatedAt + "Z")) / 36e5;
  if (hours < 4) return "fresh";
  if (hours < 24) return "aging";
  return "stale";
}

function timeAgo(iso) {
  const hours = (Date.now() - new Date(iso + "Z")) / 36e5;
  if (hours < 1) return "há minutos";
  if (hours < 24) return `há ${Math.round(hours)}h`;
  return `há ${Math.round(hours / 24)}d`;
}

function renderBoard(leads) {
  board.innerHTML = "";
  leadCountEl.textContent = `${leads.length} lead${leads.length === 1 ? "" : "s"}`;

  STAGES.forEach((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage.key);

    const col = document.createElement("section");
    col.className = "column";
    col.style.setProperty("--stage-color", stage.color);

    col.innerHTML = `
      <div class="column-header">
        <span class="column-title" style="color:${stage.color}">${stage.label}</span>
        <span class="column-count">${stageLeads.length}</span>
      </div>
      <div class="column-cards"></div>
    `;

    const cardsWrap = col.querySelector(".column-cards");

    if (stageLeads.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-column";
      empty.textContent = "Nenhum lead aqui";
      cardsWrap.appendChild(empty);
    } else {
      stageLeads.forEach((lead) => cardsWrap.appendChild(renderCard(lead)));
    }

    board.appendChild(col);
  });
}

function renderCard(lead) {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="card-top">
      <span class="card-name">${escapeHtml(lead.name)}</span>
      <span class="heat ${heatLevel(lead.updated_at)}" title="Última atividade ${timeAgo(lead.updated_at)}"></span>
    </div>
    <div class="card-company">${escapeHtml(lead.company || "—")}</div>
    <div class="card-meta">
      <span>${escapeHtml(lead.phone)}</span>
      <span>${timeAgo(lead.updated_at)}</span>
    </div>
  `;
  card.addEventListener("click", () => openDrawer(lead.id));
  card.addEventListener("keypress", (e) => { if (e.key === "Enter") openDrawer(lead.id); });
  return card;
}

async function openDrawer(leadId) {
  const res = await fetch(`/api/leads/${leadId}`);
  if (!res.ok) return;
  const lead = await res.json();

  drawerContent.innerHTML = `
    <h2 class="lead-title">${escapeHtml(lead.name)}</h2>
    <p class="lead-sub">${escapeHtml(lead.company || "Sem empresa")} · ${escapeHtml(lead.role || "—")} · ${escapeHtml(lead.phone)}</p>

    <select class="stage-select" id="stageSelect">
      ${STAGES.map((s) => `<option value="${s.key}" ${s.key === lead.stage ? "selected" : ""}>${s.label}</option>`).join("")}
    </select>

    <div class="section-label">Conversa (${lead.interactions.length})</div>
    <div class="timeline">
      ${
        lead.interactions.length
          ? lead.interactions.map((m) => `
              <div class="msg ${m.direction}">
                ${escapeHtml(m.message)}
                <span class="msg-time">${new Date(m.created_at + "Z").toLocaleString("pt-BR")}</span>
              </div>`).join("")
          : `<p class="empty-note">Nenhuma mensagem ainda.</p>`
      }
    </div>

    <div class="section-label">Reuniões (${lead.meetings.length})</div>
    ${
      lead.meetings.length
        ? lead.meetings.map((m) => `
            <div class="meeting-item">
              <div class="meeting-time">${new Date(m.scheduled_at + "Z").toLocaleString("pt-BR")}</div>
              <div class="meeting-status">${m.status}</div>
            </div>`).join("")
        : `<p class="empty-note">Nenhuma reunião agendada.</p>`
    }
  `;

  document.getElementById("stageSelect").addEventListener("change", async (e) => {
    await fetch(`/api/leads/${leadId}/stage`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: e.target.value }),
    });
    refresh();
  });

  drawer.classList.add("open");
  scrim.classList.add("open");
}

function closeDrawer() {
  drawer.classList.remove("open");
  scrim.classList.remove("open");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function refresh() {
  const leads = await fetchLeads();
  renderBoard(leads);
}

// Eventos
document.getElementById("drawerClose").addEventListener("click", closeDrawer);
scrim.addEventListener("click", () => { closeDrawer(); modal.classList.remove("open"); });

document.getElementById("newLeadBtn").addEventListener("click", () => modal.classList.add("open"));
document.getElementById("cancelNewLead").addEventListener("click", () => modal.classList.remove("open"));

document.getElementById("newLeadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = Object.fromEntries(form.entries());

  const res = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    modal.classList.remove("open");
    e.target.reset();
    refresh();
  } else {
    const err = await res.json();
    alert(err.error || "Erro ao criar lead");
  }
});

refresh();
setInterval(refresh, 15000); // atualiza sozinho a cada 15s
```

**`README.md`**

````markdown
# CRM SDR

CRM leve para alimentar um agente de SDR conversacional no WhatsApp com a API do Claude.
Node.js + Express + SQLite. Sem build step, sem banco externo pra começar.

## Rodando localmente

```bash
npm install
cp .env.example .env
npm start
```

Abra `http://localhost:3000` — o painel (kanban por estágio do funil) já funciona,
e você pode criar leads manualmente pra testar.

## Estrutura

```
server.js              # servidor Express + stub do webhook do WhatsApp
db.js                  # schema SQLite (leads, interactions, meetings)
routes/leads.js         # CRUD de leads + mudança de estágio
routes/interactions.js  # histórico de mensagens por lead
routes/meetings.js      # agendamento de reuniões
public/                 # painel visual (kanban)
data/crm.db              # banco SQLite (criado automaticamente)
```

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/leads` | lista leads (filtro opcional `?stage=`) |
| GET | `/api/leads/:id` | lead + interações + reuniões |
| GET | `/api/leads/by-phone/:phone` | busca lead pelo telefone |
| POST | `/api/leads` | cria lead |
| PUT | `/api/leads/:id` | atualiza dados do lead |
| PUT | `/api/leads/:id/stage` | muda estágio (`novo`, `qualificando`, `reuniao_marcada`, `ganho`, `perdido`) |
| DELETE | `/api/leads/:id` | remove lead |
| GET/POST | `/api/leads/:id/interactions` | histórico / registra mensagem |
| POST | `/api/leads/:id/meetings` | agenda reunião (move o lead pra `reuniao_marcada`) |
| PUT | `/api/meetings/:id` | atualiza status da reunião |

## O agente (WhatsApp + Claude + CRM)

Já está implementado e ligado. Como funciona:

```
lib/whatsapp.js      # envia/recebe mensagens via WhatsApp Cloud API
lib/claudeAgent.js   # persona, tools e o loop de conversa com a API do Claude
lib/crmService.js    # funções que o agente usa para ler/escrever no CRM
```

Fluxo de uma mensagem:

1. Lead manda mensagem no WhatsApp → Meta chama `POST /api/whatsapp/webhook`
2. `whatsapp.parseIncomingMessage` extrai telefone, nome e texto
3. `crm.getOrCreateLeadByPhone` acha o lead (ou cria um novo na primeira mensagem)
4. A mensagem é salva como interação `inbound`
5. `agent.runAgent(leadId)` monta o histórico completo da conversa e chama a API do Claude
   com as tools abaixo. Se o modelo pedir uma tool, o agente executa e devolve o resultado —
   isso pode se repetir algumas vezes antes da resposta final em texto.
6. A resposta é salva como interação `outbound` e enviada de volta pro WhatsApp

**Tools que o agente pode chamar** (definidas em `lib/claudeAgent.js`):
- `update_lead_stage` — move o lead no funil
- `schedule_meeting` — agenda reunião (e já move o estágio pra `reuniao_marcada`)
- `add_note` — registra contexto de qualificação no CRM
- `escalate_to_human` — sinaliza (por enquanto via log + nota no CRM) que alguém do time
  precisa assumir a conversa

### Customizando a persona

Edite o `SYSTEM_PROMPT` em `lib/claudeAgent.js` — os campos entre `[COLCHETES]` são onde
você descreve sua empresa, produto e critérios de qualificação. É a parte que mais importa
pra qualidade das conversas.

### Testando sem WhatsApp de verdade

Com `ANTHROPIC_API_KEY` configurada no `.env`, você pode simular uma mensagem chegando
direto no webhook, sem precisar configurar a Meta ainda:

```bash
curl -X POST localhost:3000/api/whatsapp/webhook -H "Content-Type: application/json" -d '{
  "entry": [{ "changes": [{ "value": {
    "contacts": [{ "profile": { "name": "Teste" } }],
    "messages": [{ "from": "5511999998888", "id": "wamid.test", "type": "text", "text": { "body": "Oi, quero saber mais" } }]
  }}]}]
}'
```

Sem `WHATSAPP_ACCESS_TOKEN` configurado, a resposta não é enviada de verdade — só fica
logada no console e salva no CRM, o que dá pra conferir no painel em `localhost:3000`.

### Trocando o provedor de LLM (Anthropic direto ou OpenRouter)

O agente suporta os dois, controlado pela variável `LLM_PROVIDER` no `.env`:

- `LLM_PROVIDER=anthropic` (padrão) — chama a API da Anthropic direto, com `ANTHROPIC_API_KEY`
  e `CLAUDE_MODEL` (padrão `claude-sonnet-5`)
- `LLM_PROVIDER=openrouter` — chama o OpenRouter (API compatível com a da OpenAI), com
  `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` (padrão `anthropic/claude-sonnet-5`; troque pra
  qualquer slug do [catálogo do OpenRouter](https://openrouter.ai/models), inclusive modelos
  de outros laboratórios se quiser comparar)

A lógica da persona, das tools e do CRM é a mesma nos dois casos — só muda o formato da
chamada HTTP por baixo (`lib/claudeAgent.js` tem as duas implementações lado a lado).

### Trocando o modelo (só para o provedor Anthropic)

Por padrão usa `claude-sonnet-5`. Pra um agente de alto volume e baixo custo por conversa,
defina `CLAUDE_MODEL=claude-haiku-4-5-20251001` no `.env`.

## Deploy

Funciona em qualquer lugar que rode Node — não precisa de infra especial:

- **Railway / Render**: conecta o repositório, define as variáveis do `.env`, pronto.
  Atenção: SQLite grava em disco, então use um volume persistente (ambos oferecem).
- **VPS próprio**: `npm install && npm start` atrás de um `pm2` ou `systemd`, com nginx
  como proxy reverso (necessário para o HTTPS que a Meta exige no webhook).

## Configurando o webhook na Meta

1. Crie um app em [developers.facebook.com](https://developers.facebook.com) com o produto WhatsApp.
2. Aponte o webhook para `https://SEU_DOMINIO/api/whatsapp/webhook`.
3. Use o mesmo valor de `WHATSAPP_VERIFY_TOKEN` do seu `.env` na verificação.
4. Assine o campo `messages`.

## Evoluindo o schema

Hoje é SQLite (arquivo único, zero configuração). Quando o volume crescer ou você
precisar de múltiplos servidores, migrar para Postgres é uma troca pequena: só o
`db.js` muda (trocar `better-sqlite3` por `pg`), as rotas continuam iguais.
````