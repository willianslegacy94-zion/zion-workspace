---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-07-12 (rev 14)
owner: willians
---

# Registro de Decisões — Villa Mill Tamboré PDV & Management

> Referência: [[prd-villamill]] | [[requisitos-funcionais-villamill]] | [[arquitetura-villamill]]

Memória viva do sistema. Registra o que mudou, por que mudou e o que isso significa.
Entradas em ordem cronológica crescente — as mais recentes no final.

---

## 2026-04-29 — Criação do sistema (schema inicial)

**Motivo:** Operação do restaurante sem PDV digital — pedidos e fechamentos manuais, sem rastreio de estoque.
**Impacto:** Criação das entidades fundamentais: Table (15 mesas), Product (cardápio), Order, OrderItem, Ingredient, RecipeItem, User. Stack definida: Next.js 15 + Prisma + PostgreSQL + NextAuth + SWR + Docker.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-villamill, modelo-de-dados-villamill
**Observação:** Decisão de usar Next.js App Router desde o início — evita migração futura, mas exige atenção às breaking changes do Next.js 15 (documentadas em AGENTS.md).

---

## 2026-04-29 — Timestamps em pedido (createdAt e closedAt)

**Motivo:** Sem timestamps, era impossível filtrar pedidos por período no relatório financeiro ou calcular tempo de atendimento.
**Impacto:** Migration adicionou `createdAt` (default now()) e `closedAt` (nullable — preenchido apenas no fechamento) em Order.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill
**Observação:** closedAt nullable é a flag que distingue pedido aberto de fechado — paymentStatus=PAGO sem closedAt seria estado inválido.

---

## 2026-04-30 — FormaPagamento como ENUM

**Motivo:** Campo de texto livre para forma de pagamento geraria inconsistências nos relatórios (ex: "dinheiro" vs "Dinheiro" vs "cash").
**Impacto:** Criação do enum `FormaPagamento` com valores iniciais: DINHEIRO, CARTAO, PIX. Adicionado como campo nullable em Order.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill, requisitos-funcionais-villamill
**Observação:** Campo nullable porque pedido começa sem forma de pagamento — definida apenas no fechamento.

---

## 2026-05-11 — Custo de produto e rastreio de estoque por produto

**Motivo:** Sem costPrice, era impossível calcular margem de contribuição por produto. Sem track_inventory por produto, qualquer item com ficha técnica deduziria estoque mesmo quando não desejado.
**Impacto:** Adição de `costPrice` e `track_inventory` em Product; `custoUnit` em OrderItem (snapshot do custo no momento da venda). Produtos sem track_inventory=true não deduzem insumos no fechamento.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill, requisitos-funcionais-villamill (RF-024, RN-012)
**Observação:** custoUnit em OrderItem é snapshot — preserva o custo histórico mesmo se o produto for editado depois.

---

## 2026-05-11 — Autenticação NextAuth v5 + perfis de acesso

**Motivo:** Sistema aberto sem autenticação — qualquer pessoa com acesso à URL podia operar ou ver o financeiro.
**Impacto:** Criação do model User com email, senhaHash (bcrypt) e role (ADMIN/CAIXA). Middleware NextAuth protege todas as rotas. Redirecionamento por role: CAIXA só acessa /mesas, /produtos, /estoque.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill, requisitos-funcionais-villamill (RF-001 a RF-005), arquitetura-villamill
**Observação:** NextAuth v5 ainda em beta (5.0.0-beta.31) — padrões diferem da v4. AGENTS.md documenta os cuidados específicos. Decisão de manter v5 para compatibilidade nativa com App Router.

---

## 2026-05-11 — CancelamentoLog e auditoria de cancelamentos

**Motivo:** Cancelamentos aconteciam sem rastro — impossível auditar quantos ocorreram, por quem e por quê. Risco de uso indevido do cancelamento para "apagar" pedidos.
**Impacto:** Criação do model CancelamentoLog com mesaNumero, motivoCancelamento, canceladoPor (email) e canceladoEm. Log é append-only — nunca excluído. Seção separada no relatório financeiro.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill, requisitos-funcionais-villamill (RF-020, RN-010, RN-011)
**Observação:** canceladoPor armazena email (string) em vez de FK para User — preserva o histórico mesmo se o usuário for removido no futuro.

---

## 2026-05-11 — Desconto por pedido

**Motivo:** Operadores precisavam aplicar desconto em situações específicas (cortesia, fidelidade) sem alterar o preço do produto no cardápio.
**Impacto:** Adição do campo `desconto` (Decimal, default 0) em Order. Total exibido em tempo real já desconta o valor.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill, requisitos-funcionais-villamill (RF-016)
**Observação:** Desconto é aplicado no nível do pedido, não no item — simplifica a operação mas não permite desconto por produto específico.

---

## 2026-05-11 — Adição de CREDITO e DEBITO ao enum FormaPagamento

**Motivo:** CARTAO era genérico demais — para relatório de taxas e conciliação financeira, é necessário distinguir crédito de débito.
**Impacto:** Migration adicionou os valores CREDITO e DEBITO ao enum FormaPagamento (PostgreSQL exige ALTER TYPE). CARTAO mantido por compatibilidade com dados existentes.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill (enum FormaPagamento), requisitos-funcionais-villamill
**Observação:** Alterar enum em PostgreSQL requer migration específica — não pode ser feito editando o schema direto. Decisão de manter CARTAO no enum preserva compatibilidade.

---

## 2026-05-12 — Model Despesa

**Motivo:** Sem controle de despesas, o relatório financeiro mostrava faturamento bruto sem resultado real. DRE era impossível.
**Impacto:** Criação do model Despesa com descricao, valor, categoria, data e registradoPor. Integrado ao relatório financeiro — exibido separado do faturamento para cálculo de resultado.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill, requisitos-funcionais-villamill (RF-035 a RF-038)
**Observação:** registradoPor é string (email) — não FK — para preservar histórico caso o usuário seja removido.

---

## 2026-05-14 — Split payment via JSONB

**Motivo:** Clientes frequentemente pagam parte em dinheiro e parte em PIX, ou dividem entre cartões diferentes. Sem split, o operador precisava escolher apenas uma forma, perdendo precisão no relatório.
**Impacto:** Adição do campo `pagamentosSplit` (Json, nullable) em Order. Armazena array de `{forma: FormaPagamento, valor: Decimal}`. Route Handler de fechamento processa cada entrada do split para contabilizar corretamente no relatório por forma de pagamento.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill, requisitos-funcionais-villamill (RF-018, RN-018), arquitetura-villamill
**Observação:** Decisão de usar JSONB em vez de tabela separada de pagamentos — simplifica schema e é suficiente para a escala atual. Se futuramente precisar de queries analíticas por forma de pagamento em escala, uma tabela normalizada seria mais eficiente.

---

## 2026-05-27 — Módulo de Parceria Lava-Rápido (Módulos 9 e 10)

**Motivo:** Integração operacional com o Lava-Rápido parceiro que compartilha o espaço físico. Dois fluxos identificados: (1) venda de serviço de lavagem lançada na comanda do cliente do restaurante; (2) consumo de produtos do restaurante pelos funcionários do Lava-Rápido, custeado pela caixinha que recebem.
**Impacto:**
- 3 novas entidades: FuncionarioExterno, CreditoFuncionario, ConsumoFuncionario
- 1 novo ENUM: TipoCreditoFuncionario (INDIVIDUAL / COLETIVO)
- 2 novos módulos funcionais: Módulo 9 — Gestão de Parceiros (/parceiros, ADMIN) e Módulo 10 — Baixa de Funcionário (modal na home, CAIXA + ADMIN)
- RF-041 a RF-053 adicionados; RN-022 a RN-029 adicionados
- Migration: `20260527110042_parceria_lava_rapido`
**Status:** implementado
**Artefatos atualizados:** modelo-de-dados-villamill, requisitos-funcionais-villamill
**Observações:**
- Decisão crítica de isolamento: ConsumoFuncionario NÃO usa o fluxo Order — evita contaminação do faturamento real; comporta-se como Despesa (saída de estoque com débito em aberto), não como receita
- Consumo bloqueado quando subtotal > poolSaldo da empresa — sem saldo negativo para funcionário externo (exceção intencional à RN-016 que permite estoque negativo)
- CAIXA pode registrar caixinha (crédito) e consumo, mas liquidação de ciclo é exclusiva de ADMIN
- Serviço de Lavagem de Carro não exige schema novo — é um Product com track_inventory=false e categoria "Serviços"

---

## 2026-05-27 — Refatoração para pool coletivo por empresa (rev 2)

**Motivo:** Comportamento original criava N CreditoFuncionario (um por funcionário ativo) no lançamento COLETIVO, multiplicando o total depositado pelo número de pessoas. O Lava-Rápido opera com caixinha compartilhada — R$10 vai para o grupo como um todo, não R$10 por pessoa. O operador inseriu R$10 e o sistema creditou R$20 (2 funcionários), causando inconsistência financeira.
**Impacto:**
- `CreditoFuncionario.funcionarioId` alterado de `String` para `String?` (nullable)
- Campo `empresa String?` adicionado a `CreditoFuncionario`
- COLETIVO agora gera **UM único registro** com `funcionarioId=null` e `empresa=X` representando o pool do grupo
- Saldo recalculado por empresa (pool): `SUM(COLETIVO credits WHERE empresa=X) - SUM(consumos WHERE funcionario.empresa=X)`
- Modal Caixinha ganhou seletor de segmento (🚗 Lava-Rápido / 🍖 Villa Mill) — operações isoladas por empresa
- Acesso ao modal via card na home page (não mais restrito a /mesas)
- Migration: `20260527144124_credito_pool_coletivo`
**Status:** implementado
**Artefatos atualizados:** modelo-de-dados-villamill, requisitos-funcionais-villamill
**Observações:**
- Pool elimina a necessidade de loteId para identificar lançamento coletivo — um único registro já representa o crédito do grupo
- INDIVIDUAL mantém comportamento original: crédito nominativo com funcionarioId preenchido, não entra no pool coletivo
- Pools de empresas distintas (Lava-Rápido, Villa Mill) são completamente independentes — nunca se misturam
- API GET /parceiros/funcionarios retorna `poolSaldo` por empresa; todos os funcionários do mesmo segmento compartilham o mesmo valor exibido

---

## 2026-05-29 — Voucher VR/VA adicionado ao enum FormaPagamento

**Motivo:** Parceiros corporativos e clientes com benefício alimentação (VR) ou refeição (VA) precisavam de uma forma de pagamento distinta para conciliação — registrar como CREDITO ou DEBITO mascarava o canal real.
**Impacto:** Valor `VOUCHER` adicionado ao enum `FormaPagamento`. Disponível no seletor de pagamento das mesas (simples e split), e contabilizado como coluna própria no relatório financeiro (badge âmbar). Migration: `20260529040638_add_voucher_pagamento`.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill (enum FormaPagamento), arquitetura-villamill (v1.8)
**Observação:** Mantém retrocompatibilidade total — pedidos anteriores com CREDITO/DEBITO não são afetados. CARTAO legado continua exibido condicionalmente no financeiro.

---

## 2026-05-29 — Dockerfile: prisma migrate deploy automático no startup

**Motivo:** Migrations novas nunca eram aplicadas na VPS porque o `CMD` do container iniciava direto o `node server.js` sem rodar o Prisma CLI. Resultado: tabelas ausentes em produção (P2021), que só eram descobertas após o deploy causar erro 502.
**Impacto:** `CMD` alterado para `sh -c "node ./node_modules/prisma/build/index.js migrate deploy && node server.js"`. O `node_modules/prisma` (CLI + WASM) é copiado para o runner stage. A partir deste ponto, todo `docker compose up --build` aplica automaticamente as migrations pendentes antes de iniciar a aplicação.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-villamill (v1.9)
**Observações:**
- `.bin/prisma` não deve ser copiado como arquivo regular — perde o symlink e o `__dirname` fica errado, causando ENOENT no `.wasm`. Usar `node_modules/prisma/build/index.js` diretamente resolve o problema.
- `prisma db push` nunca deve ser usado em produção — pode dropar dados para sincronizar o schema. Apenas `migrate deploy` é seguro.
- Migrations que falharam parcialmente ficam registradas como failed em `_prisma_migrations` e bloqueiam novas migrations via P3009. Resolução: `UPDATE _prisma_migrations SET finished_at = NOW(), logs = NULL WHERE ...`.

---

## 2026-05-29 — Edição de transações fechadas no módulo Financeiro

**Motivo:** Erros de operação (forma de pagamento trocada, valor incorreto) em pedidos já fechados exigiam intervenção direta no banco. Sem interface de correção, qualquer ajuste era manual e sem auditoria de interface.
**Impacto:**
- Novo endpoint `PATCH /api/pedidos/[id]` aceita `total`, `formaPagamento` e `pagamentosSplit`. Validação: apenas pedidos com `paymentStatus = PAGO` podem ser editados.
- Modal de edição na tabela de Transações do Financeiro: edita total (R$) e pagamento com suporte completo a split (mesma lógica de mesas — adicionar/remover formas, indicador "Restante").
- Coluna "Pagamento" na tabela de transações agora exibe split empilhado verticalmente: badge colorido do método + valor fracionado discreto (`text-xs text-slate-400`) com `whitespace-nowrap`.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-villamill (v1.10)
**Observações:**
- A edição não recalcula `desconto` — o campo `total` salvo é sempre o valor final (após desconto original). Editar o total substitui o valor armazenado diretamente.
- Split com um único método salva `pagamentosSplit = null` e preenche `formaPagamento`. Split com múltiplos métodos salva o array em `pagamentosSplit` e define `formaPagamento` como o método de maior valor (comportamento idêntico ao fechamento original).
- Endpoint não exposto via middleware de role adicional — acessível a qualquer usuário autenticado que acesse `/financeiro` (ADMIN por padrão via navbar).

---

## 2026-05-29 — Extrato de caixinha integrado ao módulo Financeiro + refatoração de layout

**Motivo:** Registros de caixinha (créditos inseridos e consumos baixados) não tinham visibilidade no módulo Financeiro — admin precisava navegar para o módulo Parceiros para consultar o extrato, sem possibilidade de filtrar por período ou cruzar com as demais informações financeiras do dia.
**Impacto:**
- `GET /api/financeiro` estendido: payload passa a incluir `creditosCaixinha` (CreditoFuncionario com `include: { funcionario }`) e `consumosCaixinha` (ConsumoFuncionario com `include: { funcionario, product }`), ambos filtrados pelo mesmo intervalo `from/to`
- Tela `/financeiro` ganhou seção "Caixinha — Lava-Rápido" (exibida somente quando há registros no período):
  - 3 cards de resumo: Total Créditos (verde), Total Baixas (vermelho), Saldo do Período (violeta/vermelho)
  - Tabela extrato unificada: créditos e baixas mesclados em ordem cronológica decrescente; badge `+ Crédito` (verde) ou `− Baixa` (vermelho); valor com sinal colorido; rodapé com saldo do período
- Layout geral da tela refatorado: `gap-10` no container principal, separadores `border-t` entre seções, `SectionHeader` com `border-b pb-3`, cards de forma de pagamento com layout label/valor empilhado (antes horizontal), padding de células de tabela aumentado (`px-5 py-3.5`), hover em linhas, badges de contagem nos títulos de seção
**Status:** aplicado
**Artefatos atualizados:** arquitetura-villamill (v1.11), requisitos-funcionais-villamill (RF-054, RF-055)
**Observações:**
- Nenhuma migration necessária — os dados já existem nas tabelas `CreditoFuncionario` e `ConsumoFuncionario`; a extensão é apenas na query da API
- A seção Caixinha é condicional — não aparece se não houver lançamentos no período, mantendo a tela limpa para dias sem movimentação de parceiros
- O "Saldo do Período" exibido é calculado apenas sobre os registros do intervalo filtrado, não o saldo acumulado histórico do pool

## 2026-05-29 — Edição e exclusão de registros no Financeiro (admin only)

**Motivo:** Operações de correção (crédito lançado com valor errado, consumo com quantidade incorreta, transação de mesa duplicada) exigiam acesso direto ao banco. Sem interface de correção para os registros de caixinha, o admin ficava sem autonomia para ajustar erros operacionais.
**Impacto:**
- 2 novos endpoints: `PATCH/DELETE /api/parceiros/credito/[id]` e `PATCH/DELETE /api/parceiros/consumo/[id]`, ambos com guard ADMIN via `auth()`
- `DELETE /api/pedidos/[id]` atualizado: pedido `PAGO` → exclui Order + OrderItems sem criar CancelamentoLog (correção administrativa); pedido `PENDENTE` → mantém comportamento original (cancelamento operacional com log e liberação de mesa)
- Tela `/financeiro`: botão lixeira (Trash2, Lucide, 14px) em Transações e Caixinha, visível apenas para ADMIN; botão Editar na tabela Caixinha (admin only)
- 3 modais novos: **Editar Crédito** (valor R$ + descrição), **Editar Baixa** (quantidade com preview de subtotal em tempo real — `quantidade × precoUnit`), **Confirmar Exclusão** (compartilhado, com label descritivo e botão vermelho)
- `financeiro/page.tsx` passa `isAdmin: boolean` ao componente client
**Status:** aplicado
**Artefatos atualizados:** arquitetura-villamill (v1.12), requisitos-funcionais-villamill (RF-056 a RF-059)
**Observações:**
- Edição de baixa (ConsumoFuncionario) não reconstrói os efeitos de estoque — apenas corrige o registro financeiro (mesmo comportamento da edição de transação de mesa, que não recalcula CMV)
- Exclusão de crédito/consumo de caixinha é permanente (`hard delete`) — sem soft delete, pois esses registros não têm dependentes

## 2026-06-03 — Identificação do caixa responsável por abertura de mesa

**Motivo:** Sem rastreio de qual operador abriu a mesa, era impossível auditar quem realizou a abertura em caso de divergência ou inconsistência. A lista de nomes era hardcoded no frontend, dificultando manutenção quando houver rotatividade de equipe.
**Impacto:**
- Campo `caixaNome String?` adicionado ao model `Order` — registra o nome do operador de caixa no momento da abertura; migration `20260603022543_add_caixa_nome`
- Novo model `Caixa` com campos `id`, `nome (UNIQUE)`, `ativo`, `createdAt` — tabela dinâmica de caixas cadastrados; migration `20260603025637_add_caixa_model`
- 3 novos endpoints: `GET /api/caixas` (lista ativos), `POST /api/caixas` (cria/reativa), `DELETE /api/caixas/[id]` (desativa via `ativo=false`)
- Nova página `/admin/caixas` (ADMIN) — lista os caixas cadastrados com botões "Remover" e formulário de adição; seed inicial com 7 nomes: Ana Júlia, Larissa, Kamila, Jhenifer, Jamille, Ednalva, Mill
- Tela `/mesas`: dropdown "Caixa responsável" exibido ao clicar em mesa LIVRE, antes do botão "Abrir Mesa"; botão desabilitado até seleção; nomes buscados de `GET /api/caixas` (não mais hardcoded)
- Tela `/financeiro`: coluna "Caixa" adicionada às tabelas "Transações" e "Mesas em Aberto"
- Card "Caixas" adicionado à home (visível apenas para ADMIN)
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill (rev 4), requisitos-funcionais-villamill (RF-061, RF-062, RF-063, RN-030)
**Observações:**
- `caixaNome` é String? nullable — pedidos anteriores à feature ficam com null; a coluna no financeiro exibe "—" nesses casos
- Desativação de caixa é soft delete (`ativo=false`) — preserva o nome em pedidos históricos, apenas remove do dropdown de abertura
- Nomes gerenciados pelo admin via interface sem necessidade de deploy

---

## 2026-06-03 — Edição completa de transações fechadas no Financeiro

**Motivo:** O modal de edição introduzido em 2026-05-29 cobria apenas total e pagamentos. Erros em datas (mesa aberta no dia errado), caixa incorreto ou itens equivocados continuavam exigindo correção manual no banco.
**Impacto:**
- `PATCH /api/pedidos/[id]` estendido para aceitar `desconto`, `caixaNome`, `createdAt` e `closedAt` além dos campos já existentes
- `PATCH /api/pedidos/[id]/items/[itemId]` criado — atualiza `quantidade` e recalcula `subtotal`; funciona em pedidos PAGO (antes só existia DELETE neste endpoint)
- Modal de edição de transação no Financeiro reestruturado:
  - Largura aumentada de `max-w-sm` para `max-w-lg` com corpo com scroll
  - Campos: Abertura (`createdAt`, datetime-local), Fechamento (`closedAt`, datetime-local), Caixa (dropdown via `GET /api/caixas`), Total (R$), Desconto (R$), Pagamentos (split completo)
  - Seção "Itens do pedido": lista editável com qtd por item (input numérico) + botão remover; seção "Adicionar item" com busca por texto, filtro por 11 categorias e lista scrollável dos 111 produtos do cardápio
  - Lógica de save sequencial: (1) DELETE de itens removidos, (2) PATCH de qtd alteradas, (3) POST de novos itens, (4) PATCH do pedido com os demais campos
  - Total recalculado automaticamente ao modificar itens ou desconto
- Datas convertidas entre ISO UTC e `datetime-local` no fuso America/Sao_Paulo
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-064, RF-065, RF-066)
**Observações:**
- Edição de itens não reconstrói efeitos de estoque (insumos) — apenas corrige o registro financeiro, comportamento idêntico ao da edição original de 2026-05-29
- O total salvo em `PATCH /api/pedidos/[id]` sobrescreve o que foi calculado pelos item PATCHes/POSTs — a última operação na sequência define o valor final
- Acesso ao modal de edição não tem guard de role adicional — herda a restrição de `/financeiro` (ADMIN por padrão)

<!-- novas entradas sempre abaixo desta linha, nunca acima -->

## 2026-06-27 — KDS da Cozinha (Kitchen Display System)

**Motivo:** O cozinheiro não tinha visibilidade dos pedidos em tempo real — dependia de comunicação verbal com o caixa, gerando erros de preparo, itens esquecidos e atrasos. Com o sistema, cada item lançado na comanda aparece automaticamente no KDS da cozinha em até 2 segundos.

**Impacto:**
- `UserRole` enum estendido com `COZINHA` — migration `20260627031855_add_cozinha_kds`
- `OrderItem` recebe 3 novos campos: `status String @default("PENDENTE")`, `createdAt DateTime @default(now())` e `prontoEm DateTime?` — mesma migration + `20260627042546_add_pronto_em_order_item`
- Novo usuário de sistema: email=`cozinha`, role=`COZINHA` — login via `/login` com username simples (sem domínio)
- 2 novos endpoints: `GET /api/cozinha/pedidos` (retorna `{ pendentes, concluidos }`) e `PATCH /api/cozinha/pedidos/[itemId]` (baixa do item)
- Filtro de categorias no GET: apenas Pratos do Dia, Todos os Dias, Acompanhamentos, Lanches Tradicionais, Lanches na Baguete, Lanches Artesanais e Porções — bebidas, lavagem e sobremesas excluídas
- `/cozinha` com layout exclusivo (sem Navbar, fundo zinc-950), SWR polling a cada 2s
- Abas Pendentes (âmbar) e Concluídos (verde): concluídos filtrados por `prontoEm >= hoje 00:00` — reset diário automático sem cronjob
- Middleware atualizado: COZINHA bloqueada em qualquer rota fora de `/cozinha/*`; unauthenticated em `/cozinha` → `/login`
- Opcionais de Ponto da Carne (radio obrigatório) habilitados em X-Burguer, X-Bacon, X-Egg, X-Salada, X-Tudo, X-Calabresa e Hambúrguer (Acompanhamentos) via update direto no banco

**Status:** aplicado
**Artefatos atualizados:** arquitetura-villamill (v1.13, v1.14), modelo-de-dados-villamill (rev 5), requisitos-funcionais-villamill (RF-067 a RF-075, RN-031 a RN-034)
**Observações:**
- Login unificado em `/login` para todos os roles — role determina destino pós-login via middleware
- Reset diário dos Concluídos é implícito (filtro de data) — sem cronjob, sem botão, sem exclusão de dados
- Deploy na VPS exigiu aplicação manual das migrations via psql (`docker compose exec db psql`) pois o container de produção não tem Prisma CLI — padrão estabelecido para futuras migrations

## [03/06/2026] Carga Inicial de Operadores de Caixa via SQL Direto (VPS)

### Contexto do Problema
Durante a inicialização do fluxo de mesas em ambiente de produção, o seletor de "Caixa Responsável" apresentava-se vazio. O comando de seed tradicional do Prisma (`npx prisma db seed`) falhou devido à ausência do executável do Prisma e do interpretador TypeScript (`tsx`) na imagem otimizada e enxuta do contentor de produção (`villamill-app`).

### Solução Aplicada
Para contornar a limitação do contentor da aplicação e evitar alterações na imagem de produção, a injeção dos dados foi realizada executando comandos SQL diretamente no motor de base de dados PostgreSQL através do contentor `villamill-db`.

```bash
# 1. Injeção direta dos operadores de caixa na tabela "Caixa"
docker exec -i villamill-db psql -U postgres -d villamill -c "
INSERT INTO \"Caixa\" (id, nome, ativo, \"createdAt\") VALUES
('caixa-ana-julia', 'Ana Júlia', true, NOW()),
('caixa-larissa', 'Larissa', true, NOW()),
('caixa-kamila', 'Kamila', true, NOW()),
('caixa-jhenifer', 'Jhenifer', true, NOW()),
('caixa-jamille', 'Jamille', true, NOW()),
('caixa-ednalva', 'Ednalva', true, NOW()),
('caixa-mill', 'Mill', true, NOW())
ON CONFLICT (id) DO NOTHING;
"

# 2. Reinicialização do contentor da aplicação para limpeza de cache de rotas da API
docker compose restart app

## 2026-06-27 — Cupom Térmico 80mm via CSS @media print

**Motivo:** O operador precisava de um comprovante físico para entregar ao cliente ao fechar a conta, sem depender de integração com impressora (driver, IP, WebSocket ou serviço externo). A solução via `window.print()` + CSS elimina essa dependência e funciona em qualquer SO com navegador moderno.

**Impacto:**
- `src/components/cupom-impressao.tsx` criado — tipos `DadosCupom` e `DadosCupomItem`, componente `CupomImpressao` com `.print-area hidden`
- `globals.css` estendido: `@page { size: 80mm auto; margin: 0 }` + `@media print { body * { visibility: hidden } .print-area { position: fixed; top: 0; width: 80mm; visibility: visible } }` — impressão via CSS puro, sem driver
- `mesas-grid.tsx` alterado:
  - `cupomAtual` computed value: snapshot do pedido ativo atualizado a cada render (items, totais, pagamentos, atendente, timestamp)
  - Botão "Imprimir Cupom" no modal de pedido — visível sempre que há pedido ativo (sem restrição de itens)
  - `showCupomConfirmModal` + `cupomJaOfertado`: intercepta primeiro clique em "Fechar Conta" com modal "Cupom fiscal?" — SIM volta ao modal para imprimir, NÃO fecha conta; segunda vez em "Fechar Conta" ignora a confirmação
  - `fecharConta()` reescrita como async: captura snapshot completo antes do fetch, executa fechamento, exibe overlay pós-pagamento com resumo e botão de reimpressão
- Conteúdo do cupom: cabeçalho (empresa, CNPJ), metadados (mesa, data, hora, atendente), tabela de itens com opcionais recuados `->`, subtotal, desconto, total com divisor duplo, split payment, rodapé de agradecimento
- Todas as categorias de produtos são incluídas no cupom (sem filtro — diferente do KDS)

**Status:** aplicado
**Artefatos atualizados:** arquitetura-villamill (v1.15), requisitos-funcionais-villamill (RF-076 a RF-082, RN-035 a RN-038, Módulo 12)
**Observações:**
- Impressão depende do browser ter acesso à impressora — funciona via USB ou rede sem configuração adicional no sistema
- `cupomJaOfertado` reseta ao fechar o modal ou selecionar outra mesa — cada abertura de conta começa com a confirmação do cupom habilitada
- Sem migração de banco — feature é puramente frontend

---

## 2026-07-01 — Aba Equipe em Mesas: consumo interno sem pool de saldo

**Motivo:** Precisava de um jeito de registrar o que a própria equipe interna do Villa Mill (Tarson, Fernando, Arthur, Raul, Hiago, Mateus + operadores de caixa) consome do cardápio, sem forçar esse consumo pelo fluxo de pedido/pagamento de mesa e sem exigir que a casa mantenha um pool de crédito pré-pago pra esse grupo (diferente do Lava-Rápido).
**Impacto:**
- Nova aba "Equipe" dentro de `/mesas` (toggle Mesas/Equipe no topo da página) — reaproveita 100% do model `FuncionarioExterno`/`ConsumoFuncionario` já existente do Módulo 9/10, sem schema novo
- `src/app/mesas/equipe-grid.tsx` — grid de cards de pessoas (em vez de números de mesa); ao clicar, abre seletor de produto (busca + categorias + lista) reaproveitando o padrão visual de `mesas-grid.tsx`; sem opcionais/preparo/observações (versão simplificada) e **sem etapa de pagamento** — cada clique em "Registrar Consumo" já persiste
- `POST /api/parceiros/consumo` ganha bypass: quando `funcionario.empresa === "Equipe Villa Mill"`, pula inteiramente a checagem de `poolSaldo` (RN-026) — consumo sempre aceito, sem saldo negativo nem saldo nenhum controlado pro grupo
- Convenção de dados: toda pessoa da "equipe interna" recebe `FuncionarioExterno.empresa = setor = "Equipe Villa Mill"`
- Filtro de categorias na mesa (antes uma lista fixa no código, dessincronizada do cardápio) passa a ser **derivado dinamicamente** dos produtos carregados (`Array.from(new Set(produtos.map(p => p.categoria)))`) — corrige categorias que existiam em produção (Bebidas Quente, Café da Manhã, Doces, Salgados, Salgadinho, Sorvete, Diversos, Guarnição) e nunca apareciam como filtro
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (Módulo 13, RF-083 a RF-089, RN-039 a RN-041), modelo-de-dados-villamill (exceção à RN-026 documentada)
**Observações:**
- Decisão deliberada de **não** criar tabela nova — o custo de reaproveitar `FuncionarioExterno`/`ConsumoFuncionario` (já com `liquidado`/`liquidadoEm` prontos no schema) foi menor que desenhar um model isolado só pra equipe interna
- O bypass de saldo é condicionado ao valor exato da string `empresa` — qualquer outro grupo (Lava-Rápido, Villa Mill, Restaurante) continua com a regra de pool original (RN-026) inalterada
- Sem opcionais/preparo/observações foi decisão explícita do usuário pra evitar migration nova em `ConsumoFuncionario` (não tem campo pra guardar essas escolhas)

---

## 2026-07-01 — Sincronização Parceiros ↔ Caixas na aba Equipe

**Motivo:** A aba Equipe só mostrava um grupo fixo de 12 nomes cadastrados manualmente via script. O usuário queria que qualquer pessoa cadastrada em `/parceiros` OU em `/admin/caixas` aparecesse automaticamente ali, sem depender de seed manual.
**Impacto:**
- Aba Equipe passa a listar **todo `FuncionarioExterno` ativo, de qualquer empresa** (sem filtro fixo) — cobre quem já está em Parceiros
- `POST /api/caixas` (criar/reativar caixa) passa a fazer upsert automático de um `FuncionarioExterno` correspondente (`empresa = setor = "Equipe Villa Mill"`) — sincronização daqui pra frente sem script manual
- `DELETE /api/caixas/[id]` (soft delete) desativa o `FuncionarioExterno` espelhado junto
- `scripts/seed-equipe-villa-mill.js` e `scripts/sync-caixas-equipe.js` — scripts idempotentes pra seed inicial e backfill pontual (útil se o cadastro sumir por qualquer motivo, ex: após restore de banco)
- `equipe-grid.tsx` ganhou mensagem de estado vazio ("Nenhuma pessoa cadastrada...") em vez de área em branco quando não houver ninguém — evita parecer bug de novo no futuro
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-090, RF-091)
**Observações:**
- A sincronização é **por nome** (`findFirst({ nome, empresa: "Equipe Villa Mill" })`) — não há FK entre `Caixa` e `FuncionarioExterno`, são tabelas independentes que só compartilham a string do nome
- Decisão consciente de reincluir a Jhenifer no grupo (ela havia sido removida manualmente antes desta mudança) — a regra geral "todo mundo ativo em Caixas aparece" venceu a exceção pontual anterior, por decisão explícita do usuário

---

## 2026-07-01 — Card "Caixinha Lava-Rápido" ocultado do frontend

**Motivo:** Com a aba Equipe cobrindo o consumo da equipe interna, e o Lava-Rápido/Villa Mill mantendo seu fluxo próprio de pool de saldo, o usuário pediu pra tirar o atalho da home sem apagar a funcionalidade de suporte (caso precise reativar).
**Impacto:** Botão/modal "Caixinha Lava-Rápido" comentado em `src/app/home-modules.tsx` (import, estado `openCaixinha` e JSX) — reversível descomentando. `caixinha-modal.tsx`, rotas `/api/parceiros/*` e a página `/caixinha-lava-rapido` continuam intactas no repositório, apenas sem ponto de entrada visível.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (observação no Módulo 10)
**Observações:**
- Módulo 10 (Baixa de Funcionário) continua existindo tecnicamente — só perdeu o atalho de UI na home; API e modal seguem funcionais se acessados/reativados

---

## 2026-07-01 — Baixa administrativa de consumo + categorização por grupo no extrato de Caixinha

**Motivo:** Consumo da equipe interna (sem pool de saldo) precisa ser conciliado manualmente quando alguém efetivamente paga pelo que consumiu — às vezes na hora, às vezes depois. Sem uma forma de marcar "isso já foi pago", o extrato de Caixinha ficava sem distinção entre pendente e quitado. Além disso, o extrato unificado (que agora mistura Lava-Rápido, Villa Mill e Equipe Villa Mill) não tinha como saber de qual grupo era cada linha.
**Impacto:**
- `PATCH /api/parceiros/consumo/[id]` passa a aceitar `{ liquidado: boolean }` (além de `{ quantidade }` já existente) — seta `liquidado` e `liquidadoEm`
- Botão "Dar baixa" na seção Caixinha do Financeiro, visível só para ADMIN, ao lado de Editar/Excluir — vira badge "Pago" após liquidado
- Seção renomeada de "Caixinha — Lava-Rápido" para "Caixinha" (deixou de ser específica de um grupo) e ganhou coluna "Grupo" mostrando a `empresa` de cada lançamento (Lava-Rápido, Villa Mill, Equipe Villa Mill, etc.)
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-092, RF-093)
**Observações:**
- "Dar baixa" (marcar como pago) é conceitualmente diferente do badge "− Baixa" que já existia na tabela (que significa "débito do pool") — mesma palavra, dois sentidos distintos em português de negócio, mantidos por serem os termos que o próprio usuário usa
- `liquidado`/`liquidadoEm` já existiam no schema desde o Módulo 9 (rev 2026-05-27) — só não havia nenhuma UI/API pra setá-los manualmente até esta mudança

---

## 2026-07-01 — CRUD completo (admin) na tela Financeiro + endurecimento de segurança

**Motivo:** O usuário queria poder editar, incluir e excluir qualquer registro exibido no Financeiro direto ali, sem navegar pra outras telas. O estado anterior era desigual: Transações e Caixinha já tinham editar/excluir; Despesas só tinha CRUD em `/despesas` (não no Financeiro); Cancelamentos e Vales individuais não tinham nenhuma API de edição/exclusão.
**Impacto:**
- **Transações:** botão "+ Incluir venda" — `POST /api/financeiro/transacao` (novo) cria um `Order` já `PAGO` com total=0 e 0 itens, direto (sem passar pelo fluxo de abertura de mesa, sem tocar `Table.status`); abre automaticamente o modal de edição já existente pra completar itens e pagamento
- **Despesas:** CRUD completo (incluir/editar/excluir) replicado dentro do Financeiro, reaproveitando os endpoints que já existiam em `/api/despesas*` (usados até então só pela tela `/despesas`)
- **Cancelamentos:** `PATCH/DELETE /api/cancelamentos/[id]` (novo — não existia nenhuma API de escrita pra esse log antes)
- **Vales:** a tabela de resumo agregado por colaborador foi substituída por uma lista de lançamentos individuais, com incluir (reaproveita `POST /api/vales` já existente), editar e excluir (`PATCH/DELETE /api/vales/[id]`, novo)
- **Caixinha:** botões "+ Crédito" e "+ Consumo" reaproveitando `POST /api/parceiros/credito` e `POST /api/parceiros/consumo` já existentes
- **Segurança:** descoberto durante a implementação que `PATCH/DELETE /api/pedidos/[id]` e `POST/PATCH/DELETE /api/despesas*` não tinham NENHUMA checagem de admin no servidor — a proteção era só esconder o botão na UI; qualquer usuário CAIXA autenticado podia chamar a API direto. Criado `src/lib/require-admin.ts` (`isAdmin()`) e aplicado em todos os endpoints admin-only, novos e retrofitados — sem alterar o branch de cancelamento normal de pedido PENDENTE (que continua liberado pro caixa, é fluxo protegido)
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-094 a RF-101, RN-042 a RN-044), arquitetura-villamill (v1.16)
**Observações:**
- Edge case aceito conscientemente: se o admin criar uma "venda manual" e fechar o modal sem adicionar itens, fica um `Order` PAGO com total R$0 e 0 itens no banco — não afeta KPIs (soma zero) e é raro; não valeu a complexidade de reverter a criação nesse caso
- Testado via curl end-to-end: os 8 endpoints novos/retrofitados retornam 403 para role CAIXA e funcionam para ADMIN; o cancelamento normal de mesa pelo caixa foi reconfirmado como não afetado

---

## 2026-07-01 — Correção do KDS: categoria "Café da Manhã" ausente da allowlist

**Motivo:** Usuário reportou que itens de café da manhã pedidos na mesa não apareciam no login da cozinha. Investigação encontrou que `CATEGORIAS_COZINHA` (allowlist fixa criada em v1.13, Módulo 11) nunca incluiu "Café da Manhã" — categoria que existe em produção (confirmada na decisão de 2026-07-01 "Aba Equipe", que já havia identificado essa e outras categorias reais: Bebidas Quente, Doces, Salgados, Salgadinho, Sorvete, Diversos, Guarnição). O bug não tinha relação com horário, permissão de role ou sessão de login — puramente o filtro de categoria excluindo os itens da query Prisma.
**Impacto:** `CATEGORIAS_COZINHA` em `src/app/api/cozinha/pedidos/route.ts` ganha "Café da Manhã". Nenhuma migração de banco — mudança de uma linha em array hardcoded.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-070, RN-045), modelo-de-dados-villamill, arquitetura-villamill (v1.18)
**Observações:**
- Investigação incluiu inspeção do banco local de dev, que revelou dados de teste/placeholder (produtos como "BMW 320i" em "Lanches Artesanais") não representativos da produção — reforça que qualquer validação de categoria real precisa checar o banco de produção, não o seed local
- RN-045 documenta explicitamente que essa allowlist é estática (ao contrário do filtro dinâmico de Mesas/Equipe, RF-087) — mesma classe de bug pode se repetir se uma categoria nova for criada no cardápio sem atualizar esse array

---

## 2026-07-01 — Financeiro: seções "Lavagem", "Lavagens" e "Villamil"

**Motivo:** Usuário queria saber quais mesas e qual o total do dia de serviços de Lavagem (categoria de produto usada pelo Módulo Parceria Lava-Rápido para cobrar diretamente na mesa, distinto do pool de crédito coletivo já existente). Depois de uma consulta SQL ad-hoc para levantar esse dado na VPS, o pedido evoluiu para tornar essa visão permanente na tela Financeiro, com o mesmo padrão visual das seções já existentes (Transações, Vales, Caixinha).
**Impacto:**
- Card "Lavagem" no bloco de KPIs (ao lado de Pedidos fechados/Ticket médio/Mesas abertas) — soma do subtotal de itens com `product.categoria === "Lavagem"` nos pedidos fechados do período, mais contagem de lançamentos
- Nova seção "Lavagens" — tabela com mesa, data/hora, responsável (caixaNome do pedido), serviço (nome do produto) e valor, com total no rodapé; oculta se vazia e usuário não for admin
- Nova seção "Villamil" — réplica das colunas de Transações (mesa, data/hora, caixa, pagamento, CMV, total) mas filtrando `pedidosFechadosSemLavagem` (exclui pedidos cujos itens são 100% Lavagem); total do rodapé recalculado só sobre esse subconjunto
- Seção "Transações" original voltou a exibir todos os pedidos sem filtro — a primeira iteração desta mudança tinha filtrado Lavagem para fora de Transações, mas o usuário pediu explicitamente para reverter isso e criar a visão exclusiva em separado (Villamil), mantendo Transações como a listagem-mestre com tudo
- Nenhuma migração de banco — `GET /api/financeiro` já retornava `product` completo (incluindo `categoria`) em cada item; mudança é 100% de agregação e apresentação em `financeiro-content.tsx`
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-102 a RF-105, RN-046, RN-047), arquitetura-villamill (v1.19)
**Observações:**
- Testado inserindo um pedido fictício (mesa, produto categoria "Lavagem", responsável, valor) direto no banco local via SQL, conferindo o cálculo pela API e removendo o registro em seguida — sem acesso a ferramenta de navegador neste ambiente para captura visual
- RN-046 documenta o comportamento consciente para pedidos mistos (comida + lavagem na mesma conta): o pedido aparece inteiro em Villamil (total não é dividido por categoria) e os itens de lavagem também aparecem em Lavagens — não há dedução cruzada entre as duas visões
- Título da seção é "Lavagens" (plural) na listagem detalhada, mas o card de KPI mantém "Lavagem" (singular) como nome de métrica — distinção deliberada entre nome de seção e rótulo de métrica
- Tratamento de trainee: `isAdmin()` usa checagem estrita de `role === "ADMIN"` (sem considerar `isTrainee`) — mais restritivo que o gate de página de `/despesas` (que também permitia `isTrainee`); decisão consciente de padronizar pelo padrão mais seguro já usado em `vales/liquidar` e `parceiros/consumo/[id]`, mesmo sendo uma pequena mudança de comportamento pra conta de treinamento

---

## 2026-07-03 — Remoção universal da trava de saldo no consumo de funcionários + resumo agregado no Financeiro

**Motivo:** Usuário decidiu abandonar de vez o conceito de saldo prévio/trava de caixinha no momento do lançamento de consumo — "o consumo deve ser livremente registrado e acumulado para posterior auditoria humana". O bypass de saldo já existia desde 2026-07-01, mas era condicionado à string `empresa === "Equipe Villa Mill"` (ver decisão "Aba Equipe em Mesas"); qualquer outro grupo (Lava-Rápido, Villa Mill) ainda esbarrava no HTTP 422 "Saldo insuficiente na caixinha" — inclusive dentro da própria aba Equipe, quando a pessoa selecionada pertencia a outra empresa. Foi esse sintoma (erro de saldo aparecendo na aba Equipe) que expôs o problema.
**Impacto:**
- `POST /api/parceiros/consumo` — removido por completo o bloco de cálculo de `poolSaldo` e a resposta 422; o bypass que antes era exclusivo de "Equipe Villa Mill" virou o comportamento único e universal do endpoint, para qualquer empresa. Consumo sempre é persistido e o estoque sempre é deduzido (lógica de dedução inalterada)
- Nenhuma mudança de schema — `ConsumoFuncionario` já tinha todos os campos necessários (`funcionarioId`, `productId`, `quantidade`, `precoUnit`, `subtotal`, `registradoEm`); `liquidado`/`liquidadoEm` mantidos, mas agora são exclusivamente um marcador de conciliação pós-fato (via "Dar baixa"), nunca mais uma pré-condição de lançamento
- Nova rota `GET /api/financeiro/consumo-funcionarios` — `prisma.consumoFuncionario.groupBy({ by: ["funcionarioId"], _sum: { subtotal }, _count })` no período filtrado, junta nome/empresa via `FuncionarioExterno`, ordena por total decrescente
- Nova seção "Consumo de Funcionários" na tela Financeiro — tabela resumo (FUNCIONÁRIO, TOTAL CONSUMIDO, botão "Ver Detalhes"), alimentada pelo novo endpoint via hook `useConsumoFuncionarios` (SWR, mesmo padrão de `useFinanceiro`)
- Modal "Ver Detalhes" — extrato item a item do funcionário selecionado (data/hora, item, qtd, subtotal), reaproveitando os dados já carregados de `consumosCaixinha` (sem chamada extra); admin pode **Dar baixa**, **Editar** (quantidade) ou **Excluir** cada item direto no modal, reaproveitando `PATCH/DELETE /api/parceiros/consumo/[id]` já existentes (mesmos handlers da seção Caixinha)
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-050/051 revisados, RF-106 a RF-108 novos, RN-026 revogada, RN-039 superada, RN-048 nova), modelo-de-dados-villamill (seção "Bloqueio de consumo" revogada), arquitetura-villamill (v1.20)
**Observações:**
- Testado ponta a ponta via typecheck + servidor local: registro de consumo sem saldo (aba Equipe), edição/exclusão/baixa a partir do modal "Ver Detalhes", e conferência de que o total agregado atualiza (`mutate()` duplo — hook do Financeiro + hook do resumo — após cada ação)
- RN-022 (cálculo de `poolSaldo` para exibição em `/parceiros`) e o fluxo próprio do modal "Parceiro Lava-Rápido" (`baixa-funcionario-modal.tsx`, que trava por saldo de **Vale**, um conceito diferente) **não foram alterados** — a remoção foi escopada estritamente ao endpoint `POST /api/parceiros/consumo`, que é o caminho compartilhado por Equipe e Caixinha do Financeiro
- Overflow do modal "Ver Detalhes" corrigido no mesmo lote: `max-w-lg` → `max-w-2xl` e tabela com `overflow-x-auto` (os botões de ação estavam sendo cortados pela borda do modal)

---

## 2026-07-03 — Sino de notificações no navbar + Financeiro com filtro padrão "hoje"

**Motivo:** Usuário achou os alertas de estoque crítico empilhados na tela inicial visualmente poluídos ("aquele monte de alerta") e pediu um sino de notificações para agrupá-los, tirando-os da home. Junto, pediu que a aba Financeiro abrisse direto no dia atual por padrão (não no mês inteiro), preservando o filtro de período que já existia para quem quisesse outro intervalo.
**Impacto:**
- Novo componente `src/components/notifications-bell.tsx` — ícone de sino no navbar (visível em todas as telas autenticadas, ao lado do usuário/logout), badge vermelho com a contagem de `insumoCriticos`, dropdown com a lista (link direto para `/estoque`); reaproveita `useDashboard()` já existente — mesmo polling de 3s, sem endpoint novo
- `dashboard-stats.tsx` — removidos os banners vermelhos empilhados (um por insumo crítico) que ficavam na tela inicial; o dado (`insumoCriticos`) é o mesmo, só mudou de lugar/apresentação
- `financeiro-content.tsx`, `GET /api/financeiro` e `GET /api/financeiro/consumo-funcionarios` — o `from` padrão (quando a URL não especifica) mudou de "1º dia do mês" para "hoje"; `to` já era "hoje" antes e continua. Atalhos "Hoje / 7 dias / Mês" em `date-selector.tsx` inalterados
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-109, RF-110), arquitetura-villamill (v1.21)
**Observações:**
- Validado com um teste real: criado um insumo de teste com estoque abaixo do mínimo, confirmado que aparece nos críticos, reposto o estoque acima do mínimo, confirmado que some da lista — sem alteração de código, o mecanismo já era 100% reativo (nenhum estado de alerta persistido/"dispensado", tudo recalculado a cada poll)
- Confirmado nesta mesma sessão que a dedução de estoque na venda (fechamento de mesa) já existia desde antes (`fechar`/`fechar-e-liberar`) — não houve mudança nesse ponto, só confirmação de comportamento já implementado
- `design-system-villamill` e `ux-flows-villamill` não foram atualizados — mudança é reaproveitamento de padrão visual já existente (mesma paleta semântica, mesmo componente de dropdown/modal), sem token novo

---

## 2026-07-04 — Manutenção automática do banco (SystemLog + pruning + VACUUM)

**Motivo:** Sem rotina de limpeza, o banco tende a acumular espaço em disco desnecessário na VPS ao longo do tempo — tabelas de alto churn (pedidos, itens, logs) crescem sem nunca compactar fisicamente. O usuário pediu uma rotina semanal automática de manutenção, e aproveitou para criar infraestrutura básica de logging (`SystemLog`) que hoje não existia no sistema.
**Impacto:**
- Novo model `SystemLog` (`id`, `level`, `message`, `meta` JSON, `createdAt`, índice em `createdAt`) — migration `20260704215901_add_system_log`
- `src/lib/logger.ts` — logger simples (`info`/`warn`/`error`, formata timestamp + JSON de meta), primeiro utilitário de log estruturado do projeto (antes só havia `console.log` ad-hoc)
- `POST /api/admin/manutencao` (`src/app/api/admin/manutencao/route.ts`) — autenticado por header `x-api-key` comparado com `MAINTENANCE_API_KEY` (não usa sessão NextAuth); deleta `SystemLog` com mais de 30 dias e roda `VACUUM ANALYZE` em `SystemLog`, `Order`, `OrderItem`, `CancelamentoLog`, `Despesa`, `ConsumoFuncionario`, `LancamentoVale`, `CreditoFuncionario`
- `scripts/limpeza.js` — script Node standalone que dispara o POST com a API key (uso: `node scripts/limpeza.js`), pensado para rodar via cron dentro do container (`docker exec villamill-app node scripts/limpeza.js`, já que o host não tem Node fora do Docker)
- `src/middleware.ts` — matcher ganhou exceção para `api/admin/manutencao` (única rota do projeto autenticada por API key em vez de sessão) — única mudança em fluxo protegido nesta decisão
- `.env.example` atualizado com `MAINTENANCE_API_KEY` (obrigatória) e `MAINTENANCE_URL` (opcional, só necessária se o script rodar fora do container)
**Status:** implementado e testado localmente — **pendente aplicar em produção** (definir `MAINTENANCE_API_KEY` real na VPS, configurar crontab via `docker exec`, confirmar que a migration foi aplicada em produção, rodar uma vez manualmente antes de confiar no cron)
**Artefatos atualizados:** modelo-de-dados-villamill (entidade SystemLog), arquitetura-villamill (v1.23)
**Observações:**
- Testado ponta a ponta local: 401 sem chave/chave errada, 200 com chave certa, pruning removendo só registros com mais de 30 dias, VACUUM OK em todas as tabelas, script funcionando (sucesso e falha por env var ausente)
- `SystemLog` existe no schema mas hoje nada no sistema grava nela ainda — é infraestrutura para logging futuro, não uma feature de auditoria em uso; decisão consciente de criar a tabela e a rotina de retenção antes de ter produtores de log, para não precisar de migration extra quando o primeiro logger de negócio for plugado
- Retenção de 30 dias é fixa no código (`RETENCAO_DIAS` em `route.ts`), não configurável via env — mesma classe de decisão simples já usada em outras allowlists do projeto (ex: RN-045)

---

## 2026-07-05 — Coexistência com sistema-thieco na mesma VPS + fechamento de portas expostas publicamente

**Motivo:** Decisão de consolidar infraestrutura: o sistema-thieco (barbearia, projeto separado) foi migrado para a mesma VPS que já hospeda o vilamill-sistema (`2.24.93.178`), para reduzir custo de hospedagem. Durante a investigação para preparar essa migração, foi identificado que `villamill-app` (porta 3000) e `villamill-db` (porta 5433) estavam expostos em `0.0.0.0` — acessíveis diretamente da internet (`http://2.24.93.178:3000`, e qualquer cliente Postgres podia tentar conectar em `2.24.93.178:5433`), sem passar pelo Nginx/SSL/domínio. Esse não é um risco introduzido pela chegada do sistema-thieco — já existia antes, só não tinha sido notado.

**Impacto:**
- `docker-compose.yml` (produção): `ports` de `db` e `app` alterados de `"5433:5432"` / `"3000:3000"` para `"127.0.0.1:5433:5432"` / `"127.0.0.1:3000:3000"` — nenhuma outra linha alterada (sem tocar em `POSTGRES_PASSWORD`, `DATABASE_URL` ou volume).
- Antes de aplicar, `pg_dump -Fc` de segurança tirado do banco de produção (62KB, salvo em `/var/www/vilamill-sistema/villamill_backup_pre_portfix.dump`) — rede de segurança, não usado (nenhum dado foi perdido).
- `docker compose up -d` recriou `villamill-app` e `villamill-db` reaproveitando o volume nomeado (`villamill_pgdata`) já existente — recreate de container não afeta volume nomeado, dado intacto confirmado antes/depois.
- Validado externamente: `villamill.online` continua respondendo (200/307, via Nginx) normalmente; conexão direta a `2.24.93.178:3000` e `2.24.93.178:5433` agora recusada/timeout (antes respondiam).
- `sistema-thieco` roda na mesma VPS em stack Docker totalmente separada (rede `thieco_network`, volume `thieco_postgres_data`, portas próprias em `127.0.0.1`) — sem nenhum container, rede, volume ou banco compartilhado com o vilamill-sistema. O único elemento em comum é o Nginx do host (roteamento por `server_name`/domínio) e o Certbot (certificados independentes por domínio).

**Status:** aplicado (produção)
**Artefatos atualizados:** arquitetura-villamill (fronteiras de segurança, pontos de integração, v1.22)
**Observação:** Pendência de segurança identificada mas **não corrigida** nesta sessão: `POSTGRES_PASSWORD` do villamill-db é o valor padrão `postgres` (senha fraca), hardcoded no `docker-compose.yml`. O fechamento da porta reduz drasticamente o risco prático (não é mais alcançável pela internet), mas a senha em si continua fraca — trocá-la exige sincronizar com `DATABASE_URL`/`DIRECT_URL` no mesmo arquivo e é uma mudança um pouco mais delicada (não é só editar uma linha de porta); fica como recomendação para uma sessão futura dedicada a isso.
- `design-system-villamill` e `ux-flows-villamill` não foram atualizados — mudança é reaproveitamento de padrão visual já existente (mesma paleta semântica, mesmo componente de dropdown/modal), sem token novo

---

## 2026-07-09 — KDS: agrupamento de itens da cozinha por mesa em um único card

**Motivo:** Cada prato virava um card separado na fila do KDS — uma mesa com 4 pedidos gerava 4 cards espalhados pela tela, sem noção de "essa mesa inteira" e ocupando espaço desproporcional em telas com muitos pratos simultâneos. O usuário pediu que os itens da mesma mesa/pedido ficassem agrupados visualmente.
**Impacto:**
- `GET /api/cozinha/pedidos` — resposta muda de `{ pendentes, concluidos }` para `{ mesas, concluidos }`. A query passa a buscar itens com `status IN (PENDENTE, PRONTO)` (antes só `PENDENTE`) das categorias de preparo, agrupa em memória por `order.id` e filtra para manter na fila só mesas com pelo menos 1 item ainda `PENDENTE`
- `kds-board.tsx` — cada card agora representa uma mesa/pedido (`MesaBadge` + tempo decorrido calculado pelo item pendente mais antigo do grupo), com a lista de itens dentro: pendentes em destaque (fundo claro, botão "✓ PRONTO" individual), prontos apagados/riscados (`line-through`, ícone ✓ verde, sem botão) — mesmo padrão de urgência por cor de borda (neutro/âmbar/vermelho) já existente, agora calculado sobre o item pendente mais antigo do card em vez do próprio item
- Contador da aba "Pendentes" no topo passou a somar itens pendentes de todas as mesas (`totalPendentes`), não mais `mesas.length` — evita subcontar quando uma mesa tem vários pratos
- Card só sai da fila quando o último item pendente da mesa é marcado como PRONTO; se um novo prato for lançado na mesma mesa depois disso, o card reaparece automaticamente (novo `OrderItem` PENDENTE reativa o agrupamento — sem necessidade de nenhum estado extra persistido)
- Aba "Concluídos" (histórico do dia, `prontoEm >= hoje 00:00`) não foi alterada — continua listando item a item, independente do agrupamento por mesa da aba Pendentes
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-069, RF-073 revisados; RN-049 nova), arquitetura-villamill (v1.24)
**Observações:**
- Sem migração de schema — mudança é 100% de agregação na API (`route.ts`) e apresentação no board (`kds-board.tsx`); `status`/`prontoEm` em OrderItem já existiam desde o Módulo 11 (v1.13)
- `ui-kit-villamill` não foi atualizado — o card do KDS nunca teve um token/componente formal documentado ali (mesma lacuna já registrada para o cupom térmico e o sino de notificações)

---

## 2026-07-11 — Bloqueio de acesso por horário (BYOD Guard) + aviso de expiração

**Motivo:** Alinhamento com o Termo Aditivo de Responsabilidade de Dispositivos Próprios (BYOD) para profissionais autônomos e parceiros prestadores — o usuário pediu uma barreira técnica que impeça acesso ao sistema fora do horário operacional, para eliminar risco jurídico de alegação de "tempo à disposição" ou subordinação disfarçada por perfis operacionais (CAIXA/COZINHA). Item já constava do backlog formal (`backlog-tarefas-villamill`, item 3).
**Impacto:**
- Novo `src/lib/horario-acesso.ts` — `acessoPermitido()` e `minutosAteExpirar()`, calculando o horário sempre em `America/Sao_Paulo` via `Intl.DateTimeFormat` (independente do timezone do host/container). Matriz fixa no código: domingo bloqueado; segunda a quinta 05:30–20:30; sexta 05:30–23:30; sábado 07:30–18:30 (janelas de acesso com 30min de antecedência do início do turno e ~1h30 de tolerância após o fim do expediente)
- `src/middleware.ts` — bloqueio aplicado a CAIXA/COZINHA (não-treinamento): páginas redirecionam para nova rota `/bloqueio-horario`, APIs recebem `403` com `{ error, outOfHours: true }`. ADMIN é sempre isento. Corrigido durante o teste manual um loop de redirecionamento: as restrições de página por role (que não conheciam `/bloqueio-horario` como destino válido) mandavam o usuário de volta para `/mesas`/`/cozinha`, que por sua vez reacionava o BYOD Guard — resolvido com um early-return dedicado para essa rota, antes de qualquer restrição de role
- Nova página `src/app/bloqueio-horario/page.tsx` — tela de bloqueio no mesmo design system do login, exibindo a escala de horários e botão "Sair"
- Novo `src/lib/fetcher.ts` (fetcher SWR compartilhado) — ao detectar `outOfHours` num 403, redireciona o cliente para `/bloqueio-horario` em vez de deixar a tela estourar "Erro ao buscar dados"; adotado em `useAppData.ts` (mesas/dashboard/financeiro) e no KDS (`kds-board.tsx`, que também ganhou checagem de `r.ok` que não existia antes)
- Novo `src/components/aviso-expiracao-horario.tsx` — modal client-side (visível só para CAIXA/COZINHA), checando a cada 30s via `minutosAteExpirar()`; aparece quando faltam ≤15min para o fim do expediente, com botão "OK" que só dispensa o aviso (o corte real continua garantido no middleware/servidor); rearma automaticamente na próxima janela de expediente. Montado globalmente em `src/app/layout.tsx`, ao lado do `Navbar`
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-111/112, RN-050), arquitetura-villamill (v1.25), backlog-tarefas-villamill (item marcado concluído)
**Observações:**
- Sem migração de schema — feature é 100% lógica de middleware + UI, sem novo model
- Testado ponta a ponta com servidor local (porta 3001, separado do container de produção): login real via `caixa`/`caixa123`, matriz de horário temporariamente ajustada para forçar o cenário de bloqueio e o aviso de 15min, loop de redirecionamento reproduzido e corrigido, depois revertido ao valor de produção antes do commit
- A checagem de "faltam ≤15min" roda no navegador e depende do relógio do dispositivo do cliente — aceitável por ser apenas um aviso informativo; a garantia real de bloqueio é sempre no middleware (servidor), que usa `Intl.DateTimeFormat` com timezone fixo, não o relógio local
- `ux-flows-villamill` e `ui-kit-villamill` não foram atualizados — mesma lacuna já registrada para outras telas novas (cupom térmico, sino de notificações, card do KDS)

---

## 2026-07-12 — Aumento de fonte do sistema (~12%)

**Motivo:** Item do backlog (`backlog-tarefas-villamill`) pedindo letra maior no sistema, para melhorar legibilidade nas telas operacionais.
**Impacto:** `src/app/globals.css` ganhou `html { font-size: 112.5% }` dentro de `@media screen` — escala proporcionalmente todas as classes Tailwind (rem-based) em ~12% (16px → 18px de base). Escopado a `@media screen` deliberadamente: o cupom térmico impresso (`cupom-impressao.tsx`) não define nenhum tamanho de fonte próprio (herda do body) e usa `@media print`, então ficaria maior no papel de 80mm se o aumento fosse global — a mudança preserva o cupom exatamente como estava.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-villamill (v1.26), backlog-tarefas-villamill (item marcado concluído)
**Observações:**
- Sem token novo no design system — é um multiplicador global no root, não uma mudança por token; `design-system-villamill` (seção Tipografia) ganhou uma nota explicando que os tamanhos ali documentados (px nominal, base 16px) são escalados em ~12% em tela por esse multiplicador
- Validado via build: grep confirmou `112.5%` presente no CSS compilado servido pelo Next.js

---

## 2026-07-12 — Edição de valor no lançamento de consumo da equipe

**Motivo:** Item do backlog ("dividir o lançamento do lava-rápido"). Esclarecido com o usuário que o pedido não é ratear entre múltiplos funcionários num único lançamento, e sim permitir editar o valor debitado de um funcionário — cenário real: 2 funcionários dividindo o custo de um mesmo item (ex: uma Coca-Cola de R$10, R$5 para cada um, em dois lançamentos separados).
**Impacto:**
- `POST /api/parceiros/consumo` — aceita `valorTotal` opcional. Se informado, vira o `subtotal` do registro e o `precoUnit` passa a ser derivado (`subtotal / quantidade`) em vez do contrário; se omitido, mantém o cálculo padrão (`produto.preco × quantidade`), 100% retrocompatível com as outras telas que chamam o mesmo endpoint (Caixinha Lava-Rápido, baixa de funcionário)
- `src/app/mesas/equipe-grid.tsx` — novo campo "Valor" ao lado da quantidade, pré-preenchido com o valor padrão (sincronizado via `useEffect` a cada troca de produto/quantidade) mas livremente editável pelo operador antes de registrar
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-113, RN-051), modelo-de-dados-villamill (ConsumoFuncionario.precoUnit/subtotal), arquitetura-villamill (v1.27), backlog-tarefas-villamill (item marcado concluído)
**Observações:**
- Sem migração de schema — `ConsumoFuncionario` já tinha `precoUnit`/`subtotal`, só mudou de onde vem o valor
- Escopo deliberadamente restrito à aba Equipe (`equipe-grid.tsx`) — os outros dois pontos de entrada que chamam o mesmo endpoint (`baixa-funcionario-modal.tsx`, `caixinha-client.tsx`) não ganharam o campo, por não terem sido pedidos
- Testado via API real contra o banco local: `valorTotal=5.00` numa Coca-Cola de R$10 gravou `precoUnit=5`/`subtotal=5` corretamente; omissão de `valorTotal` manteve o comportamento antigo (R$10); `valorTotal=0` rejeitado com 400. Registros de teste apagados do banco após a validação

---

## 2026-07-12 — Forma de pagamento "NOTA"

**Motivo:** Último item do backlog (`backlog-tarefas-villamill`) — adicionar uma forma de pagamento adicional ao fluxo de fechamento de mesa.
**Impacto:** Valor `NOTA` adicionado ao enum `FormaPagamento` (migration `20260712035153_add_forma_pagamento_nota`). Disponível no seletor de pagamento das mesas (simples e split, `mesas-grid.tsx`), nos filtros/edição e no card "Receita por forma de pagamento" do Financeiro (`financeiro-content.tsx`, badge rosa), e com label próprio no cupom impresso (`cupom-impressao.tsx`).
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-villamill (enum FormaPagamento), arquitetura-villamill (v1.28), backlog-tarefas-villamill (item marcado concluído — backlog 100% concluído)
**Observação:** Mesmo padrão da adição de VOUCHER (2026-05-29) — nenhuma migração de dados necessária, retrocompatível com pedidos antigos. Migration aplicada diretamente no Postgres local (container `villamill-db`, compartilhado com `villamill-app`); se esse container atender produção, precisa de rebuild (`docker compose build app && docker compose up -d app`) para o código novo entrar em uso — pendência sinalizada ao usuário, não confirmada nesta sessão se é o mesmo container de produção ou uma réplica local

---

## 2026-07-29 — Correção: quantidade dos itens não aparecia no KDS da Cozinha

**Motivo:** Usuário reportou que ao adicionar um prato com quantidade 2 (ex: "2x Strogonoff") no PDV, a tela da cozinha mostrava apenas 1 prato, sem indicar que eram duas unidades a preparar.
**Impacto:**
- Investigação (agente Explore) percorreu todo o fluxo: PDV → `POST /api/pedidos/[id]/items` → banco → `GET /api/cozinha/pedidos` → `kds-board.tsx`. Confirmado que `quantidade` estava correta em cada camada (uma única linha `OrderItem` com `quantidade=2`, sem duplicação nem explosão em múltiplas linhas) — o dado sempre chegou íntegro à API da cozinha
- Causa raiz isolada em `src/app/cozinha/kds-board.tsx`: os tipos `KdsItem`/`MesaGroup.items` nunca declaravam o campo `quantidade`, e a renderização (abas Pendentes/Prontos e Concluídos) só imprimia `item.product.nome`, sem nenhum multiplicador
- Correção: `quantidade: string` adicionado aos tipos (Decimal do Prisma serializa como string — mesmo padrão já usado em `mesas-grid.tsx` e `comanda/[id]/page.tsx`, confirmado por investigação antes de escrever o fix); cards agora exibem `{Number(item.quantidade)}x {item.product.nome}` quando quantidade > 1; contador "a fazer" por mesa e o badge da aba Pendentes passam a somar `Number(quantidade)` de cada item em vez de contar linhas (`itensPendentes.length`), que também subestimava pedidos com quantidade > 1
**Status:** aplicado — testado com servidor local dedicado (porta 3002, para não derrubar o container de produção `villamill-app` na 3000, conectado ao mesmo banco via `localhost:5433`); `npx tsc --noEmit` sem erros novos
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-069 revisado, RN-052 nova), arquitetura-villamill (v1.29)
**Observações:**
- Sem migração de schema — `quantidade` sempre existiu em `OrderItem` desde o schema inicial; bug 100% de apresentação, nunca afetou dedução de estoque no fechamento (que sempre leu a quantidade real do banco)
- `ui-kit-villamill` não foi atualizado — mesma lacuna já registrada em 2026-07-09 (card do KDS nunca teve inventário formal, nem por item nem agrupado por mesa)

---

## 2026-07-29 — Acesso do ADMIN à tela da Cozinha via navegação

**Motivo:** Usuário pediu, em seguida à correção acima, que o ADMIN pudesse acompanhar a cozinha em tempo real a partir da própria navegação do sistema, em vez de precisar digitar a URL /cozinha manualmente.
**Impacto:**
- Investigação confirmou que `src/app/cozinha/page.tsx` já liberava `role === "ADMIN"` desde a v1.13 (KDS original) — middleware não tem nenhum bloqueio para ADMIN em nenhuma rota. Faltava exclusivamente um ponto de acesso na UI
- `src/components/navbar.tsx` — novo item `{ href: "/cozinha", label: "Cozinha", icon: ChefHat, roles: ["ADMIN"] }` em `allLinks`, aparece tanto no menu desktop quanto no bottom nav mobile
- `src/app/page.tsx` — novo card no dashboard inicial (`modules`), `adminOnly: true`, mesmo padrão visual do card "Caixas" (`/admin/caixas`)
**Status:** aplicado — validado no mesmo servidor local (porta 3002); `npx tsc --noEmit` sem erros novos
**Artefatos atualizados:** requisitos-funcionais-villamill (RF-114 nova, RN-053 nova), arquitetura-villamill (v1.30)
**Observações:**
- Nenhuma mudança de autorização/middleware — só descoberta/navegação; ADMIN sempre pôde acessar /cozinha digitando a URL
- Acesso é de paridade total com o operador COZINHA (mesmo botão "✓ PRONTO"), não um modo somente-leitura — ver RN-053
- Ao entrar em /cozinha como ADMIN, a navbar padrão do sistema aparece por cima do layout escuro full-bleed próprio do KDS (`cozinha/layout.tsx`), resultando em dois "headers" empilhados (navbar do sistema + "🍳 Cozinha — ao vivo" interno do board) — funciona, mas fica visualmente redundante; ajuste de layout ficou como melhoria futura, não bloqueou a entrega
- `ux-flows-villamill` (seção 3 — arquitetura de informação — e seção 6 — iterações) atualizado com o novo ponto de acesso; `ui-kit-villamill` não foi atualizado — mesma lacuna do card do KDS já registrada em 2026-07-09