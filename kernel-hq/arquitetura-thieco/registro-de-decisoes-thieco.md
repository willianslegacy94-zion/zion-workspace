---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-08-07 (rev 9)
owner: willians
---

# Registro de Decisões — Sistema de Caixa Barbearia Thieco Leandro

> Referência: [[prd-thieco]] | [[requisitos-funcionais-thieco]] | [[arquitetura-thieco]]

Memória viva do sistema. Registra o que mudou, por que mudou e o que isso significa.
Entradas em ordem cronológica crescente — as mais recentes no final.

---

## 2024 — Criação inicial do sistema

**Motivo:** Controle financeiro manual não escala. Dois barbeiros, duas unidades, cálculo de comissão diário feito à mão.
**Impacto:** Criação das entidades base: profissionais, vendas, gastos. Stack definida (Node.js + Express + PostgreSQL + Docker + React + Nginx).
**Status:** aplicado
**Artefatos atualizados:** arquitetura-thieco, modelo-de-dados-thieco
**Observação:** Importação histórica realizada com 8.580 vendas de 2024. Flag `importado = true` para identificar dados legados vs. dados do sistema.

---

## 2025 — Adição da unidade Mutinga

**Motivo:** Abertura de segunda unidade com operação independente mas relatórios consolidados.
**Impacto:** Criação do ENUM `unidade_enum ('tambore', 'mutinga')`. Todas as entidades que dependem de unidade passaram a exigir esse campo. Profissionais Igor Hidalgo e Kauã dos Santos adicionados com vínculo à Mutinga.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco, requisitos-funcionais-thieco
**Observação:** Tambore e Mutinga têm estruturas de custo e taxas distintas — design com `unidade` em todas as tabelas principais foi a decisão correta.

---

## 2025 — Taxas PagBank diferenciadas por bandeira de cartão (Mutinga)

**Motivo:** A unidade Mutinga opera com condições de maquininha diferentes da Tambore. Visa/Mastercard têm taxas menores que outras bandeiras.
**Impacto:** Adição do campo `bandeira_cartao` na tabela de vendas. Função `calcularValorLiquido()` expandida para tratar Mutinga com lógica diferente de Tambore.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco, requisitos-funcionais-thieco (RN-004)
**Observação:** Tambore usa taxa flat por forma de pagamento. Mutinga usa taxa por bandeira apenas para débito e crédito. A lógica foi encapsulada em uma função para evitar duplicação.

---

## 2026-04 — Separação de comissão por tipo de item (serviço vs. produto)

**Motivo:** Produtos físicos vendidos na barbearia (pomadas, shampoos) não devem comissionar no mesmo percentual que serviços. 40% sobre produto físico era desproporcional.
**Impacto:** Adição das colunas `comissao_servico` e `comissao_produto` na tabela de vendas. Adição do campo `tipo_item ('servico' | 'produto')`. Novo comissionamento: serviço = 40% do bruto, produto = 10% do bruto. Backfill executado na inicialização para dados históricos.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco, requisitos-funcionais-thieco (RF-005, RF-006, RN-005)
**Observação:** A coluna `comissao` foi mantida como total (soma de serviço + produto) para compatibilidade com relatórios existentes.

---

## 2026-04 — Catálogo como referência para classificação de produto físico

**Motivo:** A distinção serviço/produto não podia depender de digitação manual do operador — risco de inconsistência. O catálogo com `controla_estoque = true` passou a ser a fonte de verdade.
**Impacto:** Backfill automático na inicialização: vendas com `servico` correspondente a item do catálogo com `controla_estoque = true` têm `tipo_item` corrigido para 'produto'. Produto físico excluído do ranking de serviços e do bloco de upsell.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (RF-021, RF-022, RN-007)
**Observação:** Backfill é idempotente — pode rodar múltiplas vezes na inicialização sem efeito colateral. Decisão de manter no startup garante que novos itens do catálogo sejam retroativamente corrigidos.

---

## 2026-04 — Comanda com upsell (itens adicionais vinculados)

**Motivo:** Um atendimento frequentemente inclui serviço principal + produto adicional vendido durante o atendimento. Sem vínculo entre eles, o relatório de "upsell" não era possível.
**Impacto:** Adição de `venda_origem_id` (FK auto-referencial) e campo `upsell` (boolean). Item filho vincula ao item pai. Backfill: todo item com `venda_origem_id NOT NULL` recebe `upsell = true`.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco, requisitos-funcionais-thieco (RF-008)
**Observação:** Produto físico não aparece como sugestão de upsell — apenas serviços. Lógica de exclusão garantida pela regra RN-007.

---

## 2026-05 — Correção: Thieco Leandro com comissão zero na inicialização

**Motivo:** Profissional com encoding corrompido na inicialização estava sendo inserido com nome inválido, e a correção de percentual_comissao=0 não era aplicada.
**Impacto:** Adição de `ADD_UNIQUE_PROF_NOME` e `UPDATE_THIECO_COMISSAO_ZERO` no processo de inicialização. UNIQUE constraint em `nome` para evitar duplicatas. Correção aplicada pelo nome exato após SEED.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco (constraint UNIQUE em profissionais.nome)
**Observação:** O dono (Thieco Leandro) não deve receber comissão — percentual_comissao = 0 é uma regra de negócio permanente, não uma configuração temporária.

---

## 2026-05 — Registro de vendas habilitado nos logins individuais dos barbeiros (Kauã e Igor)

**Motivo:** Barbeiros da unidade Mutinga precisavam registrar suas próprias vendas diretamente no login individual, sem depender do login operador (mutinga). A tela de Registro da Barbearia Thieco já existia para admin e operador; foi estendida para o role `barbeiro`.
**Impacto:**
- Backend: `POST /vendas` e `POST /combos/uso` e `POST /combos/ativar` passaram a aceitar o role `barbeiro`. Barbeiro tem `profissional_id` e `unidade` forçados pelo JWT — nunca pode registrar para outro profissional ou unidade diferente da sua.
- Frontend `MeuPainel.jsx`: adicionadas abas de navegação "Registro" / "Painel" no header. O componente `RegistroVenda` é renderizado na aba Registro.
- Frontend `RegistroVenda.jsx`: quando `user.role === 'barbeiro'`, o seletor de barbeiro é ocultado e `profissional_id` é auto-preenchido a partir do JWT. Todos os campos, cálculos e fluxos (produto, upsell, combos, taxas Mutinga, bandeira de cartão) permanecem idênticos ao fluxo do admin — sem exceção.
- Regras de negócio preservadas: taxa por bandeira de cartão Mutinga (RN-004), comissão por tipo de item serviço/produto (RN-005), comissão zero de Thieco Leandro (RN-006), catálogo como fonte de verdade para tipo_item (RN-007).
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (módulos auth e vendas), ux-flows-thieco (fluxo de barbeiro)
**Observação:** A configuração é baseada em role (`barbeiro`) — qualquer novo login de barbeiro criado com esse role herdará automaticamente a mesma interface (Registro + Painel). Nenhuma configuração adicional necessária por barbeiro.

## 2026-05 — Correção de encoding UTF-8 no decode do JWT (nome do barbeiro)

**Motivo:** Nomes com caracteres especiais (ex: Kauã) eram exibidos como `KauÃ£` na interface do barbeiro. O `atob()` nativo do browser decodifica base64 como Latin-1 — os bytes `\xC3\xA3` (ã em UTF-8) eram interpretados como dois caracteres Latin-1 (`Ã` + `£`), gerando double-encoding.
**Impacto:** Substituição da linha de decode em `AuthContext.jsx`:
- Antes: `JSON.parse(atob(padded))`
- Depois: `JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0))))`
**Status:** aplicado
**Artefatos atualizados:** —
**Observação:** O JWT em si estava correto (bytes UTF-8 válidos). O problema era exclusivamente na leitura no frontend. A correção afeta todos os usuários com acentos no nome — não apenas Kauã.

## 2026-05-29 — Produto na Aba Combos e correção de contabilização de uso

**Motivo:** A aba Combos não oferecia campo de produto — o operador precisava sair para a aba Venda para registrar qualquer produto comprado junto ao atendimento do combo. Além disso, o fluxo de "Registrar Uso" criava uma venda financeira com o valor integral do combo a cada atendimento, duplicando a receita já registrada na ativação do pacote.
**Impacto:**
- Backend `POST /combos/uso`: removida a inserção de venda de serviço. O uso do combo (atendimento em dia de validade) é cortesia — o valor já foi registrado na ativação. Nenhuma venda de serviço é criada neste endpoint. Validadores `valor`, `forma_pagamento` e `bandeira_cartao` removidos da rota.
- Frontend `RegistroVenda.jsx` — AbaCombo: adicionado campo Produto com autocomplete idêntico ao da aba Venda (filtra `controla_estoque = true`), preço automático ao selecionar, campo de quantidade e seção de pagamento completa com split. A seção de pagamento só aparece quando um produto é selecionado. Produto é registrado como venda separada (`upsell: true`, `tipo_item: 'produto'`) via `POST /vendas` — somente o valor do produto é contabilizado.
- Combo vencido: o formulário de ativação agora exibe abaixo do aviso de vencimento, com `novo_servico` e `novo_valor` pré-preenchidos a partir do plano anterior do cliente.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (RF-024, RF-025, novo RF-040, RF-041), modelo-de-dados-thieco (ciclo de vida Combo), arquitetura-thieco (fluxo de dados e histórico)
**Observação:** A regra de negócio agora é: combo ativo → serviço é cortesia, venda só para produto. Novo combo (ativação) → venda registrada com valor do plano + produto se houver. Isso elimina o double-count de receita que existia antes.

## 2026-05-29 — Aba Lançamentos no login do barbeiro com cards agrupados e edição

**Motivo:** Barbeiros precisavam de visibilidade e controle sobre os próprios lançamentos diretamente no login individual, sem depender do login operador. Além disso, atendimentos com múltiplos itens (serviço + produto + extra) geravam cards separados, dificultando a leitura.

**Impacto:**
- `MeuPainel.jsx`: adicionada aba "Lançamentos" entre "Registro" e "Painel" no header. Renderiza o componente `Lancamentos` quando selecionada.
- Backend `PATCH /vendas/:id`: liberado para role `barbeiro` com guard de segurança — barbeiro só pode editar vendas onde `profissional_id` coincide com o próprio JWT; tentativa de editar venda alheia retorna 403. Comissão e valor líquido são recalculados automaticamente ao salvar.
- `Lancamentos.jsx`: lançamentos do mesmo atendimento (vinculados via `venda_origem_id`) são agrupados em um único card expansível. Card fechado mostra nome do serviço principal, qtd de itens adicionais, data, cliente e total do grupo. Card aberto lista cada item individualmente com botão de editar e (para admin) excluir. Barbeiro não vê seletor de profissional nos filtros nem no modal de edição.

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (módulo auth, módulo vendas), arquitetura-thieco (histórico)
**Observação:** O agrupamento é determinístico via `venda_origem_id` — apenas filhos com pai presente na listagem são agrupados. Itens sem pai (combos com produto, vendas avulsas) continuam como cards independentes.

## 2026-05-29 — Modal de edição de grupo com feedback visual por item

**Motivo:** O modal `ModalEditarGrupo` dependia do estado `sucesso` do componente pai para exibir o feedback de "salvo" no botão — a propagação via props causava inconsistência de timing e o botão não atualizava visualmente após salvar.

**Impacto:**
- `ModalEditarGrupo` passou a gerenciar estado local independente: `salvandoId` (qual item está salvando), `salvoIds` (quais itens foram salvos com sucesso) e `erros` (erro inline por item).
- Botão de salvar de cada item no modal exibe spinner + "Salvando…" durante a operação, e fica verde + "✓ Salvo!" por 2,5 segundos após sucesso — feedback isolado por item, sem interferir nos demais.
- `salvarItemGrupo` no componente pai foi simplificado: apenas atualiza o estado de `vendas` e relança o erro para o modal capturar inline.
- Observação tornou-se obrigatória (`required`) em todos os formulários de edição (modal simples e modal de grupo).
- Botões de editar removidos dos itens expandidos dentro do card agrupado — único ponto de entrada para edição é o lápis no card pai, que abre o modal com todos os itens do atendimento.

**Status:** aplicado
**Artefatos atualizados:** arquitetura-thieco (histórico)
**Observação:** O padrão estado-local-por-modal passou a ser a referência para qualquer novo modal com operações assíncronas — evita dependência de estado do pai e garante feedback previsível.

## 2026-05-29 — DRE exporta lançamentos e despesas individuais com filtros completos

**Motivo:** O botão "Extrair DRE" na aba Inteligência Financeira gerava um documento apenas com dados agregados (receitas por serviço, comissões por profissional, gastos por categoria). Não havia listagem individual de lançamentos nem de despesas, e o usuário precisava de um documento completo que espelhasse tudo o que o sistema registra no período/unidade filtrados.

**Impacto:**
- Backend `GET /relatorios/dre`: adicionadas 3 novas queries ao endpoint:
  - `lancamentos` — todas as vendas (serviços e produtos) linha a linha, com barbeiro, tipo, cliente, valor, desconto, comissão, forma de pagamento e observação; respeitam filtros de data e unidade
  - `gastos_lista` — todas as despesas individuais com categoria, descrição, valor e observação; respeitam filtros de data e unidade
  - `resumo_diario` — entradas e saídas mescladas por data (qtd atendimentos, receita, gastos e saldo), equivalente ao `DetalhamentoDiario` da interface
- Frontend `buildDreHtml`: adicionadas 3 novas seções ao documento HTML exportado: **Resumo Dia a Dia**, **Lançamentos (Vendas)** e **Despesas**
- Todos os filtros (data início/fim e unidade) aplicados uniformemente em todas as seções — resumos agregados e detalhes individuais

**Status:** aplicado
**Artefatos atualizados:** arquitetura-thieco (fluxo de dados, histórico), requisitos-funcionais-thieco (RF-035)
**Observação:** Produtos (`tipo_item = 'produto'`) estão incluídos na listagem de lançamentos — a query não filtra por tipo, garantindo visibilidade completa do que foi registrado no período.

## 2026-06-02 — Meta da barbearia visível no painel do barbeiro + fix de isolamento de unidade

**Motivo:** Barbeiros visualizavam apenas a própria meta individual no painel. A meta coletiva da unidade (MetaUnidade) — definida pelo admin — não era exibida, impedindo que o barbeiro acompanhasse o progresso da barbearia como um todo. Adicionalmente, foi identificado que qualquer barbeiro podia consultar a meta de outra unidade passando `?unidade=X` na query, expondo dados entre unidades.

**Impacto:**
- Frontend `MeuPainel.jsx`: adicionado card "Meta da Barbearia" no painel do barbeiro (aba Painel), posicionado entre o card de meta individual e os cards de Ticket Médio/Top Serviços. O card exibe: barra de progresso geral (realizado / valor_global com gradiente dourado), pisos Bronze/Prata/Ouro com barra individual por nível e tick ✓ ao atingir, badge de nível atual idêntico ao da meta individual, texto dinâmico "Faltam R$ X para atingir [Prata/Ouro]". Estado vazio exibido quando nenhuma meta de unidade foi cadastrada para o mês corrente.
- Frontend `api.js`: adicionado `progressoMetaUnidade` ao namespace `api.painelBarbeiro` — chama o endpoint `/metas-unidade/progresso` sem parâmetros (unidade resolvida via JWT no backend).
- Backend `routes/metas-unidade.js`: corrigido isolamento de unidade na rota `/progresso`. A lógica anterior permitia que roles diferentes de `operador` usassem `req.query.unidade` livremente — barbeiro podia passar `?unidade=tambore` e ver meta alheia. Fix: ambos os roles `operador` e `barbeiro` passam a usar exclusivamente `unidadeJwt` (ignorando query param); somente `admin` pode filtrar por unidade via query.

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (módulo Metas), arquitetura-thieco (segurança e histórico)
**Observação:** Não foi necessário criar novo endpoint — `/metas-unidade/progresso` já era protegido por `authenticate` e o token JWT do barbeiro carrega `unidade`. O card de unidade é agnóstico ao período filtrado no painel (Hoje/Mês/Período) — sempre exibe o progresso do mês corrente, pois as MetaUnidade são cadastradas por mês.

## 2026-06-02 — Importação histórica de Maio 2026 (Mutinga) via model do backend

**Motivo:** Dados de maio de 2026 existiam apenas na planilha `Controle de Vendas - 2026.xlsx` (aba MAIO-26). O sistema precisava refletir esses lançamentos no dashboard e DRE da produção.

**Problema encontrado — IDs de profissional divergem entre local e VPS:**
Scripts SQL gerados com IDs hardcoded do banco local (Igor=2, Kauã=11, Marcos=107) falhavam silenciosamente na VPS porque os IDs de produção são diferentes. A VPS tem: Thieco Leandro (1/tambore), Igor Hidalgo (2/mutinga), Marcos Fernandes (4/mutinga), Kauã dos Santos (11/mutinga), Kauã Soares (120/mutinga), Willians Santana (133/mutinga), Willians Dev Barbeiro (158/mutinga). Scripts SQL com IDs errados vinculavam registros ao profissional errado ou não inseriam nada — sem erro explícito.

**Problema encontrado — convenção de `valor` vs `desconto`:**
A coluna `valor` na tabela `vendas` representa o que o cliente efetivamente pagou (Valor C/Desc da planilha). A coluna `desconto` armazena o abatimento dado (Valor S/Desc − Valor C/Desc). Scripts que salvavam `valor = Valor S/Desc` (preço de tabela) e `desconto = 0` inflavam a `receita_bruta` no DRE (`SUM(valor)`), gerando faturamento errado no dashboard.

**Solução definitiva:**
Script Node.js auto-contido (`importar-maio-standalone.js`) executado DENTRO do container `thieco_api` via `docker exec`. O script usa `require('./models')` e `require('./db')` — mesmas funções do `POST /vendas` — e resolve profissional_id por nome no banco da própria VPS, sem hardcode. A unidade de cada registro é lida diretamente do campo `unidade` do profissional cadastrado.

**Impacto:**
- 438 registros inseridos para Maio 2026, unidade `mutinga`
- Faturamento bruto: R$ 20.513,53 (valor pago pelo cliente)
- Descontos concedidos: R$ 566,58
- Valor de tabela (sem desconto): R$ 21.080,11
- Comissões calculadas: R$ 7.966,10
- 38 cortesias (valor = 0, forma_pagamento = 'cortesia')

**Correção colateral — Nginx sem cache para API:**
Adicionados headers `Cache-Control: no-cache, no-store, must-revalidate` na location `/api/` do `nginx.conf` do container frontend. Sem esses headers o browser aplicava cache heurístico nas respostas da API e exibia dados antigos mesmo com o banco atualizado. Commit: `b8e88eb`.

**Regra de importação futura:**
Todo script de importação em lote deve: (1) rodar dentro do container `thieco_api`; (2) resolver profissional_id por nome via query ao banco da VPS; (3) usar `Venda.create()` do models.js; (4) mapear `valor = Valor C/Desc` e `desconto = Valor S/Desc − Valor C/Desc`.

**Status:** aplicado
**Artefatos atualizados:** infraestrutura-da-vps, modelo-de-dados-thieco
**Observação:** O arquivo `backend/importar-maio-standalone.js` e `backend/importar-maio-dados.json` ficam no repositório como referência para importações futuras de outros meses.

## 2026-06-05 — origem_venda em Combos, navegação completa do barbeiro e UX de tipo de contratação unificado

**Motivo:** O módulo de Combos não rastreava a origem da contratação (se era up-sell ou reativação), impedindo análise de padrão de compra. Além disso, o AppBarbeiro tinha navegação incompleta (sem aba de Relatório e Meta) e o seletor de tipo de contratação no RegistroVenda tinha múltiplas implementações dispersas.

**Impacto:**
- Banco: `ALTER TABLE combos` e `ALTER TABLE combos_contratados` adicionam coluna `origem_venda VARCHAR(20) CHECK (NULL | 'upsell' | 'reativacao')` — migration idempotente.
- Backend `POST /combos/ativar` e `POST /combos/contratar`: recebem e persistem `origem_venda`.
- Backend `GET /relatorios/resumo-operador`: liberado para role `barbeiro`; unidade fixada pelo JWT (não aceita query param).
- Logins genéricos `mutinga` e `tambore` desativados via migration (`UPDATE usuarios SET ativo=false WHERE username IN ('mutinga','tambore')`).
- Frontend `AppBarbeiro.jsx`: sidebar completa com 5 itens — Meu Painel, Registro, Lançamentos, Relatório e Meta.
- Frontend `RegistroVenda.jsx`: seletor de tipo de contratação unificado em 3 tabs horizontais [Cliente Novo | Up-sell | Reativação]. Lista de serviços no up-sell expandida para o catálogo completo. Inferência automática de crédito: serviços com "corte" ou "barba" no nome deduzem crédito; demais ficam sem desconto imediato.

**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco (coluna origem_venda em Combo), requisitos-funcionais-thieco (RF-023, RF-040, módulo auth), arquitetura-thieco (histórico)
**Observação:** Logins genéricos eram usados como acesso operacional compartilhado. Com logins individuais por barbeiro consolidados, esses logins foram desativados — não excluídos, preservando o histórico de sessões.

---

## 2026-06-05 — Fix: cálculo de comissão e valor_liquido ignorava qtd_clientes

**Motivo:** Vendas com `qtd_clientes > 1` (ex: pai + filho = 2, grupo = 3) calculavam comissão e taxa PagBank sobre o valor unitário, não sobre o valor total do atendimento. Barbeiro recebia comissão de apenas 1 cliente mesmo quando atendeu múltiplos.

**Impacto:**
- Backend `routes/vendas.js`: `valorTotal = valor × qtd_clientes` aplicado antes das chamadas a `calcularComissao()` e `calcularValorLiquido()`. O valor unitário e a quantidade continuam gravados separadamente no banco (`valor` e `qtd_clientes`) para exibição. A comissão e o `valor_liquido` armazenados agora refletem o total real do atendimento.

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (RN-016 adicionada), arquitetura-thieco (histórico)
**Observação:** Vendas históricas com `qtd_clientes > 1` têm comissão subregistrada. A correção é prospectiva — sem backfill para não alterar relatórios já fechados.

---

## 2026-06-05 — Fix: tipo_contratacao com estado neutro e toggle

**Motivo:** O campo `tipo_contratacao` em `RegistroVenda.jsx` iniciava pré-selecionado como 'Cliente Novo', forçando contexto mesmo quando o operador ainda não havia escolhido. O clique em aba já ativa não desmarcava, e o `useEffect` de busca de cliente sobrescrevia a seleção ao encontrar um cliente.

**Impacto:**
- `tipo_contratacao` inicia como `null` — nenhuma aba é destacada ao abrir o formulário.
- Toggle: clicar em aba já ativa desmarca e retorna ao estado neutro.
- `useEffect` de busca não força mais seleção ao localizar cliente existente.
- `origemVenda` derivada de `null` → campo não é enviado ao backend (omitido no payload).

**Status:** aplicado
**Artefatos atualizados:** —
**Observação:** Melhoria de UX sem impacto em regras de negócio ou banco de dados.

---

## 2026-06-05 — Metas diárias: cota individual dinâmica, card do barbeiro e importação via Markdown

**Motivo:** O sistema tinha metas mensais por profissional e por unidade, mas não metas por dia. Barbeiros precisavam saber qual era a meta da casa para o dia corrente e quanto já faturaram em relação a ela — sem depender de planilha externa.

**Impacto:**
- Banco: nova tabela `metas_diarias` (id, unidade, data, meta_total, created_at) com constraint UNIQUE em (unidade, data) e índices em data e unidade. Seed: 21 metas de junho/2026 para `mutinga` inseridas na inicialização.
- Backend `GET /metas-diarias/progresso`: retorna cota individual do barbeiro para a data corrente. A cota é calculada em tempo real: `meta_total_do_dia ÷ barbeiros_ativos_da_unidade` (conta profissionais com `ativo=true` vinculados a usuários com `role='barbeiro'` e `ativo=true`). Denominador mínimo = 1 (sem divisão por zero). Endpoint aceita `?data=YYYY-MM-DD` para consulta de outros dias.
- Backend `GET /metas-diarias/periodo`: lista todas as metas no intervalo (admin).
- Backend `POST /metas-diarias/bulk`: upsert em lote (admin) — recebe array de `{unidade, data, meta_total}`.
- Frontend `MeuPainel.jsx`: card "Meta do Dia" posicionado no topo do painel do barbeiro. Exibe `meta_individual` em destaque, barra de progresso com valor realizado no dia, percentual de atingimento. Clique abre modal com visão de todas as metas do mês (datas em dd-mm-yyyy).
- Frontend `GestaoMetasDiarias.jsx` (tela admin): parser de Markdown que detecta automaticamente o mês a partir do conteúdo colado, exibe preview antes de salvar e envia via `POST /metas-diarias/bulk`.
- Nginx `frontend/nginx.conf`: assets JS servidos com `Cache-Control: no-cache` para garantir que o browser carregue a versão atualizada após deploy.

**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco (entidade MetaDiaria), requisitos-funcionais-thieco (Módulo 8 — RF-045, RF-046, RF-047, RF-048, RN-017), arquitetura-thieco (histórico)
**Observação:** A cota dinâmica (divisão pelo nº de barbeiros ativos) é deliberada — se um barbeiro está de folga e não está ativo no sistema, a meta per capita dos demais sobe proporcionalmente. Isso evita que dias com equipe incompleta apareçam como meta impossível.

## 2026-06-18 — Painel do barbeiro expandido: fechamento do dia, módulo de débitos e separação atendimentos/serviços

**Motivo:** O painel do barbeiro exibia apenas um número único de "atendimentos" que misturava comandas e itens de upsell, gerando contagens infladas. Além disso, o barbeiro não tinha transparência sobre o fechamento de caixa diário nem sobre débitos internos (consumo de produto) registrados pelo admin.

**Impacto:**
- Banco: nova tabela `debitos_barbeiro` (id, profissional_id, descricao, valor, data, periodo, unidade, criado_por, criado_em). Nova coluna `custo_produto NUMERIC(10,2)` na tabela `vendas` — registra o custo interno do produto físico consumido no atendimento, separado do valor cobrado ao cliente.
- Backend `GET /painel-barbeiro/resumo`: query separada em `total_atendimentos` (`COUNT(DISTINCT COALESCE(venda_origem_id, id))` — comandas únicas) e `total_servicos` (`COUNT(*)` — itens totais), alinhada com a lógica de `relatorios.js`. Ticket médio calculado sobre comandas únicas.
- Backend `GET /painel-barbeiro/fechamento?data=YYYY-MM-DD`: novo endpoint para o barbeiro. Retorna detalhamento do dia — bruto, descontos, líquido, comissão e breakdown por forma de pagamento. Data padrão = hoje. Profissional_id fixado pelo JWT.
- Backend CRUD `/painel-barbeiro/debitos`: admin registra débitos (POST), lista por profissional/período (GET), exclui (DELETE). Barbeiro consulta os próprios débitos.
- Frontend `MeuPainel.jsx`: card duplo "Clientes / Serviços" substituiu o card único de atendimentos; card "Fechamento do Dia" com botão que abre modal de detalhamento; card "Débitos" listando descontos internos do mês.
- JWT: `percentual_comissao` adicionado ao payload — necessário para o cálculo de ganho estimado no frontend sem request adicional.

**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco (entidade DebitoBarbeiro, coluna custo_produto), requisitos-funcionais-thieco (RF-049, RF-050, RF-051, RF-052, Módulo 2)
**Observação:** `total_atendimentos` (comandas únicas) é a métrica primária de produção — a distinção em relação a `total_servicos` corrigiu divergência entre o painel do barbeiro e o DRE.

---

## 2026-06-18/19 — TASK-02B/02C: ganho estimado em tempo real no registro de venda

**Motivo:** Barbeiro não sabia quanto ia ganhar de comissão antes de confirmar um lançamento — precisava calcular manualmente ou aguardar o painel atualizar. A transparência no ato do registro melhora a motivação e reduz erros de digitação de valor.

**Impacto:**
- Backend `routes/auth.js`: `percentual_comissao` do profissional adicionado ao payload do JWT. O campo já existia na tabela `profissionais` — passou a ser incluído no token na geração do login.
- Frontend `RegistroVenda.jsx`: seção "Seu ganho estimado" exibida exclusivamente para `role = barbeiro`, posicionada no Resumo do Pedido. Cálculo em tempo real: `ganho_servicos = valor_servicos × (percentual_comissao / 100)` + `ganho_produtos = valor_produtos × (percentual_comissao / 100)`. Se `percentual_comissao = 0` (caso Thieco), ambos os campos retornam zero — sem exibição de comissão fictícia. Segmentação (TASK-02C): exibição separada de ganho por serviços e ganho por produtos, além do total.

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (RF-049 — Módulo 2)
**Observação:** O cálculo é estimado — não considera a taxa PagBank (que reduz o valor_liquido, mas não afeta a comissão, que incide sobre valor bruto). Apenas uma projeção visual; o valor gravado no banco pelo backend é sempre o autoritativo.

---

## 2026-06-20 — TASK-01B: fix comissões no Dashboard via SUM(comissao)

**Motivo:** O endpoint `GET /relatorios/fluxo-caixa` (que alimenta os cards de comissão do Dashboard principal) recalculava comissões com taxas fixas hardcoded (`CASE WHEN tipo_item = 'serviço' THEN valor * 0.40 ELSE valor * 0.10 END` × `percentual_comissao`), ignorando o valor real da coluna `comissao` gravado no banco. Atendimentos com comissão acumulada divergente do recálculo estático (ex.: R$ 36 em uma venda de R$ 45 por `qtd_clientes > 1`) geravam totais errados no Dashboard em comparação com o pop-up de auditoria de atendimentos.

**Impacto:**
- Backend `routes/relatorios.js` — endpoint `/fluxo-caixa`: substituição do `CASE WHEN + LEFT JOIN profissionais` por `SUM(comissao_servico)`, `SUM(comissao_produto)` e `SUM(comissao)` — espelhando o motor do `ModalAtendimentos.jsx` e do endpoint `/dre`.

**Status:** aplicado
**Artefatos atualizados:** —
**Observação:** A raiz do bug era a dualidade de motores de cálculo — frontend e DRE usavam `SUM(coluna)`, fluxo-caixa usava recálculo ad hoc. A decisão de sempre ler `comissao` do banco (nunca recalcular) passa a ser regra consolidada. O valor gravado na criação da venda é sempre o autoritativo.

---

## 2026-06-21 — TASK-14: expansão do catálogo de categorias de despesas

**Motivo:** O select de categoria no registro de gasto (`RegistroGasto.jsx`) não cobrecia despesas operacionais recorrentes da barbearia — contas de consumo (luz/água), tributos (Simples Nacional) e insumos de limpeza/café precisavam ser enquadradas em "outros", prejudicando a granularidade do DRE.

**Impacto:**
- Backend `routes/gastos.js`: array `CATEGORIAS` expandido de 6 para 9 entradas — adicionados `utilidades`, `impostos`, `suprimentos`.
- Frontend `RegistroGasto.jsx`: 3 novas opções no `<select>` de categoria: "Contas de Consumo (Luz/Água)", "Impostos e Tributos (IR/Simples)", "Insumos e Consumo (Limpeza/Café)".

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (Módulo 4)
**Observação:** Catálogo de categorias completo: aluguel | produtos | salario | marketing | manutencao | equipamentos | utilidades | impostos | suprimentos | outros.

---

## 2026-06-21 — TASK-14B: detalhamento analítico de despesas no DRE (accordion por categoria + descrição)

**Motivo:** A seção "Gastos Operacionais por Categoria" no DRE exportado (`buildDreHtml`) agrupava apenas por `categoria`, ocultando quais itens individuais compunham cada total. O admin não conseguia distinguir, por exemplo, quais "produtos" foram comprados sem abrir a tabela de despesas linha a linha.

**Impacto:**
- Backend `GET /relatorios/dre` — query `gastosPorCategoria`: GROUP BY expandido de `(categoria, unidade)` para `(categoria, descricao, unidade)`, com ORDER BY `categoria ASC, total DESC`. Cada `(categoria, descricao)` vira uma linha separada.
- Frontend `buildDreHtml`: os rows planos são agrupados em memória por `categoria`; cada categoria gera uma linha-cabeçalho clicável (total em negrito + indicador `▶`) e sub-linhas recuadas por `descricao` (ocultas por padrão). JavaScript inline no HTML exportado gerencia o toggle `▶ / ▼`. CSS `@media print` força todas as sub-linhas visíveis ao imprimir/exportar PDF.

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (RF-035 — Módulo 9)
**Observação:** O comportamento de accordion é exclusivo do popup/PDF exportado — a tela interativa `IntelFinanceira.jsx` não exibe esta seção diretamente. A estrutura de dados retornada pela API é backwards-compatible: os campos `categoria`, `descricao`, `unidade`, `qtd` e `total` já existiam em `gastos_lista`; a mudança é só no agrupamento da query `gastos_por_categoria`.

## 2026-06-25 — Comissão de produto configurável por barbeiro (`percentual_comissao_produto`)

**Motivo:** A comissão de produtos físicos (pomadas, shampoos) era fixada em 10% para todos os barbeiros. Clientes com contratos diferentes do padrão precisavam de percentuais customizados sem necessidade de alteração no código.

**Impacto:**
- Banco: `ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS percentual_comissao_produto NUMERIC(5,2) NOT NULL DEFAULT 10.00` — migration idempotente executada no startup.
- `models.js`: `Profissional.create` e `.update` passaram a aceitar o novo campo. `.update` usa `COALESCE($5, percentual_comissao)` e `COALESCE($6, percentual_comissao_produto)` para atualização parcial.
- `routes/vendas.js`: `calcularComissao()` passou a ser **async** — consulta `Profissional.findById()` para ler os dois percentuais reais do banco em vez de usar valor fixo. Chamadores atualizados com `await`.
- `routes/auth.js`: JWT agora inclui `percentual_comissao_produto` no payload — disponível no frontend sem request adicional.
- `frontend/pages/GestaoProfissionais.jsx`: campo "Comissão produtos (%)" adicionado ao formulário de criação e ao modal de edição.

**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco, requisitos-funcionais-thieco
**Observação:** Percentual default de 10% preserva o comportamento histórico. A leitura do banco no momento da venda garante que alterações no percentual de um barbeiro sejam refletidas imediatamente nas próximas vendas — sem necessidade de logout/login.

---

## 2026-06-25 — Taxas de pagamento configuráveis via painel (fim das constantes hardcoded)

**Motivo:** As taxas PagBank estavam hardcoded como constante `TAXAS_PAGBANK` no arquivo `routes/vendas.js`. Qualquer ajuste de taxa exigia redeploy — impraticável para um SaaS multi-tenant.

**Impacto:**
- Banco: tabela `configuracoes` (chave/valor) utilizada como store de taxas — chaves no formato `taxa_{unidade}_{forma}_{bandeira?}`.
- `routes/vendas.js`: função `getTaxas()` async com **cache em memória de 5 minutos** (`_taxasCache`, `_taxasCacheAt`). `calcularValorLiquido()` agora é async e lê taxas via cache. `invalidarCacheTaxas()` exportada para que a rota de configurações notifique a invalidação ao salvar novas taxas.
- `routes/configuracoes.js` (novo): `GET /configuracoes/taxas` retorna todas as taxas; `PUT /configuracoes/taxas` valida chaves contra whitelist `TAXAS_KEYS`, valida range 0–1 (decimal), persiste e chama `invalidarCacheTaxas()`.
- `server.js`: `app.use('/configuracoes', require('./routes/configuracoes'))`.
- `frontend/api.js`: namespace `configuracoes` com `taxas()` e `atualizarTaxas()`.
- `frontend/pages/Configuracoes.jsx` (novo): tela admin com editor de taxas agrupadas por Débito, Crédito e Outros (Pix, Dinheiro, Cortesia). Inputs em %, armazenados como decimal.

**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco (Configuração), requisitos-funcionais-thieco (RN-004, novo Módulo 12)
**Observação:** Cache de 5 minutos evita query por venda. `invalidarCacheTaxas` garante consistência imediata após save — sem necessidade de aguardar expiração do TTL.

---

## 2026-06-25 — Sistema de notificações e alertas automatizados

**Motivo:** Admin e operadores não tinham visibilidade proativa sobre itens críticos (estoque baixo, meta em risco, ranking semanal). O painel exigia leitura manual de múltiplas seções para detectar problemas.

**Impacto:**
- Banco: `CREATE TABLE notificacoes` (id, unidade, tipo, criticidade, titulo, corpo, lida, created_at) + 2 índices (`(unidade, lida)` e `(unidade, created_at DESC)`). Três queries separadas no `runMigrations` (driver `pg` não suporta múltiplos statements num único `query()`).
- `routes/notificacoes.js` (novo): geradores `gerarAlertasEstoque()`, `gerarAlertasMetas()` (consulta `metas_unidade` — colunas `valor_global, mes, ano` — calcula `metaDia` proporcional e `faturadoHoje`) e `gerarRankingSemanal()`. Endpoints: `POST /notificacoes/gerar`, `GET /notificacoes`, `PATCH /notificacoes/lidas`, `PATCH /notificacoes/:id/lida`.
- `server.js`: `app.use('/notificacoes', require('./routes/notificacoes'))`.
- `frontend/api.js`: namespace `notificacoes` com listar/gerar/marcarLida/marcarTodasLidas.
- `frontend/components/NotificacoesPanel.jsx` (novo): drawer lateral deslizante (direita). Exporta `SinoBadge` (sino com badge vermelho, polling a cada 5 min via `setInterval`). Ao abrir, dispara `POST /gerar`. Grupos por criticidade: crítico → aviso → info → lidas. Ícones: Package (estoque), TrendingUp (meta), Trophy (ranking).
- `frontend/components/Header.jsx`: `SinoBadge` integrado ao Header de admin/operador.

**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco (entidade Notificacao), requisitos-funcionais-thieco (novo Módulo 13)
**Observação:** `gerarAlertasMetas` consulta `metas_unidade` — NÃO a tabela `metas`. O `metaDia` é calculado como `valor_global ÷ dias_uteis_do_mes` — proporcional ao dia corrente. `faturadoHoje` compara com meta do dia para determinar criticidade do alerta.

---

## 2026-06-25 — Toggle escuro/claro com ThemeContext e lib/theme.js

**Motivo:** O sistema operava exclusivamente em modo escuro (hardcoded). Solicitação de Willians para adicionar modo claro acessível via botão sol/lua — com persistência entre sessões e cobertura em todas as telas (login, admin, barbeiro).

**Impacto:**
- `frontend/lib/theme.js` (novo): constantes hardcoded (`DARK_BG = '#0D0F14'`, `DARK_SF = '#141921'`, `LIGHT_BG = '#EEF1F5'`, `LIGHT_SF = '#FFFFFF'`, `COR_PRIMARIA_ESCURO = '#C9A84C'`, `COR_PRIMARIA_CLARO = '#1B2A4A'`). Função `applyTenantTheme(modo)` com blocos dark/light **totalmente separados** — sem chamadas compartilhadas fora do `if/else`. `getModoInicial()` lê `localStorage.getItem('thieco_tema') ?? 'escuro'`.
- `frontend/main.jsx`: `applyTenantTheme(getModoInicial())` chamado antes do `ReactDOM.createRoot()` — elimina flash de tema errado no primeiro render.
- `frontend/contexts/ThemeContext.jsx` (novo): `ThemeProvider` com `useState(getModoInicial)` + `useEffect` que aplica tema e persiste `thieco_tema` no localStorage. `toggleModo` flip `escuro ↔ claro`. `useTheme()` hook exportado.
- `frontend/App.jsx`: `ThemeProvider` envolvendo `AuthProvider`.
- `frontend/components/Header.jsx`: botão sol/lua importado de `ThemeContext` — visível para admin e operador.
- `frontend/pages/Login.jsx`: botão sol/lua no canto superior direito — visível para TODOS os usuários antes de logar (inclusive barbeiro).
- `frontend/pages/MeuPainel.jsx`: botão sol/lua adicionado diretamente ao header customizado do barbeiro (ao lado do botão "Sair") — `MeuPainel` tem header **próprio**, não usa `Header.jsx`, portanto o toggle precisa estar aqui explicitamente.

**Status:** aplicado
**Artefatos atualizados:** arquitetura-thieco (camadas, histórico)
**Observação crítica:** `MeuPainel.jsx` tem header mobile-first próprio que NÃO herda de `Header.jsx`. Qualquer futura feature de header que precise aparecer para barbeiro deve ser adicionada **diretamente no MeuPainel**, não apenas no Header.jsx. localStorage key: `thieco_tema`.

<!-- novas entradas sempre abaixo desta linha, nunca acima -->

## 2026-07-01 — Convenção bruto/líquido de `vendas.valor` corrigida (reconciliação junho/Mutinga)

**Motivo:** Comparando a planilha de controle de vendas com o sistema, o Dashboard mostrava "Faturamento Bruto" divergente da planilha e a aba Lançamentos mostrava um terceiro valor diferente de ambos. Investigação revelou que vendas lançadas ao vivo sempre trataram `valor` como preço de tabela (bruto, antes do desconto — confirmado comparando registros reais do Thieco com desconto: `financeiro_vendas.valor_bruto = vendas.valor` exatamente, sem soma de desconto). O script de importação do histórico da planilha salvava `valor` já líquido (coluna "C/Desconto"), o oposto da convenção — Lançamentos fazia `valor - desconto` e subtraía o desconto duas vezes.

**Impacto:**
- `backend/routes/vendas.js`: `calcularComissao()` fazia `valorBruto = valor + desconto` para "reconstituir" o bruto — como `valor` já é bruto na vida real, isso inflava a comissão de qualquer venda com desconto (bug latente, nunca tinha se manifestado em dado real). Removida a soma; parâmetro `desconto` retirado da assinatura da função (2 call sites ajustados).
- `backend/models.js`: duas migrations idempotentes (`BACKFILL_COMISSAO_SPLIT`, `RECALC_COMISSAO_APOS_BACKFILL`, rodam a cada start do backend) tinham o mesmo bug — mesma correção.
- `scripts/gerar-import-sql.js`: `valor` agora recebe a coluna S/Desconto (bruto) da planilha, não C/Desconto. `financeiro_vendas.valor_bruto` gerado a partir de `i.valor` direto, sem somar desconto.
- Junho/2026 Mutinga reimportado (348 registros) com a convenção corrigida: Faturamento Bruto R$17.964,00 (bate com a planilha), líquido R$17.599,51.

**Status:** aplicado (local + VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (Venda.valor, comissao, comissao_servico, comissao_produto, desconto)
**Observação:** `desconto` continua existindo e sendo subtraído — a mudança foi só na direção: `valor - desconto = líquido`, nunca `valor + desconto` (isso dobraria o desconto ou infla comissão). Todo código futuro que mexer em `vendas.valor` deve assumir bruto.

---

## 2026-07-01 — Classificação serviço/produto na importação usa o catálogo, não heurística de comissão

**Motivo:** O importador de histórico classificava `tipo_item` (servico/produto) por uma heurística: proporção entre a comissão registrada na planilha e o valor da venda (`ratio < 0.15` → produto). Essa heurística é instável — a mesma "Cerveja - Amstel" podia cair em serviço ou produto dependendo de pequena variação de digitação na comissão da planilha linha a linha, porque cada linha tem seu próprio valor de comissão manual.

**Impacto:**
- `scripts/gerar-import-sql.js`: adicionado snapshot estático `CATALOGO_CONTROLA_ESTOQUE` (nome → boolean, extraído de `SELECT nome, controla_estoque FROM catalogo`). `tipoItem()` agora consulta esse mapa primeiro (fonte da verdade); só cai na heurística de proporção para itens fora do catálogo (ex.: "Esponja Pq.", vendida uma vez, nunca cadastrada).
- Também corrigido: coluna de referência de comissão usada pela heurística era sempre a do Igor (fixa), mesmo processando linha do Kauã — corrigido para usar a coluna de comissão do funcionário real da linha (cada barbeiro tem sua própria seção de colunas na planilha).
- `normalizarNome()` precisa rodar tanto na busca quanto na construção do mapa do catálogo (acentos) — bug secundário corrigido no mesmo commit ("Depilação nariz" não batia por causa do "ã").

**Status:** aplicado (local + VPS)
**Artefatos atualizados:** requisitos-funcionais-thieco (RN-019, novo)
**Observação:** Este bug só afeta o **script de importação em lote** (histórico de planilha) — o motor de cálculo do sistema ao vivo (`routes/vendas.js`) sempre recebeu `tipo_item` explícito da tela, nunca inferiu por heurística. Validado comparando registros reais (Tambore, Thieco) contra a fórmula — sempre bateu.

---

## 2026-07-01 — Atendimentos contados por comanda (`venda_origem_id`), não por linha

**Motivo:** Auditoria de junho/Mutinga revelou que a importação de histórico não populava `venda_origem_id` nem `nome_cliente` em nenhuma linha. Como `COUNT(DISTINCT COALESCE(venda_origem_id, id))` é o padrão usado em Performance, Inteligência Financeira e ticket médio para contar "atendimentos" (visitas, não itens), a ausência desse campo fazia cada item (serviço + produto + upsell da mesma visita) contar como um atendimento separado — 348 linhas viravam 348 "atendimentos" quando na real eram 266 visitas (82 itens comprados junto com outro na mesma visita). Ticket médio saía artificialmente baixo (~R$52 em vez de ~R$73 para o Igor).

**Impacto:**
- `scripts/gerar-import-sql.js`: parser agora captura `nome_cliente` (coluna "Cliente" da planilha). Após o INSERT principal, uma segunda query agrupa por `(LOWER(TRIM(nome_cliente)), data, profissional_id)` via `MIN(id) OVER (PARTITION BY ...)` e seta `venda_origem_id` nos itens que não são o primeiro (`MIN`) do grupo — mesmo padrão usado pelas vendas ao vivo (upsell/produto na mesma comanda).
- Limitação aceita: agrupamento por nome+data+barbeiro é uma heurística — dois clientes homônimos atendidos pelo mesmo barbeiro no mesmo dia seriam fundidos incorretamente. Risco baixo dado o volume da barbearia, mas é uma limitação de dado (planilha não tem ID de cliente nem horário), não do sistema.

**Status:** aplicado (local + VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (Venda.venda_origem_id)
**Observação:** Após a correção, junho/Mutinga: Igor 159 linhas → 113 atendimentos reais (ticket médio R$73,48); Kauã 189 linhas → 153 atendimentos (R$63,14). Endpoint `/relatorios/dre` confirmado batendo (`atendimentos: 266`, `ticket_medio: 67.53`).

---

## 2026-07-01 — Migração completa do sistema de combos para V2 (V1 retirado do app)

**Motivo:** A tela de venda (`RegistroVenda.jsx`) tinha um formulário de 3 abas (Cliente Novo/Up-sell/Reativação) que **gravava na tabela legada `combos` (V1)** via `POST /combos/ativar` — sem crédito fracionado, invisível pro resto do sistema (aba Combos admin, `GET /combos/saldo`, relatórios). Ao lado, na mesma tela, a seção "Contratar próximo combo" já usava corretamente o sistema V2 (`combos_contratados`, via `POST /combos/contratar`). Resultado: escolher "Reativação" no formulário de 3 abas *parecia* funcionar mas não criava nada usável — o cliente continuava sem crédito de verdade.

**Impacto:**
- `frontend/RegistroVenda.jsx`: formulário de 3 abas reescrito para usar `POST /combos/contratar` (mesmos campos de crédito — `limite_corte`/`limite_barba` com steppers — já usados em "Contratar próximo combo"). Removida toda lógica V1: busca dupla V1/V2 (`api.buscarCombo`), tela "Combo legado" (`registrarUso`, `api.registrarUsoCombo`), estado `combo`/`comboVencido`/`comboAtivo`, seleção de "plano" via `catalogo.categoria === 'combo'`.
- `frontend/lib/api.js`: removidas as funções V1 (`buscarCombo`, `ativarCombo`, `registrarUsoCombo`, `combos`, `criarCombo`, `atualizarCombo`, `migrarComboV2` do lado cliente) — nenhuma tela mais chama.
- `backend/routes/combos.js`: removidas as rotas V1 (`GET/POST /combos`, `GET /combos/buscar`, `POST /combos/uso`, `POST /combos/ativar`, `PATCH /combos/:id`).
- `backend/models.js`: removido o model `Combo` (V1), sem mais uso em nenhuma rota.
- Mantida `POST /combos/migrar-v2` (ferramenta de conversão pontual: recebe `combo_id` V1 + créditos, cria `combos_contratados` equivalente e marca o V1 como `ativo = false`) — usada para migrar **28 combos V1 reais e ativos** encontrados em produção (clientes que passaram pelo formulário quebrado antes da correção). Créditos inferidos por regex da descrição textual (`servicos`) de cada um; script `scripts/migrar-combos-v1-para-v2.js` roda o lote inteiro via API, senha passada por variável de ambiente (nunca gravada em arquivo, evita `EACCES` dentro do container).
- Tabela `combos` (V1) preservada intacta — sem FK de nenhuma outra tabela, não precisa ser dropada, só parou de ser escrita/lida pelo app.

**Status:** aplicado (local + VPS, migração dos 28 clientes reais confirmada)
**Artefatos atualizados:** modelo-de-dados-thieco (Combo → ComboContratado/ComboConsumo), requisitos-funcionais-thieco (Módulo 6), arquitetura-thieco (fluxo de combo, histórico v2.3)
**Observação:** Nenhuma venda ou dado financeiro já reconciliado foi tocado nessa migração — mudança restrita ao código do fluxo de combo e à criação de novos `combos_contratados` a partir dos V1 ativos. `POST /combos/migrar-v2` pode ser removida numa limpeza futura, uma vez confirmado que não sobrou combo V1 ativo em produção.

---

## 2026-07-01 — Botão "Reativar" para combos esgotados/vencidos + unificação do critério de esgotamento

**Motivo:** Cliente com combo esgotado (créditos zerados) ou vencido não tinha nenhuma ação disponível na aba Combos (admin) — card ficava mostrando o status "Encerrado" sem botão nenhum. Investigação revelou uma segunda divergência: a listagem admin (`GET /combos/contratados`) checava esgotamento por data **e** créditos, mas a tela de venda (`GET /combos/saldo` → `verificarExpiracaoCliente`) só checava vencimento por data — um cliente esgotado por crédito (não por data) aparecia "Encerrado" na aba admin mas continuava "ativo" quando um barbeiro o consultava na tela de venda.

**Impacto:**
- `backend/models.js`: `verificarExpiracaoCliente()` (chamada por `GET /combos/saldo`) passou a fechar por `data_validade < hoje` **OU** `limite_corte + limite_barba = 0` — mesmo critério (`CRITERIO_ESGOTADO`) usado na query de listagem `ComboContratado.findAll`, que ganhou um campo computado `esgotado` (boolean) para a mesma finalidade.
- `frontend/Combos.jsx`: badge de status usa esse `esgotado` computado (mostra "Encerrado" mesmo se o registro ainda estiver `em_uso` no banco, até a próxima sincronização). Botão "Reativar" aparece quando `esgotado = true` — leva para a aba "Novo combo" com nome/contato/unidade/barbeiro pré-preenchidos e tipo "Reativação" já selecionado.
- `frontend/RegistroVenda.jsx`: como `verificarExpiracaoCliente` agora fecha por crédito também, um cliente esgotado passou a cair automaticamente no mesmo formulário de 3 abas usado para clientes novos (`comboV2Ativo` vira `null`) — reativação direta na tela de venda, sem precisar ir à aba Combos.

**Status:** aplicado (local + VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (ComboContratado, estado esgotado), requisitos-funcionais-thieco (RF-025, RF-025b, RF-025c, RN-011)
**Observação:** O critério de esgotamento existe hoje em dois lugares (`ComboContratado.findAll` e `verificarExpiracaoCliente`) — devem ser mantidos idênticos manualmente caso um dos dois seja alterado no futuro; não há teste automatizado que garanta a paridade.

---

## 2026-07-01 — Toggle escuro/claro conectado às cores reais do Tailwind

**Motivo:** O toggle de tema (introduzido em 2026-06-25 — `ThemeContext`, `lib/theme.js`, botão sol/lua) não tinha efeito visual nenhum ao clicar. Causa: `applyTenantTheme()` define variáveis CSS (`--cor-fundo`, `--cor-primaria`, etc.) em `:root`, mas `tailwind.config.js` definia `onix`/`gold`/`surface` como valores hex fixos — nenhuma classe do app (`bg-onix`, `text-gold`, `bg-surface-card`, usadas em ~30 arquivos) consumia essas variáveis. O mecanismo de troca de tema (estado, localStorage, botão) sempre funcionou; só a renderização nunca esteve conectada.

**Impacto:**
- `frontend/tailwind.config.js`: `onix`/`gold`/`surface` reescritos para usar o padrão `withOpacity(variavel, fallback)` do Tailwind — lê `var(--cor-x, fallback)`, com fallback = cor exata do modo escuro atual (nada muda antes do JS do tema rodar). Formato de fallback em canais "R G B" (não hex), necessário para o Tailwind aplicar opacidade (`bg-gold/10`, `text-gold-light/70` — 255 ocorrências no app). `backgroundImage` (gold-gradient, onix-gradient, card-gradient) e `boxShadow` (gold-sm/gold/gold-lg/inset-gold/card) também migrados para `rgb(var(--x))`.
- `frontend/lib/theme.js`: reescrito para emitir canais RGB (não hex) e usar valores EXATOS do dark mode atual como base (antes havia uma leve divergência entre os valores hardcoded aqui e os do `tailwind.config.js` original — corrigido para serem idênticos). Modo claro usa a mesma família dourada da marca, só aprofundada (`#A9791E` em vez de `#D4AF37`) para contraste legível em fundo branco — não introduz cor nova (a versão anterior trocava para navy `#1B2A4A`, decisão revertida).
- Botão sol/lua já existia tanto no `Header.jsx` (admin) quanto no `MeuPainel.jsx` (barbeiros) desde 2026-06-25 — nenhuma tela precisou ser alterada, a correção foi 100% no ponto único onde as cores são definidas.

**Status:** aplicado (local + VPS)
**Artefatos atualizados:** arquitetura-thieco (histórico v2.4)
**Observação:** Build de produção validado (CSS compilado confirmado com `rgb(var(--cor-primaria, 212 175 55) / .1)`), mas não foi possível tirar screenshot real do toggle funcionando — sem navegador headless disponível no ambiente de desenvolvimento (faltam bibliotecas de sistema, sem acesso sudo para instalar). Recomendado testar visualmente na prática antes de considerar 100% fechado.

---

## 2026-07-01 — Notificações não voltam como não lidas + retenção de 7 dias

**Motivo:** Notificações de estoque/meta marcadas como lidas voltavam a aparecer como não lidas. Causa: `POST /notificacoes/gerar` (chamado toda vez que o painel de notificações é aberto) apagava **todas** as notificações voláteis (`estoque_baixo`, `estoque_zerado`, `meta_risco`) e recriava do zero a cada chamada, sem checar se já estavam marcadas como lidas — reabrir o painel depois de ler um alerta recriava a mesma notificação como não lida, com um id novo.

**Impacto:**
- `backend/routes/notificacoes.js`: nova função `sincronizarAlertas(tipos, alertasAtuais, chaveMeta, unidade)` substitui o apagar-e-recriar. Se o alerta (identificado por `tipo` + `meta->>'catalogo_id'` ou `meta->>'meta_id'`) já existe, só atualiza os dados preservando `lida`; só remove quando a condição deixou de ser válida (estoque reabastecido, meta fora de risco).
- Adicionada retenção automática: `DELETE FROM notificacoes WHERE created_at < NOW() - INTERVAL '7 days'` rodado a cada chamada de `POST /notificacoes/gerar` — nenhuma notificação (lida ou não) acumula além de 7 dias.
- Ranking semanal não tinha esse bug — já era idempotente (só recria se não existe uma do dia corrente).

**Status:** aplicado (local + VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (Notificacao — nomes de coluna corrigidos para bater com o schema real: `nivel`/`mensagem`/`meta`, não `criticidade`/`corpo`)
**Observação:** A query de retenção roda só reativamente (quando alguém abre o painel e dispara `/gerar`) — se o painel ficar muitos dias sem ser aberto, notificações antigas persistem até a próxima abertura. Suficiente para o uso atual (painel é checado diariamente), mas não é uma limpeza agendada independente.

---

## 2026-07-04 — Combos: créditos dinâmicos por serviço (JSONB), fim do `<select>` nativo, UX unificada de avulsos

**Motivo:** O modelo de crédito de combo era travado em 2 colunas fixas (`limite_corte`, `limite_barba` — depois `limite_sobrancelha` também) direto na tabela `combos_contratados`. Analisando o catálogo real, vários pacotes já cadastrados não cabiam nesse modelo: "Corte + Risco", "Corte + Progressiva", "Corte + Sobrancelha com Cera", "Dia de Princeso" (Corte+Barba+Sobrancelha+Limpeza de pele+Depilação) — qualquer serviço novo em um pacote exigiria migration + editar JSX em vários lugares. Paralelamente, a tela de venda usava um `<select>` nativo do HTML pra escolher o pacote de reativação, quebrando o padrão visual dourado do resto do app, e a seção de avulsos (serviços/produtos extras fora do combo) passou por várias idas e vindas de layout (checkbox → select → steppers → carrinho) até convergir num modelo único.

**Impacto:**
- `backend/models.js`: colunas `combos_contratados.creditos`/`creditos_originais` (JSONB, chave = nome exato do serviço no catálogo) substituem `limite_corte`/`limite_barba`/`limite_sobrancelha` — migração aditiva, colunas antigas preservadas no banco (não lidas/escritas pelo código novo), backfill idempotente migrou os combos já contratados sem perda. `combos_consumo.servico_utilizado` vira VARCHAR livre (era `combo_servico_enum` fixo 'corte'/'barba'). Nova tabela `catalogo_combo_creditos` (catalogo_id, servico, quantidade) — receita de créditos por pacote, derivada uma única vez do nome de cada pacote já cadastrado (`categoria = 'combo'`), sem cadastro manual novo. `GET /catalogo` passou a embutir essa receita (`creditos`) em cada item de combo.
- `backend/routes/combos.js`: `contratar`/`consumo`/`consumo-lote`/`saldo` generalizados para o objeto `creditos` dinâmico — validação, decremento e critério de esgotamento (`creditosEsgotados()`) passaram a iterar as chaves do objeto em vez de somar 2-3 colunas fixas. De brinde, corrigiu um bug em `verificarExpiracaoCliente` que nunca considerava sobrancelha (nem qualquer serviço além de corte/barba) no critério de esgotado.
- `frontend/components/ChecklistCreditosCombo.jsx` (reescrito): checkboxes viraram steppers (−/qtd/+), uma linha por chave de `creditos`, botão "+" travado no saldo real — nenhum serviço fixo no componente.
- `frontend/components/CardSaldoCombo.jsx` (novo): card de saldo compartilhado (ativo em verde / expirado em âmbar, créditos zerados e "vencido em" em destaque), reaproveitado na aba Combos, no modal de detalhes do cliente (`Clientes.jsx`) e na tela de venda — mesmo visual nos três lugares. Um combo `em_uso` cujo saldo zera (mas ainda não fechado por data) também vira "Combo expirado" visualmente via prop `expirado`, embora o registro só feche de fato no backend por data ou na próxima tentativa de consumo.
- `frontend/pages/RegistroVenda.jsx` (`AbaCombo`): `<select>` nativo do pacote (reativação e "Contratar próximo combo") substituído por seletor customizado (`CatalogoAutocomplete`, busca fluída + preço na lista) — Valor (R$) trava (read-only) ao selecionar. Quando o saldo do combo ativo esgota, o mesmo seletor de renovação ("Serviços-Combo") aparece exposto direto abaixo do card, sem precisar abrir o colapsável "Contratar próximo combo" (que nesse caso some, pra não duplicar a ação). Serviços/produtos avulsos viraram um único padrão: dois seletores (Produto, Serviço adicional/upsell) cada um com valor + quantidade + botão "+ Adicionar" próprio, alimentando o mesmo carrinho com Subtotal Geral e split de pagamento. "Serviço adicional (upsell)" foi reposicionado do topo da tela pra logo abaixo do card de saldo do combo.
- `frontend/pages/Clientes.jsx`: card de combo do modal de detalhes (antes uma implementação própria, ligeiramente diferente visualmente) trocado pelo `CardSaldoCombo` compartilhado — mesmo modelo visual em toda a aplicação. Corrigido de brinde: a linha "Último uso" ficava oculta quando o combo estava zerado/vencido (`{!vencido && ultimoUso}`) — removida essa condição, a data da última utilização aparece sempre que existir.
- `frontend/pages/Combos.jsx` (admin): `ModalBaixaSeletiva` migrado pra mesma API de steppers do `ChecklistCreditosCombo` (`quantidades`/`onChange`, era `selecionados`/`onToggle`) — evita quebra por incompatibilidade de props.

**Status:** aplicado (local + Docker local — `thieco_web`/`thieco_api` reconstruídos e migrations rodadas no banco real; 8.580 vendas históricas preservadas)
**Artefatos atualizados:** modelo-de-dados-thieco (ComboContratado, ComboConsumo, nova CatalogoComboCreditos), requisitos-funcionais-thieco (Módulo 6 — RF-023/024/024b/025 reescritos, RF-068 a RF-071 novos, RN-010/011 atualizadas, RN-030 nova), arquitetura-thieco (fluxo de contratação/uso, histórico v2.6), ux-flows-thieco (iteração 2026-07-04)
**Observação:** Durante a sessão de trabalho, várias iterações de layout foram tentadas e revertidas antes de convergir no modelo final (checkbox → select com preço → steppers dinâmicos → carrinho unificado de avulsos) — o modelo final documentado aqui é o único que ficou em produção. Validado end-to-end criando clientes de teste com tipos de combo bem diferentes (ex.: "Corte + Risco", "4 Barbas") direto no banco real via `docker exec`, confirmando que a UI reflete exatamente os créditos daquele contrato, sem lista fixa de serviços em nenhum ponto do código.

---

## 2026-07-05 — Consolidação de infraestrutura: sistema-thieco migrado para a VPS do villamill

**Motivo:** O sistema-thieco rodava numa VPS Hostinger dedicada (`72.60.113.214`, domínio `barbeariatl.online`). Decisão de negócio: consolidar em uma única VPS (a mesma que já hospeda o vilamill-sistema, `2.24.93.178`) para reduzir custo de infraestrutura, já que ambos os sistemas rodam em stacks Docker isoladas e cabem confortavelmente na mesma máquina.

**Impacto:**
- **Migração de dados:** `pg_dump -Fc` do banco de produção da VPS antiga (11.025 vendas, histórico 2024-01-29 a 2026-05-05) → restaurado na VPS do villamill via `pg_restore` (DROP/CREATE DATABASE + restore, substituindo o seed automático do `init.sql`). Contagem de vendas conferida byte-a-byte antes/depois (11.025 = 11.025).
- **Isolamento preservado:** container `thieco_db`/`thieco_web` na VPS do villamill seguem em rede Docker própria (`thieco_network`), volume próprio (`thieco_postgres_data`), portas vinculadas a `127.0.0.1` (nunca expostas à internet — só o Nginx do host fala com os containers). Nenhum dado ou processo compartilhado com o `vilamill-sistema`.
- **DNS:** `barbeariatl.online` repontado de `72.60.113.214` para `2.24.93.178`. Certificado SSL reemitido via certbot na nova VPS (Let's Encrypt não migra certificado entre IPs — reemissão é o caminho correto).
- **Nginx do host:** novo `server_block` para `barbeariatl.online` coexistindo com o `server_block` do `villamill.online` no mesmo Nginx — roteamento por `server_name`, sem conflito.
- **Correção de dados pós-migração (reconciliação):** o dump trazido da VPS antiga não incluía os lançamentos de junho/2026 nem os e-mails reais dos profissionais (esses dados só existiam no ambiente local de desenvolvimento e num backup de snapshot da Hostinger de 29/06). Reimportadas 348 vendas de junho/Mutinga + 4 vendas de junho/Tambore (`unidade != 'mutinga'`, dia 28/06, cliente Christopher Dias Santana) via script SQL idempotente (`DELETE` do período + `INSERT`). E-mails de Thieco Leandro e Kauã dos Santos corrigidos via `UPDATE profissionais` (fonte: backup Hostinger de 29/06). Clientes/combos de teste identificados pelo nome ("Cliente Contratar Teste", "Cliente Validacao...") e **excluídos** da reconciliação — não representam dado real.
- **Hardening colateral:** durante a investigação, identificado que o próprio `vilamill-sistema` (não o thieco) tinha `villamill-app` (porta 3000) e `villamill-db` (porta 5433) expostos em `0.0.0.0` — acessíveis publicamente sem passar pelo Nginx/SSL. Corrigido para `127.0.0.1` (backup `pg_dump` tirado antes da mudança, container recriado sem tocar no volume — nenhum dado perdido). Senha padrão (`postgres`) do Postgres do villamill identificada como pendência de segurança separada, não corrigida nesta sessão (risco reduzido pelo fechamento da porta).
- **VPS antiga:** containers parados (`docker compose stop`, dado preservado no volume) — descomissionamento total (cancelamento da assinatura Hostinger) é ação pendente do lado do usuário, fora do escopo técnico.

**Status:** aplicado (produção)
**Artefatos atualizados:** infraestrutura-da-vps (reescrita completa — nova VPS, novo IP, coexistência com villamill)
**Observação crítica — erro cometido e corrigido durante a sessão:** ao subir o sistema-thieco pela primeira vez na VPS do villamill, um `docker volume rm` foi executado sob a premissa errada de que o volume estava vazio (a autenticação falhava com a senha nova gerada na hora) — na verdade esse mesmo padrão de erro (`"Skipping initialization"` no log do Postgres = volume já tinha dados de uma vida anterior) já havia se manifestado antes, nesta mesma sessão, na VPS antiga, e foi a causa raiz de uma janela de dados órfãos que precisou ser reconciliada depois via backup Hostinger + banco local. Lição registrada: **nunca assumir que um volume Postgres está vazio só porque a autenticação com a senha atual falha** — sempre inspecionar o log de boot (`"Skipping initialization"` é o sinal definitivo) antes de qualquer `docker volume rm`.

---

## 2026-07-05 — Despesas recorrentes (mensal/semanal/anual) com geração automática de ocorrências futuras

**Motivo:** Despesas fixas do dia a dia da barbearia (aluguel, assinaturas, salário) precisavam ser relançadas manualmente todo mês/semana/ano — repetitivo e sujeito a esquecimento.

**Impacto:**
- Banco: `ALTER TABLE gastos ADD COLUMN recorrente BOOLEAN NOT NULL DEFAULT false, frequencia_recorrencia VARCHAR(10) CHECK (IN semanal/mensal/anual), gasto_origem_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL` — migration aditiva, idempotente.
- `backend/models.js`: `Gasto.gerarOcorrenciasFuturas()` — chamada uma única vez, no ato da criação de uma despesa com `recorrente=true`. Gera as próximas 11 datas futuras (mensal/semanal/anual) numa transação própria, cada ocorrência já persistida como linha independente vinculada via `gasto_origem_id`. Sem cron job — geração é em lote antecipado, não sob demanda.
- `backend/routes/gastos.js`: validação — `frequencia_recorrencia` só é exigida quando `recorrente=true`.
- `frontend/RegistroGasto.jsx`: toggle customizado (cartão clicável com quadrado de check dourado, estilo consistente com o resto do app — não o checkbox nativo do navegador) + seletor de frequência exibido só quando ativado. Ícone `Repeat` marca despesas recorrentes na listagem.
- **Bug encontrado e corrigido durante o desenvolvimento:** `node-postgres` retorna colunas `DATE` como objeto `Date`, não string — mesma classe de bug já corrigida em `9536618` (edição de venda). `String(Date).slice(0,10)` gerava data inválida (`"Invalid time value"` ao chamar `toISOString()`). Corrigido com o mesmo padrão já estabelecido no projeto: cast `data::text` direto na query SQL, nunca formatação manual em JS.

**Status:** aplicado (local + produção — VPS do villamill)
**Artefatos atualizados:** modelo-de-dados-thieco (Gasto — novos campos + relacionamento auto-referencial), requisitos-funcionais-thieco (RF-072, RN-031, RN-032)
**Observação:** Editar ou excluir a despesa original não propaga para as ocorrências já geradas — são registros independentes desde a criação, vinculados só para fins de rastreio (`gasto_origem_id`). Se o valor de uma despesa recorrente mudar no mundo real (reajuste de aluguel, por exemplo), as ocorrências futuras já geradas precisam ser editadas manualmente uma a uma, ou a despesa recorrente precisa ser recriada.

---

## 2026-07-05 — Taxas de pagamento por unidade e por bandeira individual

**Motivo:** Auditoria do código (motivada por print de erro antigo do usuário) revelou que as taxas configuráveis (introduzidas em 2026-06-25) eram **globais** — `calcularTaxaPagamento()` não recebia `unidade`, aplicando a mesma taxa pra Tamboré e Mutinga. Isso contradizia a RN-004 original (2025 — "Tambore usa taxa flat, Mutinga usa taxa por bandeira"), que já previa comportamento diferente por unidade; a versão configurável, ao substituir as constantes hardcoded antigas, perdeu essa distinção no processo. O usuário forneceu prints reais do app da maquininha com as taxas específicas da Tamboré (bem diferentes das da Mutinga, ex.: crédito Elo 4,99% vs. 4,00%).

**Impacto:**
- `backend/models.js`: nova migração `SEED_TAXAS_POR_UNIDADE` — 28 chaves no formato `taxa_{unidade}_{forma}[_{bandeira}]` (Pix/Dinheiro/Cortesia sem bandeira; Débito/Crédito com padrão + Visa/Mastercard/Elo/Hipercard/Diners individuais). Mutinga migrada preservando os valores que já estavam em uso (só granularizados por bandeira); Tamboré seedada com as taxas reais informadas. `REMOVER_TAXAS_GLOBAIS_ANTIGAS` remove as 9 chaves globais antigas (não lidas mais pelo código).
- `backend/services/financeiro.js`: `calcularTaxaPagamento()`/`calcularFinanceiro()` passam a receber `unidade`; busca `taxa_{unidade}_{forma}_{bandeira}`, cai pra `taxa_{unidade}_{forma}` se a bandeira não tiver chave específica — nunca cruza unidades, nem como fallback.
- `backend/routes/vendas.js`: as duas chamadas de `calcularFinanceiro` (criação e edição de venda) passam a enviar `unidade`.
- `backend/routes/configuracoes.js`: whitelist estática `TAXAS_KEYS` substituída por validação via regex (`taxa_{tambore|mutinga}_{forma}[_{bandeira}]`, bandeira restrita a 5 valores). `PUT` virou `INSERT ... ON CONFLICT DO UPDATE` (antes só fazia `UPDATE`, silenciosamente não fazia nada se a chave não existisse ainda).
- **Bug colateral corrigido:** `invalidarCacheTaxas()` nunca era chamada de fato — `routes/configuracoes.js` importava de `require('./vendas')`, mas a função é exportada por `services/financeiro.js`; `routes/vendas.js` só re-expunha com outro nome (`_invalidarCacheServico`, nunca usado). O `?.()` opcional mascarava o erro silenciosamente. Corrigido importando direto de `../services/financeiro`.
- `frontend/pages/Configuracoes.jsx`: reescrita — seletor de unidade (Tamboré/Mutinga) no topo; cada bandeira (Visa/Mastercard/Elo/Hipercard/Diners) editável individualmente em Débito e Crédito, além do campo "padrão" (fallback quando a bandeira não é reconhecida).

**Status:** aplicado (local + produção — VPS do villamill)
**Artefatos atualizados:** modelo-de-dados-thieco (Configuracao — schema real documentado, chave por unidade), requisitos-funcionais-thieco (RF-073, RN-025/026/027/033), arquitetura-thieco (v2.9)
**Observação:** Testado ponta a ponta criando vendas reais de R$100 crédito Elo em cada unidade — Tamboré retornou líquido R$95,01 (4,99%), Mutinga R$96,00 (4,00%), confirmando isolamento total entre as duas configurações. Instalações futuras de uma terceira unidade (se vierem a existir) exigem expandir o array `UNIDADES` em `routes/configuracoes.js` e a lista `UNIDADES` no frontend — não há suporte dinâmico a unidades ainda, a lista é hardcoded nos dois lados.

---

## 2026-07-08 — Combos: edição da data de lançamento pelo admin (correção de cadastro retroativo)

**Motivo:** Vendas de combo feitas via Booksy (fora do caixa do sistema) precisavam ser cadastradas retroativamente na aba Combos para rastrear os créditos. O cadastro manual gravava `data_compra = hoje` (dia do cadastro), não o dia real da compra — inflando indevidamente a validade de 30 dias do combo (contando a partir de quando alguém digitou no sistema, não de quando o cliente realmente pagou).

**Impacto:**
- `backend/routes/combos.js`: nova rota `PATCH /combos/contratados/:id/data-compra` (admin only, mesmo guard `requireAdmin` do encerramento manual). Recebe `data_compra`; se o combo está `em_uso`, recalcula `data_validade = data_compra + 30 dias` reaproveitando o helper `addDias()` já existente. Combos `na_fila` (ainda sem validade) e `encerrado` (histórico fechado) só atualizam `data_compra`, sem recálculo.
- `frontend/pages/Combos.jsx`: botão "Editar" (mesmo ícone/estilo usado em `Clientes.jsx` — `Pencil` + texto, não só ícone) na linha de ações de cada card, ao lado de "Baixar serviços"/"Encerrar manualmente". Abre edição inline (campo de data + Salvar/Cancelar) no lugar da linha "lançado em / válido até".
- `frontend/lib/api.js`: `atualizarDataCompraCombo(id, data_compra)`.

**Status:** aplicado (local — testado via API criando e corrigindo combo de teste; recálculo de `data_validade` confirmado com `em_uso` e `na_fila`)
**Artefatos atualizados:** modelo-de-dados-thieco (ComboContratado — `data_compra` editável, nova nota no ciclo de vida), requisitos-funcionais-thieco (RF-076, RN-035)
**Observação:** Primeira versão do botão usava só um ícone de lápis minúsculo (11px) embutido no texto cinza da linha de metadados — praticamente invisível. Corrigido para um botão com texto "Editar" na linha de ações, seguindo o padrão já estabelecido em `Clientes.jsx`, depois de feedback direto do usuário ("ainda não consegui editar, onde está o botão").

---

## 2026-07-09 — Comissão do barbeiro visível por lançamento em Lançamentos

**Motivo:** O barbeiro já via a estimativa de ganho em tempo real ao registrar a venda (`RegistroVenda.jsx`, RF-049), mas essa informação desaparecia depois — não havia como consultar quanto tinha ganhado num atendimento já lançado sem esperar o fechamento do dia.

**Impacto:**
- `frontend/pages/Lancamentos.jsx`: comissão (`raiz.comissao` / `v.comissao`, já retornada por `GET /vendas`) exibida em 3 pontos, só quando `isBarbeiro`: card simples (embaixo do valor), cabeçalho do card agrupado (soma de todos os itens da comanda) e cada item individual quando o grupo está expandido. Nenhuma mudança de backend — o campo já vinha na resposta, só não era renderizado.

**Status:** aplicado (local — testado via API confirmando que `comissao` chega no `GET /vendas` do barbeiro logado; ex.: Corte R$45 → comissão R$18 exibida corretamente)
**Artefatos atualizados:** requisitos-funcionais-thieco (RF-075)

---

## 2026-07-09 — Caixinha (gorjeta): registro estruturado em vendas e combos

**Motivo:** Barbeiros já recebiam caixinha na prática, mas o valor só ficava registrado como texto solto no campo `observacao` (ex.: "5 caixinha", visto em SQLs históricos de importação) — sem campo estruturado, sem forma de pagamento própria, sem visibilidade no fechamento do barbeiro nem nos relatórios do admin. Decisões de produto confirmadas com Willians antes de iniciar (documentadas em `CAIXINHA-PENDENTE.md`, análise de 2026-07-06): caixinha é 100% repasse ao barbeiro, fora do faturamento e da comissão da empresa; tem forma de pagamento própria (para reconciliação de caixa físico).

**Impacto:**
- Banco: `ALTER TABLE vendas ADD COLUMN caixinha NUMERIC(10,2) NOT NULL DEFAULT 0, caixinha_forma_pagamento VARCHAR(30)` — migration aditiva idempotente. Nenhuma alteração em `financeiro_vendas` (caixinha fica fora do faturamento por design).
- `backend/routes/vendas.js`: `POST /` e `PUT /:id` ganham `caixinha` (numeric opcional) e `caixinha_forma_pagamento` (`dinheiro`/`pix`/`credito`/`debito` — nunca `cortesia`, caixinha é sempre pagamento real). `PUT` reaproveita o mecanismo genérico já existente de campos editáveis (`EDITAVEIS_BASE`).
- `backend/routes/combos.js`: mesmos dois campos no `POST /contratar`, gravados na venda de faturamento criada na contratação do combo.
- `backend/routes/painel-barbeiro.js`: `GET /fechamento` soma `total_caixinha` do dia e retorna `por_forma_pagamento_caixinha` (breakdown separado do `por_forma_pagamento` da venda — caixinha tem forma de pagamento própria, agrupar junto ao da venda misturaria os dois canais de reconciliação de caixa).
- `backend/routes/relatorios.js`: `GET /dre` — query `comissoesPorProfissional` ganha `SUM(caixinha) AS caixinha_total`, consumida por `IntelFinanceira.jsx`.
- `frontend/pages/RegistroVenda.jsx`: campo "Caixinha" (valor + forma de pagamento) na aba Venda e nos dois fluxos de dinheiro real da aba Combo (uso de créditos com item avulso, e ativação de combo novo — não no "Contratar próximo combo antecipado", fluxo secundário sem split de pagamento em array). Em comanda com múltiplos itens (produto/upsell/extras) ou pagamento dividido, a caixinha é enviada só na primeira venda criada — nunca duplicada. "Seu Ganho Total" do barbeiro passa a somar a caixinha (é repasse direto, sem percentual).
- `frontend/pages/MeuPainel.jsx`: card "Caixinha (100% seu)" no fechamento do dia, e indicador por item no detalhamento.
- `frontend/pages/IntelFinanceira.jsx`: coluna "Caixinha" na tabela HTML de comissões por profissional (relatório exportável do DRE).

**Status:** aplicado (local — testado ponta a ponta via API: venda de R$45 + caixinha de R$5 gerou comissão de R$18 normalmente sobre os 45, faturamento bruto do fechamento manteve R$90 para duas vendas de R$45 sem contar a caixinha à parte, e `caixinha_total` apareceu corretamente no DRE por profissional)
**Artefatos atualizados:** modelo-de-dados-thieco (Venda — novos campos), requisitos-funcionais-thieco (RF-074, RN-034)
**Observação:** Limitação conhecida, fora de escopo: se o barbeiro só consome crédito de combo sem nenhum item avulso (`RF-024` — uso de crédito nunca gera venda), não existe `venda` para anexar a caixinha; nesse cenário específico ela não pode ser registrada.

---

## 2026-07-11 — Fix: comissão subcalculada no backfill de migration quando qtd_clientes > 1 (TASK-20)

**Motivo:** Auditoria do backlog (TASK-20, Épico 8) revelou que as migrations de auto-correção `BACKFILL_COMISSAO_SPLIT` e `RECALC_COMISSAO_APOS_BACKFILL` (`backend/models.js`, executadas a cada boot do servidor) recalculavam `comissao_servico`/`comissao_produto` como `valor * 0.40`/`valor * 0.10`, sem multiplicar por `qtd_clientes`. Como `valor` é sempre o preço por cliente (RN estabelecida em 2026-06-05, ver v1.8), qualquer lançamento com `qtd_clientes > 1` que caísse nesse backfill (linhas com comissão ainda zerada) ficava com a comissão subcalculada. A condição `percentual_comissao > 0` restringe o efeito aos barbeiros da Mutinga (Tambore/Thieco está zerado) — daí o "(Mutinga)" no título da tarefa. O fix de qtd_clientes de 2026-06-05 já havia corrigido o caminho de escrita normal (POST/PUT `/vendas`) mas não essas duas migrations de auto-cura.

**Impacto:**
- `backend/models.js`: as duas queries passam a multiplicar por `COALESCE(v.qtd_clientes, 1)` antes de aplicar o percentual.
- Checado no banco local (2.389 vendas): nenhuma linha com `qtd_clientes > 1` estava com comissão incorreta gravada no momento do fix — sem necessidade de correção retroativa nesse ambiente. Risco residual: se o backfill já rodou anteriormente com a fórmula errada numa linha (gravando valor não-zero), a guarda de idempotência (`comissao_servico = 0 AND comissao_produto = 0`) impede que essa linha específica seja recorrigida automaticamente — precisaria de correção manual pontual se identificada.

**Status:** aplicado (local + produção)
**Artefatos atualizados:** requisitos-funcionais-thieco (RN-016, nota de abrangência)
**Observação:** Achado durante uma revisão geral do backlog, não a partir de um bug reportado pelo usuário — nenhuma venda real conhecida foi afetada até o momento do fix.

---

## 2026-07-11 — Fix de segurança: SQL injection no filtro de unidade dos relatórios

**Motivo:** Ao trabalhar no card de ranking de canais de aquisição (RF novo, ver entrada seguinte), identificado que o parâmetro `unidade` em 6 endpoints de `backend/routes/relatorios.js` (`/fluxo-caixa`, `/dre`, `/comissoes`, `/inteligencia`, `/resumo-operador`, `/origem-clientes`) era interpolado direto em SQL (`` `AND unidade = '${unidade}'` ``) sem que o resultado da validação do `express-validator` fosse checado (`validationResult(req)` nunca era chamado nesses handlers) — um valor malicioso passava direto pra dentro da query.

**Impacto:**
- `backend/routes/relatorios.js`: whitelist explícita (`['tambore','mutinga'].includes(...)`) no ponto único de extração (`resolverPeriodo`) e no caso especial de `/resumo-operador`, que lia `req.query.unidade` direto sem passar por ali.
- Testado com payload `x'; DROP TABLE vendas; --` — retornou HTTP 200 sem erro (tratado como "sem filtro"), tabela `vendas` confirmada intacta (2.389 registros).
- De brinde, corrigido `backend/.dockerignore`: um symlink de dev local (`backend/data/db` → `~/.thieco-dev/pgdata`) estava quebrando o build da imagem Docker no Docker Desktop.

**Status:** aplicado (local — build e testes de injeção confirmados; pendente aplicar na VPS)
**Artefatos atualizados:** arquitetura-thieco (Fronteiras de segurança)
**Observação:** Mesmo endpoint (`/origem-clientes`) motivou a descoberta — não era um pentest deliberado, foi achado colateral ao investigar por que o card de ranking de canais nunca tinha sido exibido em nenhuma tela.

---

## 2026-07-11 — Card de Ranking por Canal de Aquisição plugado no Painel Admin

**Motivo:** Investigação de tarefa do backlog revelou que o componente `RankingOrigemClientes.jsx` (gráfico de barras horizontais, Recharts) e o endpoint `GET /relatorios/origem-clientes` já existiam prontos e funcionais, mas o componente nunca havia sido importado em nenhuma página — órfão desde sua criação.

**Impacto:**
- `frontend/pages/IntelFinanceira.jsx`: import e montagem do `RankingOrigemClientes`, reaproveitando o mesmo `filtros` (período/unidade) já usado pelos outros cards da tela.
- Testado ponta a ponta com dado real (3 vendas de teste, uma por canal) — API devolveu os 3 canais separados corretamente (33,3% cada), confirmando que o gráfico desenha múltiplas barras quando o dado existe.

**Status:** aplicado (local)
**Artefatos atualizados:** requisitos-funcionais-thieco (Módulo 9 — Relatórios)
**Observação:** Achado de dado, não de código: hoje 100% dos atendimentos reais aparecem como "não informado" — o campo `origem_cliente` (whatsapp/indicacao/organico) existe desde a criação da Venda mas nunca foi de fato preenchido no dia a dia pelos barbeiros. O gráfico só fica útil quando esse campo passar a ser registrado na prática.

---

## 2026-07-12 — Motor de Agendamento Nativo, com página pública sem login (TASK-23)

**Motivo:** Agendamento hoje é 100% externo via Booksy (link por unidade). Objetivo: motor próprio, com calendário interno pro barbeiro (só a própria agenda) e pro admin (todas + filtro por barbeiro/unidade), mais uma página pública onde o cliente escolhe um horário realmente disponível e agenda sozinho — esse link substitui o Booksy no WhatsApp/bio do Instagram. Dados reais usados no seed: duração de cada serviço por unidade e horário de funcionamento (Ter-Qui 9h-20h, Sex-Sáb 9h-19h) extraídos do PDF "Onboarding Zion Ops — Barbearia Thieco Leandro" (Abril/2026); segunda-feira assumida fechada (não documentada explicitamente, ajustável depois).

**Impacto:**
- Banco: `catalogo.duracao_minutos` (nova coluna, seed com a duração real por serviço/unidade do PDF). Nova tabela `jornada_unidade` (horário por unidade/dia da semana, 0=domingo). Nova tabela `agendamentos` (profissional, catálogo, cliente, data/hora, status, origem). Anti-overbooking em **duas camadas**: checagem `OVERLAPS` explícita na rota (mensagem de erro amigável) + `EXCLUDE USING gist` no Postgres (`btree_gist`, rede de segurança contra corrida — dois clientes reservando o mesmo horário simultaneamente pelo link público). Testado com sobreposição real: rejeitou corretamente nos dois casos (mesmo horário/barbeiro falha; barbeiro diferente ou horário adjacente sem sobrepor passa).
- Backend (`backend/routes/agendamentos.js`, novo arquivo): rotas autenticadas (`GET/POST/PUT /agendamentos`, `PATCH /:id/status`) com escopo por papel — barbeiro só vê/edita a própria agenda, operador só a própria unidade, admin livre. Rotas **públicas sem login** (`GET /servicos`, `GET /disponibilidade`, `POST /publico`) que calculam disponibilidade real cruzando jornada da unidade + agendamentos já marcados de cada barbeiro; se `profissional_id` não informado, retorna a união de todos os barbeiros ativos ("qualquer disponível"). `POST /publico` revalida tudo no servidor — nunca confia na disponibilidade calculada no cliente.
- Frontend: tela `Agenda` (grade de horários em Tailwind puro, sem lib de calendário — nenhuma estava instalada, e o bundle já estava perto do limite recomendado) plugada no menu de barbeiro/operador/admin. Página pública `AgendamentoPublico` (fluxo sem login: serviço → data → horário real → barbeiro → dados → confirmação), acessível via `?agendar=mutinga` ou `?agendar=tambore` — reconhecida em `AppRoot()` **antes** do gate de autenticação (mesmo padrão já usado pro reset de senha via `?token=`).
- Isolamento de acesso testado: barbeiro tentando criar/ver agendamento de outro colega (payload forjado com `profissional_id` de outro barbeiro) é corretamente ignorado e forçado pra si mesmo, tanto na criação quanto na listagem.

**Status:** aplicado (local — testado ponta a ponta: disponibilidade em dia aberto/fechado, criação pública, rejeição de conflito real e de corrida simultânea, reagendamento, mudança de status; pendente aplicar na VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (3 entidades novas: Agendamento, JornadaUnidade; Catalogo ganha `duracao_minutos`), requisitos-funcionais-thieco (novo Módulo 15), arquitetura-thieco (novo bloco de fronteira de segurança — endpoints públicos deliberados), ux-flows-thieco (novo fluxo: cliente agenda via link público)
**Observação:** Fora de escopo deliberado nesta entrega: tela de configuração de jornada (só a API `GET/PUT /jornada` ficou pronta, sem UI), integração real com agente de WhatsApp (API pública já pronta pra consumir — ver entradas seguintes sobre Quasar), captcha/rate-limit no endpoint público de agendamento.

---

## 2026-07-12 — Confirmação de presença do cliente (reduz falta)

**Motivo:** Depois do motor de agendamento pronto, identificada a lacuna de como confirmar que o cliente vai realmente comparecer — reduzir falta (no-show) sem depender ainda de envio automático de WhatsApp (não implementado nesta fase).

**Impacto:**
- Banco: `agendamentos` ganha `codigo_confirmacao` (token único, gerado em toda criação — pelo link público ou internamente) e `confirmado_cliente_em` (timestamp, null até o cliente confirmar).
- Backend: rotas públicas `GET/POST /agendamentos/confirmar/:codigo` (consulta o agendamento pelo código; confirma presença, rejeita se já cancelado ou já confirmado).
- Frontend: página pública `ConfirmarPresenca` via `?confirmar=<codigo>` (mesmo padrão de rota pública fora do shell autenticado). Tela `Agenda`: selo "cliente confirmou" no card da grade (✓) e no modal de detalhe, com botão "Copiar link de confirmação" — envio pro cliente ainda é manual (copiar e mandar no WhatsApp), até a integração com agente automatizar isso.

**Status:** aplicado (local — testado ponta a ponta: geração de código, consulta, confirmação, rejeição de reconfirmação e de código inválido; pendente aplicar na VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (Agendamento — novos campos), requisitos-funcionais-thieco (Módulo 15)

---

## 2026-07-12 — Lembrete automatizado de agendamento ("disparo do próprio sistema")

**Motivo:** Complementar a confirmação de presença com um lembrete que dispara sozinho perto do horário, sem depender de alguém lembrar de mandar manualmente. Como não há envio automático de WhatsApp ainda, o sistema prepara e enfileira a mensagem — o envio de fato fica para uma integração futura (ver entradas seguintes).

**Impacto:**
- `backend/routes/notificacoes.js`: `gerarLembretesAgendamento()` detecta agendamentos confirmados a 15min de começar (com telefone cadastrado) e enfileira mensagem pronta + link de confirmação na tabela `notificacoes` já existente (`canal='whatsapp'`, `tipo='lembrete_agendamento'`) — idempotente por agendamento (nunca duplica).
- `backend/server.js`: `setInterval` roda essa checagem a cada 5 minutos.
- Novos endpoints `GET /notificacoes/whatsapp/pendentes` e `PATCH /notificacoes/whatsapp/:id/enviado` — fila de consumo pra um agente externo puxar e marcar como enviado. **Só enfileira — nada é enviado de verdade ainda.**

**Status:** aplicado (local — geração idempotente testada rodando duas vezes seguidas; pendente aplicar na VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (Notificacao — novo tipo e uso do canal `whatsapp`)

---

## 2026-07-12 — Notificações Administrativas Configuráveis: faturamento, ranking e estoque parado (TASK-29)

**Motivo:** Expandir a tela de Configurações para uma central completa: além das taxas de cartão (já existentes), o admin passa a poder ligar notificações periódicas próprias — faturamento, produtos mais vendidos, serviços mais realizados e estoque parado — cada uma configurável por unidade, com periodicidade e horário de disparo próprios. Diferente da TASK-27 (ainda não iniciada, gatilhos de marketing pro cliente: aniversariante, sumido, inadimplente, promoções) — esta é voltada pro admin, relatório operacional, não campanha.

**Impacto:**
- Banco: nova tabela `configuracoes_notificacoes` — uma linha por (unidade, tipo), com `ativo`, `periodicidade` (diário/semanal/quinzenal/personalizado), `hora_disparo` (padrão 20h — decisão explícita: relatório periódico dispara em horário fixo de fim de expediente, não só por intervalo solto em qualquer hora), `parametros` (JSONB — ex.: `dias_estoque_parado`, padrão 60), `telefone_destino`. Seed com 8 linhas (4 tipos × 2 unidades), todas desligadas por padrão.
- `backend/routes/notificacoes.js`: 4 geradores de conteúdo + `verificarNotificacoesConfiguradas()`, reaproveitando a mesma fila `notificacoes`/`canal='whatsapp'` e os mesmos endpoints de consumo já construídos pro lembrete de agendamento. "Estoque parado" é calculado por `catalogo.created_at` (data de cadastro), não pela última venda — sinaliza item que nunca girou desde que entrou no sistema, por decisão explícita.
- `backend/server.js`: segundo `setInterval` (15min) chamando a checagem — intervalo separado do lembrete de agendamento (5min), propósitos diferentes.
- `backend/routes/configuracoes.js`: `GET/PUT /configuracoes/notificacoes`.
- `frontend/pages/Configuracoes.jsx`: reestruturada em abas — "Taxas de Cartão" (conteúdo antigo, zero mudança de lógica) + "Notificações" (nova, 4 cards configuráveis).

**Status:** aplicado (local — testado ponta a ponta: geração de conteúdo real com dado real, idempotência, CRUD via API; pendente aplicar na VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (nova entidade ConfiguracaoNotificacao), requisitos-funcionais-thieco (novo Módulo 16)

---

## 2026-07-12 — Arquitetura de integração com agentes de IA mapeada (Horizon, Cortex, Quasar) — pendente, nada implementado

**Motivo:** O sistema-thieco vai eventualmente ter o envio de WhatsApp de verdade (lembrete, confirmação, relatório periódico, agendamento conversacional) feito por um ou mais agentes de IA da Zion Ops. Willians pediu para mapear a arquitetura de integração necessária e deixar documentado como pendência — sem implementar nada nesta fase, aguardando decisão de prioridade.

**Impacto (documentação apenas, nenhum código):**
- **Órbita Horizon** e **Órbita Cortex** — candidatos ao **disparo outbound** da fila de notificações (`GET /notificacoes/whatsapp/pendentes` / `PATCH .../enviado`, já prontos). Nenhum dos dois tem hoje scheduler nem gateway de WhatsApp implementado. Regra de negócio registrada: contrato de 500 disparos/mês por R$39,90, excedente cobrado à parte — contagem deve morar do lado de quem envia, não no sistema-thieco. Documentado em `orbita-horizon/BACKLOG.md` (item F8) e `orbita-cortex/BACKLOG.md` (novo arquivo).
- **Órbita Quasar** — candidato ao **agendamento conversacional inbound** (cliente marca horário batendo papo no WhatsApp): já tem a arquitetura certa (Claude 3.5 Sonnet com *function calling*, duas tools — checar disponibilidade e confirmar agendamento), hoje apontando pra uma agenda fake em memória (`tools/calendar_mock.py`) e tenant fictício. Os 3 endpoints que ele precisaria consumir (`GET /agendamentos/servicos`, `GET /agendamentos/disponibilidade`, `POST /agendamentos/publico`) já são **públicos** (sem necessidade de nova autenticação, diferente do Horizon/Cortex). Documentado em `orbita-quasar/BACKLOG.md` (novo arquivo).
- Backlog master do sistema-thieco (`kernel-hq/.../backlog-tarefas-barbeariatl.md`) ganhou TASK-30 (Horizon/Cortex) e TASK-31 (Quasar), ambas marcadas pendentes.

**Status:** mapeado — nenhuma implementação, aguardando decisão de prioridade do Willians
**Artefatos atualizados:** nenhum artefato de especificação técnica desta pasta (é integração externa, ainda sem contrato de API formal do lado de fora) — registrado aqui e nos 3 `BACKLOG.md` dos respectivos agentes, e em memória de projeto do Claude Code

---

## 2026-07-12 — TASK-27 parcial: Gatilho Aniversariante + card "Dias de Menor Movimento"

**Motivo:** Primeira fatia da TASK-27 (Painel de Gatilhos ao Cliente). Investigação revelou que o gatilho "Inadimplentes" do escopo original depende de um módulo de Fiado/Contas a Receber que não existe — Willians confirmou que **não vai ter Fiado**, então esse gatilho sai de escopo definitivamente. "Promoções" também mudou de forma (ver entrada de 2026-07-12 mais abaixo, disparo manual em vez de automático). Esta entrega cobre só Aniversariante (automático) e a analítica de apoio "Dias de Menor Movimento".

**Impacto:**
- Banco: nova tabela `configuracoes_gatilhos_cliente` (unidade, tipo, ativo, hora_disparo, template_mensagem) — diferente de `configuracoes_notificacoes` (TASK-29, relatório agregado pro admin): aqui cada linha dispara mensagem personalizada por CLIENTE quando uma condição individual é satisfeita. Seed: `aniversariante` × 2 unidades, desligado por padrão.
- `backend/routes/notificacoes.js`: `gerarGatilhoAniversariante()` cruza dia/mês de `clientes.data_nascimento` com a data atual, idempotente por ano (não repete a mesma mensagem duas vezes no mesmo aniversário). Placeholders `{nome_cliente}`/`{nome_barbearia}` no template.
- `backend/routes/relatorios.js`: nova query em `/relatorios/inteligencia` — faturamento médio por dia da semana no período filtrado, ordenado do mais fraco pro mais forte.
- `frontend/pages/IntelFinanceira.jsx`: novo card "Dias de Menor Movimento" (barras horizontais, mesmo padrão visual do Ranking de Origem), destacando os 1-2 dias mais fracos — dado de apoio pra decisão manual de promoção, não dispara nada sozinho.
- `frontend/pages/Configuracoes.jsx`: nova aba "Gatilhos ao Cliente".

**Status:** aplicado (local — testado ponta a ponta: geração real com cliente de teste, idempotência confirmada; pendente aplicar na VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (nova entidade ConfiguracaoGatilhoCliente), requisitos-funcionais-thieco (regras do gatilho aniversariante e da analítica de dias fracos)

---

## 2026-07-12 — Cadastro único do administrador + roteamento de notificações por canal + remetente WhatsApp por unidade

**Motivo:** As notificações administrativas (TASK-29) exigiam digitar o mesmo telefone manualmente em até 8 cards diferentes (4 tipos × 2 unidades). Willians pediu pra conectar isso a um cadastro único do admin, com canais de envio (WhatsApp e/ou e-mail) que ele escolhe. Em paralelo, ficou claro que Tamboré e Mutinga podem precisar disparar de números de WhatsApp diferentes (remetente), questão distinta de "pra quem a mensagem vai".

**Impacto:**
- Banco: `usuarios` ganha `telefone`, `email`, `notif_canal_whatsapp` (default true), `notif_canal_email` (default false). Coluna `telefone_destino` de `configuracoes_notificacoes` removida (ficou redundante). `notificacoes` ganha `enviado_email` (simétrica a `enviado_whatsapp`). Tabela genérica `configuracoes` ganha chaves `whatsapp_remetente_{unidade}`.
- `backend/routes/notificacoes.js`: `verificarNotificacoesConfiguradas()` passa a buscar o admin (`role='admin'`, id mais antigo — decisão explícita: `ORDER BY id ASC` pra sempre pegar a conta principal, não uma conta de teste que porventura também seja admin) e gerar 0, 1 ou 2 linhas na fila por conteúdo, uma por canal ativado.
- Novo canal `email` na fila `notificacoes`, com endpoints de consumo simétricos ao whatsapp (`GET /notificacoes/email/pendentes`, `PATCH .../enviado`) — mesmo padrão "só enfileira, não envia de verdade".
- `backend/routes/configuracoes.js`: `GET/PUT /configuracoes/perfil-admin` (auto-serviço, admin edita o próprio cadastro) e `GET/PUT /configuracoes/whatsapp-remetente`.
- `frontend/pages/Configuracoes.jsx`: 2 novos cards fixos acima das abas (cross-cutting, usados por mais de uma aba) — "Cadastro do administrador" e "Número remetente do WhatsApp por unidade".

**Status:** aplicado (local — testado ponta a ponta, incluindo um bug real encontrado na verificação: existiam 2 usuários admin no banco, e a query sem `ORDER BY` pegava um aleatoriamente; corrigido)
**Artefatos atualizados:** modelo-de-dados-thieco (Usuario — novos atributos; Notificacao — canal `email`), requisitos-funcionais-thieco (regra de roteamento por canal)

---

## 2026-07-12 — TASK-27 completa: Gatilho Cliente Sumido + Promoções (disparo manual segmentado) + cooldown anti-spam

**Motivo:** Fecha a TASK-27. Cliente Sumido segue o mesmo padrão automático do Aniversariante. Promoções mudou de escopo por decisão explícita do Willians: em vez de "cupom automático em dias de menor movimento" (ideia original), virou uma tela de **disparo manual segmentado** — admin escreve, escolhe o filtro, confere quantos vão receber e dispara na hora. Depois de construir os dois, Willians levantou uma preocupação legítima: dois gatilhos independentes (mais uma campanha manual) podiam empilhar contato no mesmo cliente em pouco tempo — daí o cooldown.

**Impacto:**
- `configuracoes_gatilhos_cliente` ganha coluna `parametros` (JSONB) e o tipo `cliente_sumido` (limite de dias sem visita configurável por unidade, padrão 45). Idempotência própria: um aviso por "sequência de ausência" — não reenvia enquanto o cliente não voltar a visitar e sumir de novo (evita um cooldown arbitrário pra esse caso específico).
- Nova tabela `campanhas_promocionais` (unidade, título, mensagem, filtro, total_destinatarios, criado_por) — log de disparo manual, sem `ativo`/`hora_disparo` (não é config, é histórico). `backend/routes/campanhas.js` novo: `GET /preview-audiencia` (unidade + dias sem visita mínimo + tipo de cliente), `POST /` dispara na hora, `GET /` histórico.
- **Cooldown de marketing:** constante `DIAS_COOLDOWN_MARKETING = 14` — nenhum cliente recebe mais de uma mensagem de marketing (aniversariante/cliente sumido/promoção) dentro de 14 dias, mesmo se ele se encaixar em mais de um gatilho/campanha. Preview de audiência mostra quantos foram pulados por esse motivo (transparência, não esconde o número).
- `frontend/pages/Configuracoes.jsx`: card "Cliente sumido" na aba Gatilhos, nova aba "Promoções" (formulário + preview de audiência + histórico).

**Status:** aplicado (local — testado ponta a ponta: idempotência do cliente sumido incluindo o "escape hatch" de nova ausência após retorno, cooldown bloqueando e liberando corretamente nos dois sentidos; pendente aplicar na VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (ConfiguracaoGatilhoCliente — novo tipo e parametros; nova entidade CampanhaPromocional), requisitos-funcionais-thieco (regras de cliente sumido, promoções e cooldown)

---

## 2026-07-12 — TASK-24: Gatilho pós-venda com link de avaliação do Google Meu Negócio

**Motivo:** Ao finalizar um atendimento, enviar automaticamente um pedido de avaliação com o link do Google Meu Negócio da unidade. Investigação mostrou que **não existe conceito de "atendimento fechado" no backend** — cada `POST /vendas` já é uma linha finalizada, e um atendimento com vários itens vira várias linhas ligadas por `venda_origem_id` (mesmo padrão de agrupamento já usado em `painel-barbeiro.js`/`relatorios.js`). Sem um evento de "fechou a comanda", a solução consistente com o resto do sistema é polling.

**Impacto:**
- `configuracoes_gatilhos_cliente` ganha o tipo `avaliacao_pos_venda` (sem uso do campo `hora_disparo` — é disparado por evento, não por horário). Tabela genérica `configuracoes` ganha `link_avaliacao_{unidade}` — sem link preenchido, a unidade não dispara nada.
- `backend/routes/notificacoes.js`: `gerarGatilhoAvaliacaoPosVenda()` agrupa vendas por `COALESCE(venda_origem_id, id)` e só considera o atendimento "fechado" quando a última linha do grupo tem 5+ minutos (`created_at`) — evita mandar a mensagem no meio de uma comanda ainda sendo montada. Idempotente por atendimento (1 mensagem por atendimento, não por linha de venda). Entra no cooldown de marketing de 14 dias já existente.
- **Fora de escopo documentado:** resgate de crédito de combo (`combos.js POST /consumo`) não insere linha em `vendas`, então não dispara — só vendas diretas e compra de combo (que insere em `vendas` normalmente) são cobertas.
- `backend/server.js`: entra no timer de 5min já existente (mesmo do lembrete de agendamento — "logo após o atendimento" pede ciclo curto, diferente dos 15min dos gatilhos de marketing).
- `frontend/pages/Configuracoes.jsx`: card "Link de avaliação (Google Meu Negócio) por unidade".

**Status:** aplicado (local — testado ponta a ponta: buffer de 5min respeitado, atendimento multi-item gerando 1 única mensagem, cliente sem telefone ignorado sem erro; pendente aplicar na VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (ConfiguracaoGatilhoCliente — novo tipo), requisitos-funcionais-thieco (regra do gatilho pós-venda)

---

## 2026-07-12 — TASK-28: Campanhas segmentadas com rastreamento de conversão

**Motivo:** Completa a tela de Promoções (TASK-27) com os dois filtros que faltavam (ticket gasto, serviço consumido) e o rastreamento de resultado pedido originalmente como "ROI". Decisão consciente: não existe custo por disparo rastreado no sistema hoje (o envio de verdade ainda depende da TASK-30/31), então um "ROI %" de fato seria uma métrica fabricada — a entrega mostra conversão e faturamento gerado, a base pronta pra virar ROI de verdade quando houver custo real por mensagem.

**Impacto:**
- Nova tabela `campanhas_destinatarios` (campanha_id, cliente_id, cliente_nome, enviado_em) — `campanhas_promocionais` só guardava a contagem de destinatários, não quem foi; sem o roster não dá pra cruzar com o que aconteceu depois.
- `backend/routes/campanhas.js`: `buscarAudiencia()` ganha filtros de ticket gasto (faixa min/max, soma histórica real de `vendas`) e serviço consumido (`EXISTS` em `vendas`). Novo `GET /campanhas/servicos-disponiveis` popula um dropdown com serviços reais da unidade. Novo `GET /campanhas/:id/resultados`: conversão = nova venda do cliente numa janela de 30 dias após o envio (constante `DIAS_JANELA_CONVERSAO`, mais longa que o cooldown de 14 dias porque medir "funcionou" pede mais tempo de observação que "não manda de novo essa semana"), taxa de conversão, faturamento gerado, agendamentos gerados na mesma janela.
- `frontend/pages/Configuracoes.jsx`: aba Promoções ganha os 2 filtros novos no formulário; histórico de disparos virou expansível, mostrando os resultados por campanha sob demanda.

**Status:** aplicado (local — testado ponta a ponta: filtros isolados/combinados batendo com dado real, roster gravado no disparo, conversão detectada dentro da janela e corretamente ignorada fora dela; confirmado pelo Willians na tela antes do commit; pendente aplicar na VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (nova entidade CampanhaDestinatario), requisitos-funcionais-thieco (regra da janela de atribuição de conversão)

---

## 2026-07-18 — Isolamento de catálogo, profissionais e clientes por unidade no backend

**Motivo:** `GET /catalogo`, `GET /profissionais` e `GET /clientes` aceitavam o parâmetro `unidade` sem validar contra o token — bastava omiti-lo (como a busca de clientes do Registro de Venda já fazia) para um barbeiro/operador ver dados da outra unidade. Convenção de isolamento existia só no frontend, não era garantida pelo backend.

**Impacto:**
- `backend/middleware/auth.js`: novo helper `decodeTokenOpcional()` — decodifica o JWT quando presente sem exigir autenticação (as 3 rotas continuam públicas para o link de agendamento sem login e para sugestões do RegistroVenda).
- `backend/routes/catalogo.js`, `backend/routes/profissionais.js`, `backend/routes/clientes.js`: quando há token válido de barbeiro/operador, a `unidade` do JWT sempre prevalece sobre a recebida via query — impede ver catálogo, colegas ou clientes de outra unidade. Comportamento de admin (sem token, ou token admin) e do link público de agendamento sem login não muda.

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (regra de isolamento por unidade nos módulos Catálogo, Profissionais e Clientes)

---

## 2026-07-18 — Edição de data e serviço liberada em lançamentos para barbeiro/operador/admin

**Motivo:** Barbeiro só podia lançar e editar vendas no dia corrente — sem meio de corrigir um lançamento esquecido de ontem sem pedir para o admin. O campo serviço também era somente-leitura na edição, forçando excluir e recriar a venda só para trocar o serviço.

**Impacto:**
- `backend/routes/vendas.js` (`PUT /vendas/:id`): removida a checagem que travava a data do lançamento ao dia atual. `data` e `servico` entram em `EDITAVEIS_BASE` — editáveis por qualquer papel (barbeiro só na própria venda, operador só na própria unidade, admin sem restrição — `profissional_id` continua exclusivo de admin).
- `frontend/src/components/CatalogoAutocomplete.jsx`: extraído do `RegistroVenda` para ser reaproveitado também na edição em `Lancamentos.jsx`, mantendo o mesmo seletor de catálogo (busca fluída, preço ao lado do nome) nos dois lugares em vez de um `<select>` nativo divergente.
- `frontend/src/pages/Lancamentos.jsx`: formulário de edição ganha os campos Data e Serviço.

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (RF-042, Módulo 2)

---

## 2026-07-18 — Fix: zera comissão de produto do Thieco (dono/admin sem comissão)

**Motivo:** Thieco (dono/admin) tinha `percentual_comissao_produto = 10%` herdado do `DEFAULT` da coluna — a migração que zera sua comissão rodava antes da coluna `percentual_comissao_produto` existir, então nada corrigia o valor depois do `ALTER` que a criou. Vendas de produto lançadas no nome dele geravam comissão indevida (2 vendas em 28/06, R$ 14,14 no total, já corrigidas diretamente no banco).

**Impacto:** `backend/models.js`: migração idempotente adicional que zera `percentual_comissao` e `percentual_comissao_produto` do Thieco especificamente depois que a coluna de produto já existe — não volta a acontecer em reset/reseed do banco.

**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-thieco (Profissional — nota em `percentual_comissao_produto`)

---

## 2026-07-18 — Exclusão de lançamentos liberada para qualquer data (barbeiro)

**Motivo:** `DELETE /vendas/:id` travava o barbeiro a excluir só vendas do dia atual — inconsistente com a edição (já liberada na mesma sessão para qualquer data) e com o admin, que nunca teve essa restrição.

**Impacto:** `backend/routes/vendas.js`: removida a checagem de data no `DELETE /vendas/:id` para o papel barbeiro — passa a excluir qualquer venda própria (`profissional_id` do JWT), de qualquer data. `frontend/src/pages/Lancamentos.jsx`: botão de excluir deixa de depender da data do lançamento.

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (RF-011, Módulo 2)

---

## 2026-07-19 — Isolamento de cliente por unidade no upsert automático (PDV/combos) [TASK-36]

**Motivo:** O upsert automático de cliente (criar-ou-atualizar ao registrar venda ou ativar combo) casava por nome sem checar `unidade` — dois clientes homônimos de Tambore e Mutinga eram tratados como o mesmo registro, mesclando `barbeiro_responsavel_id` e `ultima_visita` de unidades diferentes. O `JOIN` de `total_visitas` em `Cliente.findAll` tinha o mesmo problema (contava visitas da outra unidade).

**Impacto:** `backend/models.js` e `backend/routes/combos.js`/`backend/routes/vendas.js` — escopados por unidade nos 4 pontos de upsert/leitura por nome: registro de venda, contratação de combo (fluxo normal e migração V1→V2), e o `JOIN` de contagem de visitas. Testado ponta a ponta em ambiente local.

**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-thieco (regra de isolamento por unidade no Módulo 7 — Clientes)

---

## 2026-07-20 — Isolamento de estoque/serviços por unidade no cadastro, edição e exclusão

**Motivo:** Willians reportou que deletar um produto na aba Tamboré também apagava o mesmo produto na Mutinga, e que cadastrar um produto/serviço na aba Tamboré caía sempre na Mutinga. Investigação revelou a causa raiz: itens de categoria fora de `servico`/`combo` (produtos físicos) nunca recebiam `unidade` real no cadastro — só serviço/combo tinham o seletor de unidade no frontend. Ficavam com `unidade = NULL`, e a listagem trata `NULL` como "aparece nas duas unidades" (`unidade IS NULL OR unidade = :unidade`) — ou seja, era **a mesma linha do banco** exibida nas duas abas; deletar em uma apagava a única linha existente, que também sumia da outra.

**Impacto:**
- `backend/models.js`: `Catalogo.update`/`ajustarQuantidade` ganham parâmetro `unidadeAtual` — trava a query com `WHERE id = :id AND unidade IS NOT DISTINCT FROM :unidadeAtual` (`IS NOT DISTINCT FROM` em vez de `=` porque itens legados sem unidade têm o valor `NULL`, e `NULL = NULL` é falso em SQL).
- `backend/routes/catalogo.js`: `POST /catalogo` passa a **exigir** `unidade` válida para qualquer categoria (antes só validava para serviço/combo). `PUT`/`DELETE`/`PATCH .../quantidade` recebem `unidade_atual` (a unidade que o item tinha antes da edição, segundo o item carregado em tela) e nunca mais tocam um registro que pertença a outra unidade.
- `backend/routes/estoque.js`: `POST /estoque/consumo-interno` e `/entrada` passam a rejeitar a operação se o produto já pertence a uma unidade diferente da informada no lançamento.
- `frontend/src/pages/Estoque.jsx`: campo Unidade agora aparece no cadastro **e** na edição para todas as categorias (antes só serviço/combo). Nova categoria de produto `produto_barba` ("Barba") adicionada à lista. O valor padrão do seletor de unidade no cadastro e na edição de itens legados passa a seguir a aba/filtro de unidade ativo na tela (antes caía sempre em Mutinga, reproduzindo o mesmo bug mesmo com o seletor visível). Formulário de Consumo Interno filtra produtos pela unidade selecionada.
- 38 itens do catálogo pré-existentes ficaram com `unidade = NULL` (levantados e documentados à parte) — a maioria (36) já está desativada (`ativo = false`) e não aparece no catálogo em uso; os 2 ativos (`Condicionador Ice` #1729, `Shampoo Ice` #1727) seguem compartilhados entre as duas unidades até serem editados manualmente com a unidade correta. Nenhuma migração automática foi feita — não há sinal nos dados para inferir com segurança a qual unidade cada item pertence, decisão fica com o Willians.

**Status:** aplicado (local — build de frontend validado, `node --check` no backend; pendente aplicar na VPS)
**Artefatos atualizados:** modelo-de-dados-thieco (Catalogo — atributos reais e regra de `unidade` obrigatória), requisitos-funcionais-thieco (Módulo 5 — Catálogo)
**Observação:** Os dois papéis (Horizon/Cortex = outbound periódico; Quasar = inbound conversacional) são complementares e podem coexistir sem conflito — não é uma decisão de "escolher um".

---

## 2026-07-21 — TASK-30 revisitada: motor de disparo direto (e-mail real + WhatsApp) substitui a espera por Horizon/Cortex

**Motivo:** A entrada de 2026-07-12 tinha deixado o disparo de verdade (WhatsApp/e-mail) como pendência mapeada, aguardando decisão de qual agente da Zion Ops (Horizon ou Cortex) assumiria o envio — nenhum dos dois tinha scheduler nem gateway de WhatsApp prontos. Willians decidiu não esperar por isso: construir o disparo **diretamente no sistema-thieco**, sem agente externo, reaproveitando a fila e as configurações já existentes (nenhuma tabela nova). E-mail via Nodemailer ficou pronto e real. Para WhatsApp, a primeira tentativa foi o protocolo não-oficial (Baileys/QR, mesma base do WhatsApp Web) — mas Willians vai trazer a **chave oficial do WhatsApp Business** do Thieco (Meta Cloud API), então o Baileys fica pausado como implementação de referência, não como caminho final.

**Impacto:**
- `backend/services/emailService.js` (novo): Nodemailer real usando `SMTP_*` do `.env`, template HTML com a identidade dark/dourada do Órbita (cores extraídas de `frontend/tailwind.config.js`: onix `#0F0E0A`, gold `#D4AF37`/`#F5D76E`). Nunca lança exceção — falha de SMTP retorna `{ok:false, erro}`, não derruba o processo.
- `backend/services/whatsappService.js` (novo, **pausado**): conexão via `@whiskeysockets/baileys` (multi-device, mesmo protocolo do WhatsApp Web) — QR Code gerado com a lib `qrcode`, sessão persistida em `backend/data/whatsapp-auth` (sobrevive a reinício). Testado localmente de forma isolada: o handshake conecta ("connected to WA") mas falha durante o protocolo Noise antes de emitir o QR, de forma consistente, mesmo forçando resolução DNS IPv4 primeiro — suspeita de proxy/rede interferindo no WebSocket binário (o `docker info` da máquina de dev mostra um proxy HTTP configurado). **Decisão:** em vez de insistir no Baileys ou adotar o Evolution API (que no modo QR usa Baileys por baixo dos panos e sofreria do mesmo problema), Willians vai trazer a chave oficial da Meta Cloud API — a implementação Baileys fica **comentada no próprio arquivo** com o esqueleto pronto da troca (chamada REST simples pra `graph.facebook.com/v18.0/{phone_number_id}/messages`, sem WebSocket persistente, sem QR, sem risco de ban por automação não-oficial).
- `backend/routes/whatsapp.js` (novo): `GET /status`, `GET /qrcode`, `POST /conectar`, `POST /desconectar` — ficam órfãs/candidatas a remoção quando a migração pra Cloud API acontecer.
- `backend/routes/notificacoes.js`: `verificarNotificacoesConfiguradas()` deixou de só enfileirar — agora chama `enviarEmail()`/`enviarWhatsapp()` de verdade antes de gravar a linha em `notificacoes`, e `enviado_whatsapp`/`enviado_email` passam a refletir o resultado real do envio (antes eram sempre `false`, esperando um consumidor externo que nunca existiu).
- `backend/jobs/notificacoesJob.js` (novo): `node-cron` rodando a cada hora cheia, chamando `verificarNotificacoesConfiguradas()` — substitui o `setInterval` de 15min em `server.js` só para esse gerador (lembrete de agendamento e gatilhos por cliente continuam no `setInterval` de 5min/15min, fora de escopo desta entrega).
- `frontend/src/pages/Configuracoes.jsx`: card "Cadastro do administrador" ganha botão "QR Code" (habilitado só com telefone preenchido) e `ModalQrCodeWhatsapp` — faz polling de status/QR a cada 2,5s. Fica funcional apontando pro Baileys, mas sem uso real até a decisão da Cloud API se resolver (nesse caso o botão/modal também seriam removidos).
- Nenhuma tabela nova — reaproveita integralmente `usuarios.notif_canal_*`/`perfil-admin` e `configuracoes_notificacoes` (TASK-29), que já cobriam exatamente os campos que tinham sido pedidos como "novos" numa primeira leitura do pedido.
- Dependências novas: `nodemailer`, `node-cron`, `@whiskeysockets/baileys`, `qrcode`.
- Testado localmente com o banco Docker real (`thieco_db`, não o Postgres embarcado — este teve um erro pré-existente e não relacionado na extensão `unaccent`, não investigado por estar fora de escopo): migrations rodaram limpo, login e os 4 endpoints novos de `/whatsapp` responderam corretamente.

**Status:** parcial — e-mail aplicado (local; falta só o Willians preencher a senha de app do Gmail em `backend/.env`, `SMTP_PASS`); WhatsApp implementado mas **pausado**, aguardando a chave oficial da Meta Cloud API; nada disso em produção/VPS ainda.
**Artefatos atualizados:** requisitos-funcionais-thieco (Módulo 16 — RF-083 e nova regra de disparo real), modelo-de-dados-thieco (Notificacao — semântica de `enviado_whatsapp`/`enviado_email`), arquitetura-thieco (v2.19 — novos serviços e job), backlog-tarefas-barbeariatl (TASK-30 revisitada)

---

## 2026-07-23 — Isolamento de alertas internos (SinoBadge) por unidade + selo de unidade na UI

**Motivo:** Willians reportou que o painel de notificações (SinoBadge, `canal='sistema'` — diferente do disparo administrativo do Módulo 16) precisava de duas coisas: cada barbeiro/operador ver só o alerta da própria unidade, e a tela de admin do Thieco ver os alertas das duas unidades juntos, com o produto e a unidade visíveis em cada item. Investigação revelou três bugs reais, não só ausência de feature:

1. **Admin nunca via as duas unidades.** O JWT do admin carrega `unidade: 'tambore'` (herdado do vínculo dele como profissional/barbeiro) — igual ao caso já conhecido de Profissionais/Catálogo/Clientes (RN-052/055/057). O código de `GET /notificacoes` e `POST /gerar` caía nesse valor sempre que a query vinha vazia (`req.query.unidade || req.user.unidade || null`), então o admin ficava travado só nos alertas de Tamboré sem perceber.
2. **Dedup de ranking semanal não era escopado por unidade.** A checagem "ranking já gerado hoje" era uma query global — a unidade que abrisse o painel primeiro no dia "travava" a vaga, e a outra unidade nunca ganhava ranking gerado naquele dia. Só passou a importar agora que barbeiro/operador de unidades diferentes chamam `/gerar` (antes só o admin acessava o endpoint).
3. **`PATCH /:id/lida` sem checagem de unidade.** Qualquer usuário autenticado podia marcar como lida uma notificação de qualquer unidade só adivinhando o `id` — não havia `WHERE unidade = ...` nenhum.

**Impacto:**
- `backend/routes/notificacoes.js`: middleware de `POST /gerar`, `GET /`, `PATCH /lidas` e `PATCH /:id/lida` trocado de `authenticate, requireAdmin` para só `authenticate` (abre pra barbeiro/operador, antes admin-only). Novo helper `unidadeEfetiva(req)`: barbeiro/operador sempre usam `req.user.unidade` (JWT prevalece sobre query, mesmo padrão de Profissionais/Catálogo/Clientes); admin usa `req.query.unidade` só se informada, senão `null` (sem filtro = as duas unidades). Dedup de ranking e `PATCH /:id/lida` passam a incluir a unidade na cláusula `WHERE`.
- `frontend/src/components/Header.jsx`: `SinoBadge` deixa de aparecer só pra `user?.role === 'admin'` — aparece pra qualquer `user` autenticado (o `Header` já era compartilhado entre `AppOperador`/`AppBarbeiro`/`AppAutenticado`, só faltava a condição).
- `frontend/src/components/NotificacoesPanel.jsx`: cada item ganha um selo (`LABEL_UNIDADE`: Tamboré/Mutinga) ao lado do título quando `n.unidade` não é nulo. O nome do produto já vinha no título (ex.: "Estoque zerado: Pomada Pistache - Fox") — só faltava a unidade.
- `backend/services/whatsappService.js`: durante a re-validação, um teste local de ~48min crashou o processo (`nodemon app crashed`) — o handler de reconexão do Baileys chamava `iniciarConexao()` sem delay a cada queda, loop apertado esgotou recursos. Corrigido com backoff exponencial (`1000 * 2^tentativas`, teto 30s) e limite de 15 tentativas antes de exigir `POST /whatsapp/conectar` manual. Fix de resiliência, não relacionado ao isolamento de alertas, mas feito na mesma sessão ao reiniciar o backend pra validar o fix acima.

**Testado ponta a ponta (ambiente local, banco Docker real):**
- Admin (thieco): `GET /notificacoes` sem filtro retorna alertas de **ambas** unidades numa chamada só (confirmado com 2 notificações de teste inseridas, uma por unidade, removidas depois).
- Barbeiro (Igor, unidade Mutinga): `GET /notificacoes?unidade=tambore` — o parâmetro é ignorado, só retorna a notificação de Mutinga (mais as de `unidade IS NULL`, visíveis a todos).
- Barbeiro tentando `PATCH /notificacoes/114/lida` (114 = notificação de Tamboré, não é dele): resposta `{ok:true}` genérica, mas a linha **não** foi alterada (`lida` continuou `false`) — confirma que o `WHERE` de unidade bloqueou o update de fato.
- Descoberta lateral (não é bug de código): os 31 itens de catálogo com `controla_estoque=true` estão todos com `unidade=NULL` hoje (produtos legados, ver `produtos-legado-unidade-nula.md`) — por isso os alertas de estoque não mostram selo de unidade ainda; assim que forem migrados pra uma unidade real, o selo aparece automaticamente, sem mudança de código.

**Status:** aplicado e testado localmente (commit `d3ed046`, push feito pra `main`); pendente aplicar na VPS.
**Artefatos atualizados:** requisitos-funcionais-thieco (Módulo 13 — RF-061 a RF-064, novo RN-059), modelo-de-dados-thieco (Notificacao — nota de isolamento por unidade), arquitetura-thieco (v2.20 — isolamento de alertas + backoff do WhatsApp), backlog-tarefas-barbeariatl (TASK-37)

---

## 2026-07-25 — Pivô de Baileys pra Evolution API: WhatsApp real sai do papel

**Motivo:** A entrada de 2026-07-21 tinha deixado o Baileys pausado esperando a chave oficial da Meta Cloud API, por causa da falha de handshake (WebSocket binário quebrando no protocolo Noise, suspeita de proxy da máquina de dev). Em vez de esperar pela Cloud API (processo de aprovação da Meta, mais lento) ou insistir no Baileys direto no processo Node do próprio backend, a decisão foi rodar o **Evolution API como serviço próprio, containerizado** (`evolution_api` + `evolution_postgres` + `evolution_redis`) — ele usa Baileys por baixo dos panos, mas isolado num container com sua própria rede, evitando o problema de proxy que bloqueava a tentativa anterior. E-mail migrou de Nodemailer/Gmail (dependia de senha de app pendente) pra Resend (API key, sem SMTP).
**Impacto:**
- `backend/services/emailService.js`: reescrito pra Resend (`RESEND_API_KEY`), mesmo template HTML dark/dourado.
- `backend/services/whatsappService.js`: reescrito do zero pra Evolution API — `instance/create`, `instance/connect`, `instance/connectionState`, `instance/fetchInstances`, `message/sendText`, `message/sendMedia`, `webhook/set` (registra o webhook de resposta automática no momento da conexão). Baileys/`qrcode` removidos das dependências.
- Dependências removidas: `@whiskeysockets/baileys`, `nodemailer`. Novas: `resend`.
**Status:** aplicado, testado localmente e em produção (VPS) — commits `1fa8748`, `315dc83`.
**Artefatos atualizados:** arquitetura-thieco, requisitos-funcionais-thieco

---

## 2026-07-25/28 — WhatsApp multi-canal em produção + concierge de IA (Quasar) e canal administrativo (Cortex) ativos

**Motivo:** Com o Evolution API funcionando, a Thieco passou a ter 3 canais reais de WhatsApp — Mutinga, Tamboré e um canal "admin" — e a IA conversacional (Órbita Quasar, já mapeada em 2026-07-12 como "pendente, nada implementado") pôde finalmente ser ligada de ponta a ponta: cliente manda mensagem de verdade pro número da unidade, o sistema responde automaticamente. O canal admin ganhou seu par: o Órbita Cortex passa a atender pedidos de relatório sob demanda por WhatsApp.

**Impacto:**
- **`backend/services/whatsappService.js`:** `CANAIS_VALIDOS = ['mutinga', 'tambore', 'admin']`. `nomeInstancia(canal)` monta o nome da instância Evolution API por canal (`{EVOLUTION_INSTANCE_NAME}-{canal}`). `urlAgentePorCanal(canal)`: `admin` → Cortex, `mutinga`/`tambore` → Quasar (`CANAIS_COM_ATENDIMENTO_IA`) — cada canal tem seu próprio webhook configurado no `instance/create`/reconexão.
- **`backend/routes/whatsapp.js`:** rotas ganham `:canal` — `GET/POST /whatsapp/:canal/status|qrcode|conectar|desconectar`.
- **Concierge Quasar (canais de unidade):** responde automaticamente com FAQ da unidade, oferece transbordo pra humano (endpoint `POST /notificacoes/transbordo`, novo), e desde `6febbbf`/`41` manda a foto da unidade (Mutinga) via `message/sendMedia` quando a resposta menciona o Booksy ou o endereço. Link preview desativado no envio (`linkPreview: false`) pra não gerar thumbnail feia quando a resposta cita um link.
- **Canal administrativo Cortex:** `GET /notificacoes/relatorio-sob-demanda` (novo) — admin manda mensagem tipo "faturamento de hoje" pro canal admin, Cortex classifica o pedido e chama esse endpoint, que devolve dado real agregado (faturamento, ranking de barbeiros, estoque parado, ticket médio — tipos foram adicionados incrementalmente, `1413ce7`→`64472f7`). `GET /notificacoes/admin-autorizado` (novo, `f792b79`) — checagem de telefone **antes** de processar qualquer pedido, corrigindo um loop infinito de resposta que acontecia quando alguém não-autorizado mandava mensagem pro canal admin.
- **Alertas de sistema → WhatsApp real:** `d33cff7` — alertas voláteis (estoque zerado, meta batida) que já apareciam no SinoBadge (ver entrada 2026-07-23) passam também a notificar o admin via WhatsApp, não só ficar no sininho.
- **Infra:** `backend/whatsappService.js`/Cortex/Quasar passam a se conectar entre si pela rede Docker compartilhada `orbita_shared` (fix `56174dc`), não mais `host.docker.internal` — necessário pra funcionar igual em dev e na VPS.
**Status:** aplicado, testado ponta a ponta com mensagem real de WhatsApp pro número de Mutinga (resposta automática do Quasar confirmada) e deployado na VPS (Cortex e Quasar rodam como microservices Python compartilhadas, fora deste repositório — mesma dupla que depois foi portada pro sistema-orbita-whitelabel, ver [[arquitetura-kernel]] 2026-07-28).
**Artefatos atualizados:** arquitetura-thieco, requisitos-funcionais-thieco

---

## 2026-07-28 — Contrato de `notificar-admin` do Cortex simplificado (efeito colateral da portabilidade do whitelabel)

**Motivo:** Ao portar o canal administrativo do Cortex pro sistema-orbita-whitelabel (multi-tenant, sem dicionário fixo de cliente), o endpoint `POST /api/v1/cortex/notificar-admin` do Cortex — até então indexado por `tenant_id` contra um dicionário Python fixo (`INSTANCIA_ADMIN_POR_TENANT`) — passou a receber o nome da instância Evolution API diretamente, eliminando esse dicionário também para o caso do thieco.
**Impacto:**
- `backend/routes/notificacoes.js`: `notificarAdminViaCortex(telefone, mensagem)` agora envia `{ instancia: 'thieco-admin', telefone, mensagem }` em vez de `{ tenant_id: 'sistema_thieco', telefone, mensagem }`. Mesmo destino real (a instância do canal admin do Thieco não mudou de nome), comportamento idêntico — mudança de contrato, não de resultado.
**Status:** aplicado, verificado por leitura (mesmo destino, `thieco-admin` já era o nome da instância) — não exigiu novo teste ponta a ponta.
**Artefatos atualizados:** —
**Observação:** Decisão completa da portabilidade documentada em [[arquitetura-kernel]] e `registro-de-decisoes-orbita-whitelabel` (fora deste domínio) — essa entrada existe só para registrar o efeito colateral no lado thieco.
**Observação:** TASK-31 (Quasar, agendamento conversacional inbound) continua intocada e pendente — é uma frente diferente (inbound vs. outbound), sem relação com esta decisão.

---

## 2026-07-28 — Botão de desconectar WhatsApp direto no card de remetente (Configurações)

**Motivo:** O botão "Desconectar" só existia dentro do modal de QR Code, depois de abrir e ver que o canal já estava pareado — obrigava um clique a mais (e certa procura) só pra encerrar uma sessão do WhatsApp. O card de remetente (Tamboré/Mutinga/Admin) já existia desde o multi-canal (2026-07-25/28), mas não sabia se cada canal estava conectado.
**Impacto:**
- `frontend/src/pages/Configuracoes.jsx`: `CardRemetenteWhatsApp` passa a carregar o status de pareamento dos 3 canais (`api.whatsapp.status(canal)`) ao montar. Novo componente `BotaoConexaoWhatsapp` alterna entre "QR Code" (desconectado) e "Desconectar" (conectado, ícone `LogOut` + `confirm()` nativo) direto ao lado do campo de número, sem precisar abrir o modal. Mostra o número pareado abaixo do campo quando conectado.
- Fechar o modal de QR Code também recarrega o status (`carregarStatus()`), pra refletir de imediato um pareamento recém-feito.
- Nenhum endpoint novo — reaproveita `GET /whatsapp/:canal/status` e `POST /whatsapp/:canal/desconectar`, já existentes desde o multi-canal.
**Status:** aplicado.
**Artefatos atualizados:** arquitetura-thieco, ux-flows-thieco.

---

## 2026-07-28 — Fix: seletor de Serviço/Produto no PDV usa categoria, não `controla_estoque`

**Motivo:** O PDV (`RegistroVenda.jsx`, abas Venda e Combo) dividia o catálogo entre os seletores "Serviço" e "Produto" filtrando por `controla_estoque` — um item sem "Controla estoque" marcado (ex.: snack/bebida cadastrado sem controle de quantidade) caía escondido dentro do seletor de Serviço, misturado com Corte/Barba, em vez de aparecer em Produto. `controla_estoque` é sobre controle de quantidade em estoque, não sobre em qual aba do PDV o item deve aparecer — os dois conceitos vinham sendo tratados como se fossem o mesmo.
**Impacto:**
- `frontend/src/pages/RegistroVenda.jsx`: nova função `separarServicosProdutos(catalogo)` divide pela `categoria` do item (`servico`/`combo` → seletor Serviço; qualquer outra categoria → seletor Produto). Usada em `AbaVenda` e `AbaCombo`, substituindo os dois filtros por `controla_estoque` que existiam soltos em cada aba.
- Não muda a classificação de backend (comissão, upsell, alertas de estoque) — RN-019/RF-021 (`requisitos-funcionais-thieco`) continuam usando `controla_estoque` como fonte da verdade pra isso; a mudança é só sobre qual aba do PDV mostra o item.
**Status:** aplicado.
**Artefatos atualizados:** ux-flows-thieco.

---

## 2026-08-04 — Fix: canal de notificações administrativas fora do ar desde 28/07 (contrato do Cortex não deployado + 3 canais WhatsApp desconectados)

**Motivo:** Willians reportou suspeita de que o canal de notificações não estava funcionando. A entrada de 2026-07-28 ("Contrato de `notificar-admin` do Cortex simplificado") tinha registrado a mudança como "verificado por leitura... sem mudança de comportamento" — essa verificação foi só do lado do código do sistema-thieco, nunca confirmada ponta a ponta contra o que estava de fato rodando no container do Cortex na VPS. Investigação revelou duas causas empilhadas, cada uma escondendo a próxima.

**Impacto:**
1. **Contrato desalinhado de verdade:** o `PayloadNotificarAdmin` do Cortex, na VPS, continuava exigindo `tenant_id` (campo removido do payload que o sistema-thieco manda desde a entrada de 2026-07-28) — toda chamada de `POST /api/v1/cortex/notificar-admin` retornava HTTP 422 antes mesmo de tentar enviar pelo WhatsApp. Quase uma semana de notificação administrativa (faturamento, ranking de produtos/serviços, alertas de estoque/meta) silenciosamente não entregue — `enviado_whatsapp=false` acumulando na fila sem que ninguém percebesse. Corrigido: `orbita-cortex/main.py`, `PayloadNotificarAdmin.instancia` em vez de `tenant_id`, commit `34abea5` (`orbita-workspace`).
2. **Descoberta de deploy:** `/var/www/orbita-agents/cortex` e `/var/www/orbita-agents/quasar` na VPS **não são clones git** (sem `.git`) — foram publicados por cópia manual de arquivo em algum momento anterior. Isso explica por que o fix do contrato nunca chegou lá mesmo com o commit já existindo no repositório desde 28/07: não existia mecanismo de `git pull` funcionando naquele diretório. Corrigido por patch direto do arquivo na VPS (substituição de texto exata via script Python, mais seguro que editar à mão) + `docker compose up -d --build`. Reconfigurar esses diretórios como clone git de verdade fica como pendência em aberto, não decidida nesta sessão.
3. **Depois de corrigir o 422**, a Evolution API passou a responder HTTP 400 (`Cannot read properties of undefined (reading 'id')` — sintoma de sessão Baileys quebrada). Investigando: **os 3 canais Evolution API (`thieco-admin`, `thieco-mutinga`, `thieco-tambore`) estavam com `connectionStatus: "connecting"` desde 28/07/2026** — Willians tinha usado o botão "Desconectar" (ver entrada 2026-07-28, `74b0d21`) nos 3 canais pra testar com o número pessoal dele, e nenhum reconectou de verdade depois (ficaram numa sessão travada, nem `open` nem `close`). `thieco-tambore` nunca teve `ownerJid` registrado — nunca chegou a ser pareado de verdade. **Impacto real maior que o esperado: o atendimento automático do Theo (Quasar) pode ter ficado fora do ar pra cliente de Mutinga e Tamboré a semana inteira, não só a notificação do admin.**

**Testado:** fix do contrato confirmado rodando na VPS (`docker exec orbita_cortex python3 -c "..."` mostrando `instancia: str`); reenvio de teste de notificação pendente ainda bloqueado pelo item 3 (canais desconectados) — 3 notificações (faturamento, serviços mais realizados, produtos mais vendidos) continuam com `enviado_whatsapp=false` aguardando reconexão pra reenvio.

**Status:** parcial. Fix de código aplicado e deployado (item 1 e 2). Reconexão dos 3 canais WhatsApp (item 3) pendente — combinado que o Thieco (dono, não confundir com o assistente Theo) vai logar o número dele mesmo no sistema em 2026-08-05, parando de usar o número pessoal do Willians nos canais de unidade.
**Artefatos atualizados:** arquitetura-thieco (v2.24), infraestrutura-da-vps (deploy sem git dos agentes Cortex/Quasar), `Playbook DevOps - Comandos Docker e Bancos.md` (comandos de diagnóstico Evolution API + patch sem git).
**Observação:** a lição principal não é o bug em si, é que "verificado por leitura" (entrada de 2026-07-28) não é o mesmo que "verificado em produção" — mudança de contrato entre dois serviços deployados separadamente precisa de teste ponta a ponta contra o que está rodando de verdade, não só revisão de diff.

---

## 2026-08-04 — Theo (Quasar) nunca arredonda preço na resposta ao cliente

**Motivo:** Willians reportou que o Theo estava passando informação errada ao cliente. Preços conferidos contra o catálogo real de produção (Mutinga e Tamboré) bateram 100% — não é tabela desatualizada. Willians foi confirmar com o Thieco (dono) o caso exato antes de mexer em mais código, mas adiantou uma regra que vale independente do achado específico: o Theo nunca pode arredondar valor.

**Impacto:**
- `orbita-quasar/database.py`, bloco `FAQ_THIECO_COMUM` (regras comuns às duas unidades): nova regra explícita — "NUNCA arredonde valores. Informe sempre o preço exato, com centavos, exatamente como está na tabela [...] mesmo que soe estranho na fala, o cliente é cobrado pelo valor exato." Vários combos têm centavos quebrados (Combo - Corte + Sobrancelha R$ 59,25, Combo - Corte + Risco + Sobrancelha R$ 69,13, Combo - Corte + Barba + Risco R$ 88,88, Dia de Princeso R$ 138,25) — um LLM respondendo em tom de conversa tem tendência natural a arredondar ("uns 90 reais") em vez de citar o valor exato, o que gera atrito quando o cliente é cobrado o valor certo na hora do pagamento.
**Status:** aplicado e deployado (commit `30a1064`, `orbita-workspace`; confirmado rodando via `docker exec orbita_quasar python3 -c "import database; print(database.FAQ_THIECO_COMUM)"`).
**Artefatos atualizados:** —

---

## 2026-08-06/07 — Fix: `thieco_db` parado + `DB_HOST` colidindo entre projetos (causa real do "Theo não responde") + 4 melhorias no Theo + confirmação de que a produção real é a VPS, não o desktop

**Motivo:** Willians reportou "cadê o Theo, não me respondeu". Investigação revelou uma causa de infra mais grave que qualquer coisa relacionada à sessão WhatsApp em si, e expôs um erro de suposição sobre topologia de deploy que vinha de sessões anteriores.

**Impacto:**
1. **`thieco_db` parado (~2026-08-05 11:19, shutdown limpo) sem reconectar sozinho.** Na tentativa de religar, `thieco_api` entrou em crash-loop de ~30h com `password authentication failed for user "postgres"` — senha certa, **banco errado**: `docker-compose.yml` usava `DB_HOST: postgres` (nome do *service*), e a rede compartilhada `orbita_shared` tem outro projeto (`kernel`) com um service também chamado `postgres`. Com o container attachado nas duas redes, o DNS resolvia pro banco do kernel. Corrigido pra `DB_HOST: thieco_db` (nome do *container*, único no host) — commit `7ed95ef`. Mesma convenção que Evolution API/Cortex/Quasar já seguiam no próprio `docker-compose.yml`; só o `DB_HOST` tinha ficado de fora.
2. **Confirmado (ao ler `infraestrutura-da-vps` por outro motivo) que a produção real do sistema-thieco é a VPS `2.24.93.178`** (`/var/www/sistema-thieco`, `barbeariatl.online`) — o desktop local do Willians é só ambiente de dev/teste. O fix do item 1 tinha sido feito e testado só no desktop; precisou ser replicado manualmente na VPS (`git pull` + rebuild, depois de configurar Deploy Key SSH pro GitHub — senha por HTTPS não é mais aceita) pra valer de verdade. Ver seção "Autenticação do `git pull` na VPS" em [[infraestrutura-da-vps]].
3. **4 melhorias no Theo (Quasar)**, commitadas em `orbita-workspace` (`orbita-quasar/main.py`+`database.py`) e replicadas manualmente na VPS via `scp` (sem git em `/var/www/orbita-agents/quasar`, ver [[infraestrutura-da-vps]]):
   - Saudação sem "digital", com o **nome do cliente** antes do "!" (`"Boa tarde Aline! Aqui é o Theo..."`) quando o WhatsApp manda `pushName` real.
   - Horário de funcionamento **específico por unidade** (antes Mutinga e Tamboré compartilhavam o mesmo bloco, com o horário certo só pra Mutinga) — Mutinga: Seg-Sex 9h-20h, Sáb 9h-19h · Tamboré: Seg-Sex 9h-19h, Sáb 9h-17h.
   - Nova ferramenta `calcular_total_servicos` — preço de serviço/combo (único ou soma de vários) passa a vir de `GET /agendamentos/servicos` (catálogo real) em vez da tabela estática do FAQ, que já estava desatualizada (Combo Corte+Barba real R$80,00, tabela dizia R$79,00). Tabela do FAQ virou só fallback.
   - Nova ferramenta `manter_silencio_mesmo_assunto` — depois de escalar um assunto pro humano, o Theo não insiste nele se o cliente mandar outra mensagem sobre o mesmo tema, mas continua respondendo normalmente sobre assunto diferente. Mensagem de transbordo deixou de citar "Thieco"/"gerente" nominalmente (só "o responsável"). Nova regra de concordância verbal (erro real observado: "Avalia corte" → "Quer avaliar corte").
4. **Meta description da página de login** (`frontend/index.html`) — Google gerava o snippet de busca a partir do texto cru do formulário (sem `<meta name="description">`). Adicionada descrição profissional.

**Testado:** todos os itens confirmados rodando de verdade na VPS — `docker exec thieco_api printenv DB_HOST` → `thieco_db`; `curl https://barbeariatl.online` → 200 + meta description nova no HTML; chamada real ao `/api/v1/quasar/chat` do Quasar na VPS devolvendo saudação com nome + preço real (R$80,00) + tom calibrado.

**Status:** aplicado e deployado (sistema-thieco: commits `7ed95ef`, `82eea61`; orbita-quasar: commits `252957d`, `3c2ffa2`, `3b3454c` em `orbita-workspace`, + scp manual pra VPS).
**Artefatos atualizados:** infraestrutura-da-vps (incidente DB_HOST + autenticação SSH do git pull), `Playbook DevOps - Comandos Docker e Bancos.md` (mesmo incidente, com diagnóstico reproduzível + setup de Deploy Key).
**Observação:** a lição principal, de novo (mesma da entrada 2026-08-04): nunca assumir que um ambiente de dev/teste é a produção real sem confirmar contra a documentação de infra — o desktop e a VPS podem estar em estados completamente diferentes, e um fix "funcionando" localmente não vale nada pro cliente até ser replicado no ambiente real.
**Observação:** a informação errada específica que motivou o relato original ainda não foi identificada — aguardando Willians confirmar com o Thieco. Não é a tabela de preços (conferida e correta); pode ser equipe, endereço, horário, ou o Theo respondendo algo fora do FAQ.

---

## 2026-08-07 — Fix: Theo usa nome completo do cliente e repete saudação/"tudo bem?" em toda mensagem

**Motivo:** Willians mandou print de conversa real (cliente "Thiago Ermão", pushName do WhatsApp "Thiago Leandro") mostrando dois problemas: o Theo chamou o cliente de "Thiago Leandro" (nome completo) e repetiu "Thiago, tudo bem?" em praticamente toda resposta da conversa, incluindo respostas de preço e agendamento onde isso não fazia sentido.

**Impacto:**
- `orbita-quasar/main.py`, início de `gerar_resposta_quasar`: `nome_cliente = nome_cliente.split()[0]` pra produto thieco, cortando o nome pro primeiro token assim que ele entra na função — corrigido **em código**, não só via instrução de prompt, porque o modelo não vinha respeitando "só primeiro nome" de forma confiável em toda mensagem da conversa.
- `orbita-quasar/database.py`, `FAQ_THIECO_COMUM`: regra de tom reescrita — nome do cliente e "tudo bem?" aparecem só na saudação inicial (uma vez), nunca mais depois disso na mesma conversa. A versão anterior ("sempre que voltar a falar, cheque com tudo bem?") tinha ficado ambígua o suficiente pro modelo aplicar em toda resposta, não só ao retomar depois de um intervalo.
**Testado:** reproduzida a conversa exata do print (nome completo + 2 mensagens seguidas) tanto local quanto na VPS de produção — segunda versão devolve só "Thiago" na saudação e vai direto ao ponto nas mensagens seguintes, sem repetir nome nem "tudo bem?".
**Status:** aplicado e deployado (commit `7800154`, `orbita-workspace`, replicado na VPS via `scp` em `/var/www/orbita-agents/quasar`).
**Artefatos atualizados:** `Playbook DevOps - Comandos Docker e Bancos.md`.
**Observação:** entre o commit anterior desta mesma sessão e este, outra sessão/processo comitou e deu push direto no `main` do `orbita-workspace` (`f7ca3bf`, trabalho pendente da Lane Confeitaria) sem coordenação — a técnica de isolamento por reconstrução a partir do HEAD (ver entrada 2026-08-06/07) precisou ser refeita contra o HEAD novo. Sinal de alerta útil pra próxima vez: um diff que deveria ser pequeno aparecendo gigante é motivo pra conferir `git log --oneline` antes de desconfiar da própria lógica.