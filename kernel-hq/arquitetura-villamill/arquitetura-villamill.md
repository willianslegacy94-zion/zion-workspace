---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-07-29 (rev 19)
owner: willians
---

# Arquitetura Técnica — Villa Mill Tamboré PDV & Management

> Referência: [[prd-villamill]] | [[requisitos-funcionais-villamill]]

---

## 1. Stack de decisão

| Componente     | Tecnologia escolhida                    | Motivo da escolha                                                                                                 | O que essa escolha fecha                                                                                                        |
| -------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Framework      | Next.js 15 (App Router)                 | Full-stack em uma única codebase — API Routes + React no mesmo projeto; deploy simplificado com output standalone | Server components e App Router têm breaking changes significativos vs. Pages Router — curva de aprendizado para padrões antigos |
| UI             | React 19 + TypeScript 5                 | Tipagem estática reduz bugs em runtime; React 19 traz melhorias de performance                                    | Exige compilação — não serve como script simples                                                                                |
| Estilo         | Tailwind CSS 4                          | Utility-first elimina arquivos CSS separados; responsivo por padrão                                               | —                                                                                                                               |
| ORM            | Prisma 6.4                              | Schema declarativo em `schema.prisma`; migrations versionadas; type safety automático                             | Cada mudança de schema exige migration — não dá para alterar o banco diretamente em produção                                    |
| Banco de dados | PostgreSQL 16                           | ACID, suporte a JSONB (split payment), confiável para dados transacionais                                         | —                                                                                                                               |
| Autenticação   | NextAuth v5 (beta)                      | Integra nativamente com Next.js App Router; suporta Credentials provider com bcrypt                               | v5 ainda em beta — alguns padrões diferem da v4 documentada; exige atenção ao AGENTS.md                                         |
| Data fetching  | SWR 2.4                                 | Polling automático (3s) com keepPreviousData — evita flicker visual em telas operacionais                         | Depende de JS no cliente — sem SSR para dados em tempo real                                                                     |
| Infraestrutura | Docker Compose (Hostinger VPS)          | Custo fixo sem surpresas de cloud; controle total do ambiente                                                     | Backup e monitoramento devem ser gerenciados manualmente                                                                        |
| Deploy         | Docker multi-stage + Next.js standalone | Imagem final enxuta (sem node_modules de dev); output standalone elimina dependência de next CLI em produção      | —                                                                                                                               |

---

## 2. Camadas do sistema

```
[Browser — React 19 + SWR]
         ↓  ↑  (fetch / polling 3s)
[Next.js 15 App Router]
   ├── [Route Handlers — /api/*]   ← lógica de negócio
   ├── [Server Components]         ← rendering inicial
   └── [Middleware NextAuth]       ← autenticação e autorização
         ↓  ↑  (Prisma Client)
[PostgreSQL 16]
```

**Browser (Client Components):**
Telas interativas renderizadas no cliente. SWR gerencia polling e cache local. Mutações via `fetch` + `mutate()` para invalidação imediata. Tailwind CSS para estilo.

**Next.js App Router:**
Unifica frontend e backend. Route Handlers (`/app/api/*/route.ts`) são o backend REST. Server Components fazem o rendering inicial com dados do Prisma direto (sem fetch). Middleware NextAuth intercepta todas as requisições antes do handler.

**Middleware (auth + role):**
Executa em Edge Runtime antes de qualquer route handler ou página. Valida sessão, verifica role e isTrainee. Se isTrainee = true, intercepta mutações e retorna sucesso falso antes de chegar ao banco. Role COZINHA é bloqueada em qualquer rota fora de `/cozinha/*` — redireciona para `/cozinha`.

**Prisma Client + PostgreSQL:**
ORM com type safety total gerado pelo schema. Migrations versionadas garantem que banco e código estão sempre sincronizados. JSONB nativo para pagamentosSplit sem tabela extra.

---

## 3. Fluxo de dados

**Abertura de mesa (caminho principal):**
```
[PATCH /api/mesas → cria Order PENDENTE]
→ [Middleware valida sessão + role]
→ [Route Handler: prisma.order.create + prisma.table.update(OCUPADA)]
→ [Response 201]
→ [SWR invalida cache de mesas → grid atualiza em até 3s]
```

**Fechamento com split payment:**
```
[PATCH /api/pedidos/[id]/fechar-e-liberar]
→ [Middleware valida sessão]
→ [Route Handler:
    1. prisma.order.update (PAGO, pagamentosSplit, closedAt)
    2. Para cada OrderItem: busca RecipeItems do produto
    3. Para cada RecipeItem: decrementa Ingredient.quantidadeAtual
    4. prisma.table.update (LIVRE)
   — tudo em uma transaction]
→ [Response 200]
→ [SWR invalida mesas + financeiro]
```

**Relatório financeiro:**
```
[GET /api/financeiro?from=YYYY-MM-DD&to=YYYY-MM-DD]
→ [Middleware valida sessão + role ADMIN]
→ [Prisma: findMany Orders WHERE closedAt BETWEEN from AND to, incluindo items]
→ [Route Handler agrega por formaPagamento + processa pagamentosSplit]
→ [Response JSON com totais por forma + cancelamentos + despesas]
→ [SWR renderiza sem flicker (keepPreviousData)]
```

---

## 4. Pontos de integração

| Integração | Direção | Formato | Autenticação | Notas |
|---|---|---|---|---|
| Browser ↔ Next.js API | consumo interno | REST/JSON via fetch | NextAuth session cookie | SWR gerencia polling e cache |
| Next.js ↔ PostgreSQL | consumo interno | Prisma Client (TCP) | DATABASE_URL no .env | Conexão direta via Docker network |
| Maquininha de cartão | nenhuma | — | — | Formas de pagamento registradas manualmente pelo operador |
| Hostinger VPS ↔ Docker | deploy | Docker Compose | SSH | Nginx do host (fora de container) faz proxy reverso de `villamill.online` → `127.0.0.1:3000`, com SSL via Certbot/Let's Encrypt. Container não expõe mais porta diretamente à internet (corrigido em 2026-07-05 — ver v1.22) |
| Cron (VPS) ↔ `POST /api/admin/manutencao` | consumo interno | REST/JSON via fetch (`scripts/limpeza.js`) | header `x-api-key` == `MAINTENANCE_API_KEY` (não usa sessão NextAuth) | Cron semanal (proposto: domingo 03h) roda `docker exec villamill-app node scripts/limpeza.js`, já que o host não tem Node fora do Docker; rotina deleta `SystemLog` com mais de 30 dias e roda `VACUUM ANALYZE` nas tabelas de maior churn — pendente aplicar em produção (v1.23) |

---

## 5. Fronteiras de segurança

- **Autenticação:** NextAuth v5 via Credentials provider — email + bcryptjs hash. Sessão como JWT seguro; AUTH_SECRET no .env
- **Autorização:** Middleware em Edge Runtime aplica regras por role antes de qualquer handler
- **Autorização admin-only em Route Handlers:** `src/lib/require-admin.ts` (`isAdmin()`) centraliza a checagem `role === "ADMIN"` no servidor para endpoints de escrita sensíveis (Financeiro, vales, cancelamentos, consumo/crédito de caixinha, despesas) — necessário porque o middleware por si só não distingue ADMIN de CAIXA dentro de uma mesma rota liberada (ex: `/api/pedidos/[id]` atende tanto o cancelamento operacional de mesa quanto a exclusão administrativa de venda fechada)
- **Autenticação por API key (desde 2026-07-04):** `POST /api/admin/manutencao` é a única rota do projeto que não usa sessão NextAuth — autentica via header `x-api-key` comparado com `MAINTENANCE_API_KEY` (.env), pensada para ser chamada por cron/script, não por usuário logado. `src/middleware.ts` tem exceção explícita no `matcher` para essa rota (única mudança em fluxo protegido motivada por essa decisão — ver v1.23)
- **Isolamento de treinamento:** isTrainee interceptado no middleware — nenhuma lógica de negócio é executada, banco nunca é tocado
- **Dados sensíveis:** senhaHash (bcrypt) — nunca exposta em response. AUTH_SECRET e DATABASE_URL apenas no .env (nunca no repositório)
- **Banco:** porta 5432 (mapeada como 5433 no host) vinculada a `127.0.0.1` desde 2026-07-05 — antes ficava em `0.0.0.0`, acessível diretamente da internet sem passar pelo Nginx (falha de configuração corrigida, não uma decisão original de arquitetura). Hoje só acessível localmente na própria VPS (SSH tunnel/DBeaver local)
- **Isolamento de infraestrutura (desde 2026-07-05):** VPS compartilhada com o sistema-thieco (projeto separado, barbearia) — cada um em stack Docker própria (rede, volume e portas independentes), sem nenhum recurso compartilhado além do Nginx do host e do Certbot
- **Pendência conhecida:** `POSTGRES_PASSWORD` ainda é o valor padrão `postgres` (senha fraca) — risco reduzido pelo fechamento da porta, mas não eliminado; troca de senha ainda não aplicada (ver registro de decisões, 2026-07-05)
- **Auditoria:** CancelamentoLog registra mesaNumero, motivoCancelamento, canceladoPor (email) e canceladoEm — imutável após inserção

---

## 6. Estratégia de escala

**Gargalos previstos:**
- SWR polling 3s de múltiplos clientes simultâneos — 10+ operadores fariam ~200 requests/min para `/api/mesas`
- Queries de relatório financeiro sem índice em `closedAt` em base com milhares de pedidos

**Estratégia atual (suficiente para escala do restaurante):**
- PostgreSQL lida com dezenas de conexões simultâneas sem problema
- Prisma Connection Pool gerencia reutilização de conexões
- `keepPreviousData` no SWR evita renders desnecessários

**O que exige reescrita acima de X:**
- Se múltiplas unidades do restaurante forem adicionadas → schema precisaria de campo `unidadeId` em todas as entidades (análogo ao villamill hoje não tem multi-unidade)
- Se relatório histórico ultrapassar 100k pedidos → materializar views ou separar banco analítico
- Se polling causar carga excessiva → substituir SWR por WebSocket (Server-Sent Events ou socket.io)

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | 2026-04-29 | Schema inicial — mesas, produtos, pedidos, insumos, usuários, fichas técnicas |
| v1.1 | 2026-04-29 | Adição de timestamps (createdAt, closedAt) em Order |
| v1.2 | 2026-04-30 | FormaPagamento enum adicionado a Order |
| v1.3 | 2026-05-11 | costPrice e track_inventory em Product; custoUnit em OrderItem; autenticação NextAuth + CancelamentoLog + desconto |
| v1.4 | 2026-05-11 | Adição de CREDITO e DEBITO ao enum FormaPagamento |
| v1.5 | 2026-05-12 | Model Despesa para controle de saídas financeiras |
| v1.6 | 2026-05-14 | pagamentosSplit JSONB em Order para split payment entre múltiplas formas |
| v1.7 | 2026-05-27 | Módulo Parceria Lava-Rápido — FuncionarioExterno, CreditoFuncionario (pool coletivo), ConsumoFuncionario; rotas /parceiros e /caixinha-lava-rapido |
| v1.8 | 2026-05-29 | VOUCHER adicionado ao enum FormaPagamento |
| v1.9 | 2026-05-29 | Dockerfile: CMD executa `prisma migrate deploy` antes de `node server.js`; CLI copiado via node_modules/prisma/build/index.js |
| v1.10 | 2026-05-29 | PATCH /api/pedidos/[id] — edição de transações fechadas (total, formaPagamento, pagamentosSplit); coluna Pagamento exibe split empilhado no Financeiro |
| v1.11 | 2026-05-29 | GET /api/financeiro estendido com `creditosCaixinha` (CreditoFuncionario + include funcionario) e `consumosCaixinha` (ConsumoFuncionario + include funcionario + product) filtrados pelo mesmo intervalo de datas; tela /financeiro ganhou seção "Caixinha — Lava-Rápido" com 3 cards de resumo (Total Créditos, Total Baixas, Saldo do Período) e extrato unificado créditos/baixas em ordem cronológica; layout geral refatorado (separadores de seção, hierarquia visual, padding aumentado) |
| v1.12 | 2026-05-29 | Edição e exclusão de registros no Financeiro (admin only) — PATCH/DELETE `/api/parceiros/credito/[id]`, PATCH/DELETE `/api/parceiros/consumo/[id]`; DELETE `/api/pedidos/[id]` bifurca por paymentStatus (PAGO: exclui sem CancelamentoLog; PENDENTE: comportamento original); ícone lixeira (Trash2/Lucide) substitui texto "Apagar"; 3 novos modais: editar crédito (valor+descrição), editar baixa (quantidade+preview subtotal), confirmar exclusão compartilhado |
| v1.13 | 2026-06-27 | KDS da Cozinha — role COZINHA adicionada ao enum UserRole; campos `status`, `createdAt` e `prontoEm` adicionados a OrderItem; `GET /api/cozinha/pedidos` retorna `{ pendentes, concluidos }` — pendentes filtrados por categoria e `status=PENDENTE`, concluídos filtrados por `prontoEm >= hoje 00:00`; `PATCH /api/cozinha/pedidos/[itemId]` seta `status=PRONTO` e `prontoEm=now()`; `/cozinha` com layout exclusivo (sem navbar, dark theme), SWR polling 2s, abas Pendentes/Concluídos com reset diário automático; login via `/login` com username simples (`cozinha`), middleware bloqueia COZINHA fora de `/cozinha/*` |
| v1.14 | 2026-06-27 | Ponto da Carne habilitado em Lanches Tradicionais e Hambúrguer — X-Burguer, X-Bacon, X-Egg, X-Salada, X-Tudo, X-Calabresa e Hambúrguer (Acompanhamentos) recebem opcional radio obrigatório "Ponto da Carne" (Ao Ponto / Bem Passado / Mal Passado), alinhado aos Lanches Artesanais que já tinham a configuração |
| v1.15 | 2026-06-27 | Cupom térmico 80mm — `src/components/cupom-impressao.tsx` (tipo `DadosCupom`, Courier New 10pt, divisores dashed/double, todas as categorias incluídas); `@page { size: 80mm auto; margin: 0 }` + `@media print { .print-area }` em globals.css; botão "Imprimir Cupom" disponível no modal de pedido sempre que há pedido ativo; pop de confirmação "Cupom fiscal?" intercepta primeiro clique em "Fechar Conta" — SIM volta ao modal para imprimir antes, NÃO prossegue com fechamento direto; overlay pós-fechamento com resumo financeiro e segundo botão de impressão; snapshot capturado antes do fechamento preserva dados corretos |
| v1.16 | 2026-07-01 | Aba Equipe (`src/app/mesas/equipe-grid.tsx`) reaproveitando FuncionarioExterno/ConsumoFuncionario, sem model novo; bypass de poolSaldo em `POST /api/parceiros/consumo` para `empresa="Equipe Villa Mill"`; filtro de categoria de produto (mesas e Equipe) passa a ser derivado dinamicamente dos produtos carregados em vez de lista fixa no código; sincronização automática `POST/DELETE /api/caixas` ↔ `FuncionarioExterno`; card "Caixinha Lava-Rápido" comentado em `home-modules.tsx` (reversível) |
| v1.17 | 2026-07-01 | CRUD completo (admin) na tela Financeiro — `POST /api/financeiro/transacao` (venda manual), `PATCH/DELETE /api/cancelamentos/[id]` (novo), `PATCH/DELETE /api/vales/[id]` (novo), inclusão inline de despesa/crédito/consumo reaproveitando endpoints existentes; `PATCH /api/parceiros/consumo/[id]` ganha `{ liquidado }` (baixa administrativa); seção "Caixinha — Lava-Rápido" renomeada para "Caixinha" com coluna "Grupo"; `src/lib/require-admin.ts` (`isAdmin()`) criado e aplicado em todos os endpoints admin-only, incluindo retrofit de `PATCH/DELETE /api/pedidos/[id]` (branch PAGO apenas) e `/api/despesas*`, que não tinham checagem de admin no servidor |
| v1.18 | 2026-07-01 | Correção do KDS da Cozinha — `CATEGORIAS_COZINHA` em `src/app/api/cozinha/pedidos/route.ts` ganha "Café da Manhã" (categoria existente em produção, esquecida na allowlist original de v1.13); itens dessa categoria pedidos na mesa não apareciam no KDS |
| v1.19 | 2026-07-01 | Financeiro — três novas visões do faturamento por categoria: card "Lavagem" no bloco de KPIs (total do período + contagem), seção "Lavagens" (mesa, data/hora, responsável, serviço, valor, com total no rodapé) e seção "Villamil" (réplica de Transações excluindo pedidos 100% Lavagem); Transações original mantida sem filtro, mostrando todos os pedidos |
| v1.20 | 2026-07-03 | Removida por completo a checagem de `poolSaldo` em `POST /api/parceiros/consumo` — o bypass que em v1.16 era exclusivo de `empresa="Equipe Villa Mill"` virou o único comportamento do endpoint, para qualquer grupo; sem migração de schema. Nova rota `GET /api/financeiro/consumo-funcionarios` (Prisma `groupBy` por `funcionarioId`, soma de `subtotal`) alimentando nova seção "Consumo de Funcionários" no Financeiro (resumo agregado + modal "Ver Detalhes" com Dar baixa/Editar/Excluir por item, reaproveitando `PATCH/DELETE /api/parceiros/consumo/[id]` já existentes); novo hook `useConsumoFuncionarios` em `useAppData.ts` |
| v1.21 | 2026-07-03 | Novo componente `src/components/notifications-bell.tsx` no navbar — centraliza alertas de estoque crítico (antes banners empilhados na home) em um sino com badge e dropdown, reaproveitando `useDashboard()` sem endpoint novo; `financeiro-content.tsx` + as duas rotas de Financeiro passam a assumir `from = hoje` por padrão (antes `1º dia do mês`) quando a URL não especifica período |
| v1.22 | 2026-07-05 | Portas de `villamill-app` (3000) e `villamill-db` (5433), antes em `0.0.0.0` (expostas à internet), vinculadas a `127.0.0.1` no `docker-compose.yml` de produção — só o Nginx do host consegue falar com os containers agora. Backup `pg_dump` de segurança tirado antes da mudança; container recriado reaproveitando o volume nomeado existente, sem perda de dado. Motivado pela chegada do sistema-thieco (projeto separado) à mesma VPS — que expôs essa lacuna de configuração já existente durante a auditoria de portas |
| v1.23 | 2026-07-04 | Manutenção automática do banco — model `SystemLog` (migration `20260704215901_add_system_log`); `src/lib/logger.ts` (primeiro logger estruturado do projeto); `POST /api/admin/manutencao` autenticado por `x-api-key` (deleta `SystemLog` >30 dias, roda `VACUUM ANALYZE` em 8 tabelas de maior churn); `scripts/limpeza.js` para disparo via cron (`docker exec villamill-app node scripts/limpeza.js`); exceção no `matcher` do middleware para a nova rota. Testado localmente ponta a ponta — **pendente aplicar em produção** (API key real, crontab, confirmar migration aplicada) |
| v1.24 | 2026-07-09 | KDS — `GET /api/cozinha/pedidos` agrupa itens por mesa/pedido: resposta `{ pendentes, concluidos }` vira `{ mesas, concluidos }`, buscando itens `PENDENTE` e `PRONTO` e agrupando por `order.id`; card no `kds-board.tsx` passa a representar uma mesa inteira (itens pendentes em destaque, prontos riscados no mesmo card); card só sai da fila quando todos os itens da mesa estão prontos e reaparece se um novo item for lançado na mesma mesa. Sem migração de schema — mudança de agregação e apresentação |
| v1.25 | 2026-07-11 | Bloqueio de acesso por horário (BYOD Guard) — `src/lib/horario-acesso.ts` (matriz fixa por dia da semana, calculada sempre em `America/Sao_Paulo`); `middleware.ts` bloqueia CAIXA/COZINHA fora do expediente (redirect para nova rota `/bloqueio-horario` em páginas, 403 `outOfHours` em APIs), ADMIN isento; novo fetcher SWR compartilhado (`src/lib/fetcher.ts`) redireciona o cliente ao detectar `outOfHours` em vez de estourar erro genérico; modal de aviso 15min antes do corte (`aviso-expiracao-horario.tsx`). Sem migração de schema |
| v1.26 | 2026-07-12 | Aumento de fonte do sistema — `html { font-size: 112.5% }` em `globals.css`, escopado a `@media screen` para não afetar o cupom térmico impresso (que herda o tamanho do body via `@media print`) |
| v1.27 | 2026-07-12 | `POST /api/parceiros/consumo` ganha `valorTotal` opcional — permite editar o valor debitado no lançamento (ex: dois funcionários dividindo o custo de um mesmo item); quando omitido, mantém o cálculo padrão (`produto.preco × quantidade`). Campo "Valor" editável adicionado na aba Equipe (`equipe-grid.tsx`). Sem migração de schema |
| v1.28 | 2026-07-12 | Valor `NOTA` adicionado ao enum `FormaPagamento` (migration `20260712035153_add_forma_pagamento_nota`) — disponível no split payment de mesas, no Financeiro (filtro, resumo por forma, badge rosa) e no cupom impresso. Mesmo padrão da adição de VOUCHER (v1.8), sem migração de dados |
| v1.29 | 2026-07-29 | Correção do KDS — `kds-board.tsx` passa a ler o campo `quantidade` do `OrderItem` (nunca lido antes) e exibe "2x Nome do Prato" quando maior que 1; contadores "a fazer" somam quantidades em vez de contar linhas. Sem migração de schema — bug de apresentação, `quantidade` sempre existiu na API e no banco |
| v1.30 | 2026-07-29 | Acesso do ADMIN à Cozinha via navegação — item "Cozinha" adicionado à navbar (`navbar.tsx`) e card no dashboard inicial (`page.tsx`), ambos restritos a role ADMIN, apontando para /cozinha. Nenhuma mudança de autorização: `cozinha/page.tsx` já liberava ADMIN desde v1.13, faltava só o ponto de acesso na UI |
