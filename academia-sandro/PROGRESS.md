# Progresso — Sistema de Gestão Academia Prof. Sandro

Projeto: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Prisma 7.8 + PostgreSQL (Supabase).

> ⚠️ Este projeto usa versões novas/breaking do Next.js, Tailwind e Prisma — ver `AGENTS.md` e `node_modules/next/dist/docs/` antes de assumir comportamento de versões antigas.

## Identidade visual

| Token | Valor |
|---|---|
| Fundo (escuro, default) | `#0F0E0A` |
| Fundo (claro) | `#F7F5EF` |
| Primária (dourado) | `#D4AF37` |
| Secundária (bronze) | `#A9791E` |
| Sucesso | `#22c55e` |
| Aviso | `#f59e0b` |
| Erro | `#ef4444` |
| Info | `#3b82f6` |

## O que foi feito

### 1. Tema (`src/app/globals.css`)
Tailwind v4 **não lê `tailwind.config.ts`** por padrão (config é CSS-first via `@theme`). O tema foi colocado direto em `globals.css`:
- `:root` = tema escuro (default)
- classe `.light` no `<html>`/`<body>` sobrescreve para o tema claro
- Cores da marca entram em `@theme inline`, gerando utilitários automáticos: `bg-primary`, `text-primary`, `bg-secondary`, `bg-success`, `text-error`, etc.

### 2. Schema (`prisma/schema.prisma`)
Adicionados dois models com relação 1:N (`Aluno` → `TransacaoFinanceira`, `alunoId` opcional):
- `Aluno`: `id` (uuid), `nome`, `modalidade`, `graduacaoFaixa`, `dataMatricula`, `statusPagamento`, `aptoExame` (boolean)
- `TransacaoFinanceira`: `id` (uuid), `tipo`, `categoria`, `valor` (**`Decimal @db.Decimal(10,2)`**, não `Float` — evita erro de arredondamento com dinheiro), `dataTransacao`, `alunoId` (opcional)

Schema validado com `npx prisma validate` ✅.

### 3. `.env` — corrigido (estava quebrado + senha exposta)
O arquivo original tinha `DATABASE_URL` e `DIRECT_URL` concatenados numa linha só, o que expôs a senha real do Postgres em texto puro. Foi corrigido:
- variáveis separadas em linhas próprias
- senha percent-encoded (continha `#`, `[`, `]`, que quebram parsing de URL)
- **pendente: rotacionar a senha no painel do Supabase** (Settings → Database → Reset Database Password), já que ela apareceu em texto puro nesta conversa

### 4. Troubleshooting da conexão (erro `P1001`)
`npx prisma migrate dev` falhava com `P1001: Can't reach database server`. Investigação eliminou, nessa ordem: rede/porta bloqueada (TCP abre normalmente), proxy corporativo (nenhum configurado), antivírus/firewall de terceiros (desativado, erro persistiu), IPv6 (host só tem registro A/IPv4).

**Causa raiz encontrada:** mudança de comportamento do **Prisma 7** — `sslmode=require` passou a validar a cadeia de certificado por completo (antes só criptografava, sem validar, como o `libpq` tradicional). A cadeia do *connection pooler* da Supabase (Supavisor) não bate com a lista de CAs confiável default do Prisma 7, gerando `self-signed certificate in certificate chain`.

**Fix aplicado:** trocado `?sslmode=require` por `?sslmode=no-verify` nas duas URLs do `.env` (mantém TLS, só não valida a cadeia — ok para dev local; revisitar com `sslmode=verify-full` se for pra produção).

Fontes: [prisma/prisma#29060](https://github.com/prisma/prisma/issues/29060), [prisma/prisma#28803](https://github.com/prisma/prisma/discussions/28803)

### 5. Segundo bug encontrado: senha com colchetes do template do Supabase

Mesmo com `sslmode=no-verify`, a migração continuava falhando — no Windows como `P1001` (can't reach server), no WSL como `P1000` (authentication failed). Investigação (via WSL, testando a conexão direto) revelou que a causa real não era rede nem TLS: a senha salva no `.env` incluía os colchetes `[` `]` como se fossem parte da senha.

Esses colchetes são o placeholder do template que o Supabase mostra na tela de connection string (`postgres.[ref]:[YOUR-PASSWORD]@...`) — a senha real (guardada só no `.env`, fora do controle de versão) não inclui os colchetes. O `P1001` no Windows era um sintoma indireto: o retry/timeout do driver mascarava o erro de autenticação como erro de conexão.

**Fix:** removidos os colchetes do valor de `DATABASE_URL` e `DIRECT_URL` no `.env` (mantido apenas `%23` para o `#`).

### 6. Migração aplicada ✅

`npx prisma migrate dev --name init-aluno-transacao` rodou com sucesso no Windows:
```
prisma\migrations/20260711003005_init_aluno_transacao/migration.sql
Your database is now in sync with your schema.
```

## Próximos passos

- [x] Rodar `npx prisma migrate dev --name init-aluno-transacao` e confirmar que a migração aplica no Supabase
- [ ] Rotacionar a senha do banco no Supabase (pendente por segurança — a senha real apareceu em texto puro múltiplas vezes nesta conversa)
- [x] Apagar os scripts de diagnóstico deixados na raiz do projeto: `test-pg.js`, `test-pg-tls.js`, `test-pg-cert.js` (não fazem parte do app)
- [ ] Seguir com a implementação (telas de Aluno / Transação Financeira, etc.)
