const TENANT_ID = "orbita";

// Cores semânticas do funil: cinza=novo, azul=em andamento, âmbar=aguardando, verde=ganho, vermelho=perdido
const STAGES = [
  { key: "novo", label: "Novo", color: "var(--neutral)", bg: "var(--neutral-bg)" },
  { key: "qualificando", label: "Qualificando", color: "var(--primary)", bg: "var(--primary-bg)" },
  { key: "reuniao_marcada", label: "Reunião marcada", color: "var(--warning)", bg: "var(--warning-bg)" },
  { key: "ganho", label: "Ganho", color: "var(--success)", bg: "var(--success-bg)" },
  { key: "perdido", label: "Perdido", color: "var(--danger)", bg: "var(--danger-bg)" },
];

const board = document.getElementById("board");
const leadCountEl = document.getElementById("leadCount");
const drawer = document.getElementById("drawer");
const drawerContent = document.getElementById("drawerContent");
const scrim = document.getElementById("scrim");
const modal = document.getElementById("modal");
const searchInput = document.getElementById("searchInput");

let allLeads = []; // cache local pra filtrar sem bater na API a cada tecla

async function fetchLeads() {
  const res = await fetch(`/api/leads?tenant_id=${TENANT_ID}`);
  return res.ok ? res.json() : [];
}

function filterLeads(leads, query) {
  const q = query.trim().toLowerCase();
  if (!q) return leads;
  return leads.filter((l) =>
    [l.name, l.company, l.phone].some((f) => (f || "").toLowerCase().includes(q))
  );
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
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
    col.style.setProperty("--stage-bg", stage.bg);

    col.innerHTML = `
      <div class="column-header">
        <span class="column-dot"></span>
        <span class="column-title">${stage.label}</span>
        <span class="column-count">${stageLeads.length}</span>
      </div>
      <div class="column-cards" data-stage="${stage.key}"></div>
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

    cardsWrap.addEventListener("dragover", (e) => {
      e.preventDefault();
      cardsWrap.classList.add("drag-over");
    });
    cardsWrap.addEventListener("dragleave", () => cardsWrap.classList.remove("drag-over"));
    cardsWrap.addEventListener("drop", async (e) => {
      e.preventDefault();
      cardsWrap.classList.remove("drag-over");
      const leadId = e.dataTransfer.getData("text/plain");
      const targetStage = cardsWrap.dataset.stage;
      const lead = allLeads.find((l) => l.id === leadId);
      if (!lead || lead.stage === targetStage) return;

      await fetch(`/api/leads/${leadId}/stage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: TENANT_ID, stage: targetStage }),
      });
      refresh();
    });

    board.appendChild(col);
  });
}

function renderCard(lead) {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.draggable = true;
  card.innerHTML = `
    <div class="card-top">
      <span class="card-avatar">${initials(lead.name)}</span>
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
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => card.classList.add("dragging"));
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  return card;
}

async function openDrawer(leadId) {
  const res = await fetch(`/api/leads/${leadId}?tenant_id=${TENANT_ID}`);
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
      body: JSON.stringify({ tenant_id: TENANT_ID, stage: e.target.value }),
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
  allLeads = await fetchLeads();
  renderBoard(filterLeads(allLeads, searchInput.value));
}

searchInput.addEventListener("input", () => {
  renderBoard(filterLeads(allLeads, searchInput.value));
});

// Chat de teste com o agente ------------------------------------------------

const chatDrawer = document.getElementById("chatDrawer");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

// Telefone fake persistido no navegador, pra manter a mesma conversa entre sessões
function getTestPhone() {
  let phone = localStorage.getItem("sdr_test_phone");
  if (!phone) {
    phone = "web-test-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("sdr_test_phone", phone);
  }
  return phone;
}

function renderChatBubble({ direction, message, pending }) {
  const div = document.createElement("div");
  div.className = `msg ${direction}${pending ? " pending" : ""}`;
  div.textContent = message;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

async function openChat() {
  chatDrawer.classList.add("open");
  scrim.classList.add("open");
  chatMessages.innerHTML = "";

  const phone = getTestPhone();
  const res = await fetch(`/api/leads/by-phone/${phone}?tenant_id=${TENANT_ID}`);
  if (res.ok) {
    const lead = await res.json();
    const historyRes = await fetch(`/api/leads/${lead.id}/interactions?tenant_id=${TENANT_ID}`);
    const interactions = historyRes.ok ? await historyRes.json() : [];
    if (interactions.length === 0) {
      chatMessages.innerHTML = `<p class="chat-empty">Mande uma mensagem pra começar a conversa.</p>`;
    } else {
      interactions.forEach((i) => renderChatBubble({ direction: i.direction, message: i.message }));
    }
  } else {
    chatMessages.innerHTML = `<p class="chat-empty">Mande uma mensagem pra começar a conversa.</p>`;
  }

  chatInput.focus();
}

function closeChat() {
  chatDrawer.classList.remove("open");
  scrim.classList.remove("open");
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatMessages.querySelector(".chat-empty")?.remove();
  renderChatBubble({ direction: "inbound", message: text });
  chatInput.value = "";
  chatInput.disabled = true;
  const pendingBubble = renderChatBubble({ direction: "outbound", message: "digitando…", pending: true });

  try {
    const res = await fetch("/api/test-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: TENANT_ID, phone: getTestPhone(), name: "Lead de Teste", message: text }),
    });
    const data = await res.json();
    pendingBubble.remove();
    renderChatBubble({ direction: "outbound", message: res.ok ? data.reply : `⚠️ ${data.detail}` });
  } catch (err) {
    pendingBubble.remove();
    renderChatBubble({ direction: "outbound", message: "⚠️ Falha ao falar com o servidor." });
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
    refresh();
  }
});

document.getElementById("testChatBtn").addEventListener("click", openChat);
document.getElementById("chatClose").addEventListener("click", closeChat);

// Eventos
document.getElementById("drawerClose").addEventListener("click", closeDrawer);
scrim.addEventListener("click", () => { closeDrawer(); closeChat(); modal.classList.remove("open"); });

document.getElementById("newLeadBtn").addEventListener("click", () => modal.classList.add("open"));
document.getElementById("cancelNewLead").addEventListener("click", () => modal.classList.remove("open"));

document.getElementById("newLeadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const body = Object.fromEntries(form.entries());
  body.tenant_id = TENANT_ID;

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
    alert(err.detail || "Erro ao criar lead");
  }
});

refresh();
setInterval(refresh, 15000); // atualiza sozinho a cada 15s
