---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-09-07
owner: willians
---

# Registro de Decisões — Jocley Grill

> Referência: [[prd-jocley-lanchonete]] | [[requisitos-funcionais-jocley-lanchonete]] | [[arquitetura-jocley-lanchonete]]

Memória viva do sistema. Registra o que mudou, por que mudou e o que isso significa.
Entradas em ordem cronológica crescente — as mais recentes no final.

---

## 2026-07-29 — Criação do sistema (schema inicial + bootstrap)

**Motivo:** Cliente pediu um sistema para lanchonete (bebidas, lanches, espetos de churrasco) reaproveitando explicitamente o layout do vilamill-sistema (dashboard financeiro, cores claras) e a estrutura de menu/inteligência financeira do sistema-thieco, em vez de desenhar do zero.
**Impacto:** Projeto `lanchonete-sistema` criado em `TeloVis Workspace`, ao lado dos dois sistemas de referência. Stack definida: Next.js 15 + Prisma + PostgreSQL + NextAuth v5 + SWR + Docker (mesma base do vilamill). Schema inicial completo: User/UserRole (ADMIN/CAIXA/COZINHA nesta primeira versão), Table, Order/OrderItem (com `tipo` MESA/BALCAO desde o início, diferente do vilamill que só tem mesas), ContadorComanda, Product/Ingredient/RecipeItem, MovimentacaoEstoque, Despesa (já nascendo com campos de recorrência), Funcionario/Feedback/PlanoAcao/Sugestao, TaxaPagamento, ConfiguracaoNotificacao, ConfiguracaoGeral. Seed com 3 usuários (admin/caixa/cozinha), 12 mesas, taxas de pagamento default, produtos de exemplo com ficha técnica completa (X-Burguer, Espetos, Refrigerante).
**Status:** aplicado
**Artefatos atualizados:** arquitetura-jocley-lanchonete, modelo-de-dados-jocley-lanchonete
**Observação:** Antes de codar, houve uma fase de exploração real do código dos dois sistemas de referência (agentes Explore dedicados para vilamill-sistema e sistema-thieco) para entender exatamente como cada padrão funciona, seguida de um plano formal aprovado pelo usuário (EnterPlanMode) antes da implementação.

---

## 2026-07-29 — PDV core: Mesas + Balcão + Cupom + Split Payment

**Motivo:** Núcleo operacional do negócio — sem isso, nada mais no sistema tem dado real para trabalhar.
**Impacto:** Grid de mesas (12 mesas, cores por status), lista de comandas de balcão, tela de itens compartilhada (`/comanda/[id]`) entre os dois tipos, cupom térmico 80mm via `window.print()` + CSS `@page` escopado ao componente, split payment com validação de soma em tempo real. Decisões de escopo confirmadas com o usuário antes de codar: numeração de balcão reseta todo dia (não é contínua); dedução de estoque acontece no fechamento da comanda, não na adição do item.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulos 2, 3, 8), arquitetura-jocley-lanchonete
**Observação:** `ContadorComanda` foi desenhado como upsert atômico chaveado por data (`YYYY-MM-DD`) especificamente para suportar o reset diário sem risco de corrida de concorrência entre duas comandas abertas ao mesmo tempo.

---

## 2026-07-29 — Cardápio + Estoque + CMV

**Motivo:** Pedido explícito do cliente: CMV precisa ser uma aba separada do Cardápio, com cálculo automático — diferente do vilamill-sistema (onde o custo é digitado manualmente) e do sistema-thieco (que não tem CMV).
**Impacto:** `/produtos` (CRUD de cardápio) e `/cmv` (cálculo, markup, margem, preço sugerido) como telas distintas. `lib/cmv.ts` centraliza o recálculo — disparado ao editar ficha técnica de um produto ou o custo unitário de um insumo (recálculo em lote, nesse caso). `costPriceManual` como válvula de escape para produtos sem ficha técnica (ex.: bebida revendida pronta). Dedução de estoque no fechamento de comanda ligada à ficha técnica.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulos 4, 5, 6), modelo-de-dados-jocley-lanchonete
**Observação:** Testado ao vivo com dados reais (X-Burguer: pão + carne + queijo + alface + tomate = R$9,63 de CMV calculado corretamente contra o cálculo manual esperado).

---

## 2026-07-29 — Cozinha (KDS)

**Motivo:** Completar o ciclo operacional — sem KDS, a cozinha dependeria de aviso verbal do atendente/caixa.
**Impacto:** `/cozinha` com layout próprio (sem sidebar/navbar), tema dark (zinc-950), poll de 2s via SWR, urgência visual por tempo decorrido do item pendente mais antigo (neutro <8min, âmbar 8–14min, vermelho ≥15min), abas Pendentes/Concluídos com reset diário implícito via filtro de data.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulo 7)
**Observação:** Layout dark do KDS reaproveita diretamente o padrão visual já validado no vilamill-sistema para a mesma função.

---

## 2026-07-29 — Dashboard Financeiro (Início)

**Motivo:** Pedido explícito do cliente para replicar os cards de dashboard do vilamill-sistema (Receita Bruta, CMV, Despesas, Resultado, Pedidos Fechados, Ticket Médio, Mesas Abertas, Receita por Forma de Pagamento).
**Impacto:** `/` (Início) com os cards no mesmo layout de cores do vilamill, mais um card adicional de Receita Líquida (decisão tomada nesta sessão — ver entrada de Taxa de Pagamento abaixo). Filtro de período (Hoje/7 dias/Mês) via querystring.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulo 9)

---

## 2026-07-29 — Taxa por forma de pagamento afeta os relatórios (Receita Líquida)

**Motivo:** Decisão de escopo tomada durante o planejamento — perguntado diretamente ao cliente se a taxa configurável por forma de pagamento deveria só ser informativa ou realmente descontar da receita nos relatórios. Resposta: deve afetar.
**Impacto:** `Order.taxaTotal` como snapshot calculado no fechamento (não recalculado retroativamente se a taxa mudar depois). `Resultado = Receita Bruta − CMV − Despesas − Taxa`. Card "Receita Líquida" adicionado ao dashboard. DRE (Inteligência Financeira) passa a exibir a linha de taxa separadamente.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (RF-048, RN-024), modelo-de-dados-jocley-lanchonete (Order.taxaTotal)

---

## 2026-07-29 — Inteligência Financeira (rankings, pico de horário, DRE, projeção)

**Motivo:** Pedido do cliente para reaproveitar o conceito de Inteligência Financeira do sistema-thieco, mais pico de horário — funcionalidade que **nenhum** dos dois sistemas de referência tinha pronta.
**Impacto:** `/inteligencia` com abas Rankings (formas de pagamento + pratos), Pico de Horário (agregação em memória por hora, fuso America/Sao_Paulo), Ticket Médio por Caixa, Projeção & Break-even (mês corrente). `/inteligencia/dre` como página isolada para impressão A4, com `print:hidden` nos elementos de navegação — decisão deliberada de **não** usar o mesmo mecanismo do cupom térmico (que fixa `@page` em 80mm), porque o DRE precisa do tamanho de papel padrão da impressora do usuário.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulo 10), arquitetura-jocley-lanchonete
**Observação:** Escopo de Inteligência Financeira foi definido por pergunta direta ao cliente (múltipla escolha): DRE exportável, projeção/break-even e ticket médio por caixa foram os itens confirmados, além dos 3 já pedidos explicitamente na mensagem original (ranking pagamento, ranking pratos, pico de horário).

---

## 2026-07-29 — Despesas com recorrência + Lançamentos

**Motivo:** Reaproveitar o padrão de despesa recorrente do sistema-thieco (que gera ocorrências futuras automaticamente).
**Impacto:** `Despesa.recorrente` + `frequenciaRecorrencia` (semanal/mensal/anual) — criar uma despesa recorrente gera a origem + 11 ocorrências futuras. Edição/exclusão perguntam o escopo (só esta ocorrência, ou esta e as futuras da série) — decisão confirmada com o cliente antes de implementar. `despesaOrigemId` com `onDelete: SetNull` para nunca quebrar por violação de chave estrangeira ao excluir a origem de uma série. `/lancamentos` como listagem simples de comandas fechadas no período — mais simples que o equivalente do sistema-thieco porque, nesta arquitetura, uma comanda já é uma linha única (thieco precisa agrupar várias linhas de venda via `venda_origem_id`).
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulos 11, 12), modelo-de-dados-jocley-lanchonete

---

## 2026-07-29 — Gestão de Time (Equipe, Feedbacks, PDCA, Sugestões, Timeline)

**Motivo:** Reaproveitar o módulo de Gestão de Time do sistema-thieco na íntegra (escopo completo confirmado com o cliente, em vez de uma versão simplificada).
**Impacto:** `/time` com 5 sub-abas. `Funcionario` substitui o conceito de "barbeiro/profissional" do thieco, adaptado para o vocabulário de lanchonete (cargo genérico em vez de especialidade fixa). `Sugestao` desenhada sem vínculo a funcionário (canal geral da equipe), enquanto `Feedback` e `PlanoAcao` são sempre por pessoa. Timeline não é uma tabela própria — é uma agregação em memória de Feedback + PlanoAcao + Sugestao, ordenada por data.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulo 13), modelo-de-dados-jocley-lanchonete

---

## 2026-07-29 — Configurações (Notificações + Taxas)

**Motivo:** Pedido explícito do cliente para a tela de Configurações ter **apenas** notificação e taxa por forma de pagamento — nenhuma outra configuração do sistema deveria ficar exposta ali.
**Impacto:** `/configuracoes` com 2 abas. Notificações: 4 tipos (Faturamento, Produtos mais vendidos, Estoque parado, Estoque baixo), cada um com toggle, periodicidade e horário — grava a configuração, mas não há job/worker disparando ainda (gap consciente, fora do escopo desta sessão). Taxas: percentual por forma de pagamento.
**Status:** aplicado (Notificações: gravação apenas, sem disparo real — ver RN-035)
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulo 14)

---

## 2026-07-29 — Correção crítica: middleware bloqueava as próprias APIs dos papéis operacionais

**Motivo:** Durante a verificação final (Fase 11), o middleware de RBAC aplicava a mesma allowlist de rota tanto para páginas quanto para chamadas de API. Como as rotas de API (`/api/orders`, `/api/tables`, etc.) não estavam na allowlist de nenhum papel operacional, o próprio fluxo de PDV do Caixa e do Atendente ficaria bloqueado assim que a tela tentasse buscar dados.
**Impacto:** Middleware alterado para liberar qualquer rota `/api/*` após confirmar sessão válida, deixando a restrição de escrita sensível (produtos, insumos, ficha técnica, usuários) a cargo do próprio route handler.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.10), requisitos-funcionais-jocley-lanchonete (RF-004)
**Observação:** Encontrado por revisão de código antes mesmo de qualquer teste ao vivo — evitou que o bug chegasse a ser observado pelo usuário final.

---

## 2026-07-29 — Correção de bug: redirect pós-login para a porta errada

**Motivo:** Usuário reportou "toda vez que tento abrir a porta, ela cai na 3000" — investigação (incluindo checagem de processos WSL/Windows, netstat e wslrelay) descartou conflito de porta ou cache de navegador. Causa raiz real: `.env` local do projeto tinha `NEXTAUTH_URL="http://localhost:3000"` (herdado sem ajuste do `.env.example`), fazendo o NextAuth montar o redirect pós-login para a porta 3000 — onde o vilamill-sistema, outro projeto do mesmo workspace, já estava rodando.
**Impacto:** `.env` e `.env.example` corrigidos para `http://localhost:3001` (porta real do lanchonete-sistema), com `AUTH_URL` adicionado também (nome mais recente da mesma variável no NextAuth v5). Confirmado via requisição real: header `Location` do redirect pós-login passou a apontar para a porta correta.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.11)
**Observação:** Boa parte do tempo de diagnóstico foi gasto descartando hipóteses de infraestrutura (WSL localhost forwarding, Docker Desktop proxy) antes de revisar a própria configuração da aplicação — lição registrada para diagnósticos futuros: checar `NEXTAUTH_URL`/`AUTH_URL` primeiro quando o sintoma é "login redireciona para o lugar errado".

---

## 2026-07-29 — Papéis SUPERVISOR e ATENDENTE + tela de Usuários

**Motivo:** Pedido direto do cliente (transcrição de áudio): criar um "login supervisor" para o dono distribuir acessos, e um papel de atendente restrito a tablet/celular — só cardápio e mesas, com acesso ao fechamento da comanda.
**Impacto:**
- `UserRole` estendido com SUPERVISOR e ATENDENTE (migration aplicada)
- Middleware ganha `ROTAS_SUPERVISOR` e `ROTAS_ATENDENTE` — Supervisor com acesso operacional amplo (Mesas, Balcão, Cozinha, Cardápio, Estoque, Lançamentos, Despesas, Gestão de Time, Usuários) mas **sem** Início/Inteligência Financeira/CMV/Configurações; Atendente restrito a Cardápio (visualização) + Mesas + Balcão
- Nova tela `/usuarios` (ADMIN e SUPERVISOR) — Admin cria/edita qualquer papel; Supervisor só cria/edita CAIXA/ATENDENTE/COZINHA (`PAPEIS_GERENCIAVEIS_POR_SUPERVISOR`), reforçado no servidor via `/api/users` e `/api/users/[id]`, não só na UI
- `guardGestor()` (`src/lib/api-guard.ts`) criado e aplicado em todas as rotas de escrita de Produtos, Insumos e Ficha Técnica — endpoints que antes não tinham nenhuma checagem de role no servidor (a proteção era só esconder o botão)
- Sidebar tornada role-aware (grupos/itens filtrados), Navbar tornada role-aware (Atendente não vê link de Estoque)
- Cardápio e Estoque ganham modo somente-leitura para CAIXA/ATENDENTE (botões de criar/editar/excluir somem)
- Seed atualizado com 2 novos logins de exemplo: supervisor/supervisor123, atendente/atendente123
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulo 1, RF-071 a RF-075), modelo-de-dados-jocley-lanchonete (UserRole), arquitetura-jocley-lanchonete (v1.13), design-system-jocley-lanchonete, ux-flows-jocley-lanchonete
**Observações:**
- Testado ao vivo, ponta a ponta: login dos dois papéis novos, cada rota permitida/bloqueada corretamente (código de resposta HTTP conferido por role), criação de usuário pelo Supervisor, bloqueio confirmado de tentativa de Supervisor criar conta ADMIN (403), item de menu confirmado ausente/presente por role via inspeção do HTML renderizado
- Interpretação deliberada da frase "fechou a mesa, imprimiu o cupom no caixa" do cliente: entendida como descrição de logística física (impressora instalada no caixa), não como restrição de permissão — o Atendente manteve acesso ao fechamento completo da comanda, já que o próprio cliente disse explicitamente "o cara vai ter o acesso ao fechamento de mesa"

---

## 2026-07-29 — Taxa de pagamento por bandeira de cartão (opcional)

**Motivo:** Pedido do cliente logo após o fechamento do papel Supervisor/Atendente: "na parte de cartão eu quero que seja possível cadastrar por bandeira, mas isso pode ser opcional".
**Impacto:**
- `TaxaPagamento.bandeira` (já nullable desde o schema inicial) passa a ter UI de gestão: aba Taxas em Configurações ganha seção expansível "Por bandeira (opcional)" para Crédito e Débito, com lista de bandeiras (Visa, Mastercard, Elo, Hipercard, Diners, American Express, Outra), cada uma podendo ter sua própria taxa ou ficar ausente (cai na taxa padrão da forma)
- Nova rota `DELETE /api/configuracoes/taxas/[id]` para remover uma taxa de bandeira específica
- `PagamentoSplitDialog` (fechamento de comanda) ganha seletor de bandeira opcional por linha, quando a forma é Crédito ou Débito
- `lib/taxas.ts` (`calcularTaxaAplicada`) já implementava o fallback forma+bandeira → forma+null desde a criação do schema — só faltava a superfície de UI para cadastrar e para escolher no momento da venda
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (RF-069, RF-070, RN-034), modelo-de-dados-jocley-lanchonete
**Observação:** Testado ao vivo — taxa de Crédito/Visa cadastrada a 2,5% (abaixo da taxa padrão de crédito, 3,49%) foi corretamente aplicada no fechamento de uma comanda com bandeira Visa selecionada, confirmando o fallback funcionando nos dois sentidos (usa a específica quando existe, cai para a padrão quando não existe).

---

## 2026-07-30 — Rebranding para "Jocley Grill" + repositório Git próprio

**Motivo:** Cliente enviou uma peça de cardápio pronta (imagem) com a marca "Jocley Grill — BBQ & Espetos", diferente do nome usado até então no sistema ("Jocley Lanchonete"). Pediu explicitamente para alterar o nome do sistema. Em seguida, pediu para versionar o projeto em Git próprio (padrão vilamill-sistema/orbita-lobo), já sinalizando que o monorepo `TeloVis Workspace` "está muito bagunçado" e será reorganizado depois.
**Impacto:** Constante `NOME_LANCHONETE` (`src/lib/constants.ts`) alterada — reflete em toda a UI (login, sidebar, navbar, cupom térmico, KDS, DRE) sem tocar identificadores internos (nome do pacote npm, nome do banco `jocley_lanchonete`, containers Docker — permanecem como estavam, por não serem visíveis ao usuário e por risco desnecessário de renomear infraestrutura em funcionamento). `git init` na pasta `lanchonete-sistema` (branch `main`, commit inicial com os 141 arquivos do projeto, `.env`/`node_modules`/`.next` corretamente ignorados) — projeto deixa de ser uma pasta solta sem versionamento dentro do `TeloVis Workspace` e passa a ser um repositório independente, no mesmo padrão de `vilamill-sistema`.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.14)
**Observação:** Decisão de manter os identificadores internos (banco, npm) inalterados foi deliberada — o pedido do cliente era sobre o nome **exibido**, não sobre a identidade técnica do projeto; renomear banco/containers em ambiente já rodando teria custo/risco desproporcional ao pedido.

---

## 2026-07-30 — Taxas de Delivery + Calculadora de Metas (Inteligência Financeira)

**Motivo:** Cliente pediu uma calculadora na Inteligência Financeira para projetar ganhos a partir de uma quantidade de vendas desejada, mostrando quanto vender de cada produto cadastrado para atingir a meta — considerando as taxas de iFood, 99, motoboy e outros deliveries, que ainda não existiam no sistema (só havia taxa por forma de pagamento, não por canal de venda).
**Impacto:** Novo model `TaxaDelivery` + enum `CanalDelivery` (IFOOD, NOVENTA_E_NOVE, MOTOBOY, OUTROS_DELIVERY) — desenhado como tabela separada de `TaxaPagamento` porque canal de delivery não é forma de pagamento (não tem bandeira, é comissão de marketplace). Nova seção "Taxas de Delivery" na aba Taxas de Configurações, mesmo padrão visual da seção existente. Nova aba "Calculadora de Metas" em Inteligência Financeira: usuário informa quantidade de vendas desejada + canal, sistema distribui a meta proporcionalmente ao mix histórico de vendas do período (via `ranking-pratos`), calcula receita bruta por produto, desconta taxa do canal e CMV projetado, exibe lucro bruto e margem. Sem histórico no período, cai para distribuição igualitária entre produtos ativos (com aviso na tela).
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (RF-078 a RF-080, RN-039), modelo-de-dados-jocley-lanchonete (TaxaDelivery, CanalDelivery, regra de cálculo da Calculadora de Metas)
**Observação:** Todo o cálculo da calculadora roda no cliente, combinando três endpoints já existentes (`/api/products`, `/api/inteligencia/ranking-pratos`, `/api/configuracoes/taxas-delivery`) em vez de criar uma rota de API dedicada — decisão de reaproveitamento, não de economia de esforço: os três dados já existiam separadamente, só faltava a composição.

---

## 2026-07-30 — Estoque: card de valor total + filtro por produto (com correção de bug de hidratação)

**Motivo:** Cliente pediu um card com o valor total em dinheiro parado em estoque e um filtro por produto para visualização, na aba `/estoque`.
**Impacto:** Card soma `quantidadeAtual × custoUnitario` de todos os insumos exibidos; campo de busca filtra a tabela por nome e recalcula o card só com os itens filtrados (permite ver o valor de um insumo específico). **Bug real encontrado em produção (dev) e corrigido na mesma sessão:** o card, ao renderizar o valor formatado em moeda antes dos dados carregarem (`isLoading` ainda `true` durante o SSR), causava "Hydration failed" — o servidor formatava `R$ 0,00` via `Intl`/ICU do Node, potencialmente divergente do que o navegador produziria na re-hidratação. Corrigido exibindo um placeholder (`—`/"Carregando...") enquanto `isLoading=true`, só formatando moeda depois que os dados chegam de verdade no cliente.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (RF-076, RF-077, RN-038)
**Observação:** O sintoma relatado pelo cliente foi "aparece e some" ao atualizar a página — clássico de mismatch de hidratação, onde o React descarta a árvore renderizada no servidor e refaz do zero no cliente. Um segundo incidente parecido na mesma sessão (build inteiro corrompido, "Cannot find module") teve causa diferente — cache do `.next` incompleto após uma limpeza anterior — resolvido com `rm -rf .next` + reinício completo do servidor dev.

---

## 2026-07-30 — Sistema de tratamento e registro de erros + conta `devmaster`

**Motivo:** Cliente pediu para criar logs de erro (pra entender e registrar o que quebra no sistema) e, em qualquer lugar que hoje mostra erro, trocar para uma mensagem explicando o motivo em vez do código/stack técnico. Levantamento mostrou que nenhuma das 39 rotas de API do sistema tinha tratamento de exceção — qualquer erro (Prisma, validação, bug) vazava stack cru pro cliente e não deixava rastro persistido em lugar nenhum.
**Impacto:** Novo model `ErrorLog` (rota, status, mensagem técnica, stack truncado, usuário logado, data). Helper central `src/lib/api-error.ts` (`AppError`, `handleApiError`, `withErrorHandling`) — mapeia códigos conhecidos do Prisma (P2025/P2002/P2003) para mensagem específica, loga no console + banco, responde `{ error: mensagemAmigavel }` em vez do stack. Aplicado nas 38 rotas de API do sistema (todas exceto o handler do NextAuth, que tem gestão de erro própria) — 2 convertidas manualmente como referência, as demais 36 por um agente `@dev` seguindo o padrão exato, com `tsc`/`lint`/`build` validados ao final. `error.tsx`/`global-error.tsx` cobrem falha de renderização React com o mesmo espírito. `fetcher.ts` (usado por toda tela com SWR) passou a repassar a mensagem amigável da API em vez de um genérico fixo. Nova aba "Logs de Erro" em Configurações, exclusiva da conta `devmaster` (nova, seedada com senha fixa) — invisível para qualquer outro ADMIN, inclusive na tela de Usuários e na API `GET /api/users` (filtrada explicitamente), com edição bloqueada mesmo via chamada direta a `PATCH /api/users/[id]`.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulo 16 novo: RF-081 a RF-086, RN-040 a RN-043), modelo-de-dados-jocley-lanchonete (ErrorLog, nota sobre `devmaster` em User), arquitetura-jocley-lanchonete (v1.17, seção de Fronteiras de segurança)
**Observação:** Testado ao vivo provocando erros reais (PATCH em registro inexistente → Prisma P2025 → mensagem "Registro não encontrado", POST com data inválida → mensagem "Dados inválidos enviados para o servidor") — confirmado que a resposta ao cliente vem amigável e o registro técnico completo (stack incluso) aparece em `/api/error-logs` e na aba visual, só para `devmaster`.

---

## 2026-07-30 — Push do repositório para o GitHub (`@devops`)

**Motivo:** Cliente pediu para commitar o trabalho e acionar o `@devops` para dar push na `main`, formalizando o repositório próprio criado mais cedo na sessão.
**Impacto:** Agente `@devops` (Gage) verificou que não existia repositório prévio, criou `willianslegacy94-zion/lanchonete-sistema` (privado — decisão autônoma do agente, dado que `docker-compose.yml` tem credenciais default de dev) e fez `git push -u origin main`, após quality gate completo (`tsc`, lint, build de 21 rotas, scan de segredos — todos PASS).
**Status:** aplicado
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.18)
**Observação:** Decisão de privacidade do repositório é reversível a qualquer momento (`gh repo edit --visibility public`) — registrada aqui para não se perder por que ficou privado, já que os sistemas irmãos (vilamill-sistema, sistema-thieco) são públicos.

---

## 2026-08-03 — Deploy em produção na VPS compartilhada + domínio jocleygrill.online

**Motivo:** Cliente já possuía domínio (`jocleygrill.online`) e VPS (`2.24.93.178`, a mesma que já hospeda vilamill-sistema, sistema-thieco, lane-confeitaria e academia-sandro) e pediu para colocar o sistema no ar.
**Impacto:** `docker-compose.yml` hardened antes do deploy — Postgres e app publicados só em `127.0.0.1` (nunca `0.0.0.0`, mesmo padrão de segurança do vilamill-sistema desde 2026-07-05), credenciais do Postgres parametrizadas via `${POSTGRES_USER}`/`${POSTGRES_PASSWORD}`/`${POSTGRES_DB}` em vez de fixas em `postgres/postgres`. Nginx configurado como reverse proxy (`deploy/nginx/jocleygrill.online.conf`, novo no repo) + Certbot/Let's Encrypt para SSL com renovação automática. Acesso da VPS ao repositório GitHub via **SSH deploy key** (chave só de leitura, cadastrada nas configurações do repo) — GitHub não aceita mais autenticação por usuário/senha em HTTPS para operações git.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.19, Seção 1 e 4)
**Observação:** Dois bugs surgiram e foram corrigidos durante o próprio deploy (ver decisões seguintes): pasta `public/` ausente quebrando o build Docker, e conflito de porta do Postgres com o `lane-confeitaria` na mesma VPS. Terminal da VPS teve problemas reais com heredoc multi-linha colado (bracketed paste corrompendo o terminador `EOF`) — resolvido preferindo comandos de uma linha só (`echo >>`, ou conteúdo de arquivo via `base64 -d`) em vez de heredoc sempre que precisar colar algo maior na sessão SSH.

---

## 2026-08-03 — Correção: pasta `public/` ausente quebrava o build Docker

**Motivo:** Descoberto durante o primeiro `docker compose up -d --build` na VPS — o projeto nunca teve uma pasta `public/` (nem local, nem versionada), e o `Dockerfile` (`COPY --from=builder /app/public ./public`) falha se a pasta não existir no estágio de build, mesmo o Next.js não exigindo essa pasta para funcionar.
**Impacto:** Criado `public/.gitkeep` versionado, só para garantir que a pasta sempre exista no contexto de build.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.20)
**Observação:** Bug latente desde a criação do projeto — só apareceu porque era o primeiro build via Docker completo (dev local sempre rodou `next dev` fora de container, via `scripts/dev.js`).

---

## 2026-08-03 — Correção: porta do Postgres tornada configurável (conflito com lane-confeitaria na VPS)

**Motivo:** Ao subir o `docker-compose.yml` original (porta 5434 fixa) na VPS, o container não subiu — porta já em uso pelo `lane-confeitaria-db`, outro projeto na mesma VPS. Corrigido inicialmente fixando 5435 direto no compose, mas isso quebrou o ambiente de dev local (`scripts/dev.js` tem `DB_PORT=5434` hardcoded, checando essa porta antes de decidir se sobe o Docker).
**Impacto:** Porta do host do Postgres passou a vir de `${POSTGRES_HOST_PORT:-5434}` no `docker-compose.yml` — dev local não muda nada (cai no default 5434), só a VPS define `POSTGRES_HOST_PORT=5435` no próprio `.env` (não commitado, específico do ambiente).
**Status:** aplicado
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.21, Seção 1)
**Observação:** Lição geral pro workspace (já vale a pena levar pros outros projetos que dividem essa VPS): nunca fixar porta de host direto no `docker-compose.yml` compartilhado entre dev e produção — sempre variável com default, override só no `.env` do ambiente que precisa divergir.

---

## 2026-08-03 — Cardápio real cadastrado (dois cardápios) + favicon provisório

**Motivo:** Cliente enviou duas imagens de cardápio real (WhatsApp) — cardápio principal (espetos prontos, burgers na brasa, porções, adicionais, jantinhas, bebidas, combo) e um segundo cardápio de espetinhos crus (pacotes por unidade, entrega só sáb/dom, para churrasco em casa) — pedindo pra substituir os produtos de exemplo do seed pelos reais, complementando (não removendo) entre os dois cardápios. Também pediu um favicon "JG" nas cores do sistema.
**Impacto:** `prisma/seed.ts` reescrito — produtos/ingredientes de exemplo (X-Burguer, Espeto de Frango genérico, ficha técnica de exemplo) removidos, 56 produtos reais cadastrados (42 do cardápio principal + 14 de espetinhos crus). Nova categoria `"Espetinhos Crus"` em `CATEGORIAS_CARDAPIO` (`src/lib/constants.ts`) pra separar claramente pacote cru de espeto pronto — decisão do próprio agente, não pedido explícito do cliente, pra evitar confusão de quem for lançar pedido. Preço das 6 bebidas (Coca-Cola, Coca Zero, Guaraná, Guaraná Zero, Fanta Laranja, Água) ficou em R$ 0,00 — não veio valor explícito no cardápio, cliente ajusta depois pela tela de Produtos. Duas ambiguidades do cardápio resolvidas por julgamento do agente, sem confirmação explícita do cliente (registrado pra rastreabilidade, caso precise corrigir): "Frango" cru virou um produto só (10 un, R$ 34,00, descrição "Asinha na Mostarda") em vez de dois produtos separados; os dois "Pão de Alho" do cardápio (um em Espetinhos, R$ 15, outro em Acompanhamentos como "Santa Massa", R$ 12) foram cadastrados como produtos distintos. Favicon "JG" (texto) criado via `src/app/icon.tsx` (Next.js `next/og`, `ImageResponse`), cores da marca (`#d64000` laranja + branco) — **não é o logo real fornecido pelo cliente** (chama estilizada preto/dourado), é placeholder até a arte ser integrada.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.22), modelo-de-dados-jocley-lanchonete (categoria de Product)
**Observação:** Dados de exemplo já tinham sido gravados em produção numa rodada de seed anterior (mesma sessão) antes do cardápio real chegar — precisou de um script de limpeza pontual (`deleteMany` por nome) rodado via imagem intermediária do Docker (`--target builder`, que tem `tsx`/devDependencies que a imagem final de produção não tem) antes de rodar o seed atualizado, pra não duplicar "Espeto de Frango" com preço de exemplo (R$ 14) ao lado do produto real (R$ 10,99).

---

## 2026-08-04 — Dez melhorias operacionais: KDS filtrado, quantidade na venda, estoque oculto, permissões granulares, notificações WhatsApp reais

**Motivo:** Cliente trouxe uma lista de 10 pedidos após a primeira semana observando o sistema em uso real: item de cozinha some/aparece corretamente na fila, cupom completo ao fechar mesa, filtro por mesa na cozinha para resolver atrito ("a cozinha provar o que recebeu"), split payment em mesa, escolher quantidade na venda, esconder valor em R$ do estoque no caixa, permissão configurável por usuário (aba+subtópico), confirmação se notificação funciona, telefone de WhatsApp configurável, e itens sem preparo (ex.: refrigerante) não aparecerem na cozinha.
**Impacto:** Investigação prévia (sem codar ainda) revelou que **2 dos 10 pedidos já estavam implementados** (impressão de cupom completo e split payment em mesa — `ComandaItens` já é compartilhado entre mesa/balcão) e **1 estava parcialmente implementado por trás de uma lacuna** (item de cozinha já aparecia automaticamente, mas *tudo* aparecia, inclusive bebida, por faltar o flag de exclusão) — evitou trabalho duplicado. Dos 7 pedidos realmente novos: (1) `Product.enviaParaCozinha` (migration nova) + filtro em `/api/kds/items` — bebida e itens sem preparo nunca entram na fila; (2) filtro por mesa/comanda no KDS, mesclando itens pendentes+prontos daquele pedido como "comprovante" pra disputa; (3) seletor de quantidade ao lançar item (dialog com +/-) + botões +/- em item já lançado (novo endpoint `PATCH /api/orders/[id]/items/[itemId]`, só permitido enquanto o item ainda está `PENDENTE`); (4) card de valor total e coluna de custo unitário do Estoque escondidos para qualquer role que não seja ADMIN; (5) **Módulo 17 novo — Permissões Granulares:** `User.permissoesOverride` (Json, migration), árvore canônica de abas+subtópicos em `src/lib/permissions.ts`, resolução `role` → default vs. override configurado, aplicada em 3 camadas (Sidebar/Navbar via `PermissoesProvider`, guard server-side `requirePermissao()` em cada `page.tsx`, filtro de subabas em Configurações/Gestão de Time) — sempre **complementar** ao RBAC por role já existente no middleware, nunca uma ampliação; UI de matriz de checkboxes em Usuários; (6) telefone de WhatsApp configurável (`ConfiguracaoGeral`) + botão "Enviar teste", client HTTP mínimo pra Evolution API (`src/lib/evolution-api.ts`); (7) **disparo real de notificações agendadas**, que nunca existiu (`ConfiguracaoNotificacao` era só configuração sem consumidor) — `src/lib/notificacoes-dispatcher.ts` monta o conteúdo de cada tipo reaproveitando `buscarPedidosFechados`/`calcularResumoFinanceiro` já existentes, `src/instrumentation.ts` roda um `setInterval` de 60s dentro do próprio processo Next.js (viável porque o deploy é `next start` de container de vida longa, não serverless).
**Status:** aplicado (código); migration escrita manualmente e validada por leitura, não aplicada contra banco real nesta sessão — sem Docker/Postgres acessível no ambiente de trabalho (só WSL sem integração Docker Desktop, sem sudo). Aplicada de fato só depois, durante o deploy na VPS (ver decisões seguintes)
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (Módulo 17 novo: RF-099 a RF-103; RFs novos em Módulos 3, 4, 6, 7, 14: RF-087 a RF-098; RN-044 a RN-051), modelo-de-dados-jocley-lanchonete (`Product.enviaParaCozinha`, `User.permissoesOverride`, `ConfiguracaoGeral`/`ConfiguracaoNotificacao` atualizados), arquitetura-jocley-lanchonete (v1.23, Seção 4 e 5)
**Observação:** Antes de codar, o pedido de permissões granulares foi levado ao usuário via pergunta explícita (por aba só, ou aba+subtópico completo) — usuário escolheu a matriz completa, mesmo sabendo que era o escopo maior. Igualmente perguntado sobre WhatsApp: usuário já tinha Evolution API self-hosted rodando na mesma VPS (junto com outros agentes, "Cortex" e "Quasar") — decisão de integrar direto com ela em vez de esperar outro provedor.

---

## 2026-08-04 — Deploy das 10 melhorias na VPS + correção de rede Docker (WhatsApp não alcançava a Evolution API)

**Motivo:** Deploy de rotina do trabalho da decisão anterior — mas o teste de "Enviar teste" (WhatsApp) falhou (`fetch failed`) mesmo com a Evolution API respondendo normalmente via `curl` de dentro da VPS.
**Impacto:** Causa raiz: a Evolution API (`evolution_api`, container próprio, já rodava na mesma VPS antes deste sistema) publica a porta só em `127.0.0.1:8081` do host — regra do Docker que aceita conexão **apenas via loopback do host**, então nem `host.docker.internal` (que chega pela interface de bridge, não loopback) conseguia passar. Duas tentativas até a correta: (1) `extra_hosts: host.docker.internal:host-gateway` no `docker-compose.yml` — não resolveu, mesmo motivo acima; (2) solução correta — descoberto que `evolution_api` já estava numa rede Docker externa chamada `orbita_shared` (compartilhada entre os sistemas da VPS, incluindo os agentes Cortex/Quasar); conectado o container `app` do lanchonete nessa mesma rede (`networks: [default, orbita_shared]` no `docker-compose.yml`, `orbita_shared` declarada `external: true`) e trocado `EVOLUTION_API_URL` para `http://evolution_api:8080` (nome do container + porta **interna**, não a publicada). Também corrigido durante o mesmo ciclo: role do Postgres do `.env` de produção é `jocley_prod`, não `postgres` (comandos de diagnóstico `psql` precisaram do usuário certo).
**Status:** aplicado — testado ao vivo (`docker exec ... wget http://evolution_api:8080` retornou o welcome da Evolution API, depois "Enviar teste" enviou mensagem real recebida no WhatsApp configurado)
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.24, Seção 4)
**Observação:** Lição pra qualquer integração futura entre sistemas dessa VPS compartilhada: **nunca depender de porta publicada em `127.0.0.1` do host para comunicação entre containers** — sempre checar se existe uma rede Docker compartilhada (`orbita_shared` já existe e é o padrão certo a reaproveitar) e falar pelo nome do container na porta interna. `host.docker.internal` só ajudaria se a porta estivesse publicada em `0.0.0.0`, não em `127.0.0.1`.

---

## 2026-08-04 — Correções pós-deploy: DDI ausente rejeitado pela Evolution API, botão Desconectar, campo de dias da periodicidade Personalizada, disparo não respeitava periodicidade

**Motivo:** Sequência de bugs encontrados testando ao vivo depois do deploy: (1) telefone salvo sem o DDI 55 (`11948455946`) fazia a Evolution API responder 400 com `"exists": false` (número não reconhecido como WhatsApp válido); (2) cliente perguntou onde estava o botão de desconectar o telefone — não existia, só dava pra apagar manualmente e salvar vazio; (3) cliente reparou que a periodicidade "Personalizado" não tinha campo nenhum pra escolher o intervalo de dias; (4) ao verificar se o disparo agendado funcionava de verdade (forçando um teste ao vivo mudando o horário pra "agora"), ficou claro que o agendador nunca tinha sido testado com periodicidade diferente de Diário — revisão do código mostrou que a periodicidade só influenciava o **conteúdo** do relatório (quantos dias olhar pra trás), nunca a **frequência do envio**, que sempre disparava todo dia assim que ativo, independente de Semanal/Quinzenal/Personalizado.
**Impacto:** `enviarWhatsApp()` (`src/lib/evolution-api.ts`) completa o DDI 55 automaticamente para números de 10/11 dígitos que não começam com 55, e traduz o erro específico de "número não existe no WhatsApp" (`response.message[].exists === false`) numa mensagem clara em vez de só repassar o status HTTP. Botão "Desconectar" (vermelho, com `confirm()`) adicionado ao lado de "Salvar telefone"/"Enviar teste", só visível quando já existe telefone salvo. Campo "A cada quantos dias" adicionado condicionalmente quando periodicidade = Personalizado (existia no schema/API desde a decisão anterior, nunca tinha UI). `devDisparar()` (`src/lib/notificacoes-dispatcher.ts`) reescrito para calcular a diferença em dias de calendário (SP) entre `ultimoDisparoEm` e hoje, e só disparar quando essa diferença é ≥ ao intervalo da periodicidade (1/7/15/`periodicidadeDias`) — antes só checava "já disparou hoje?".
**Status:** aplicado — verificado ao vivo forçando `horaDisparo` do FATURAMENTO para o horário atual via `UPDATE` direto no banco, esperando o tick do agendador (~90s) e confirmando recebimento da mensagem no WhatsApp; `horaDisparo`/`ultimoDisparoEm` revertidos ao normal (`08:00`/`null`) depois do teste
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (RF-093, RF-097, RF-098 refletem o comportamento corrigido), arquitetura-jocley-lanchonete (v1.25)
**Observação:** O teste ao vivo do disparo agendado só foi possível porque o container já estava de pé há tempo suficiente (o agendador roda desde o boot do processo, via `src/instrumentation.ts`) — confirma que o `setInterval` em processo está funcionando de fato, não só no código. Fica registrado como método de verificação reutilizável: mudar `horaDisparo`/zerar `ultimoDisparoEm` de um tipo específico via SQL direto é mais rápido que esperar o horário real bater, sem precisar mockar nada em código.

---

<!-- novas entradas sempre abaixo desta linha, nunca acima -->

## 2026-08-07 — Rendimento do insumo após limpeza/perda + custo efetivo no cálculo de CMV

**Motivo:** Carnes e outros insumos "brutos" perdem peso na limpeza/aparas antes de virarem o que é efetivamente usado na ficha técnica (ex.: contrafilé com osso/gordura vira contrafilé limpo) — usar só `custoUnitario` bruto subestima o CMV real de qualquer produto que consome esses insumos.
**Impacto:** Novo campo `Ingredient.rendimentoPercentual` (Decimal 5,2, default 100 = sem perda) — migration `20260805025924_add_rendimento_percentual_ingredient`. Nova função `custoEfetivoUnitario()` (`src/lib/cmv-calc.ts`): `custoUnitario / (rendimentoPercentual / 100)` quando rendimento < 100, senão retorna o próprio custo. `recalculateProductCost()` (`src/lib/cmv.ts`) passou a usar o custo efetivo em vez do custo bruto na soma da ficha técnica. UI do formulário de insumo (`ingrediente-form-dialog.tsx`) ganhou campo "Rendimento após limpeza/perda (%)" com exemplo prático (27kg brutos → 20kg líquidos = 74,07%) e preview do custo efetivo calculado em tempo real.
**Status:** aplicado — commitado e enviado ao GitHub em 2026-08-07 (junto com a decisão seguinte, que já estava em andamento na mesma sessão de trabalho quando este código foi encontrado sem versionar)
**Artefatos atualizados:** modelo-de-dados-jocley-lanchonete (Ingredient.rendimentoPercentual, Regra de cálculo — CMV)
**Observação:** Encontrado como trabalho de uma sessão anterior deixado sem commit (schema, rotas de Insumos e UI já implementados, mas nunca versionados nem documentados aqui) — formalizado nesta sessão. Pequeno ajuste posterior no mesmo texto de ajuda: símbolo `%` faltante no exemplo ("74,07" → "74,07%"), commit separado `1b56d7f`.

---

## 2026-08-07 — PDV lista todos os produtos ativos, entrada rápida de estoque, ficha técnica do Espeto de Contrafilé e correção das categorias canônicas do cardápio

**Motivo:** Pedido explícito do cliente: produtos de categorias como "Espetinhos Crus" pareciam não aparecer corretamente nas telas de Mesa/Balcão; faltava uma forma rápida de repor estoque sem preencher o formulário completo de edição de insumo; e o nome das categorias do cardápio tinha inconsistência (ex.: "Espetos" em vez de "Espetinhos Assados", "Lanches" em vez de "Burgers na Brasa") que o cliente queria padronizar.
**Impacto:**
- `GET /api/products` passou a incluir `recipeItems.ingredient` completo (antes não trazia, necessário para cálculo de custo/baixa automática no fechamento) e a ordenar só por nome (antes ordenava por categoria+nome) — o filtro em si (`ativo=true`, sem restrição de categoria/`trackInventory`) já estava correto; confirmado ao vivo que as 6 categorias (incluindo "Espetinhos Crus", 13 produtos) e os 60 produtos ativos voltam completos na resposta
- Novo endpoint `POST /api/ingredients/[id]/entrada` — soma `quantidadeAtual` (increment atômico via `$transaction`), atualiza `custoUnitario` opcionalmente, registra `MovimentacaoEstoque` tipo ENTRADA com motivo fixo "Entrada rápida de estoque (Recomposição)", valida quantidade > 0 (400 se não), recalcula CMV dos produtos afetados quando o custo muda
- Novo componente `ModalEntrada` (`src/components/estoque/modal-entrada.tsx`) — modal disparado por um botão dedicado (ícone `PackagePlus`) na tabela de Estoque, só exige quantidade, custo unitário é opcional
- `prisma/seed.ts`: insumos base `"Contrafilé (Limpo)"` (KG, R$42,00) e `"Palito de Espetinho"` (UN, R$0,05), produto `"Espeto de Contrafilé"` (categoria "Espetinhos Assados", R$12,00) com ficha técnica (0,150kg de contrafilé + 1 palito) — demonstra o padrão carne-limpa-em-KG-virando-produto-em-UN pra qualquer espeto futuro
- Categorias canônicas corrigidas em `CATEGORIAS_CARDAPIO` (`src/lib/constants.ts`): `"Espetinhos Assados"`, `"Espetinhos Crus"`, `"Burgers na Brasa"`, `"Jantinhas e Porções"`, `"Bebidas"` (mais `"Insumos"`/`"Outros"` já existentes). Seed ganhou um passo de `updateMany` que migra produtos já existentes das categorias antigas (`"Espetos"` → `"Espetinhos Assados"`, `"Lanches"` → `"Burgers na Brasa"`, `"Porções"`/itens "Jantinha..." em `"Outros"` → `"Jantinhas e Porções"`) — necessário porque o seed só cria produto por nome quando ele não existe (`findFirst` + `create`), nunca atualiza categoria de um produto já seedado antes
**Status:** aplicado — testado ponta a ponta contra o banco local (login autenticado real via NextAuth, `POST /api/ingredients/[id]/entrada` com quantidade 0 → 400, com quantidade válida → 200 + `MovimentacaoEstoque` criada + CMV recalculado corretamente, bloqueio 403 confirmado para role CAIXA), seed rodado duas vezes seguidas pra confirmar idempotência (sem duplicar produto/insumo/ficha técnica na segunda rodada). Commitado (`7abd46c`) e enviado à `main` no GitHub — **deploy na VPS de produção (`jocleygrill.online`) ainda não confirmado**, cliente recebeu o comando de `git pull && docker compose up -d --build` pra rodar manualmente
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (RF-021 corrigido, Módulo 6 ganha RF-104/RF-105, RN-052), modelo-de-dados-jocley-lanchonete (categorias canônicas, nota de entrada rápida), arquitetura-jocley-lanchonete (v1.26/v1.27)
**Observação:** Push feito sem o agente `@devops` de fato disponível na sessão (mesma limitação já registrada em 2026-07-30 — este projeto não roda dentro do framework AIOX) — um agente genérico foi instruído a adotar a persona/processo do Gage (ler `devops.md`, rodar quality gate `tsc`+`lint`, `git push` sem force) como substituto funcional, com confirmação explícita do cliente antes de cada push. Ver Playbook DevOps (`telovis-hq-arquitetura`) para o detalhe operacional completo, incluindo a descoberta de que o diretório de deploy na VPS é `/opt/lanchonete-sistema` (via `docker inspect ... com.docker.compose.project.working_dir`) e que o `Dockerfile` já roda `prisma migrate deploy` sozinho no boot do container, sem passo manual de migration.

---

## 2026-08-10 — Correção do erro de sessão quebrada da Evolution API ("sendMessage" undefined) + esclarecimento dos cards de WhatsApp em Configurações

**Motivo:** Cliente reportou erro repetido ao clicar "Enviar teste" em Configurações → Notificações: `AppError` com o corpo cru da Evolution API, contendo `"TypeError: Cannot read properties of undefined (reading 'sendMessage')"`. Investigação mostrou que não é um erro deste código — é um erro **interno do Baileys/Evolution**, disparado quando ela tenta `socket.sendMessage(...)` com o socket da sessão `undefined` (sessão caiu de verdade, mesmo que o status reportado ainda diga `open`) — mesma família de sintoma já registrada no Sistema Thieco (Playbook DevOps, incidentes 2026-08-04/05). Na mesma conversa, o cliente também apontou que os dois cards de WhatsApp em Configurações ("Telefone WhatsApp para receber notificações" e "Instância WhatsApp (Evolution)") pareciam duplicados.
**Impacto:**
- `POST /api/configuracoes/whatsapp/testar` (`src/app/api/configuracoes/whatsapp/testar/route.ts`) passou a chamar `statusInstanciaWhatsApp()` antes de qualquer tentativa de envio — se o estado não for `open`, retorna direto um erro claro ("gere um novo QR code... e escaneie novamente") sem nem chamar a Evolution.
- `mensagemAmigavelEvolution()` (`src/lib/evolution-api.ts`) ganhou um segundo caso: quando `response.message[]` da Evolution contém uma string com `sendMessage` (o erro interno do Baileys), devolve "A sessão do WhatsApp caiu do lado da Evolution API — desconecte e escaneie o QR code novamente" em vez do JSON cru — cobre justamente o caso em que o status ainda reporta `open`, mas o envio falha do mesmo jeito.
- Labels dos dois cards em `notificacoes-tab.tsx` reescritos pra deixar explícito que são conceitos diferentes, não duplicados: "Número que recebe os alertas" (destino, `ConfiguracaoGeral`) vs. "Número que envia (WhatsApp pareado)" (a sessão/instância Evolution que efetivamente dispara as mensagens) — cada card ganhou uma frase curta explicando o papel.
- Confirmado (sem precisar de nenhuma mudança de código) que o botão "Desconectar sessão atual" já existente (`DELETE /api/configuracoes/whatsapp/instancia`) reseta **só a instância `jocley-grill`** — escopado por `EVOLUTION_INSTANCE`, não afeta as outras instâncias da mesma Evolution API compartilhada nessa VPS (thieco-admin, academia-sandro-admin, lane_confeitaria, thieco-mutinga) — o isolamento por instância já era correto por design, mesmo padrão confirmado no incidente Thieco de 2026-08-05.
**Status:** código alterado e validado por `tsc --noEmit` (sem erro) — **não commitado nem enviado ao GitHub até o fim desta sessão**. Cliente pediu deploy direto via `scp` dos 3 arquivos alterados pra `/opt/lanchonete-sistema`, seguido de rebuild (`docker compose build app && docker compose up -d app`) — comandos fornecidos, **execução não confirmada nesta sessão** (ver Playbook DevOps)
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (RF-094 revisado, RF-106 novo, RN-053 nova), arquitetura-jocley-lanchonete (v1.28)
**Observação:** Reforça a lição já registrada no Playbook a partir do incidente Thieco (2026-08-04/05): status `open` reportado pela Evolution API não é garantia de sessão viva — o jeito mais confiável de saber é tentar enviar e tratar o erro específico que volta. Igual ao Thieco, também não existe aqui *retry* nem checagem periódica proativa de `connectionStatus`; o usuário só descobre a sessão quebrada ao tentar enviar de fato.

---

## 2026-08-10 — Porta default do Postgres local trocada de 5434 pra 5436 (colisão com lane-confeitaria)

**Motivo:** Levantamento de todas as portas locais dos sistemas do workspace mostrou que o default `POSTGRES_HOST_PORT:-5434` deste projeto colide com a porta fixa `5434` do `lane-confeitaria-db` — se os dois sobem localmente ao mesmo tempo sem `.env` customizado, um dos dois falha ao subir o container. O `.env.example` já documentava esse risco manualmente ("só mude isso se 5434 já estiver em uso"), mas não corrigia o default.
**Impacto:** `docker-compose.yml`, `scripts/dev.js` (`DB_PORT`) e `.env`/`.env.example` atualizados juntos para o novo default `5436` — escolhido por não colidir com nenhum sistema do workspace na varredura feita (thieco=5432, vilamill=5433, lane-confeitaria=5434, kernel=5435, telovis-mei=5438, telovis-foodservice=5440, telovis-academia=5441). Porta da VPS (`5435`, definida só no `.env` de produção) não foi alterada — é específica daquele ambiente e não colide lá hoje.
**Status:** aplicado, não testado subindo o container de novo nesta sessão (mudança de configuração, sem lógica de aplicação envolvida).
**Artefatos atualizados:** nenhum RF/RN — mudança de infraestrutura local, não de comportamento do produto.

---

## 2026-08-13 — Enter para salvar nos formulários de Produtos, Insumos, Despesas e Usuários

**Motivo:** Cliente reportou que várias telas de cadastro (produtos/preços, insumos, despesas, usuários) só salvavam clicando no botão — pressionar Enter não fazia nada, obrigando a soltar o teclado a cada campo.
**Impacto:** Os quatro diálogos (`produto-form-dialog.tsx`, `ingrediente-form-dialog.tsx`, `despesa-form-dialog.tsx`, `usuario-form-dialog.tsx`) usam `<input>` soltos sem `<form>`, chamando `salvar()` só via `onClick` do botão — mesma causa raiz em todos. Adicionado `onKeyDown` nos campos de texto/número que dispara o salvamento ao pressionar Enter, reaproveitando a mesma condição que já habilita o botão "Salvar" (extraída para `podeSalvar` em cada componente, em vez de duplicar a checagem). Segue o mesmo padrão já existente em `abrir-comanda-dialog.tsx` (PDV), que já tratava Enter dessa forma. No formulário de produto, os dois campos do "novo grupo opcional" (nome/opções) têm seu próprio `onKeyDown` chamando `adicionarGrupoOpcional()` em vez de `salvar()`, pra Enter não salvar o produto por engano enquanto o usuário monta um grupo de opcionais.
**Status:** aplicado — `tsc --noEmit` e `next lint` limpos, commitado (`27486b8`) e enviado à `main` no GitHub, deploy confirmado na VPS de produção (`jocleygrill.online`) na mesma sessão: `git pull` (fast-forward `3896ddb..27486b8`), `docker compose build app` + `docker compose up -d --force-recreate app`, log confirmando `8 migrations found... No pending migrations to apply` e `✓ Ready in 209ms` sem erro.
**Artefatos atualizados:** nenhum RF/RN — melhoria pontual de usabilidade, não muda regra de negócio nem schema.
**Observação:** Ao tentar validar a mudança rodando `npm run dev` localmente antes do commit, o Prisma falhou com `P1000: Authentication failed` — a porta default local `5436` (definida na decisão de 2026-08-10 acima) está sendo ocupada, nesta máquina específica, pelo container `evolution_postgres` (não fazia parte da varredura de portas daquela decisão). Ver gotcha novo no Playbook DevOps. Como efeito colateral útil, o `git pull` na VPS durante o deploy confirmou que os commits `7abd46c`/`1b56d7f` (2026-08-07, PDV+entrada rápida+rendimento) e a correção do WhatsApp `sendMessage` de 2026-08-10 (bundlada no commit `3896ddb` de 2026-08-11) já estavam de pé em produção antes desta sessão — resolve os dois itens em aberto equivalentes no backlog do Índice.

---

## 2026-08-13 — Rodapé "Fechar Comanda" alinhado à coluna de itens (não precisa mais rolar a página inteira)

**Motivo:** Cliente reportou que o botão "Fechar Comanda" (tela `/comanda/[id]`) estava "se alinhando ao menu central" — no desktop, só aparecia depois de rolar a página inteira até o fim, incluindo toda a grade de produtos do catálogo à esquerda, em vez de ficar junto da lista de itens da comanda à direita.
**Impacto:** `comanda-itens.tsx` — o container principal (`flex md:flex-row`) não tinha altura fixa no desktop, então a div `flex-1 overflow-y-auto` da lista de itens nunca criava uma região de scroll própria (sem altura delimitada pelo pai, `overflow-y-auto` não tem efeito) — a página inteira crescia com o catálogo (grid de produtos, geralmente mais alto) e o rodapé (Total/Cancelar/Fechar Comanda) ficava empurrado pro fim de tudo. Corrigido dando `md:h-screen md:overflow-hidden` ao container e `md:overflow-y-auto` à coluna do catálogo — agora cada coluna rola de forma independente, dentro da altura da tela, e o rodapé fica preso ao final da coluna de itens, sempre visível sem rolar a página. Comportamento mobile (bem diferente: barra fixa `fixed bottom-0 md:hidden`) não foi tocado.
**Status:** aplicado — `tsc --noEmit` limpo, commitado (`d8202fb`) e enviado à `main`, deploy na VPS de produção confirmado pelo cliente (`jocleygrill.online`).
**Artefatos atualizados:** nenhum RF/RN — correção de layout, não muda comportamento de dados.

---

## 2026-08-13 — Primeira forma de pagamento pré-preenchida com o total no fechamento de comanda

**Motivo:** Cliente pediu que, no caso mais comum (uma única forma de pagamento), o campo de valor já viesse com o total da comanda preenchido — só trocando a forma de pagamento, sem digitar o valor de novo. Se o operador adicionar uma segunda forma pra dividir o pagamento, aí sim edita os valores manualmente.
**Impacto:** `pagamento-split.tsx` — `useEffect` novo, disparado quando `open` vira `true`, reseta `desconto` e `linhas` toda vez que o diálogo abre: a primeira linha nasce com `forma: "DINHEIRO"` e `valor` já igual a `totalBruto - descontoInicial` (formatado com 2 casas). Antes, o `useState` inicial só rodava uma vez no mount do componente (que fica montado o tempo todo na página da comanda, não remonta a cada abertura do diálogo), então o valor ficava vazio na primeira abertura e preservava o que o operador tivesse digitado nas aberturas seguintes — igual ao problema já resolvido nos diálogos de cadastro (produto/insumo/despesa/usuário), aqui pro caso de reabrir o mesmo diálogo de pagamento sem remontar.
**Regressão encontrada e corrigida na mesma sessão:** o botão "Adicionar forma de pagamento" só era renderizado quando `restante > 0.005` (saldo não alocado) — fazia sentido quando a primeira linha nascia vazia (sempre havia saldo a alocar até o operador preencher), mas com o valor total pré-preenchido o `restante` já nasce zerado, e o botão simplesmente sumia assim que o diálogo abria, impedindo split de pagamento por completo. Corrigido removendo a condição — o botão fica sempre visível; `adicionarLinha()` já lidava corretamente com `restante` zero ou negativo (nova linha nasce com valor vazio), não precisou de mudança.
**Status:** aplicado — `tsc --noEmit` e `next lint` limpos nos dois commits, commitado (`0ca4071` valor pré-preenchido, `a5550d9` correção do botão) e enviado à `main`, deploy na VPS de produção confirmado pelo cliente (`jocleygrill.online`).
**Artefatos atualizados:** nenhum RF/RN — melhoria de usabilidade, não muda regra de cálculo do fechamento.
**Observação:** Reforça um padrão a vigiar neste projeto: qualquer diálogo que fica montado o tempo todo (não remonta a cada abertura) precisa de um `useEffect` explícito gateado por `open` pra resetar estado — um `useState` inicial sozinho só roda no primeiro mount. Vale conferir os outros diálogos do PDV (`abrir-comanda-dialog.tsx` já faz isso via `useEffect(() => { if (open) setNome(""); }, [open])`) se aparecer sintoma parecido no futuro.

---

## 2026-08-23 — Confirmação da estratégia de impressão (cozinha só no KDS) + código curto da comanda no cupom térmico

**Motivo:** Cliente confirmou explicitamente a estratégia de impressão do PDV: a cozinha acompanha os pedidos exclusivamente pela tela do KDS em tempo real (`/cozinha`) — não existe, e nunca existirá, impressão de ficha física de produção para a cozinha. A única impressora térmica do estabelecimento fica ligada por cabo no computador do caixa, e a única impressão do sistema é o cupom de conferência/fechamento de comanda. Junto com a confirmação, pediu para o cupom ganhar um logo e um "código de comanda".
**Impacto:** Investigação prévia (sem codar) confirmou que a arquitetura de impressão já era exatamente essa desde a origem — `CupomImpressao` (Módulo 8, v1.2/v1.4) já isola o cupom do resto da página via `.print-area` + `@media print` em `globals.css`, e o KDS (Módulo 7) nunca teve nenhuma rota de impressão associada; não havia código de impressão de cozinha para remover. Da parte nova pedida: (1) `DadosCupom` (`src/components/cupom-impressao.tsx`) ganhou o campo `codigo: string`, impresso como "Cód: A1B2C3" logo abaixo da identificação da mesa/comanda — calculado em `fecharComanda()` (`comanda-itens.tsx`) como `order.id.slice(-6).toUpperCase()` (6 últimos caracteres do `cuid` da comanda, maiúsculas), só para facilitar localizar o pedido no sistema em caso de conferência — não é um campo novo no banco, é derivado em tempo de impressão a partir do `id` que já existe. (2) Logo-imagem no cabeçalho do cupom foi avaliada e implementada com fallback automático (`<img src="/logo.png">` com `onError` caindo pro nome em texto), mas descartada a pedido do cliente antes de ir para produção — hoje não existe nenhum arquivo de logo no projeto (`public/` só tem `.gitkeep`), então o cabeçalho do cupom permanece só com `NOME_LANCHONETE` em texto (mesmo padrão de sempre).
**Status:** aplicado (código) — `tsc --noEmit` limpo; **não commitado** até o fim desta sessão.
**Artefatos atualizados:** requisitos-funcionais-jocley-lanchonete (RF-107, RN-054, RN-055 — Módulo 8), arquitetura-jocley-lanchonete (v1.29).
**Observação:** Não é uma mudança de estratégia de fato — é a formalização explícita de uma decisão que já estava implementada desde 2026-07-29 (PDV core) e nunca teve exceção. Fica registrado aqui porque o cliente pediu a confirmação de forma direta, e para documentar a decisão consciente de não adicionar logo-imagem por ora, evitando que uma sessão futura tente "completar" isso sem necessidade — se o cliente fornecer a arte da marca depois (ver item de backlog "logo da marca" no Índice), basta colocar o arquivo em `public/logo.png` e trocar o bloco de texto pelo `<img>` já testado.

---

## 2026-09-02 — "Nome do Cliente" em Despesas e Lançamentos + reimpressão do cupom pela aba Lançamentos

**Motivo:** Cliente pediu (1) um campo "Nome do Cliente" na tela de lançamento de despesas e (2) poder reabrir uma comanda já fechada na aba Lançamentos, ver/editar o cliente e reimprimir o cupom — útil quando a impressão original falhou ou faltou papel.
**Impacto:**
- **Despesa.clienteNome** (String?, opcional, sem validação) — migration `20260902120000_add_cliente_nome_despesa`. Campo no `despesa-form-dialog`, coluna "Cliente" na `despesas-table` e busca client-side por cliente na mesma tela, reaproveitando o padrão `busca`/`useMemo`/ícone `Search` já usado em Produtos e Estoque (requisito 4 do pedido só foi atendido porque **já existia** esse padrão de filtro — não se inventou um novo).
- **Aba Lançamentos** (`/lancamentos`, lista de comandas `FECHADO`) ganhou coluna "Cliente" (via `Order.clienteNome`) e linha clicável → `CupomReimpressaoDialog`: prévia do cupom + campo "Nome do cliente" editável (`PATCH /api/orders/[id]`, que já aceitava `clienteNome`) + botão "Imprimir cupom" que funciona com ou sem cliente (se o nome mudou e não foi salvo, salva antes de imprimir). Reaproveita `CupomImpressao` + `window.print()` — nenhuma rota nova, os dados vêm do `GET /api/orders?status=FECHADO` que já retorna a comanda inteira.
- `DadosCupom` (`cupom-impressao.tsx`) ganhou `cliente?: string | null`, impresso como "Cliente: ..." quando presente — tanto na reimpressão quanto na impressão do fechamento (`comanda-itens.tsx` passou a informar `order.clienteNome`).
- **Descoberta:** `Order.clienteNome` já existia no schema desde a migration `20260811151346_add_cliente_nome_e_contador_global` (e no `OrderDTO`), só nunca era exibido em lugar nenhum além da tela da comanda. O `modelo-de-dados` nunca tinha registrado essa coluna — corrigido nesta atualização.
**Status:** aplicado — `tsc --noEmit` + `next lint` limpos, migration aplicada no banco de dev local (`prisma migrate deploy`), commits `aadd0ae` (feature) e `c5ed041` (bundle com a porta de dev, abaixo) na `main`. Deploy em produção: cliente disse que faria o deploy normal — o `CMD` do container roda `prisma migrate deploy` no boot, aplica a migration sozinho.
**Artefatos atualizados:** modelo-de-dados-jocley-lanchonete (`Despesa.clienteNome`, `Order.clienteNome`), arquitetura-jocley-lanchonete (v1.30), requisitos-funcionais-jocley-lanchonete (Módulo 11 RF-055 revisado, Módulo 12 RF-108/RF-109, RN-056).
**Observação:** O pedido do cliente chamava as duas telas de "aba de Lançamentos (Despesas)" como se fossem a mesma coisa — no sistema são itens de menu distintos (`/lancamentos` = comandas fechadas; `/despesas` = model `Despesa`). Confirmado com o cliente que ele queria o campo nas **duas**. Também confirmado o nome da coluna: `clienteNome` (não `nomeCliente` como veio no pedido) para bater com `Order.clienteNome`/`NotaCliente.clienteNome`.

---

## 2026-09-02 — Porta fixa 3002 para o `npm run dev` local

**Motivo:** Ao rodar o sistema localmente pra validar as mudanças, a porta 3000 estava ocupada pelo `villamill-app` (outro projeto do workspace, container publicado em `0.0.0.0:3000`) — o `npm run dev` subia mas o navegador abria o vilamill. Além disso, o `.env` local apontava o Postgres para a 5436, que **nesta máquina** é do `evolution_postgres`, não do Jocley (gotcha já registrado em 2026-08-13, agora com correção definitiva no `.env` local).
**Impacto:** `scripts/dev.js` passou a subir o Next com `-p ${PORT || 3002}` (sobrescrevível pontualmente com `PORT=xxxx npm run dev`) e a logar a URL certa. `.env` local (não versionado) corrigido: `DATABASE_URL`/`DIRECT_URL` → `localhost:5434` (container `jocley-lanchonete-db`, que publica nessa porta nesta máquina), `NEXTAUTH_URL`/`AUTH_URL` → `http://localhost:3002`.
**Status:** aplicado — commit `c5ed041` na `main` (junto do trabalho de "Nome do Cliente"). Só afeta ambiente de dev; produção roda `next start` em container, não usa `scripts/dev.js`. `.env` é gitignored — a correção de porta do banco não sai da máquina.
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.31). Nenhum RF/RN — infraestrutura de dev, não muda comportamento do produto.
**Observação:** Reforça o gotcha de 2026-08-13: a porta "default" do Postgres local deste projeto (5436, decidida em 2026-08-10) colide com o `evolution_postgres` nesta estação de trabalho específica — o container real do Jocley aqui está publicado na 5434. É ambiente-específico; não vale mexer no default do `docker-compose.yml`/`.env.example` de novo, só no `.env` local.

---

## 2026-09-02 — Impressão de rede ESC/POS da ficha de produção na Cozinha (reverte "só KDS") + aba Impressoras + correção do cupom claro do Caixa

**Motivo:** Três pedidos do cliente, tratados como frentes independentes:
1. A cozinha tem uma impressora Wi-Fi que **não imprime de forma confiável** pelo diálogo do SO (`window.print()`) — limitação de driver/SO, não do sistema (cupons de iFood/99 saem bem nela). Cliente quer que a ficha de produção saia automaticamente ao lançar o item, impressa **pelo servidor direto no IP da impressora**, sem passar pelo navegador. Isso **reverte a decisão de 2026-08-23** ("nunca haverá impressão de ficha física para a cozinha") — o cliente mudou de ideia depois de conviver com o atrito de a cozinha depender só da tela.
2. Uma aba "Impressoras" em Configurações pra cadastrar IP/porta da impressora da cozinha e testar.
3. O cupom do Caixa (impressora cabeada) sai fraco/apagado — cupons de iFood/99 saem escuros na **mesma** impressora, então não é hardware.

**Impacto (fundação + Frente 2 — commit `c2b6672`):**
- `model Impressora` (`nome`, `ip`, `porta` default 9100, `ativa`, `papel` enum `PapelImpressora.PRODUCAO_COZINHA` `@unique`) — migration `20260902214752_add_impressora`. Escolhido **model dedicado** em vez de chave em `ConfiguracaoGeral` porque `papel` quer ser enum e os campos são tipados.
- Dependência **`node-thermal-printer` 4.6.1** (estável; `characterSet` PC860 resolve acentuação PT; `escpos-network` estava em alpha, descartado) + `serverExternalPackages: ["node-thermal-printer"]` no `next.config.ts` (usa `net`/require dinâmico, não pode ser empacotada pelo bundler).
- `src/lib/impressao.ts`: `novoPrinter()` (socket TCP `tcp://ip:porta`, `options.timeout` 4s — Wi-Fi tem mais latência que cabo, timeout curto derruba impressão boa), `traduzErro()` (mapeia `ECONNREFUSED`/`EHOSTUNREACH`/`ETIMEDOUT` para mensagem amigável + `detalhe` técnico `IP:porta (CÓDIGO) — msg`), `testarImpressora()`, `imprimirFichaProducao()`. Nenhuma função lança — todas devolvem `{ ok, erro?, detalhe? }`.
- `/api/configuracoes/impressoras` (GET/PATCH upsert pelo `papel`, validação de IPv4/porta com `AppError`) e `/api/configuracoes/impressoras/testar` (POST, dispara cupom de teste real) — ambas `guardGestor()`. Aba **Impressoras** (`impressoras-tab.tsx`) no padrão das abas existentes (Card + toggle + botão "Testar impressão" + bolinha verde/vermelha do último teste, mantida só em estado de tela, não persistida) + nota fixa explicando que a impressora do Caixa é escolhida pelo navegador/SO, não configurada ali. Chave de permissão `configuracoes.impressoras` em `PERMISSION_TREE`.

**Impacto (Frente 1 — commit `ea08cff`):**
- `POST /api/orders/[id]/items`: após criar um item com `Product.enviaParaCozinha=true`, dispara `void imprimirFichaComLog(fichaDoItem(item))` — **fire-and-forget, NÃO `await`ado**. O lançamento responde em ~0.5s independente da impressora; a impressão roda em paralelo e completa depois da resposta (viável porque o deploy é `next start` de processo de vida longa, igual ao agendador de notificações). Falha → `ErrorLog` `status=502` com identificação da comanda + item + `IP:porta (código)`; o item **continua no KDS normalmente**.
- `POST /api/kds/reimprimir` (`{ itemId }` ou `{ orderId }` = todos os itens de cozinha pendentes da comanda) + botão "Imprimir novamente" por item e "Reimprimir" por comanda no `/cozinha`, com feedback efêmero (✓/✗ por 3s).
- O cupom do Caixa (`window.print()`) **não foi tocado** — continua browser-side.

**Impacto (Frente 3 — commit `604eae4`):**
- CSS de `cupom-impressao.tsx` reescrito e escopado em `.cupom-termico`: `color:#000` puro + `print-color-adjust:exact` (o navegador estava "clareando" a tinta pra economizar — causa provável nº 1), `font-weight:700` em tudo, `-webkit-font-smoothing:none` (borda dura, sem antialiasing suave), fonte `"Courier New", Courier, monospace`, corpo 12.5pt / título 16pt / TOTAL 15pt, separadores 2px sólidos. O cupom antigo herdava a cor de texto do tema (~`#0f172a`, cinza-escuro) e peso normal.
- Nova página `/cupom-teste` (ADMIN, via middleware) — prévia ANTIGO×NOVO lado a lado (80mm) + botão pra imprimir cada modelo (só o selecionado recebe `.print-area`), pra comparação física com um cupom de iFood/99.

**Status:** aplicado — `tsc --noEmit` + `next lint` limpos, **`next build` de produção validado** (`✓ Compiled successfully`, 54/54 páginas, sem erro de bundling do `node-thermal-printer`), migration aplicada no banco de dev. Testado ponta a ponta contra o dev (sem impressora física): lib carrega, socket conecta, timeout de 4s dispara, erros viram mensagem amigável + `ErrorLog` com `IP:porta (código)`; `/api/configuracoes/impressoras` GET/PATCH/testar OK; add de item de cozinha responde 201 em ~0.5s sem bloquear e loga a falha de impressão; `POST /api/kds/reimprimir` 404/400/502 limpos. Dados de teste limpos do banco de dev depois. **Três commits separados** na `main` (`c2b6672`, `ea08cff`, `604eae4`), push feito. Deploy em produção: cliente faria o deploy normal (o `CMD` do container roda `prisma migrate deploy` no boot).
**Artefatos atualizados:** modelo-de-dados-jocley-lanchonete (`model Impressora`, enum `PapelImpressora`, nota de impressão de rede no ErrorLog), arquitetura-jocley-lanchonete (v1.32, Seção 1/3/4/5), requisitos-funcionais-jocley-lanchonete (Módulo 7 RF-110/RF-111, Módulo 8 RF-112, Módulo 14 RF-113 a RF-115, **RN-022 e RN-054 revisadas**, RN-057 a RN-059 novas).
**Observação — pré-requisito de rede não resolvido nesta sessão:** a impressão de rede só funciona se o **servidor Next.js alcançar o IP da impressora**. Em produção o container roda na VPS compartilhada (`2.24.93.178`) — uma impressora Wi-Fi na LAN do cliente tem IP privado (`192.168.x.x`), **não roteável** da VPS pela internet. A impressora cabeada do Caixa teria o mesmo problema a partir da VPS. Ou seja: pra impressão automática da cozinha funcionar de fato, ou o servidor precisa rodar numa máquina da LAN do cliente, ou é preciso VPN/túnel/port-forward entre a VPS e a impressora. Isso foi levantado no diagnóstico prévio e comunicado ao cliente; a implementação está pronta, a viabilização de rede é uma decisão de infraestrutura ainda em aberto. Sem impressora física acessível no ambiente de trabalho, a validação foi só do caminho de código (conexão/timeout/erro/log), não de um cupom saindo de verdade.
**→ Resolvido na decisão seguinte (2026-09-03):** cliente escolheu a abordagem fila + agente.

---

## 2026-09-03 — Impressão da Cozinha: de socket direto para fila + Agente no PC do caixa

**Motivo:** A decisão de 2026-09-02 (v1.32) deixou o pré-requisito de rede em aberto — o container na VPS não alcança o IP privado da impressora Wi-Fi da LAN do restaurante. Apresentadas 3 opções ao cliente: (A) VPN/subnet-router (ex. Tailscale) num dispositivo sempre-ligado do restaurante, (B) um agente de impressão rodando no PC do caixa que puxa os jobs do servidor e imprime local, (C) port-forward no roteador. Cliente escolheu **(B)** — mais sólida pra impressora atrás de NAT, não depende de o PC do caixa ser roteável nem de plumbing de VPN dentro do Docker na VPS compartilhada, e degrada bem.
**Impacto:**
- **Schema:** `FilaImpressao` (fila de jobs — `origem`, `descricao`, `ip`/`porta` snapshot, `payloadBase64` com os bytes ESC/POS renderizados, `status` PENDENTE/IMPRESSO/ERRO, `tentativas`, `ultimoErro`, `orderItemId`), enum `StatusFilaImpressao`, e `Impressora.agenteVistoEm` (heartbeat). Migration `20260903015245_add_fila_impressao`.
- **`src/lib/impressao.ts` reescrito:** o servidor agora só **renderiza** a ficha em bytes (`node-thermal-printer` → `getBuffer()`, **sem abrir socket**) e **enfileira** em `FilaImpressao` (`renderFichaProducao`/`renderCupomTeste`/`enfileirarImpressao`/`enfileirarFichaItem`). `node-thermal-printer` + `serverExternalPackages` continuam (só pra montar o buffer). Sem socket saindo da VPS.
- **Rotas do agente:** `GET /api/impressao/fila` (o agente puxa a fila; atualiza `agenteVistoEm`; expira jobs PENDENTE > 30 min → `ERRO` + `ErrorLog`) e `PATCH /api/impressao/fila/[id]` (`{resultado:"ok"|"erro", code?, mensagem?}` — retry até 3, depois `ERRO` + `ErrorLog`). Auth: `guardAgenteImpressao(req)` (`src/lib/api-guard.ts`) — Bearer `IMPRESSAO_AGENT_TOKEN` (env da VPS + `.env` do agente), **sem sessão NextAuth**. `middleware.ts` passou a isentar `api/impressao` do gate de sessão (mesmo padrão de `api/auth`).
- **Gatilhos:** `POST /api/orders/[id]/items` e `POST /api/kds/reimprimir` passaram a **enfileirar** (era socket direto). `POST /api/configuracoes/impressoras/testar` enfileira um cupom de teste e faz polling de até 12s pela confirmação do agente (200 = saiu, 502 = agente reportou erro, 504 = ninguém pegou o job).
- **UI:** `impressoras-tab.tsx` mostra "Agente de impressão: online/offline (visto há Xs)" (heartbeat via SWR de 5s); "Testar impressão" agora exige a impressora salva.
- **Agente (novo):** pasta `agente-impressao/` no repo — `agente.js` (Node ≥ 18, **zero dependências**: `node:net` + `fetch`), `package.json`, `.env.example`, `README.md` (runbook offline-first completo, com PARTE 1 = kit a montar numa máquina com internet, PASSOS 1–8 e tabela de erros comuns). Roda no PC do caixa como Tarefa Agendada ou serviço `nssm`.
**Status:** aplicado — `tsc --noEmit` + `next lint` + **`next build`** (`✓ Compiled successfully`, 55/55) limpos. Migration aplicada no dev. Testado ponta a ponta no dev **simulando o agente** com `curl` + token: enfileiramento no lançamento do item (201 em ~0.5s), `GET /api/impressao/fila` devolve o job com `payloadBase64` válido (decodificado = ESC/POS real "PRODUCAO - COZINHA"), `PATCH .../ok` → IMPRESSO, `PATCH .../erro` 3× → ERRO + `ErrorLog`, `/testar` sem agente → 504, `GET /api/impressao/fila` sem token → **401 (não 302)** confirmando a isenção do middleware, heartbeat `agenteVistoEm` gravado. Dados de teste limpos do dev. **Não commitado** até o fim desta sessão.
**Artefatos atualizados:** playbook-devops-jocley-lanchonete (seção "Impressão da Cozinha — fila + Agente" reescrita + runbook de instalação do agente), modelo-de-dados-jocley-lanchonete (`FilaImpressao`, `StatusFilaImpressao`, `Impressora.agenteVistoEm`), arquitetura-jocley-lanchonete (v1.33, Seção 3/4), requisitos-funcionais-jocley-lanchonete (RF-110/RF-111/RF-114 e RN-058/RN-059 reescritos pra fila+agente; RF-116 novo — agente), indice-jocley-lanchonete (backlog).
**Observação:** o **cupom do Caixa não mudou** — continua `window.print()` no navegador. Quem imprime a ficha da Cozinha é o agente; se ele estiver offline, os jobs ficam PENDENTE na fila (e expiram em 30 min), o KDS em tela continua sendo a fonte primária. Pré-requisito operacional novo: **reserva de DHCP** no roteador do restaurante pro IP da impressora não mudar (o agente pega o IP de cada job, que é snapshot do que está em `Impressora` — trocar o IP é só em Configurações, sem tocar no agente).

---

## 2026-09-05 — Segmentação de impressão Cozinha/Caixa (com USB local) + separação Fechar (atendente)/Finalizar (caixa) + edição de preço/desconto restrita ao caixa + correção do cupom duplicado + Enter/quantidade digitável

**Motivo:** Pedido direto do cliente, oito itens tratados como um único lote de trabalho:
1. Segmentar a impressão automática — itens de cozinha saem na Cozinha, bebidas/drinks saem na impressora do Caixa (hoje bebida não imprimia em lugar nenhum, só ficava no total da comanda).
2. Só o Caixa (na máquina) pode **finalizar** a comanda (cobrar pagamento); a atendente só pode **fechar** (na mesa, pelo celular) — a finalização e o recebimento continuam sendo sempre do Caixa.
3. A atendente fecha a comanda pelo celular, mas vai até o caixa pegar a impressão (implica que a impressão sai **no caixa**, não no aparelho de quem fechou).
4. O botão de fechar comanda deve imprimir automaticamente na impressora cabeada do caixa.
5. Na tela de mesa/balcão, dá pra apertar Enter pra adicionar item (busca e seletor de quantidade), e digitar a quantidade direto além dos botões +/-.
6. Só o caixa pode aplicar desconto e/ou alterar o valor (preço) de um produto na comanda, antes de finalizar.
7. A ficha da cozinha deve sair com a mesa e o nome do cliente.
8. O cupom do caixa estava saindo duplicado/triplicado (mais de uma folha repetindo as informações).

**Decisões de arquitetura tomadas durante a sessão** (via perguntas diretas ao cliente, não assumidas):
- **Impressora do Caixa é USB local, sem IP de rede** (confirmado pelo cliente) — diferente da Cozinha (Wi-Fi com IP). Isso é o que forçou a extensão do Agente de Impressão pra imprimir também via compartilhamento de impressora do Windows, e não só socket TCP: sem isso, "fechar" pelo celular jamais conseguiria imprimir sozinho numa impressora USB de outra máquina.
- **"Fechar" = pedir a conta, sem cobrar** — reaproveitando o `TableStatus.CONTA`, que já existia no enum e na cor da grade de mesas (vermelho) desde o bootstrap do schema (2026-07-29), mas **nunca tinha sido setado por nenhum fluxo real** até esta sessão. "Finalizar" continua sendo, na prática, o antigo botão único "Fechar Comanda" (cobra pagamento, desconto, baixa estoque, imprime cupom de pagamento) — só que renomeado e restrito ao Caixa.
- **CAIXA, SUPERVISOR e ADMIN** (não só CAIXA) podem finalizar/aplicar desconto/alterar preço — mantém paridade de acesso do Supervisor com o Caixa, como já ocorre em outras telas do sistema (Módulo 2 RN-003).

**Impacto:**
- **Schema** (migration `20260905180000_add_caixa_printer_conta_solicitada`): `PapelImpressora` ganha `CAIXA`; novo enum `TipoConexaoImpressora` (REDE/USB_LOCAL); `Impressora` e `FilaImpressao` ganham `tipo`+`compartilhamento` (e `ip`/`porta` viram opcionais — só fazem sentido quando `tipo=REDE`); `Order` ganha `contaSolicitada`/`contaSolicitadaEm`/`contaSolicitadaPor`.
- **`src/lib/impressao.ts` generalizado:** `buscarImpressoraCozinha()` → `buscarImpressora(papel)`; `enfileirarImpressao()` passa a receber `papel` e monta o snapshot (`tipo` + `ip`/`porta` ou `compartilhamento`) de acordo; `identificacaoPedido()` passa a incluir o nome do cliente (RF item 7); novas `renderFichaConta()` (ficha de conta, sem forma de pagamento) e `enfileirarFichaConta()`.
- **`POST /api/orders/[id]/items`:** decide o papel pelo `Product.enviaParaCozinha` que já existia — `true` → `PRODUCAO_COZINHA`, `false` (bebida/drink) → `CAIXA`. Sem campo novo no Produto — a segmentação pedida (item 1) sai de graça reaproveitando um flag já existente.
- **Novo `POST /api/orders/[id]/solicitar-conta`** ("Fechar"): trava itens pra ATENDENTE (`contaSolicitada=true`), marca `Table.status=CONTA` se for MESA, enfileira a ficha de conta na impressora `CAIXA` — via fila+Agente, então funciona mesmo vindo do celular (resolve os itens 2/3/4 de uma vez: a impressão sai sempre no caixa, nunca no aparelho de quem clicou, e a atendente precisa ir até lá buscar).
- **`POST /api/orders/[id]/close`** ("Finalizar") e `PATCH .../items/[itemId]` (quando o body inclui `precoUnit`) e `PATCH /api/orders/[id]` (quando inclui `desconto`) passam a exigir `guardCaixa()` (novo em `api-guard.ts`, mesmo padrão de `guardGestor()`, mas ADMIN/SUPERVISOR/CAIXA) — resolve os itens 2 e 6, reforçado no servidor, não só escondido na tela.
- **Agente (`agente-impressao/agente.js`):** ganha `imprimirLocal(compartilhamento, bytes)` — grava um arquivo temporário e roda `copy /b <tmp> \\localhost\<compartilhamento>` via `child_process.execFile`, sem nenhuma dependência npm nova (mantém a promessa de "zero dependências" do README). Decide `imprimirRede` vs `imprimirLocal` pelo `job.tipo`.
- **`comanda-itens.tsx`:** ramificado por `useSession()`/`PAPEIS_CAIXA` (novo em `constants.ts`) — ATENDENTE vê só "Fechar Comanda" (chama `solicitar-conta`, sem dialog de pagamento); CAIXA/SUPERVISOR/ADMIN vêem "Finalizar Comanda" (abre o `PagamentoSplitDialog`, renomeado de "Fechar Comanda" pra "Finalizar Comanda"). Editor de preço inline por item, visível só pra `PAPEIS_CAIXA`. Enter no campo de busca abre o seletor do primeiro produto filtrado; Enter dentro do seletor confirma a adição; campo de quantidade aceita digitação direta (resolve os itens 5).
- **Correção do cupom duplicado (item 8):** causa raiz era `.print-area { position: fixed }` em `globals.css` — por especificação de CSS pra mídia paginada, um elemento `position: fixed` é **repetido em toda página impressa**; em comandas longas o cupom ultrapassa 1 folha física (o driver da impressora não respeita à risca o `@page { size: 80mm auto }`) e cada folha extra reimprimia o cupom inteiro de novo. Corrigido trocando pra `position: absolute`.
- **`impressoras-tab.tsx`:** card duplicado — "Impressora de Cozinha" (só rede, como antes) e "Impressora do Caixa" (seletor Rede/USB local, mostra os campos certos conforme o tipo escolhido).
**Status:** aplicado — `tsc --noEmit`, `next lint` e `next build` de produção limpos. **Sem banco Postgres local acessível nesta sessão** (mesmo gotcha WSL/Docker Desktop já registrado no Índice para a migration de 2026-08-04) — a migration foi escrita manualmente (mesmo formato das geradas pelo Prisma), validada com `prisma validate`/`prisma generate` (sem tocar em banco), e só testada de fato contra um banco real no deploy em produção. Commits `b913ffa` (feature completa) + `0235b84` (republica `agente-impressao.zip` em `public/` com o agente/README novos). **Deploy confirmado em produção nesta sessão:** `docker compose up -d --build` rodado pelo cliente na VPS; migration aplicada no boot do container (confirmado consultando `_prisma_migrations` e a estrutura de `Order`/`Impressora` direto no Postgres via `psql` dentro do container `db` — nome de usuário do Postgres nesta VPS não é o "postgres" default, é customizado via `.env`, então o primeiro comando de verificação falhou com "role does not exist" até trocar pra usar as env vars do próprio container).
**Artefatos atualizados:** modelo-de-dados-jocley-lanchonete (`Order.contaSolicitada*`, `Impressora.tipo`/`compartilhamento`, `FilaImpressao.tipo`/`compartilhamento`, enums `PapelImpressora.CAIXA`/`TipoConexaoImpressora`, estados de `TableStatus`/`PaymentStatus` revisados), arquitetura-jocley-lanchonete (v1.34, Seções 1/3/4/5), requisitos-funcionais-jocley-lanchonete (RF-017 renomeado/restrito, RF-110/RF-116/RF-113/RF-114/RF-115 revisados, RF-044 corrigido, RF-117 a RF-122 novos, RN-059/RN-022 revisadas, RN-061 a RN-066 novas), indice-jocley-lanchonete (contagens, resumos, backlog).
**Observação — dois passos operacionais ficaram pendentes fora do alcance desta sessão (sem acesso ao PC do caixa):** (1) atualizar o `agente.js`/`README.md` no PC do caixa com a versão nova (publicada em `public/agente-impressao.zip`) e reiniciar o serviço; (2) compartilhar a impressora USB do caixa no Windows e cadastrar o nome do compartilhamento em Configurações → Impressoras → Impressora do Caixa. Sem esses dois passos, a segmentação de bebidas e a ficha de conta do "Fechar Comanda" ficam na fila sem imprimir de verdade — ver Índice (backlog). Também vale registrar: a correção do cupom duplicado (item 8) não pôde ser fisicamente validada nesta sessão por falta de impressora térmica real disponível — a correção se apoia em comportamento documentado de especificação CSS (mídia paginada + `position:fixed`), não em teste de impressão de fato; cliente deve confirmar visualmente após o deploy.

---

## 2026-09-05 — Ficha de pedido consolidada ("Confirmar Pedido") + retorno visível de impressão

**Motivo:** No mesmo dia do deploy da v1.34 (segmentação Cozinha/Caixa), o cliente reportou dois problemas do jeito como a impressão automática por item se comportava na prática:
1. "Pedido da mesa saiu picado, não em uma folha completa" — cada item lançado virava uma ficha própria; um pedido de 5 itens saía em 5 folhas separadas, em vez de uma só.
2. "Quando você lança o item, ele entra na impressão, mas o sistema não mostra que imprimiu — sai na impressora, mas o cara que está fazendo o lançamento acha que não foi." O lançamento (`POST /api/orders/[id]/items`) enfileirava a ficha `fire-and-forget`, sem nenhum retorno na tela — quem lançava não tinha como saber se tinha ido pra impressora ou não.

Os dois sintomas têm a mesma causa raiz: imprimir automaticamente, sozinho, no exato instante de cada `POST /items`, sem agrupar nem avisar nada.

**Decisão:** trocar a impressão automática-por-item por uma ação explícita — **"Confirmar Pedido"**. A atendente lança todos os itens da rodada e, quando terminar, aperta um botão que manda tudo pendente de uma vez, numa ficha só por destino (Cozinha e/ou Caixa), e a tela espera a confirmação do Agente antes de dizer "pronto". Resolve os dois problemas ao mesmo tempo: uma folha por rodada de pedido (não por item), e retorno visível de verdade (sucesso, falha ou "ainda na fila").

**Impacto:**
- **Schema:** `OrderItem.enviadoImpressaoEm DateTime?` (migration `20260905190000_add_enviado_impressao_em`) — `null` = ainda não incluído em nenhuma ficha.
- **`POST /api/orders/[id]/items`** perdeu o `void enfileirarFichaItem(...)` que disparava sozinho — agora só cria o item (fica `enviadoImpressaoEm=null`, "pendente de envio") e responde, sem tocar em impressão.
- **Novo `src/lib/impressao.ts`:** `renderFichaPedido()` (ficha com uma lista de itens, sem preço, título "PEDIDO - COZINHA"/"PEDIDO - BAR / BEBIDAS") e `aguardarConfirmacaoJob()` (helper de polling até ~12s, extraído da rota de "Testar impressão" e reaproveitado — antes a lógica de espera só existia lá).
- **Novo `POST /api/orders/[id]/confirmar-pedido`:** busca `OrderItem` com `enviadoImpressaoEm=null` da comanda, agrupa por destino (mesmo critério `enviaParaCozinha` de sempre), enfileira uma ficha consolidada por grupo não vazio, marca os itens enviados **assim que o job entra na fila** (não espera a impressão física — evita reenviar em dobro se o agente demorar), e só então aguarda a confirmação de todos os jobs em paralelo (não sequencial — o tempo total de espera não cresce com o número de destinos). Responde com o status por destino: `IMPRESSO`, `ERRO` (com o motivo) ou `PENDENTE` (agente não confirmou a tempo, mas o job continua na fila).
- **`comanda-itens.tsx`:** botão "Confirmar Pedido (N)" acima da lista de itens, com contagem de pendentes e desabilitado quando não há nada novo; mensagem de resultado por destino depois de enviar; bolinha ao lado do item que ainda não foi enviado.
- **Salvaguarda:** "Fechar Comanda" (`solicitar-conta`) e "Finalizar Comanda" (`close`) chamam o `confirmar-pedido` silenciosamente antes de prosseguir, caso reste item não confirmado — evita perder um pedido porque a atendente esqueceu de apertar o botão antes de sair da mesa.
- **`POST /api/kds/reimprimir { orderId }`** (botão "Reimprimir" do KDS) também passou a consolidar numa ficha só, em vez de uma por item — mesmo `renderFichaPedido`. O reenvio de **um item avulso** (`{ itemId }`) continua ficha própria, sem mudança (faz sentido reenviar só o que faltou).
**Status:** aplicado — `tsc --noEmit`, `next lint` e `next build` de produção limpos. **Sem banco Postgres local acessível nesta sessão** (mesmo gotcha WSL/Docker Desktop de sempre) — migration escrita manualmente, validada só com `prisma validate`/`prisma generate`. Commit `a0f664d` na `main`. **Deploy confirmado em produção**: `docker compose up -d --build` na VPS, log confirmou `Applying migration \`20260905190000_add_enviado_impressao_em\`` → `All migrations have been successfully applied` → `Ready in 219ms`, sem loop de restart.
**Artefatos atualizados:** modelo-de-dados-jocley-lanchonete (`OrderItem.enviadoImpressaoEm`), arquitetura-jocley-lanchonete (v1.35, fluxo de impressão na Seção 3 reescrito, Seção 1 revisada), requisitos-funcionais-jocley-lanchonete (RF-123/RF-124 novos, RF-110/RF-111/RF-120 revisados, RN-058 revisada, RN-067/RN-068 novas), indice-jocley-lanchonete (backlog e resumos).
**Observação:** não existe hoje um jeito de reenviar bebidas isoladamente se a ficha da Caixa falhar (o reenvio manual do KDS, `{itemId}`/`{orderId}`, é exclusivo de itens de Cozinha) — se o "Confirmar Pedido" falhar especificamente pro grupo Caixa, a única forma de tentar de novo é lançar mais um item na comanda (o que dispararia um novo "Confirmar Pedido" incluindo só o que ainda não foi marcado como enviado — os itens da falha anterior **já estão marcados como enviados** e não voltam sozinhos). Ficou registrado como lacuna conhecida, não como bug: resolver certo exigiria um botão de "reimprimir conta/bebidas" equivalente ao do KDS, fora do escopo pedido nesta sessão.

---

## 2026-09-05 — Correção de horário (fuso) e letra maior na ficha de pedido consolidada

**Motivo:** Cliente testou o "Confirmar Pedido" (v1.35) em produção e reportou dois problemas pequenos: o horário impresso na ficha saía errado, e pediu a letra do nome do item um pouco maior.
**Impacto:** Causa do horário: o container roda em UTC (sem `TZ` setado na imagem), e `Date.prototype.toLocaleTimeString("pt-BR")`/`toLocaleString("pt-BR")` sem a opção `timeZone` formatam usando o fuso do runtime, não o de Brasília — resultado: horário ~3h à frente do real. Esse mesmo padrão de risco (formatar data/hora sem fuso explícito no servidor) já tinha sido resolvido antes em `lib/periodo.ts` (ver comentário "sempre considerando o dia civil em America/Sao_Paulo"), mas `lib/impressao.ts` não seguia o mesmo cuidado. Corrigido com dois helpers novos (`formatarHorario`/`formatarDataHora`) que sempre passam `timeZone: "America/Sao_Paulo"`, usados nas 4 fichas que imprimem hora (ficha de produção avulsa, ficha de pedido consolidada, ficha de conta, cupom de teste). Letra maior: `renderFichaPedido` ganhou `p.setTextSize(2, 0)` no nome de cada item (altura 3x, largura normal — preserva quantos caracteres cabem por linha, pra não cortar nome de produto comprido no meio).
**Status:** aplicado — `tsc --noEmit`, `next lint` e `next build` limpos. Commit `8db0a27` na `main`. Deploy confirmado em produção (sem migration nova).
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.36).
**Observação:** vale conferir se outros lugares do sistema formatam data/hora no servidor sem `timeZone` explícito — o padrão correto já existe (`lib/periodo.ts`), só não tinha sido replicado em `lib/impressao.ts` até essa correção. Não foi feita uma varredura completa do resto do código nesta sessão.

---

## 2026-09-06 — Confirmação do Agente atualizado no PC do caixa (via Agendador de Tarefas) + correção de dados: bebidas cadastradas indo pra Cozinha

**Motivo:** Depois do deploy da v1.34/v1.35, o cliente reportou dois problemas na prática: (1) a impressora do Caixa (USB local) não estava imprimindo — precisava confirmar se o Agente no PC do caixa já era a versão nova; (2) ao lançar "Amstel" (uma cerveja) e depois outras bebidas, a ficha saía na Cozinha em vez do Caixa.
**Impacto:**
- **Agente:** troubleshooting ao vivo confirmou que esse PC do caixa específico foi configurado com a **Opção A do runbook (Agendador de Tarefas)**, não com a Opção B (serviço `nssm`) — não existe `nssm.exe` na pasta do agente. Tentar rodar `nssm stop/start` nesse PC dá `"nssm" não é reconhecido` (comando não existe fora da pasta onde o `.exe` está, e aqui ele nem existe). Reiniciar corretamente é via **Agendador de Tarefas** (`taskschd.msc`) → localizar a tarefa → "Finalizar" → "Executar". Depois de baixar `agente-impressao.zip` atualizado, substituir os arquivos e reiniciar pelo Agendador, o Agente passou a responder "online" e a impressora do Caixa (USB local) imprimiu o teste com sucesso.
- **Dados — bebidas mal cadastradas:** investigação direta no banco de produção (`SELECT categoria, nome, "enviaParaCozinha" FROM "Product"`) encontrou **12 produtos** que são bebida mas estavam com `enviaParaCozinha=true` (o default de todo produto novo, ver RN-046 em requisitos-funcionais) — por isso a ficha saía na Cozinha: `Água`, `caipirinha vodka`, `Coca-Cola`, `Coca Zero`, `Fanta Laranja`, `Guaraná`, `Guaraná Zero`, `Heineken`, `Original` (categoria Bebidas) e `Balde de Original`, `Fanta uva`, `suco` (esses três cadastrados até na categoria errada — "Espetinhos Assados" em vez de "Bebidas", mas o que causava o problema de impressão era só o campo). Corrigido via `UPDATE "Product" SET "enviaParaCozinha" = false WHERE (categoria, nome) IN (...)` direto no Postgres de produção — **não é bug de código**, o roteamento (RF-110/RN-064) sempre funcionou certo a partir do campo; o problema era o cadastro desses produtos específicos nunca ter desmarcado a opção.
**Status:** aplicado direto em produção (correção de dados, sem deploy de código). Confirmado por nova consulta filtrando `enviaParaCozinha=false` mostrando os 12 produtos corrigidos junto com os que já estavam certos.
**Artefatos atualizados:** indice-jocley-lanchonete (backlog do agente marcado como resolvido), playbook-devops-jocley-lanchonete (nota sobre esse PC usar Agendador, não nssm).
**Observação:** ficou uma limitação conhecida, não resolvida — **"Combo Batata + Refrigerante"** (categoria Outros) é um produto único que mistura item de cozinha (batata) e de bar (refrigerante); como `enviaParaCozinha` é um campo só por produto, o combo inteiro vai pra Cozinha e o refrigerante não avisa o Caixa. Resolver direito exigiria cadastrar os dois como itens separados no cardápio (decisão do cliente, não uma correção de dado como as demais) — cliente optou por não mexer por enquanto. Vale também, pra prevenir recorrência: sempre que cadastrar uma bebida nova em Produtos, lembrar de desmarcar "Enviar para a cozinha" — o campo nasce marcado por padrão (RN-046) e não há validação/alerta automático hoje pra pegar esse esquecimento por categoria.

---

## 2026-09-06 — Visual "fast-food ticket" (estilo McDonald's) nas fichas ESC/POS

**Motivo:** Cliente testou as fichas impressas (Cozinha e Caixa) e reportou que "a letra não tá saindo legal" — pediu formatação e tamanho de letra no estilo das redes de fast-food (referência explícita: McDonald's).
**Impacto:** Redesenhado o visual das 4 fichas ESC/POS em `src/lib/impressao.ts` de forma consistente:
- Nome do item: negrito + CAIXA ALTA + altura ampliada (~3x) via novo helper `imprimirNomeItem()`.
- Títulos ("PEDIDO - COZINHA" etc.): altura ~2x (antes usava `setTextDoubleHeight()`, trocado por `setTextSize(2, 0)` explícito pra manter o padrão único em todas as fichas).
- Divisórias fortes (`drawLine("=")`) separando cabeçalho/rodapé; leves (`drawLine()`, traço) entre itens na ficha de pedido consolidada.
- TOTAL da ficha de conta também maior e em negrito.
- Observações em CAIXA ALTA.
**Decisão técnica (para não repetir o erro em ajustes futuros):** ampliar só a **altura** do texto (`setTextSize(altura, 0)`), nunca a largura. A biblioteca `node-thermal-printer` calcula o preenchimento de espaços do `leftRight()` (usado pra alinhar preço à direita) e a quebra de linha do `println()`/`_fold()` sempre com base na largura configurada fixa (`COLUNAS = 42`) — ela não sabe que o texto ficou fisicamente mais largo se a magnificação de largura for aumentada, e o resultado seria preço desalinhado ou nome de produto cortado no meio da palavra. Ampliar só a altura não tem esse problema: cada caractere ocupa a mesma largura em pontos no papel, só fica mais alto — é seguro combinar com `leftRight()` sem recalcular nada.
**Status:** aplicado — `tsc --noEmit`, `next lint` e `next build` limpos. Commit `77a3025` na `main`. Deploy confirmado (sem migration nova). **Validação física ainda pendente** — cliente disse que vai testar depois; sem impressora térmica real disponível no ambiente de trabalho pra conferir o resultado visual de fato.
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.37).
**Observação:** essa é a segunda rodada de ajuste fino nas fichas do "Confirmar Pedido" (a primeira foi a correção de fuso/tamanho em 2026-09-05, v1.36) — reforça que o formato físico da impressão só se valida de verdade com a impressora real na mão do cliente, não dá pra acertar de primeira só olhando o código.

---

## 2026-09-06 — Mesas e categorias configuráveis em Configurações + autorização de API por permissão (não mais por papel)

**Motivo:** Pedido direto do cliente, três partes: (1) poder criar mais mesas e mais categorias do cardápio pela tela de Configurações (antes as 12 mesas vinham só do seed e as 7 categorias eram uma constante fixa em código); (2) as categorias oferecidas ao cadastrar um produto tinham que ser exatamente as mesmas usadas para agrupar o cardápio em Mesas/Balcão; (3) ao cadastrar um produto numa categoria "sem preparo" (ex.: Bebidas), o campo "Enviar para a cozinha" já vir desmarcado. Num segundo momento, o cliente reforçou o princípio: **"as funcionalidades e botões devem aparecer os mesmos para todos, desde que a pessoa tenha a permissão"** — ou seja, a autorização real de cada ação tem que seguir a permissão granular, não o papel.

**Decisões:**
- **Categorias moram em `ConfiguracaoGeral`, sem migration.** Nova chave `categorias_cardapio` guardando um JSON `[{nome, vaiParaCozinha}]`. `src/lib/categorias.ts` centraliza o parse/serialize e o fallback para a lista padrão (as 7 de sempre, com `Bebidas`/`Insumos` já como `vaiParaCozinha=false`). `Product.categoria` continua `String` livre — nada de FK nem tabela nova. Escolha deliberada: não havia banco Postgres local nesta sessão (gotcha WSL/Docker de sempre) e o padrão `ConfiguracaoGeral` já existia para o telefone do WhatsApp.
- **Mesa vira CRUD.** `POST /api/tables` (cria com o próximo número livre) e `DELETE /api/tables/[id]` (bloqueia se a mesa não está `LIVRE` ou tem comanda `PENDENTE`; comandas já fechadas são **desvinculadas**, `mesaId=null`, para preservar histórico em vez de apagar).
- **Autorização de API passa a ser por permissão granular.** Novos guards em `src/lib/api-guard.ts`: `guardPermissao(chave)` e `guardPermissaoQualquer(chaves[])` — equivalente de API ao `requirePermissao()` das páginas (ADMIN sempre passa; qualquer outro passa se tiver a chave, seja pelo padrão do papel ou por override do ADMIN). `guardGestor()` e `guardAdmin()` (checagem por papel) **removidos** e trocados em todas as rotas de gestão. `guardCaixa()` **mantido** — separação de função (atendente fecha, caixa finaliza), não é acesso a tela, e a UI já casa com ele. Os checks de `/api/users/*` (qual papel gerencia qual) e `/api/error-logs` (`devmaster`) também ficam como estão.

**Impacto:**
- **`src/lib/categorias.ts` (novo):** `CHAVE_CATEGORIAS_CARDAPIO`, tipo `CategoriaCardapio`, `CATEGORIAS_CARDAPIO_PADRAO`, `normalizarCategorias()` (trim + dedupe case-insensitive), `parseCategorias()`, `serializeCategorias()`.
- **`GET/PUT /api/configuracoes/categorias` (novo):** GET sem guard (qualquer autenticado precisa da lista pra montar o cardápio); PUT com `guardPermissao("configuracoes.categorias")`, valida ≥1 categoria.
- **`src/app/api/tables/route.ts` + `[id]/route.ts`:** `POST`/`DELETE` novos com `guardPermissao("configuracoes.mesas")`.
- **`src/lib/permissions.ts`:** `PERMISSION_TREE` → subtópicos `configuracoes.mesas` e `configuracoes.categorias` (ADMIN por padrão; demais papéis por override).
- **`src/lib/api-guard.ts`:** `permissoesDoUsuario()` interno + `guardPermissao`/`guardPermissaoQualquer`; `guardGestor`/`guardAdmin` apagados.
- **Rotas migradas de papel → permissão:** `/api/products*` → `produtos`; `/api/ingredients*` (+ `/entrada`) → `estoque`; `/api/recipe-items` → `produtos` **ou** `cmv` (a ficha técnica abre tanto pelo Cardápio quanto pelo CMV); `/api/configuracoes/impressoras*` → `configuracoes.impressoras`; `/api/configuracoes/whatsapp*` → `configuracoes.notificacoes`; `/api/configuracoes/categorias` → `configuracoes.categorias`; `/api/tables*` → `configuracoes.mesas`; `/api/notas*` (era só ADMIN) → `notas`.
- **`configuracoes-content.tsx`:** duas abas novas — **Mesas** (`mesas-tab.tsx`: adicionar/remover, status de cada mesa) e **Categorias do Cardápio** (`categorias-tab.tsx`: CRUD da lista com o toggle "vai para a cozinha" por linha). Filtradas por `permissoes["configuracoes.mesas"|"configuracoes.categorias"]`.
- **`produto-form-dialog.tsx`:** o `<select>` de categoria vem de `useCategoriasCardapio()` (novo hook em `useAppData.ts`) — não mais da constante. Trocar de categoria já ajusta `enviaParaCozinha` para o padrão daquela categoria (Bebidas entra desmarcado), ainda editável na mão. Produto antigo cuja categoria saiu da lista continua aparecendo como opção.
- **`comanda-itens.tsx`:** os chips de categoria em Mesas/Balcão passam a seguir a ordem definida em Configurações (categorias com produto, na ordem configurada; sobras no fim).
**Status:** aplicado — `tsc --noEmit`, `next lint` e `next build` de produção limpos. **Sem migration** (categorias em `ConfiguracaoGeral`). Commit `d15ae54` na `main`. **Deploy ainda não confirmado nesta sessão** — sobe no próximo `docker compose up -d --build` da VPS; sem migration, não há passo de banco.
**Artefatos atualizados:** modelo-de-dados-jocley-lanchonete (`ConfiguracaoGeral` ganha `categorias_cardapio`; `Table.numero`/`status`, nota de permissões e `Product.categoria` revisados; tabela de acesso troca `guardGestor()` por `guardPermissao()` e ganha linhas `Table`/`ConfiguracaoGeral`), arquitetura-jocley-lanchonete (v1.38, Seção 5 de segurança reescrita + linha no Histórico de versão), requisitos-funcionais-jocley-lanchonete (RF-125 a RF-128 novos, RF-022 a RF-025/RF-092/RF-099 revisados, RN-012/RN-033/RN-046/RN-049 revisadas, RN-069 a RN-072 novas), indice-jocley-lanchonete (contagem de RFs → 131, resumos das 3 camadas, 3 itens de backlog).
**Observação:** `guardGestor` e `guardAdmin` sumiram do código — se algum PR futuro copiar esse padrão antigo de outra base, agora está errado: o padrão é `guardPermissao("<chave>")`. A separação atendente/caixa continua sendo a única coisa gated por papel puro (`guardCaixa`), de propósito. Categoria ainda é string livre no `Product` — remover uma categoria em uso não renomeia os produtos que a usavam (eles continuam com a string antiga e aparecem como opção "solta" no form). "Combo Batata + Refrigerante" (item de cozinha + bebida num produto só) segue como limitação conhecida — `enviaParaCozinha` é um flag por produto, não por item.

---

## 2026-09-06 — Nome do cliente no KDS + conta impressa no caixa ao Fechar Comanda, com retorno visível

**Motivo:** Cliente pediu, olhando a tela da Cozinha: (1) cada card do KDS mostrar o **número da mesa/comanda e o nome do cliente** (o card só mostrava "Mesa 5" / "Comanda #12"); (2) ao a atendente apertar "Fechar Comanda", a comanda completa **imprimir automaticamente no caixa** pra o caixa finalizar.
**Decisão:** O item (2) já era o comportamento desde a v1.34 (`POST /api/orders/[id]/solicitar-conta` enfileira `enfileirarFichaConta()` na impressora do Caixa via fila+Agente). O que faltava era **retorno**: a chamada era `void` (fire-and-forget) e a tela sempre dizia "Conta impressa no caixa" mesmo quando a ficha nem entrava na fila (sem impressora do Caixa cadastrada, agente offline, etc.). Então: manter o comportamento, mas **aguardar o enfileiramento** e devolver o resultado pra atendente.
**Impacto:**
- **`kds-board.tsx`:** `identificacaoPedido()` passou a concatenar `— <clienteNome>` quando houver; o header do card mostra Mesa/Comanda em negrito grande + nome do cliente em linha própria (âmbar, truncada), e a lista de "Concluídos" também usa a identificação completa.
- **`POST /api/orders/[id]/solicitar-conta`:** `void enfileirarFichaConta(...)` → `const impressao = await enfileirarFichaConta(...)`; a resposta agora inclui `impressao: { ok, erro }`.
- **`comanda-itens.tsx`:** `solicitarConta()` lê `data.impressao`; se `ok === false`, mostra um aviso âmbar ("Comanda fechada, mas <motivo> — avise o caixa") em vez da mensagem verde de sucesso, e segura o redirect um pouco mais pra dar tempo de ler.
**Status:** aplicado — `tsc --noEmit`, `next lint` e `next build` de produção limpos. Sem migration. Commit `3b8aa6a` na `main`. **Deploy ainda não confirmado nesta sessão.**
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.39 no Histórico de versão), requisitos-funcionais-jocley-lanchonete (RF-130 novo em Módulo 7, RF-131 novo em Módulo 2, RF-117 revisado), indice-jocley-lanchonete (resumo de Camada 1 + item de backlog de Camada 3/4).
**Observação:** a ficha de conta (`renderFichaConta`) já trazia o nome do cliente via `identificacaoPedido()` desde a v1.34 — a mudança aqui é só de tela (KDS) + de feedback (Fechar Comanda). A impressão física da conta continua dependendo de o PC do caixa ter o Agente rodando e uma `Impressora(papel=CAIXA, ativa)` cadastrada — o novo aviso é justamente pra tornar visível quando isso não está de pé.

---

## 2026-09-07 — Drill-down por horário no gráfico de Pico de Horário

**Motivo:** Cliente pediu que, no gráfico de Pico de Horário (Inteligência Financeira), fosse possível **clicar num horário** e ver o ticket médio daquele horário, quantas comandas e quais as formas de pagamento.
**Decisão:** Não criar rota nova nem segundo fetch — o endpoint de pico de horário já varre todas as comandas fechadas do período pra montar as barras; ele passou a devolver, **no mesmo passo**, o detalhe por hora (`ticketMedio`, `formasPagamento`). O drill-down no cliente é só estado de tela sobre a resposta que já veio. "Quantas pessoas" foi lido como **nº de comandas** (o sistema não conta pessoas por comanda).
**Impacto:**
- **`GET /api/inteligencia/pico-horario`:** cada bucket de hora agora carrega `ticketMedio` (receita ÷ comandas do horário) e `formasPagamento` (`[{forma, valor}]`, só as não-zero, ordenado desc) — calculado por hora com `receitaPorFormaPagamento()` (`src/lib/financeiro.ts`, já split-aware, o mesmo do Ranking de Formas, RF-049). Campos antigos (`hora`, `pedidos`, `receita`, `pico`) inalterados.
- **`pico-horario-chart.tsx`:** `onClick` do `BarChart` (via `activePayload[0].payload.hora`) define a hora selecionada; `<Cell>` por barra pinta a selecionada de dourado (`--color-brand-accent`) e esmaece as demais; painel de detalhe abaixo do gráfico com comandas / ticket médio / receita + barras de forma de pagamento (valor e %). Clicar de novo na mesma barra, ou no ×, fecha. Rótulo do pico trocado de "pedidos" para "comandas".
**Status:** aplicado — `tsc --noEmit`, `next lint` e `next build` de produção limpos. Sem migration. Commit `5371a17` na `main`. **Deploy ainda não confirmado nesta sessão.**
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.40 no Histórico de versão), requisitos-funcionais-jocley-lanchonete (RF-132 novo em Módulo 10, RF-051 revisado, RN-026 revisada), indice-jocley-lanchonete (contagem de RFs → 132, resumo de Camada 1).
**Observação:** o pico continua sendo agregado por `Order.createdAt` (hora de abertura da comanda), não `closedAt` — mantido como já era, faz mais sentido pra "quando enche"; o ticket médio do horário, portanto, é das comandas **abertas** naquela hora, ainda que fechadas depois.

## 2026-09-29 — Jantinha com escolha de espetos, observações, edição da ficha técnica, saúde do CMV e consumo nas Notas

**Motivo:** Pacote de 6 pedidos vindos da operação real: (1) ao lançar uma Jantinha, o PDV deve exigir a escolha exata dos espetos; (2) observação por item e na hora de lançar o pedido, impressa nas fichas; (3) alterar só a quantidade de um insumo da ficha técnica sem apagar/inserir de novo; (4) indicador de saúde do CMV + simulador de preço; (5) opcionais/observações em letra normal e recuados na impressão, sem espremer a ficha; (6) na tela de Notas, provar ao cliente o que foi consumido.
**Decisão:**
- **Espetos como grupo de opcionais "por categoria", não tabela nova.** `Product.opcionais` (JSON) ganhou a variante `{origem: "categoria", categoria, quantidade}` — mesmo lugar dos grupos de lista fixa, sem migration de schema pra isso. As opções são os produtos ativos da categoria (novo espeto aparece sozinho na Jantinha). Pode repetir o mesmo espeto. O servidor revalida (o `POST .../items` aceitava qualquer `opcionaisSel` até aqui).
- **Espetos separados em "Espetos Tradicionais" e "Espetos Premium"**, como no cardápio impresso (cliente confirmou). Feito por **migration de dados** (`20260929120100_espetos_tradicionais_premium`), porque em produção só roda `migrate deploy`, nunca o seed: recategoriza pelos nomes exatos do seed (só quem ainda está em "Espetinhos Assados"), acrescenta o grupo nas 4 Jantinhas sem apagar grupos existentes, e insere as duas categorias em `ConfiguracaoGeral` logo depois de "Espetinhos Assados". Idempotente. Seed e constante padrão atualizados pra bancos novos.
- **Os espetos escolhidos baixam estoque e entram no custo** (cliente confirmou): guardados em `OrderItem.componentes` (`[{productId, nome, quantidade}]`, por unidade). Sem isso o CMV da Jantinha ficava errado conforme o espeto. O `costPrice` **cadastrado** da Jantinha usa a **média** dos espetos da categoria (o espeto só é conhecido na venda); o `custoUnit` da venda usa o custo real do escolhido. Cascata de recálculo de um nível só (espeto → Jantinhas), pra não criar laço entre categorias.
- **Observação da comanda é uma só e fica na comanda** (`Order.observacoes`), reimpressa em todo "Confirmar Pedido" e na conta — escolhido com o cliente em vez de "observação por envio".
- **Saúde do CMV pelo CMV%, não pela margem.** Faixa saudável definida pelo cliente: **28%–35%** do faturamento. O simulador pede o **CMV-alvo** (preço = custo ÷ CMV%) e mostra a margem ao lado — a proposta original ("margem de 40%") pela fórmula antiga daria CMV de 60%, fora da faixa, então as duas medidas foram alinhadas na mesma língua. A tela `/cmv` foi alinhada: coluna CMV colorida pela faixa, e o preço sugerido passou de margem 65% para CMV 32% (meio da faixa).
- **Impressão:** fichas passam a receber opcionais e observação **separados** (`ItemFicha.opcionais[]`), em vez de tudo concatenado num texto só com " — ". Detalhes em tamanho normal e recuados; nome do item mantém a altura ~3x da v1.37.
**Impacto:**
- Schema: `Order.observacoes`, `OrderItem.componentes` (migration `20260929120000_add_observacoes_componentes`).
- `src/lib/opcionais.ts` (grupo por categoria, `linhasOpcionaisSelecionados`), `src/lib/cmv.ts` (custo com componentes, cascata, `custoUnitarioDoItem`), `src/lib/cmv-calc.ts` (saúde/simulador), `src/lib/impressao.ts` (`imprimirDetalhesItem`, `itemFichaDe`, observação da comanda), `POST .../items` (validação + componentes), `POST .../close` (baixa dos componentes), `PATCH /api/recipe-items` (novo), `PATCH /api/orders/[id]` (`observacoes`), `GET /api/notas` (itens da comanda), `products` POST/PATCH (recálculo).
- Telas: modal do PDV (+/- por espeto, observação do item), painel da comanda (observação), cadastro de produto ("Produtos de uma categoria"), ficha técnica (lápis, selo, simulador), `/cmv`, KDS, Notas (consumo expansível), cupom do caixa.
- Corrigidos de carona: reimpressão do KDS e ficha de conta não levavam os opcionais; nome comprido na conta colava no preço.
**Status:** aplicado — `tsc --noEmit` e `next lint` limpos; APIs testadas ponta a ponta num Postgres descartável (21 verificações, incl. validação dos espetos, custo, baixa de estoque, fichas decodificadas da fila, Notas); migrations aplicadas sobre banco no estado de produção e reaplicadas sem efeito. **Telas não abertas no navegador** — o `node_modules` da máquina foi instalado pelo WSL (binários nativos Linux: `lightningcss`, `esbuild`), `next dev` no Windows dá 500 em qualquer página. Commit `dad02cd` na `main`. **Deploy confirmado em produção em 2026-09-29** (migrations aplicadas no boot) — mas a migração de dados não encontrou os espetos em produção; ver a entrada de 2026-09-30.
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.41 + fluxos de lançamento, finalização e CMV), modelo-de-dados-jocley-lanchonete (`Order.observacoes`, `OrderItem.componentes`/`custoUnit`/`opcionaisSel`, `Product.opcionais`, regra de CMV), requisitos-funcionais-jocley-lanchonete (RF-133 a RF-140, RF-030/RF-031 revisados, RN-073 a RN-076), indice-jocley-lanchonete, playbook-devops-jocley-lanchonete.
**Observação:** a migration de dados só reconhece os espetos pelos **nomes do seed** ("Espeto de Carne", "Espeto de Medalhão de Carne"...). Espeto renomeado em produção fica em "Espetinhos Assados" e não aparece na Jantinha até trocar a categoria na tela de Produtos — conferir depois do deploy. "Espeto de Contrafilé" (R$ 12,00, fora do cardápio impresso) continua em "Espetinhos Assados" de propósito.

## 2026-09-30 — Correções de dados pós-deploy da v1.41: espetos na categoria "Espetos" + ajustes de cadastro

**Motivo:** A conferência no banco de produção depois do deploy da v1.41 mostrou: (1) os 16 espetos assados estavam na categoria **"Espetos"**, não em "Espetinhos Assados" (nome usado no seed e assumido pela migração `20260929120100`) — só 1 foi recategorizado, **"Espetos Tradicionais" ficou vazia e as Jantinhas de espetos tradicionais não podiam ser lançadas** (o modal exige a escolha exata e não havia opção); (2) cadastro divergente do cardápio: "Espeto de coração" (R$ 11,00) duplicando o "Espeto de Coração" (R$ 11,99), "Jantinha c/ 1 Espeto Premium" a R$ 14,54 (cardápio: R$ 27,99), "Espeto de Medalhão de Queijo Coalho" a R$ 9,99 (Premium no cardápio: R$ 11,99), 3 Jantinhas antigas sem escolha de espeto ("jantinha", "jantinha de 1 carne", "jantinha coração") e a categoria "Espetos" vazia em Configurações.
**Decisão:**
- **Correção por migration de dados, não por SQL manual na VPS** — mesmo caminho da v1.41 (em produção só roda `migrate deploy`), fica versionada e reproduzível.
- **Classificação pelos nomes do cardápio impresso, não pelo preço** — em produção os preços divergem do cardápio (ex.: Medalhão de Queijo Coalho a R$ 9,99, Premium no cardápio), então preço não separa Tradicional de Premium. Origem aceita: "Espetos" e "Espetinhos Assados".
- **Ajustes de cadastro autorizados pelo cliente ("pode ajustar tudo isso que você viu")**, cada UPDATE condicionado ao estado exato observado (ex.: `WHERE preco = 14.54`), pra não sobrescrever correção manual feita antes do deploy. Nada apagado — produto sai de uso por `ativo=false` (reversível em Produtos; histórico de venda intacto). Entre os dois corações, ficou o que bate com nome e preço do cardápio.
- **Não alterados, de propósito (resolvido depois na v1.43, mesma data — cliente pediu alinhar ao cardápio):** os outros preços que divergem do cardápio (Espeto de Carne R$ 11,00 vs R$ 10,99; Pão de Alho e Queijo Coalho R$ 9,99 vs R$ 10,99; Medalhões de Carne/Frango/Provolone R$ 12,50 vs R$ 11,99) — podem ser reajuste deliberado; ficam para o cliente decidir. "Espeto de picanha" (R$ 20, fora do cardápio) segue avulso em "Espetinhos Assados", fora das Jantinhas.
**Impacto:** migrations `20260930120000_espetos_categoria_espetos` (commit `f74be13`) e `20260930130000_ajustes_cardapio_espetos` (commit `5cd0f40`). Sem mudança de código nem de schema.
**Status:** aplicado e **deploy confirmado em produção em 2026-09-30** — conferido no banco: Espetos Tradicionais 7, Espetos Premium 9 ativos, "Espeto de coração" e Jantinhas antigas com `ativo=false`, preços novos gravados. As duas migrations foram testadas antes num Postgres descartável com as linhas reais de produção (colhidas via `SELECT` na VPS) e reaplicadas sem efeito.
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.41 com deploy confirmado + v1.42), indice-jocley-lanchonete (backlog), playbook-devops-jocley-lanchonete (lição sobre migration de dados).
**Observação (lição):** migration de dados que localiza registros por categoria/nome **não pode assumir o estado do seed** — produção é editada à mão pelo cliente (categorias renomeadas, produtos duplicados, preços reajustados). Antes de escrever uma, colher o estado real com um `SELECT` na VPS e montar o teste com essas linhas.

## 2026-09-30 — Preço de venda avulsa dos espetos alinhado ao cardápio impresso

**Motivo:** Depois das correções da v1.42, ficaram espetos com preço diferente do cardápio impresso (Espeto de Carne R$ 11,00; Pão de Alho e Queijo Coalho R$ 9,99; Medalhões de Carne, Frango e Provolone R$ 12,50). Na v1.42 não foram alterados porque podiam ser reajuste deliberado; o cliente decidiu: "ajusta os preços dos espetos conforme o cardápio".
**Decisão:** Migration de dados (mesmo caminho das anteriores — em produção só roda `migrate deploy`) que põe **todos** os espetos do cardápio no preço impresso — Tradicionais R$ 10,99, Premium R$ 11,99 —, identificados pelo nome, só ativos (`preco <> alvo` torna idempotente). Aqui **não** se condicionou ao preço observado, ao contrário da v1.42: o pedido é explícito ("conforme o cardápio"), então o cardápio é a fonte de verdade.
**Impacto:** migration `20260930140000_precos_espetos_cardapio` (commit `c5be707`). Só `Product.preco` da venda avulsa; Jantinhas têm preço próprio e não mudam; itens já lançados mantêm o `precoUnit` do momento (RN-009).
**Status:** aplicado e **deploy confirmado em produção em 2026-09-30** — conferido no banco: Espetos Tradicionais R$ 10,99 × 7, Espetos Premium R$ 11,99 × 9 (ativos).
**Artefatos atualizados:** arquitetura-jocley-lanchonete (v1.43), indice-jocley-lanchonete (pendência de preços resolvida).
