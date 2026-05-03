const { query } = require('./db');

// ─── DDL ────────────────────────────────────────────────────────────────────

const CREATE_ENUM_UNIDADE = `
  DO $$ BEGIN
    CREATE TYPE unidade_enum AS ENUM ('tambore', 'mutinga');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
`;

const CREATE_PROFISSIONAIS = `
  CREATE TABLE IF NOT EXISTS profissionais (
    id                  SERIAL PRIMARY KEY,
    nome                VARCHAR(100) NOT NULL,
    unidade             unidade_enum NOT NULL,
    percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 40.00,
    ativo               BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const CREATE_VENDAS = `
  CREATE TABLE IF NOT EXISTS vendas (
    id                SERIAL PRIMARY KEY,
    unidade           unidade_enum NOT NULL,
    profissional_id   INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
    servico           VARCHAR(120) NOT NULL,
    valor             NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
    comissao          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (comissao >= 0),
    forma_pagamento   VARCHAR(30) NOT NULL DEFAULT 'dinheiro',
    data              DATE NOT NULL,
    observacao        TEXT,
    importado         BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_vendas_data        ON vendas(data);
  CREATE INDEX IF NOT EXISTS idx_vendas_unidade     ON vendas(unidade);
  CREATE INDEX IF NOT EXISTS idx_vendas_profissional ON vendas(profissional_id);
`;

const CREATE_GASTOS = `
  CREATE TABLE IF NOT EXISTS gastos (
    id          SERIAL PRIMARY KEY,
    unidade     unidade_enum NOT NULL,
    categoria   VARCHAR(60) NOT NULL,
    descricao   VARCHAR(255) NOT NULL,
    valor       NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
    data        DATE NOT NULL,
    observacao  TEXT,
    importado   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_gastos_data    ON gastos(data);
  CREATE INDEX IF NOT EXISTS idx_gastos_unidade ON gastos(unidade);
`;

const ADD_UNIQUE_PROF_NOME = `
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'uq_prof_nome' AND conrelid = 'profissionais'::regclass
    ) THEN
      ALTER TABLE profissionais ADD CONSTRAINT uq_prof_nome UNIQUE (nome);
    END IF;
  END $$;
`;

const SEED_PROFISSIONAIS = `
  INSERT INTO profissionais (nome, unidade, percentual_comissao)
  VALUES
    ('Thieco Leandro',   'tambore', 50.00),
    ('Igor Hidalgo',     'mutinga', 40.00),
    ('Kauã dos Santos',  'mutinga', 40.00),
    ('Marcos Fernandes', 'mutinga', 40.00)
  ON CONFLICT (nome) DO NOTHING;
`;

// ─── DDL Gestão de Time ──────────────────────────────────────────────────────

const CREATE_FEEDBACKS = `
  DO $$ BEGIN
    CREATE TYPE feedback_tipo_enum AS ENUM ('elogio', 'melhoria');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  CREATE TABLE IF NOT EXISTS feedbacks (
    id               SERIAL PRIMARY KEY,
    profissional_id  INTEGER NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    tipo             feedback_tipo_enum NOT NULL,
    categoria        VARCHAR(60) NOT NULL DEFAULT 'outros',
    titulo           VARCHAR(150) NOT NULL,
    descricao        TEXT NOT NULL,
    data             DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_feedbacks_prof ON feedbacks(profissional_id);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_data ON feedbacks(data);
`;

const CREATE_PLANOS_ACAO = `
  DO $$ BEGIN
    CREATE TYPE pdca_status_enum AS ENUM ('pendente','em_andamento','concluido','cancelado');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  CREATE TABLE IF NOT EXISTS planos_acao (
    id               SERIAL PRIMARY KEY,
    profissional_id  INTEGER NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    titulo           VARCHAR(200) NOT NULL,
    planejar         TEXT NOT NULL,
    executar         TEXT NOT NULL DEFAULT '',
    checar           TEXT NOT NULL DEFAULT '',
    agir             TEXT NOT NULL DEFAULT '',
    status           pdca_status_enum NOT NULL DEFAULT 'pendente',
    data_inicio      DATE NOT NULL DEFAULT CURRENT_DATE,
    data_meta        DATE,
    data_conclusao   DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_pdca_prof   ON planos_acao(profissional_id);
  CREATE INDEX IF NOT EXISTS idx_pdca_status ON planos_acao(status);
`;

const CREATE_SUGESTOES = `
  DO $$ BEGIN
    CREATE TYPE sugestao_status_enum AS ENUM ('aberta','em_analise','aprovada','implementada','rejeitada');
    CREATE TYPE sugestao_prioridade_enum AS ENUM ('baixa','media','alta');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  CREATE TABLE IF NOT EXISTS sugestoes (
    id          SERIAL PRIMARY KEY,
    unidade     VARCHAR(30) NOT NULL DEFAULT 'geral',
    categoria   VARCHAR(60) NOT NULL DEFAULT 'outros',
    titulo      VARCHAR(200) NOT NULL,
    descricao   TEXT NOT NULL,
    prioridade  sugestao_prioridade_enum NOT NULL DEFAULT 'media',
    status      sugestao_status_enum NOT NULL DEFAULT 'aberta',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

// ─── DDL Usuários (RBAC) ────────────────────────────────────────────────────

const CREATE_USUARIOS = `
  DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('admin', 'barbeiro');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  CREATE TABLE IF NOT EXISTS usuarios (
    id               SERIAL PRIMARY KEY,
    nome             VARCHAR(100) NOT NULL,
    username         VARCHAR(50)  NOT NULL,
    senha_hash       VARCHAR(255) NOT NULL,
    role             user_role_enum NOT NULL DEFAULT 'barbeiro',
    profissional_id  INTEGER REFERENCES profissionais(id) ON DELETE SET NULL,
    ativo            BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_username UNIQUE (username)
  );
`;

// Adiciona role 'operador' e coluna unidade_acesso (idempotente)
const ALTER_USER_ROLE_OPERADOR = `
  ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'operador';
`;

const ALTER_USUARIOS_UNIDADE_ACESSO = `
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS unidade_acesso VARCHAR(20);
`;

// Senhas padrão — ALTERAR em produção via UPDATE usuarios SET senha_hash = ...
async function seedUsuarios() {
  const bcrypt = require('bcryptjs');

  const { rows: profs } = await query('SELECT id, nome FROM profissionais');
  const findId = (fragment) =>
    fragment
      ? profs.find((p) => p.nome.toLowerCase().includes(fragment.toLowerCase()))?.id ?? null
      : null;

  const seeds = [
    { nome: 'Thieco Leandro', username: 'thieco',  senha: 'Thieco@2025!',  role: 'admin',    profKey: 'thieco', unidade_acesso: null      },
    { nome: 'Caixa Mutinga',  username: 'mutinga', senha: 'Mutinga@2025!', role: 'operador', profKey: null,     unidade_acesso: 'mutinga' },
  ];

  for (const u of seeds) {
    const { rows: exists } = await query('SELECT id FROM usuarios WHERE username = $1', [u.username]);
    if (exists.length > 0) continue;

    const hash = await bcrypt.hash(u.senha, 12);
    await query(
      `INSERT INTO usuarios (nome, username, senha_hash, role, profissional_id, unidade_acesso)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (username) DO NOTHING`,
      [u.nome, u.username, hash, u.role, findId(u.profKey), u.unidade_acesso]
    );
  }
  console.log('  ✓ Usuários verificados: thieco (admin), mutinga (operador)');
}

// ─── Migrations ─────────────────────────────────────────────────────────────

async function runMigrations() {
  console.log('Executando migrations...');
  try {
    await query(CREATE_ENUM_UNIDADE);
    await query(CREATE_PROFISSIONAIS);
    await query(ADD_UNIQUE_PROF_NOME);
    await query(CREATE_VENDAS);
    await query(CREATE_GASTOS);
    await query(SEED_PROFISSIONAIS);
    await query(CREATE_FEEDBACKS);
    await query(CREATE_PLANOS_ACAO);
    await query(CREATE_SUGESTOES);
    await query(CREATE_USUARIOS);
    await query(ALTER_USER_ROLE_OPERADOR);
    await query(ALTER_USUARIOS_UNIDADE_ACESSO);
    await seedUsuarios();
    console.log('Migrations concluídas com sucesso.');
  } catch (err) {
    console.error('Erro ao executar migrations:', err.message);
    throw err;
  }
}

// ─── Queries reutilizáveis ───────────────────────────────────────────────────

const Profissional = {
  findAll: ({ unidade, apenas_barbeiros } = {}) => {
    const conditions = ['p.ativo = true'];
    const params = [];
    if (unidade) {
      params.push(unidade);
      conditions.push(`p.unidade = $${params.length}`);
    }
    if (apenas_barbeiros) {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.profissional_id = p.id AND u.role = 'admin')`
      );
    }
    return query(
      `SELECT p.* FROM profissionais p WHERE ${conditions.join(' AND ')} ORDER BY p.nome`,
      params
    );
  },
  findById: (id) => query(`SELECT * FROM profissionais WHERE id = $1`, [id]),
  findByNome: (nome) =>
    query(`SELECT * FROM profissionais WHERE LOWER(nome) = LOWER($1) LIMIT 1`, [nome]),
  create: ({ nome, unidade, percentual_comissao }) =>
    query(
      `INSERT INTO profissionais (nome, unidade, percentual_comissao)
       VALUES ($1, $2, $3) RETURNING *`,
      [nome, unidade, percentual_comissao ?? 40]
    ),
};

const Venda = {
  findAll: ({ unidade, inicio, fim, profissional_id } = {}) => {
    const conditions = [];
    const params = [];
    if (unidade) { conditions.push(`v.unidade = $${params.push(unidade)}`); }
    if (inicio)  { conditions.push(`v.data >= $${params.push(inicio)}`); }
    if (fim)     { conditions.push(`v.data <= $${params.push(fim)}`); }
    if (profissional_id) { conditions.push(`v.profissional_id = $${params.push(profissional_id)}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return query(
      `SELECT v.*, p.nome AS profissional_nome
       FROM vendas v
       LEFT JOIN profissionais p ON p.id = v.profissional_id
       ${where}
       ORDER BY v.data DESC, v.created_at DESC`,
      params
    );
  },
  create: ({ unidade, profissional_id, servico, valor, comissao, forma_pagamento, data, observacao, importado }) =>
    query(
      `INSERT INTO vendas (unidade, profissional_id, servico, valor, comissao, forma_pagamento, data, observacao, importado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [unidade, profissional_id, servico, valor, comissao ?? 0, forma_pagamento ?? 'dinheiro', data, observacao ?? null, importado ?? false]
    ),
  bulkCreate: async (vendas) => {
    const client = await require('./db').getClient();
    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const v of vendas) {
        const { rows } = await client.query(
          `INSERT INTO vendas (unidade, profissional_id, servico, valor, comissao, forma_pagamento, data, observacao, importado)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, true) RETURNING *`,
          [v.unidade, v.profissional_id, v.servico, v.valor, v.comissao ?? 0, v.forma_pagamento ?? 'dinheiro', v.data, v.observacao ?? null]
        );
        inserted.push(rows[0]);
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

const Gasto = {
  findAll: ({ unidade, inicio, fim, categoria } = {}) => {
    const conditions = [];
    const params = [];
    if (unidade)   { conditions.push(`unidade = $${params.push(unidade)}`); }
    if (inicio)    { conditions.push(`data >= $${params.push(inicio)}`); }
    if (fim)       { conditions.push(`data <= $${params.push(fim)}`); }
    if (categoria) { conditions.push(`LOWER(categoria) = LOWER($${params.push(categoria)})`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return query(`SELECT * FROM gastos ${where} ORDER BY data DESC, created_at DESC`, params);
  },
  create: ({ unidade, categoria, descricao, valor, data, observacao, importado }) =>
    query(
      `INSERT INTO gastos (unidade, categoria, descricao, valor, data, observacao, importado)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [unidade, categoria, descricao, valor, data, observacao ?? null, importado ?? false]
    ),
  bulkCreate: async (gastos) => {
    const client = await require('./db').getClient();
    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const g of gastos) {
        const { rows } = await client.query(
          `INSERT INTO gastos (unidade, categoria, descricao, valor, data, observacao, importado)
           VALUES ($1,$2,$3,$4,$5,$6, true) RETURNING *`,
          [g.unidade, g.categoria, g.descricao, g.valor, g.data, g.observacao ?? null]
        );
        inserted.push(rows[0]);
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = { runMigrations, Profissional, Venda, Gasto };
