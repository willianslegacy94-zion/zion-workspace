---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-08-07
owner: willians
---

# Registro de Decisões — Jocley Grill

> Referência: [[prd-jocley-lanchonete]] | [[requisitos-funcionais-jocley-lanchonete]] | [[arquitetura-jocley-lanchonete]]

Memória viva do sistema. Registra o que mudou, por que mudou e o que isso significa.
Entradas em ordem cronológica crescente — as mais recentes no final.

---

## 2026-07-29 — Criação do sistema (schema inicial + bootstrap)

**Motivo:** Cliente pediu um sistema para lanchonete (bebidas, lanches, espetos de churrasco) reaproveitando explicitamente o layout do vilamill-sistema (dashboard financeiro, cores claras) e a estrutura de menu/inteligência financeira do sistema-thieco, em vez de desenhar do zero.
**Impacto:** Projeto `lanchonete-sistema` criado em `orbita-workspace`, ao lado dos dois sistemas de referência. Stack definida: Next.js 15 + Prisma + PostgreSQL + NextAuth v5 + SWR + Docker (mesma base do vilamill). Schema inicial completo: User/UserRole (ADMIN/CAIXA/COZINHA nesta primeira versão), Table, Order/OrderItem (com `tipo` MESA/BALCAO desde o início, diferente do vilamill que só tem mesas), ContadorComanda, Product/Ingredient/RecipeItem, MovimentacaoEstoque, Despesa (já nascendo com campos de recorrência), Funcionario/Feedback/PlanoAcao/Sugestao, TaxaPagamento, ConfiguracaoNotificacao, ConfiguracaoGeral. Seed com 3 usuários (admin/caixa/cozinha), 12 mesas, taxas de pagamento default, produtos de exemplo com ficha técnica completa (X-Burguer, Espetos, Refrigerante).
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

**Motivo:** Cliente enviou uma peça de cardápio pronta (imagem) com a marca "Jocley Grill — BBQ & Espetos", diferente do nome usado até então no sistema ("Jocley Lanchonete"). Pediu explicitamente para alterar o nome do sistema. Em seguida, pediu para versionar o projeto em Git próprio (padrão vilamill-sistema/orbita-lobo), já sinalizando que o monorepo `orbita-workspace` "está muito bagunçado" e será reorganizado depois.
**Impacto:** Constante `NOME_LANCHONETE` (`src/lib/constants.ts`) alterada — reflete em toda a UI (login, sidebar, navbar, cupom térmico, KDS, DRE) sem tocar identificadores internos (nome do pacote npm, nome do banco `jocley_lanchonete`, containers Docker — permanecem como estavam, por não serem visíveis ao usuário e por risco desnecessário de renomear infraestrutura em funcionamento). `git init` na pasta `lanchonete-sistema` (branch `main`, commit inicial com os 141 arquivos do projeto, `.env`/`node_modules`/`.next` corretamente ignorados) — projeto deixa de ser uma pasta solta sem versionamento dentro do `orbita-workspace` e passa a ser um repositório independente, no mesmo padrão de `vilamill-sistema`.
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
**Observação:** Push feito sem o agente `@devops` de fato disponível na sessão (mesma limitação já registrada em 2026-07-30 — este projeto não roda dentro do framework AIOX) — um agente genérico foi instruído a adotar a persona/processo do Gage (ler `devops.md`, rodar quality gate `tsc`+`lint`, `git push` sem force) como substituto funcional, com confirmação explícita do cliente antes de cada push. Ver Playbook DevOps (`kernel-hq-arquitetura`) para o detalhe operacional completo, incluindo a descoberta de que o diretório de deploy na VPS é `/opt/lanchonete-sistema` (via `docker inspect ... com.docker.compose.project.working_dir`) e que o `Dockerfile` já roda `prisma migrate deploy` sozinho no boot do container, sem passo manual de migration.

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
**Impacto:** `docker-compose.yml`, `scripts/dev.js` (`DB_PORT`) e `.env`/`.env.example` atualizados juntos para o novo default `5436` — escolhido por não colidir com nenhum sistema do workspace na varredura feita (thieco=5432, vilamill=5433, lane-confeitaria=5434, kernel=5435, kernelmei=5438, kernel-foodservice=5440, kernel-academia=5441). Porta da VPS (`5435`, definida só no `.env` de produção) não foi alterada — é específica daquele ambiente e não colide lá hoje.
**Status:** aplicado, não testado subindo o container de novo nesta sessão (mudança de configuração, sem lógica de aplicação envolvida).
**Artefatos atualizados:** nenhum RF/RN — mudança de infraestrutura local, não de comportamento do produto.
