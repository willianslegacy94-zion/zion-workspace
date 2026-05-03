const BASE = '/api';

const TOKEN_KEY = 'thieco_auth_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function http(path, opts = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro ?? `HTTP ${res.status}`);
  return data;
}

export const api = {
  // ── Autenticação ──────────────────────────────────────────────────────────
  auth: {
    login: (username, senha) =>
      http('/auth/login', { method: 'POST', body: JSON.stringify({ username, senha }) }),
    me: () => http('/auth/me'),
  },

  // ── Relatórios ────────────────────────────────────────────────────────────
  fluxoCaixa: (params) =>
    http(`/relatorios/fluxo-caixa?${new URLSearchParams(params)}`),
  dre: (params) =>
    http(`/relatorios/dre?${new URLSearchParams(params)}`),
  comissoes: (params) =>
    http(`/relatorios/comissoes?${new URLSearchParams(params)}`),
  inteligencia: (params) =>
    http(`/relatorios/inteligencia?${new URLSearchParams(params)}`),

  // ── CRUD ──────────────────────────────────────────────────────────────────
  profissionais: (params = {}) =>
    http(`/profissionais?${new URLSearchParams(params)}`),
  vendas: (params = {}) =>
    http(`/vendas?${new URLSearchParams(params)}`),
  gastos: (params = {}) =>
    http(`/gastos?${new URLSearchParams(params)}`),
  criarVenda: (body) =>
    http('/vendas', { method: 'POST', body: JSON.stringify(body) }),
  criarGasto: (body) =>
    http('/gastos', { method: 'POST', body: JSON.stringify(body) }),

  // ── Importação (admin) ────────────────────────────────────────────────────
  importar: (payload) =>
    http('/import', { method: 'POST', body: JSON.stringify(payload) }),

  // ── Gestão de Time (admin — JWT faz o controle, não PIN) ─────────────────
  gestao: {
    feedbacks: (params = {}) =>
      http(`/gestao/feedbacks?${new URLSearchParams(params)}`),
    criarFeedback: (body) =>
      http('/gestao/feedbacks', { method: 'POST', body: JSON.stringify(body) }),
    deletarFeedback: (id) =>
      http(`/gestao/feedbacks/${id}`, { method: 'DELETE' }),

    pdca: (params = {}) =>
      http(`/gestao/pdca?${new URLSearchParams(params)}`),
    criarPdca: (body) =>
      http('/gestao/pdca', { method: 'POST', body: JSON.stringify(body) }),
    atualizarPdca: (id, body) =>
      http(`/gestao/pdca/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deletarPdca: (id) =>
      http(`/gestao/pdca/${id}`, { method: 'DELETE' }),

    sugestoes: (params = {}) =>
      http(`/gestao/sugestoes?${new URLSearchParams(params)}`),
    criarSugestao: (body) =>
      http('/gestao/sugestoes', { method: 'POST', body: JSON.stringify(body) }),
    atualizarSugestao: (id, body) =>
      http(`/gestao/sugestoes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

    timeline: (profissionalId) =>
      http(`/gestao/timeline/${profissionalId}`),
  },
};
