# 📋 Backlog de Tarefas - Atualização do Sistema Órbita

Este documento centraliza as melhorias de regras de negócio, correções de métricas e alinhamento de painéis (Admin vs. Colaborador) identificados nos feedbacks e fechamentos de Maio/2026, com foco no processamento dos dados de Junho/2026[cite: 1].

---

## 🟥 Épico 1: Correção da Regra de Negócio de Atendimentos (Métrica Crítica)
> **Objetivo:** Impedir que múltiplos serviços em um mesmo atendimento inflem artificialmente o número de clientes atendidos na tela do barbeiro[cite: 1].

- [x] **TASK-01: Alteração da Lógica de Agregação no Backend (Query/API)**[cite: 1]
  * **✅ Concluído** — `backend/routes/painel-barbeiro.js` · endpoint `/resumo` usa `COUNT(DISTINCT COALESCE(venda_origem_id, id))` · alinhado com `relatorios.js`[cite: 1]

- [x] **TASK-02: Criação do Campo Duplo no Painel do Barbeiro**[cite: 1]
  * **✅ Concluído** — `frontend/src/pages/MeuPainel.jsx`[cite: 1]

- [x] **TASK-02B: Exibição de Ganho Estimado (Comissão) no Fechamento da Venda**[cite: 1]
  * **✅ Concluído** — `frontend/src/pages/RegistroVenda.jsx` + `backend/routes/auth.js` (percentual_comissao no payload JWT)[cite: 1]

---

## 🟨 Épico 2: Sincronização e Auditoria de Telas (Barbeiro vs. Admin)
> **Objetivo:** Eliminar divergências de dados entre o painel de gerenciamento (Admin) e o painel individual do colaborador[cite: 1].

- [x] **TASK-03: Unificação do Endpoint de Métricas**[cite: 1]
  * **✅ Concluído** — `/resumo` refatorado, `ticket_medio` calculado por atendimento (`faturamento / total_atendimentos`)[cite: 1]

- [x] **TASK-04: Tela de Logs de Fechamento de Caixa**[cite: 1]
  * **✅ Concluído** — `backend/routes/painel-barbeiro.js` endpoint `GET /fechamento?data=YYYY-MM-DD` + `ModalFechamento` em `MeuPainel.jsx`[cite: 1]

- [x] **TASK-36: Isolamento de Clientes por Unidade no Cadastro Automático (PDV)**
  * **✅ Concluído** — bug real encontrado, não só de exibição: o upsert automático de cliente ao fechar uma venda (`backend/routes/vendas.js`) e os dois fluxos de combo (`backend/routes/combos.js`: ativação normal e migração V1→V2) casavam o cliente só por nome (`LOWER(nome) = LOWER($1)`), sem checar `unidade` — igual ao padrão já usado corretamente em outro ponto do código (`models.js:1207`). Na prática, dois clientes com o mesmo nome em unidades diferentes (ex.: "João Silva" em Tamboré e em Mutinga) eram tratados como a mesma pessoa: a venda da segunda unidade sobrescrevia `barbeiro_responsavel_id` e `ultima_visita` do registro da primeira, sem nunca corrigir a `unidade` do cliente. O JOIN de `total_visitas`/`ultima_visita` em `Cliente.findAll` (`backend/models.js`) também casava por nome sem escopo de unidade, somando visitas das duas unidades no mesmo card de cliente. Corrigido nos 4 pontos (3 upserts + 1 join) adicionando o filtro/condição de `unidade`. **Testado ponta a ponta** (ambiente local, banco de dev — 2.391 vendas, não a base de produção): registradas 2 vendas de teste com nome de cliente idêntico em unidades diferentes; antes do fix teriam virado 1 registro mesclado, depois do fix geraram corretamente 2 registros de cliente separados (um por unidade, `total_visitas=1` cada, sem contaminação cruzada). Dados de teste removidos após a validação.

- [x] **TASK-37: Isolamento de Alertas Internos (SinoBadge) por Unidade + Selo de Unidade**
  * **✅ Concluído** — Willians pediu que cada barbeiro veja só o alerta da própria unidade, e que a tela de admin veja as duas unidades juntas, com produto e unidade visíveis em cada item. Três bugs reais encontrados: (1) admin nunca via as duas unidades porque o JWT dele carrega `unidade='tambore'` (herdado do vínculo como profissional) e o código antigo caía nesse valor por padrão em vez de não filtrar; (2) a checagem de "ranking semanal já gerado hoje" não era escopada por unidade — travava a vaga pra quem abrisse o painel primeiro no dia; (3) `PATCH /:id/lida` não checava a unidade da notificação, deixando marcar como lida qualquer `id` de qualquer unidade. `backend/routes/notificacoes.js`: middleware de 4 endpoints trocado de admin-only pra `authenticate`; novo helper `unidadeEfetiva(req)` (JWT prevalece pra barbeiro/operador, mesmo padrão de Profissionais/Catálogo/Clientes; admin sem query vê tudo). `Header.jsx`: sino liberado pros 3 papéis. `NotificacoesPanel.jsx`: selo de unidade (Tamboré/Mutinga) ao lado do título. **Testado ponta a ponta** com login real (admin + barbeiro Igor) e notificações de teste inseridas/removidas — confirmado admin vendo as duas unidades, barbeiro travado na própria mesmo forçando `?unidade=` na query, e `PATCH /:id/lida` bloqueando update cross-unidade. Achado lateral (dado, não código): os 31 itens de catálogo com estoque controlado estão todos com `unidade=NULL` hoje (produtos legados) — por isso o selo ainda não aparece nos alertas de estoque, só quando esses itens forem migrados pra uma unidade real.

---

## 🟩 Épico 3: Módulo de Descontos, Consumos e Compras Internas
> **Objetivo:** Automatizar o abatimento de produtos consumidos e gastos por profissionais diretamente no faturamento líquido[cite: 1].

- [x] **TASK-05: Integração com a Aba "Compra Funcionário" (Débitos do Barbeiro)**[cite: 1]
  * **✅ Concluído** — migration em `backend/models.js` + `GET/POST/DELETE /painel-barbeiro/debitos` + `DebitosCard` em `MeuPainel.jsx`[cite: 1]

- [x] **TASK-06: Vínculo de "Gasto de Produto" por Atendimento**[cite: 1]
  * **✅ Concluído** — migration `ALTER TABLE vendas ADD COLUMN IF NOT EXISTS custo_produto NUMERIC(10,2)` em `backend/models.js`[cite: 1]

---

## 🟦 Épico 4: Processamento de Dados - Histórico de Vendas
> **Objetivo:** Importar e conciliar os dados de vendas passados para o banco de produção de forma estruturada[cite: 1].

- [ ] **TASK-07: Importação dos Arquivos `maiovendas` e `junhovendas` para Produção**[cite: 1]
  * **Descrição:** Gerar script SQL de migração unificado baseado na leitura analítica dos arquivos físicos `maiovendas` e `junhovendas` para injetar os registros diretamente na VPS Hostinger[cite: 1].
  * **Regras de Processamento:**
    1. O script deve realizar o cruzamento dinâmico dos profissionais utilizando `LOWER(p.nome)` e o vínculo estrito da respectiva unidade (`mutinga` ou `tambore`) para capturar os IDs de relacionamento corretos[cite: 1].
    2. Aplicar a nova lógica de agrupamento de atendimentos por cliente único para evitar inflar o volume de comandas do histórico[cite: 1].
    3. Garantir que os itens com quantidade multiplicada (ex: produtos e bebidas) apliquem a taxa comissionável proporcional correta de cada unidade correspondente[cite: 1].
  * **🔄 Em andamento** — Nomes dos arquivos de origem mapeados; estrutura pronta para execução[cite: 1].
  * **✅ Tambore/Junho-2026 concluído** — `importar_tambore_junho_2026.sql` gerado a partir do DRE em PDF (dados que haviam sumido do banco, provável causa: migração de VPS) e executado em produção (`docker exec thieco_db`). 86 lançamentos → 69 atendimentos, R$ 6.730,00 de receita bruta e 15 despesas totalizando R$ 6.788,31 — todos os valores conferidos e batendo exatamente com o PDF original. Restam: Mutinga/Maio e Mutinga/Junho (scripts já existem na VPS: `importar_maio_novo.sql`, `importar_junho_novo.sql`, `vps-junho-2026-mutinga-completo.sql` — verificar se já foram aplicados) e Tambore/Maio (ainda não iniciado).

---

## 🟪 Épico 5: Inteligência Financeira e DRE Detalhado
> **Objetivo:** Mudar a estrutura do Demonstrativo do Resultado do Exercício do nível macro para o analítico, permitindo auditoria pontual por tipo de despesa[cite: 1].

- [x] **TASK-14B: Detalhamento Analítico de Itens de Despesa no DRE (Plano de Contas)**[cite: 1]
  * **✅ Concluído** — `backend/routes/relatorios.js:204-206` já faz `GROUP BY categoria, descricao, unidade`. `frontend/src/pages/IntelFinanceira.jsx` já tem o accordion de gastos por categoria ("DRE Analítico — accordion de gastos por categoria").

- [x] **TASK-15: Gráfico de Ranking de Origem de Clientes**[cite: 1]
  * **✅ Concluído** — `frontend/src/components/RankingOrigemClientes.jsx` (barras horizontais, Recharts) e `GET /relatorios/origem-clientes` já existiam prontos mas o componente nunca tinha sido importado em nenhuma página — órfão. Plugado em `IntelFinanceira.jsx`. Testado ponta a ponta (login real + API) e build de produção confirmado. **Validado com dado real:** inseridas 3 vendas de teste (whatsapp/indicação/orgânico) — API devolveu os 3 canais separados corretamente (33,3% cada), confirmando que o gráfico desenha múltiplas barras quando o dado existe. Dados de teste removidos após a validação. **Achado de dado:** hoje 100% dos atendimentos reais aparecem como "não informado" — o campo `origem_cliente` não está sendo preenchido no dia a dia pelos barbeiros, então o gráfico só vai ficar útil quando isso passar a ser registrado.

---

## 🟫 Épico 6: Motor de Combos Inteligente (Layout e Lógica Dinâmica)
> **Objetivo:** Eliminar dropdowns nativos, tratar estados de expiração e flexibilizar a interface para o trio padrão (Cabelo, Barba e Sobrancelha).

- [x] **TASK-16: Componente de Créditos e Fluxo de Reativação Expirada**
  * **✅ Concluído** — `frontend/src/components/ChecklistCreditosCombo.jsx`: seletor numérico (− / qtd / +) dinâmico via `.map()`, botão `+` travado rigidamente no saldo disponível (`disabled={!podeIncrementar}`). `frontend/src/pages/RegistroVenda.jsx`: fluxo de `combo_expirado` com campo "Serviços-Combo *" para reativação.

- [x] **TASK-17: Comanda de Avulsos e Produtos Isolada**
  * **✅ Concluído** — `frontend/src/pages/RegistroVenda.jsx`: seção de avulsos (`extrasServico`, `extrasProduto`, `avulsosCart`) funciona independente do combo; split de pagamento (`pagamentos.length > 1`) já tratado em várias telas.

---

## 🔐 Épico 7: Segurança, Autenticação JWT e Core Editável
> **Objetivo:** Proteger os endpoints sensíveis, individualizar as sessões dos barbeiros em tablets compartilhados e habilitar edições retroativas seguras[cite: 1].

- [x] **TASK-18: Autenticação Baseada em JWT + Criptografia Bcrypt**[cite: 1]
  * **✅ Concluído** — `backend/routes/auth.js` usa `bcryptjs` (hash/compare); `backend/middleware/auth.js` usa `jsonwebtoken`.

- [x] **TASK-19: Módulo de Lançamentos Editáveis com Níveis de Permissão**[cite: 1]
  * **✅ Concluído** — `backend/routes/vendas.js`: `EDITAVEIS_BASE` (barbeiro) vs `EDITAVEIS_ADMIN` (+ `profissional_id`, `data`); `servico` nunca está na lista editável; barbeiro só edita lançamentos do dia atual.

---

## 📦 Épico 8: Gestão Avançada de Estoque e Comissões Dinâmicas
> **Objetivo:** Resolver furos de inventário por consumo interno e automatizar a multiplicação exata de faturamento por quantidade física de produtos[cite: 1].

- [x] **TASK-20: Correção de Cálculo de Multiplicação de Quantidade e Comissões (Mutinga)**[cite: 1]
  * **✅ Concluído** — `backend/models.js`: migrations `BACKFILL_COMISSAO_SPLIT` e `RECALC_COMISSAO_APOS_BACKFILL` recalculavam comissão como `valor * 0.40/0.10` sem multiplicar por `qtd_clientes` (afetava só profissionais com `percentual_comissao > 0`, ou seja, os barbeiros da Mutinga). Corrigido para `valor * qtd_clientes * 0.40/0.10`. Checado no banco local (2.389 vendas): nenhuma linha com `qtd_clientes > 1` estava com comissão incorreta gravada — sem necessidade de correção retroativa nesse ambiente.

- [x] **TASK-21: Fluxo de Baixa Automatizada e Consumo de Lavatório (Insumos)**[cite: 1]
  * **✅ Concluído** — `POST /estoque/consumo-interno` já debita estoque, registra movimentação e gera despesa automática (`categoria: 'consumo_interno'`) no DRE. Nota: essa categoria não está na lista `CATEGORIAS` do dropdown de `RegistroGasto.jsx` — aparece sem rótulo bonito na tela, mas funciona.

- [x] **TASK-22: Correção dos Botões de Ação na View de Estoque**[cite: 1]
  * **✅ Concluído** — `frontend/src/pages/Estoque.jsx`: `onDeletar`→`api.deletarCatalogo`, `onCriar`→`api.criarCatalogo`, `onSave`→`api.atualizarCatalogo`, todos com fluxo de confirmação e loading state funcionando.

---

## 📅 Épico 9: Módulo de Agendamento Nativo
> **Objetivo:** Quebrar a dependência de plataformas terceiras através de um motor próprio de agendamento por time-slots, preparando a internacionalização do core[cite: 1].

- [x] **TASK-23: Motor de Alocação de Slots de Atendimento e Jornada de Trabalho**[cite: 1]
  * **✅ Concluído** — Tabelas `jornada_unidade` (horário por unidade/dia, seed real do PDF Onboarding Zion Ops: Ter-Qui 9h-20h, Sex-Sáb 9h-19h) e `agendamentos`, com `catalogo.duracao_minutos` populado com a duração real de cada serviço por unidade (mesma fonte). Anti-overbooking em duas camadas: checagem `OVERLAPS` na rota (mensagem amigável) + `EXCLUDE USING gist` no banco (rede de segurança contra corrida) — testado com sobreposição real, rejeitou corretamente.
  * **Backend:** `backend/routes/agendamentos.js` — CRUD autenticado (`GET/POST/PUT /agendamentos`, `PATCH /:id/status`) com escopo por role (barbeiro só vê/edita a própria agenda, operador só a própria unidade); endpoints públicos sem login (`/servicos`, `/disponibilidade`, `/publico`) que calculam disponibilidade real cruzando jornada + agendamentos existentes.
  * **Frontend:** tela `Agenda` (grade custom em Tailwind, sem lib externa) plugada no menu de barbeiro/operador/admin, com filtro por barbeiro e unidade pro admin. Página pública `AgendamentoPublico` (fluxo sem login: serviço → data → horário real → barbeiro → dados → confirmação) acessível via `?agendar=mutinga` ou `?agendar=tambore` — esse link substitui o Booksy no WhatsApp/bio.
  * **Testado ponta a ponta:** disponibilidade em dia aberto/fechado, criação pública, rejeição de conflito (inclusive tentativa de dupla-reserva simultânea), reagendamento, mudança de status, e barbeiro tentando agendar/ver agenda de outro colega (corretamente bloqueado e redirecionado pra si mesmo).
  * **Fora de escopo (deliberado):** tela de configuração de jornada (só a API `GET/PUT /jornada` ficou pronta), integração real com o agente de WhatsApp (API pronta pra consumir depois), captcha/rate-limit no endpoint público.

- [ ] **TASK-32: Bloqueio Pontual de Agendamento + Calendário de Feriados**
  * **Descrição:** Hoje `jornada_unidade` só cobre horário fixo recorrente por dia da semana — não existe forma de tirar uma data específica da disponibilidade (folga de um profissional, evento, feriado). Sem isso, a página pública de agendamento continua oferecendo horários que na prática não vão existir. Criar uma exceção pontual (data + unidade + opcionalmente profissional_id, motivo) que a query de disponibilidade (`GET /agendamentos/disponibilidade`) precisa passar a considerar, junto com a checagem que já cruza jornada + agendamentos existentes. Calendário de feriados nacionais pode alimentar esse mesmo mecanismo automaticamente (bloqueio em lote nas datas do calendário), evitando bloquear feriado por feriado manualmente todo ano.
  * **Motivação:** identificado na análise comparativa com o Tua Agenda (2026-07-12) — é a única lacuna daquela comparação com risco real de causar um agendamento inválido pro cliente, não só perda de conveniência.

- [ ] **TASK-33: Lista de Espera de Agendamento**
  * **Descrição:** Quando não há horário disponível pro filtro escolhido (unidade/serviço/data/profissional), permitir que o cliente entre numa lista de espera em vez de só ver "sem horário". Precisa de um mecanismo de aviso quando um horário compatível abrir (provavelmente via a mesma fila `notificacoes` já existente) — desenho de quando/como avisar ainda por definir.
  * **Motivação:** identificado na análise comparativa com o Tua Agenda (2026-07-12). Valor real depende de quão frequentemente a agenda satura — validar antes de priorizar.

- [ ] **TASK-34: QR Code no Link Público de Agendamento**
  * **Descrição:** Gerar QR code do link público (`?agendar=<unidade>`) na tela de administração, com opção de copiar/baixar/compartilhar — mesmo padrão que o Tua Agenda expõe em "Meu link". Facilita colar em balcão físico, story do Instagram, cartão.
  * **Motivação:** identificado na análise comparativa com o Tua Agenda (2026-07-12). Baixo custo, baixo risco.

- [ ] **TASK-35: Relatório de Descontos Aplicados**
  * **Descrição:** `vendas.desconto` já é rastreado em cada venda, mas não existe um relatório consolidado que mostre volume de desconto aplicado e impacto no faturamento por período/unidade/profissional — só dá pra ver desconto olhando venda por venda. Nova query agregada em `relatorios.js`, sem mudança de schema.
  * **Motivação:** identificado na análise comparativa com o Tua Agenda (2026-07-12) — o dado já existe, falta só a visão consolidada.

- [x] **TASK-31: Arquitetura de Integração — Órbita Quasar (Agendamento Conversacional via WhatsApp)**
  * **✅ Concluído (2026-07-27/28)** — Diferente da TASK-30 (disparo *outbound* de notificação/lembrete), o Quasar é o motor **conversacional inbound**: o cliente manda mensagem no WhatsApp, a IA (via OpenRouter) responde automaticamente com FAQ da unidade, oferece transbordo pra humano (`POST /notificacoes/transbordo`) e manda foto da unidade quando pertinente (`message/sendMedia`). Ativo em todos os canais de unidade (Mutinga e Tamboré, não só Mutinga como no piloto inicial), rodando de ponta a ponta em produção (VPS) — testado com mensagem real de WhatsApp.
  * **Gateway de WhatsApp** (item 6 da versão anterior desta tarefa) resolvido pelo pivô Baileys → Evolution API (ver TASK-30 abaixo e [[registro-de-decisoes-thieco]] 2026-07-25) — `webhook/set` na Evolution API aponta pro Quasar (`POST /webhook/evolution`), que processa e responde via `message/sendText`/`sendMedia`.
  * **Agendamento conversacional completo** (Quasar chamando `checar_disponibilidade_agenda`/`confirmar_agendamento_call` de verdade, com tenant real cadastrado por unidade) **não faz parte do escopo entregue** — o que foi ligado é o atendimento FAQ + transbordo. Fica como possível extensão futura, não pendência aberta desta rodada.
  * Canal administrativo (Órbita Cortex, relatório sob demanda) é o par complementar — ver TASK-30 abaixo.

- [x] **TASK-24: Automação e Integração Google Meu Negócio (Gatilho Pós-Venda)**[cite: 1]
  * **✅ Concluído** — Não existe conceito de "comanda fechada" no backend (cada `POST /vendas` já é uma linha finalizada; um atendimento multi-item vira múltiplas linhas ligadas por `venda_origem_id`). Solução: gerador por polling (mesmo timer de 5min do lembrete de agendamento) que agrupa vendas por `COALESCE(venda_origem_id, id)` e só considera o atendimento "fechado" quando a última linha do grupo tem 5+ minutos — evita disparar no meio de uma comanda ainda sendo montada. Idempotente por atendimento (1 mensagem por atendimento, não por linha). Reaproveita `configuracoes_gatilhos_cliente` (tipo `avaliacao_pos_venda`) e entra no cooldown de marketing de 14 dias já existente (TASK-27). Link de avaliação configurável por unidade em Configurações — sem link preenchido, a unidade não dispara nada. **Fora de escopo documentado:** resgate de crédito de combo (`combos.js POST /consumo`) não insere linha em `vendas`, então não dispara o pedido de avaliação — só vendas diretas e compra de combo (`POST /contratar`) são cobertas. Testado ponta a ponta: buffer de 5min respeitado, atendimento multi-item gera 1 única mensagem, idempotência, cliente sem telefone é ignorado sem erro.

---

## 🎨 Épico 10: Padronização Visual White Label "Órbita"
> **Objetivo:** Uniformizar a identidade visual premium, removendo cores legadas e garantindo componentes responsivos de controle globais[cite: 1].

- [ ] **TASK-25: Substituição Global de Paleta de Cores (Teal/Neon → Dourado Premium)**[cite: 1]
  * **Descrição:** Substituir globalmente as classes de cores verde-água legadas (`teal`, `emerald`) pelo tom oficial Dourado/Ouro Premium do ecossistema Órbita[cite: 1].
  * **⚠️ Fora do escopo do sistema-thieco** — é responsabilidade do projeto `orbita-whitelabel` (design system compartilhado entre os produtos Órbita), não uma tarefa a implementar aqui. Mantida no backlog só como referência de dependência; não conta como pendência própria do sistema-thieco.

- [x] **TASK-26: Correção/Persistência do Botão de Alternância de Tema (Header)**[cite: 1]
  * **✅ Concluído** — `frontend/src/contexts/ThemeContext.jsx` persiste em `localStorage('thieco_tema')`; toggle já ligado no `Header.jsx`.

---

## 📣 Épico 11: Módulo de Marketing e Notificações Automatizadas
> **Objetivo:** Criar um motor ativo de disparos estruturado no banco e relatórios de conversão para retenção de clientes.

- [x] **TASK-27: Painel de Configuração de Notificações por Gatilhos**
  * **✅ Concluído** — dos 4 gatilhos originais, 2 viraram automáticos (mesmo padrão), 1 virou disparo manual segmentado (mudança de escopo deliberada) e 1 saiu de escopo por dependência inexistente:
    - **Aniversariante** — ✅ automático, roda no `setInterval` de 15min cruzando dia/mês de `clientes.data_nascimento`. Idempotente por ano.
    - **Cliente Sumido** — ✅ automático, mesmo padrão, cruza `clientes.ultima_visita` com um limite de dias configurável por unidade (`parametros.dias_sem_visita`, default 45). Idempotente por "sequência de ausência": não reenvia enquanto o cliente não voltar a visitar e sumir de novo.
    - **Inadimplentes** — ❌ **fora de escopo definitivamente** — depende de um módulo de Fiado/Contas a Receber que não existe e não vai existir (confirmado com Willians).
    - **Promoções** — ✅ entregue como **disparo manual** em vez de automático por dias de menor movimento (decisão explícita do Willians durante o desenvolvimento): nova aba "Promoções" em Configurações, admin escreve a mensagem, filtra a audiência (unidade + dias sem visita mínimo + tipo de cliente) com preview de quantos vão receber, e dispara na hora. Fica registrado em `campanhas_promocionais` (histórico). O card **"Dias de Menor Movimento"** (novo, em Inteligência Financeira) dá o dado de apoio pra essa decisão manual (dias mais fracos por faturamento médio), sem disparar nada sozinho.
  * **Reaproveita** `configuracoes_gatilhos_cliente` (mesma tabela pros 2 gatilhos automáticos, coluna `tipo` + `parametros JSONB` genérica) e a fila `notificacoes` já existente (`canal='whatsapp'`), mesmo padrão da TASK-29.
  * **Extra entregue além do escopo original:**
    - **Cadastro único do administrador** (nome/telefone/e-mail + canais WhatsApp/e-mail) em Configurações — substitui o telefone digitado por card em `configuracoes_notificacoes` (TASK-29) por um cadastro centralizado, com canal **e-mail** novo na fila (`canal='email'`, endpoints de consumo simétricos ao whatsapp).
    - **Número de WhatsApp remetente configurável por unidade** — Tamboré e Mutinga podem disparar de números diferentes.
    - **Cooldown anti-spam de 14 dias** entre mensagens de marketing (aniversariante/cliente sumido/promoção) pro mesmo cliente, cross-tipo — evita empilhar contato quando o cliente se encaixa em mais de um gatilho/campanha no mesmo período. Valor inicial conservador, ajustável depois de validar o volume real de disparo.
  * **Testado ponta a ponta:** geração real dos dois gatilhos automáticos (idempotência e "volta a disparar após novo ciclo de ausência" confirmados), disparo manual de promoção com filtro de segmentação, exclusão por cooldown confirmada nos dois sentidos (bloqueia dentro da janela, libera depois). Envio de verdade pro WhatsApp continua pendente da integração externa (TASK-30/31).

- [x] **TASK-28: Criação de Campanhas Segmentadas e Rastreamento de ROI**
  * **✅ Concluído** — Estende a aba "Promoções" (disparo manual, TASK-27) em vez de criar tela nova. Filtros novos em `buscarAudiencia()` (`backend/routes/campanhas.js`): ticket gasto (faixa min/max, soma histórica real de `vendas`) e serviço já consumido (`GET /campanhas/servicos-disponiveis` popula o dropdown com serviços reais da unidade, evita erro de digitação). Nova tabela `campanhas_destinatarios` — `campanhas_promocionais` só guardava a *contagem* de destinatários, não *quem* recebeu; sem isso não dava pra cruzar com o que aconteceu depois. `GET /campanhas/:id/resultados` calcula conversão (nova venda do cliente numa janela de 30 dias após o envio, mesmo padrão de matching por nome já usado no resto do sistema), taxa de conversão, faturamento gerado e agendamentos gerados na mesma janela — histórico de disparos virou expansível pra mostrar isso por campanha. **Decisão consciente sobre "ROI":** as métricas são nomeadas "conversão/faturamento gerado", não "ROI %" — não existe custo por disparo rastreado no sistema hoje (envio de verdade ainda depende da TASK-30/31), então forçar um percentual de retorno seria uma métrica fabricada; a base fica pronta pra virar ROI de verdade com uma conta simples assim que houver custo por mensagem. Testado ponta a ponta: filtros isolados e combinados batendo com dado real, roster gravado no disparo, conversão detectada dentro da janela de 30 dias e corretamente ignorada fora dela. Confirmado pelo Willians na tela antes do commit.

- [x] **TASK-29: Painel de Notificações Administrativas Configuráveis (Faturamento/Estoque/Ranking)**
  * **✅ Concluído** — Diferente da TASK-27 (gatilhos de marketing pro cliente), esta é voltada pro admin: aba "Notificações" dentro de Configurações, 4 tipos configuráveis por unidade (faturamento, produtos mais vendidos, serviços mais realizados, estoque parado — baseado em `catalogo.created_at`), cada um com liga/desliga, periodicidade (diário/semanal/quinzenal/personalizado) e horário fixo de disparo. Nova tabela `configuracoes_notificacoes` + `verificarNotificacoesConfiguradas()` rodando a cada 15min em `backend/routes/notificacoes.js`/`server.js`, reaproveitando a mesma fila `notificacoes` e os mesmos endpoints de consumo (`GET/PATCH .../whatsapp/...`) já construídos na TASK-23 pro lembrete de agendamento. *Atualização (TASK-27):* o telefone de destino por card foi substituído por um cadastro único do administrador (nome/telefone/e-mail + canais WhatsApp/e-mail), com canal `email` novo na mesma fila. Envio de verdade fica mapeado como pendência nos backlogs do `orbita-horizon` e `cortex` (candidatos a agente de disparo — nenhum dos dois tem scheduler nem gateway de WhatsApp hoje). Testado ponta a ponta: geração de conteúdo real, idempotência, CRUD da configuração.

- [x] **TASK-30: Disparo real de notificações (e-mail + WhatsApp) — Horizon/Cortex descartados, disparo direto no sistema-thieco**
  * **✅ Concluído (2026-07-25/28)** — a ideia original de delegar o envio a um agente externo (Horizon ou Cortex) foi descartada; disparo construído direto no sistema-thieco.
  * **E-mail:** `backend/services/emailService.js` — pivô final foi **Resend** (não Nodemailer/Gmail como na tentativa anterior), template HTML dark/dourado. Em produção.
  * **WhatsApp:** o plano de esperar a chave oficial da Meta Cloud API (revisão de 2026-07-21) foi **abandonado** — em vez disso, `backend/services/whatsappService.js` foi reescrito pra usar **Evolution API self-hosted** (container próprio, `evolution_api`/`evolution_postgres`/`evolution_redis`), contornando o problema de rede que travava o Baileys direto no processo do backend. `@whiskeysockets/baileys`/`qrcode` removidos das dependências. 3 canais reais em produção: Mutinga, Tamboré, admin — cada um com sua própria instância Evolution API, QR pareado de verdade.
  * **Além do disparo administrativo original:** o canal admin ganhou um par conversacional (Órbita Cortex responde pedido de relatório sob demanda por WhatsApp — faturamento, ranking de barbeiros, estoque parado, ticket médio) e os alertas de sistema (estoque/meta, SinoBadge) passaram a notificar o admin via WhatsApp também, não só ficar no sininho.
  * **Status:** aplicado e testado ponta a ponta com mensagem real, deployado na VPS. Ver [[registro-de-decisoes-thieco]] (2026-07-25, 2026-07-25/28) para o relato técnico completo.

---

## 📈 Tabela de Priorização Atualizada

| ID | Tarefa | Impacto | Status |
| :--- | :--- | :---: | :---: |
| TASK-01 | Query de agrupamento por comanda | Altíssimo | ✅ Done[cite: 1] |
| TASK-02 | Card duplo clientes/serviços no painel | Alto | ✅ Done[cite: 1] |
| TASK-02B | Ganho estimado no registro de venda | Médio | ✅ Done[cite: 1] |
| TASK-03 | Espelhamento de métricas Admin → Barbeiro | Alto | ✅ Done[cite: 1] |
| TASK-04 | Tela de fechamento de caixa diário | Alto | ✅ Done[cite: 1] |
| TASK-36 | Isolamento de clientes por unidade no cadastro automático (PDV) | Alto | ✅ Done |
| TASK-05 | Débitos de consumo interno do barbeiro | Médio | ✅ Done[cite: 1] |
| TASK-06 | Coluna `custo_produto` na tabela vendas | Baixo | ✅ Done[cite: 1] |
| TASK-07 | Importação dos arquivos `maiovendas` e `junhovendas` | Médio | 🔄 Em andamento[cite: 1] |
| TASK-20 | Correção de cálculo de comissão e qtd (Mutinga) | Altíssimo | ✅ Done[cite: 1] |
| TASK-16 | Interface e controle de saldos de combos (Ativo vs Expirado) | Alto | ✅ Done |
| TASK-17 | Comanda de serviços/produtos avulsos e split de caixa | Alto | ✅ Done |
| TASK-27 | Gatilhos ao cliente (aniversariante/sumido) + promoções manuais | Alto | ✅ Done |
| TASK-14B | Detalhe de subcontas/descrição no DRE Analítico | Alto | ✅ Done[cite: 1] |
| TASK-23 | Motor de agendamento nativo anti-overbooking | Alto | ✅ Done[cite: 1] |
| TASK-18 | Autenticação por token JWT e Bcrypt (Backend) | Alto | ✅ Done[cite: 1] |
| TASK-28 | Envio de campanhas segmentadas e métricas de ROI | Médio | ✅ Done |
| TASK-29 | Notificações administrativas configuráveis (faturamento/estoque/ranking) | Alto | ✅ Done |
| TASK-30 | Disparo real de notificações (e-mail via Resend + WhatsApp via Evolution API) | Alto | ✅ Done |
| TASK-37 | Isolamento de alertas internos (SinoBadge) por unidade + selo de unidade | Alto | ✅ Done |
| TASK-31 | Concierge Quasar (FAQ + transbordo via WhatsApp) + canal admin Cortex (relatório sob demanda) | Alto | ✅ Done |
| TASK-32 | Bloqueio pontual de agendamento + calendário de feriados | Alto | 🟨 Prio 2 |
| TASK-33 | Lista de espera de agendamento | Médio | 🟩 Prio 3 |
| TASK-34 | QR code no link público de agendamento | Baixo | 🟩 Prio 3 |
| TASK-35 | Relatório de descontos aplicados | Baixo | 🟩 Prio 3 |
| TASK-19 | Níveis de permissão para edição de lançamentos | Médio | ✅ Done[cite: 1] |
| TASK-21 | Baixas automáticas de estoque e insumos | Médio | ✅ Done[cite: 1] |
| TASK-22 | Correção dos botões Crud da tabela de Estoque | Médio | ✅ Done[cite: 1] |
| TASK-25 | Limpa global de cores Teal para Dourado Órbita | Médio | 🟩 Prio 3[cite: 1] |
| TASK-15 | Gráfico de ranking de canais de aquisição | Baixo | ✅ Done[cite: 1] |
| TASK-24 | Gatilho pós-venda com link de avaliação Google | Baixo | ✅ Done |
| TASK-26 | Ativação e persistência do seletor Dark Mode | Baixo | ✅ Done[cite: 1] |


Ao se cadastrar no link de agendamento, criar na tela de admin
Ao confirmar pelo link de confirmação deve aparecer na agenda do barbeiro