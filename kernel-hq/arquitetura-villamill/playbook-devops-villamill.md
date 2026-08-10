---
status: stable
domain: villamill
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Playbook DevOps — Villa Mill

Extraído do Playbook DevOps geral do kernel-hq em 2026-08-10 (estava genérico demais, difícil de localizar). Contém comandos, deploy e gotchas específicos do Villa Mill (`vilamill-sistema`). Ver também [[indice-villamill]] e [[Playbook DevOps - Comandos Docker e Bancos]] (comandos gerais + risco do monorepo).

## Villa Mill Sistema (vilamill-sistema) — o que saber pra mexer sem mim

**Duas cópias existem, com os mesmos nomes de container e portas — é fácil confundir uma com a outra:**

| | Local (seu Windows/WSL) | Produção (VPS) |
|---|---|---|
| Caminho | `/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/vilamill-sistema` | `/var/www/vilamill-sistema` (SSH na VPS, IP `2.24.93.178`) |
| Tem Node/npm? | Sim | **Não** — só Docker |
| Quem acessa | Só você, testando | Clientes reais, via `villamill.online` (Nginx + SSL na frente) |
| Containers | `villamill-app` (3000), `villamill-db` (5433) | mesmos nomes/portas, mas isolados — não é a mesma instância |

Um `git push` daqui **não** chega na VPS sozinho — GitHub só guarda o código. Alguém precisa entrar na VPS e rodar o pull/rebuild (próxima seção).

### Deploy na VPS (produção)

```bash
ssh <usuario>@2.24.93.178
cd /var/www/vilamill-sistema
git pull origin main
docker compose up -d --build     # reconstrói a imagem com o código novo; Dockerfile já roda `prisma migrate deploy` sozinho no startup
docker compose ps                # confirma villamill-app e villamill-db "Up"
docker compose logs -f app       # confirma que subiu sem erro (Ctrl+C sai sem derrubar)
```

**A VPS não tem `npm`/`npx` no host** — qualquer coisa que precise do Prisma CLI ou de rodar um script Node tem que ser dentro do container:
```bash
docker exec villamill-app node -e "<script inline>"
```
(mesmo princípio vale pra Prisma — não só seed: script Node que precise do runtime do container tem que rodar via `docker exec`, nunca no host)

### Ambiente local — testar mudança de código sem afetar ninguém

```bash
cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/vilamill-sistema"
npx prisma generate                                      # gera o client após clonar ou mudar o schema
NEXTAUTH_URL=http://localhost:3001 npx next dev -p 3001   # sobe em paralelo ao container local (porta 3000), sem conflito
```
Ao terminar: `pkill -f "next dev -p 3001"`. Isso só existe localmente — não faz sentido (nem funciona) na VPS.

Qualquer mudança em `prisma/schema.prisma` precisa virar uma migration antes de subir (`npx prisma migrate dev --name descricao-da-mudanca`, local) — nunca só editar o schema esperando o Prisma "adivinhar". `npx prisma migrate status` confere se schema e banco batem, sem alterar nada.

Usuários de teste (seed, local): `admin`/`admin123` (ADMIN), `caixa`/`caixa123` (CAIXA), `treinamento`/`treino123` (CAIXA, modo treino — não persiste nada no banco). Existe também um usuário `cozinha` (role COZINHA) no banco, mas a senha dele não veio do `seed.ts` — não sei qual é; se precisar, resetar via `docker exec villamill-db psql -U postgres -d villamill` e um `UPDATE "User" SET "senhaHash" = ...` com hash bcrypt novo. Login é por **usuário**, não e-mail, apesar do campo se chamar "usuário" na tela.

**Pegadinha de cookie:** login fica salvo por domínio (`localhost`), não por porta — se você testou em `:3000` e depois abre `:3001`, o navegador manda o cookie antigo e você cai logado com o usuário errado. Resolve com `http://localhost:PORTA/api/auth/signout` ou aba anônima.

Pra conferir um valor de enum ou dado específico sem mexer em nada (local ou VPS, trocando o nome do container):
```bash
docker exec villamill-db psql -U postgres -d villamill -c "select 'NOTA'::\"FormaPagamento\";"
```
Nomes com letra maiúscula (`"User"`, `"FormaPagamento"`) precisam de aspas duplas — o Prisma cria tudo com o case exato do schema, e Postgres é case-sensitive quando tem aspas.

### Fazer commit sem misturar com trabalho não relacionado

Se `git status` mostrar um arquivo com mudanças de duas features diferentes ao mesmo tempo, dá pra escolher só os trechos (hunks) de uma delas:
```bash
git add -p arquivo.ts   # pergunta hunk por hunk: y (inclui), n (deixa de fora)
```

### Se o sistema realmente travar em produção e eu não estiver disponível

1. SSH na VPS → `docker compose ps` — `villamill-app` e `villamill-db` estão "Up"? Se não, `docker compose up -d`.
2. `docker compose logs --tail 100 app` — o erro geralmente aparece nas últimas linhas.
3. Erro de banco (`P2021`, "table does not exist") → `docker compose restart app` primeiro — o `migrate deploy` automático do Dockerfile às vezes resolve sozinho.
4. Se nada resolver e for urgente: `docker compose down && docker compose up -d` recria os containers sem apagar dado (volume nomeado do Postgres é preservado à parte, independente do container).
5. Confirmar de fora que voltou: abrir `villamill.online` no navegador (não `2.24.93.178:3000` direto — essa porta está fechada pro público desde a decisão de segurança de 2026-07-05, só o Nginx do host fala com o container).

