---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-08-04 (rev 8)
owner: willians
---

# Arquitetura Técnica — Sistema de Caixa Barbearia Thieco Leandro

> Referência: [[prd-thieco]] | [[requisitos-funcionais-thieco]]

---

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Frontend | React 18 + Vite | Willians já domina; build rápido; ecossistema amplo para componentes de dashboard | Requer JS habilitado no browser; não é server-side rendering |
| Backend | Node.js 18 + Express | Mesma linguagem no front e back reduz contexto; Willians já domina | Performance de CPU intensiva seria melhor com Go/Rust |
| Banco de dados | PostgreSQL 16 | Transações ACID, suporte a ENUM nativo, queries analíticas para relatórios, histórico de 8.580 vendas já nele | Escalabilidade horizontal requer mais setup vs. cloud DBs |
| Infraestrutura | Docker Compose (self-hosted) | Custo zero de cloud, controle total, sem dependência externa | Precisa de servidor próprio com backup gerenciado manualmente |
| Proxy reverso | Nginx | Roteamento frontend/backend em uma única porta (80), SSL termination | — |
| Autenticação | JWT (jsonwebtoken) | Stateless, sem necessidade de session store, funciona bem para escala da barbearia | Logout "real" requer blacklist — hoje tokens só expiram por tempo |

---

## 2. Camadas do sistema

```
[Apresentação — React + Vite]
         ↓  ↑  (HTTP/REST via JSON)
[Nginx — proxy reverso]
         ↓  ↑
[Lógica de negócio — Node.js + Express]
         ↓  ↑  (pg driver)
[Dados — PostgreSQL 16]
```

**Apresentação:** SPA React servida pelo Nginx. Toda navegação é client-side. Comunicação com backend via fetch/axios. Sem estado global complexo — cada tela busca seus dados diretamente.

**Nginx:** Roteamento: `/api/*` → backend (porta 3000); todo o resto → frontend (pasta dist). Serve como única porta de entrada (80). SSL termination pode ser adicionado sem mudar o backend.

**Lógica de negócio:** Express com rotas organizadas por domínio (`/routes/vendas.js`, `/routes/profissionais.js`, etc.). Middleware de autenticação JWT centralizado. Cálculo de comissão e valor líquido acontece aqui, não no frontend nem no banco. DDL e migrações executadas na inicialização via `models.js`.

**Dados:** PostgreSQL com ENUMs nativos (`unidade_enum`, `feedback_tipo_enum`, `pdca_status_enum`). Índices em colunas de filtro frequente (data, unidade, profissional_id). Constraints de integridade referencial declaradas no DDL.

---

## 3. Fluxo de dados

```
[POST /vendas] → [Middleware Auth JWT] → [Validação express-validator] 
→ [calcularComissao()] → [calcularValorLiquido()] 
→ [INSERT vendas] → [Response 201 + venda criada]
```

**Registro de venda (caminho principal):**
1. Frontend envia POST com todos os campos da venda
2. JWT é validado no middleware — role determina permissões
3. express-validator valida tipos e enums (unidade, forma_pagamento, etc.)
4. `await calcularComissao()` — async: consulta `Profissional.findById()` para ler `percentual_comissao` e `percentual_comissao_produto` reais do banco
5. `await calcularValorLiquido()` — async: lê taxas via `getTaxas()` (cache 5 min da tabela `configuracoes`) em vez de constantes hardcoded
6. INSERT na tabela `vendas` com todos os campos calculados
7. Response com venda persistida

**Contratação de combo (créditos dinâmicos por JSONB desde 2026-07-04):**
1. Frontend envia POST /combos/contratar com cliente_nome, creditos (objeto `{ servico: quantidade }` — qualquer serviço do catálogo, não só corte/barba), valor, forma_pagamento e (opcional) origem_venda/servico_inicial
2. Backend cria/atualiza o cliente, fecha combos expirados do cliente na mesma transação, cria a `venda` (faturamento do combo, cobrado no ato) e cria `combos_contratados` com `creditos`/`creditos_originais` (JSONB) — status `em_uso` se o cliente não tem outro ativo, `na_fila` caso contrário
3. Disponível em dois lugares com o mesmo endpoint: aba Combos (admin) e direto na tela de venda (seletor de 3 abas Cliente Novo/Up-sell/Reativação) — **antes de 2026-07-01 a tela de venda usava um endpoint V1 separado e quebrado (`POST /combos/ativar`), que gravava numa tabela morta sem crédito**
4. Seletor de pacote (reativação e "Contratar próximo combo") é customizado (busca + preço na lista, igual ao padrão da aba de Venda) — desde 2026-07-04 substitui o `<select>` nativo; a receita de créditos do pacote (`catalogo_combo_creditos`) autopreenche `creditos` e trava o campo Valor (R$) com o preço de tabela

**Uso de crédito do combo ativo:**
1. Frontend envia POST /combos/consumo (ou /consumo-lote) com combo_contratado_id e o(s) nome(s) de serviço presentes em `creditos` — steppers na UI, cada crédito marcado vira 1 ocorrência do nome do serviço na lista enviada
2. Backend valida status `em_uso` e `creditos[servico] > 0`, decrementa `creditos[servico]`, insere 1 linha em `combos_consumo` por crédito debitado
3. **Nenhuma venda de serviço é criada** — o valor já foi cobrado na contratação
4. Se todas as chaves de `creditos` zeram (checagem dinâmica, sem lista fixa de serviços), status vira `encerrado` e o próximo `na_fila` (se houver) é ativado automaticamente
5. Serviços/produtos avulsos (fora dos créditos do combo) entram num carrinho unificado com quantidade — cada item gera POST /vendas separado (`upsell: true`, `tipo_item: 'servico'|'produto'`), com split de pagamento (múltiplos métodos) quando há subtotal
6. `GET /combos/saldo` (usado toda vez que a tela de venda busca um cliente) roda a mesma checagem de esgotamento/vencimento antes de responder — garante que o combo nunca aparece "ativo" numa tela e "encerrado" em outra

**Relatório (caminho analítico):**
1. Frontend envia GET com filtros (periodo, unidade, profissional_id)
2. Backend executa query agregada no PostgreSQL (SUM, GROUP BY)
3. Response com JSON estruturado para renderização no dashboard

**Disparo do próprio sistema (padrão desde 2026-07-12) — polling, não webhook/evento:**
Seis geradores rodam em `setInterval`/`node-cron` no `server.js`, cada um enfileirando uma linha em `notificacoes` (`canal='whatsapp'`/`'email'`):
- **5min (`setInterval`):** `gerarLembretesAgendamento` (agendamento a 15min de começar), `gerarGatilhoAvaliacaoPosVenda` (atendimento fechado — polling por evento, não por condição: agrupa `vendas` por `venda_origem_id` e usa buffer de 5min pra inferir que a comanda parou de crescer)
- **15min (`setInterval`):** `gerarGatilhoAniversariante`, `gerarGatilhoClienteSumido` (condição por cliente)
- **Hora cheia (`node-cron`, desde 2026-07-21 — antes 15min via `setInterval`):** `verificarNotificacoesConfiguradas` (relatório periódico admin) — ver `backend/jobs/notificacoesJob.js`
- **Manual (sem timer):** `POST /campanhas` — disparo imediato sob ação do admin, não por polling

Todos compartilham a mesma fila e os mesmos endpoints de consumo (`GET /notificacoes/{whatsapp,email}/pendentes`, `PATCH .../enviado`) — a fila não sabe nem se importa qual gerador criou a linha.

**Disparo real (desde 2026-07-21, WhatsApp real desde 2026-07-25):** `verificarNotificacoesConfiguradas` chama `backend/services/emailService.js` (Resend, real) e `backend/services/whatsappService.js` (Evolution API, real — pivô de Baileys/Meta Cloud API pausados, ver v2.21 no histórico de versão) antes de gravar a linha, com `enviado_whatsapp`/`enviado_email` refletindo o resultado real. Alertas de sistema (estoque/meta, SinoBadge) também passaram a notificar o admin via WhatsApp (v2.22). Lembrete de agendamento e gatilhos ao cliente continuam só enfileirando (fora de escopo dessas rodadas). O canal admin do WhatsApp ganhou um par conversacional real — Órbita Cortex responde relatório sob demanda — e os canais de unidade (Mutinga/Tamboré) têm concierge de IA ativo (Órbita Quasar: FAQ + transbordo pra humano), ambos rodando como microservices Python compartilhadas fora deste repositório. Ver [[registro-de-decisoes-thieco]] (2026-07-25, 2026-07-25/28).

**Reconexão do WhatsApp com backoff exponencial (desde 2026-07-23, válido também pro Evolution API):** um teste local de ~48min derrubou o processo Node — o handler de reconexão chamava `iniciarConexao()` de novo, sem delay, a cada queda de conexão, e o loop apertado (a cada poucos segundos) esgotou recursos até crashar. Corrigido com backoff exponencial (`1000 * 2^tentativas`, teto de 30s) e limite de 15 tentativas — depois disso, para de tentar sozinho e exige `POST /whatsapp/:canal/conectar` manual.

---

## 4. Pontos de integração

| Integração | Direção | Formato | Autenticação | Versionamento |
|---|---|---|---|---|
| Frontend ↔ Backend | consumo interno | REST/JSON | JWT Bearer token | sem versionamento formal — API interna |
| Import de dados históricos | entrada | CSV / planilha | admin only | via rota `/import` |
| PagBank | nenhuma | — | — | Taxas hardcoded em constantes no código; sem integração API real |
| Evolution API (WhatsApp) | saída/entrada | REST/JSON + webhook | `apikey` header | Self-hosted, container próprio. `whatsappService.js` chama `instance/*`/`message/send*`; `webhook/set` aponta pro Cortex (canal admin) ou Quasar (canais de unidade) — desde 2026-07-25 |
| Resend (e-mail) | saída | REST/JSON | `RESEND_API_KEY` | `emailService.js` — desde 2026-07-25 |
| Órbita Cortex | consumo externo (relatório sob demanda) / chamado por | REST/JSON | `X-Internal-Key` | Microservice Python compartilhada, fora deste repositório — canal admin do WhatsApp |
| Órbita Quasar | chamado por (webhook de mensagem recebida) | REST/JSON + webhook | `X-Internal-Key` | Microservice Python compartilhada, fora deste repositório — concierge de IA nos canais de unidade |

> PagBank não tem integração direta — as taxas são aplicadas por regra de negócio local, não por consulta à API do banco.

---

## 5. Fronteiras de segurança

- **Autenticação:** Middleware `authenticate` em todas as rotas — valida JWT, injeta `req.user` com `{ id, role, profissional_id }`
- **Autorização:** Middleware `requireAdmin` nas rotas de gestão (criar/editar profissionais, acessar relatórios completos, excluir vendas)
- **Isolamento de dados por papel:** Barbeiro tem `profissional_id` e `unidade` no token — backend sobrescreve qualquer filtro enviado para garantir que só vê próprios dados e meta da própria unidade; `?unidade=X` em `/metas-unidade/progresso` é ignorado para roles `barbeiro` e `operador`
- **Dados sensíveis:** Senha hasheada (bcrypt) antes de persistir — nunca trafega ou é exibida em plain text
- **Banco de dados:** Não exposto diretamente — acesso apenas via backend. Porta 5432 vinculada a `127.0.0.1` no host (desde 2026-07-05) — acessível só localmente na VPS (SSH tunnel/DBeaver local), nunca pela internet
- **Isolamento de infraestrutura (desde 2026-07-05):** sistema-thieco coexiste na mesma VPS do vilamill-sistema (`2.24.93.178`), em stack Docker própria (rede `thieco_network`, volume `thieco_postgres_data`) — sem nenhum container, rede ou volume compartilhado entre os dois sistemas. Frontend também vinculado a `127.0.0.1:5173`; só o Nginx do host (fora de container) fala com a internet, por domínio (`barbeariatl.online`)
- **Dados que nunca saem sem proteção:** hash de senha, JWT secret
- **Endpoints públicos deliberados (desde 2026-07-12):** exceção controlada à regra "tudo exige JWT" — `GET /agendamentos/servicos`, `GET /agendamentos/disponibilidade`, `POST /agendamentos/publico` e `GET/POST /agendamentos/confirmar/:codigo` não exigem autenticação, por design: são a superfície que o cliente final (sem conta no sistema) usa pra agendar e confirmar presença via link. `POST /agendamentos/publico` revalida toda a disponibilidade no servidor (nunca confia em dado calculado no cliente); `codigo_confirmacao` é um token aleatório não sequencial (evita enumeração trivial, mas não é criptograficamente forte — não protege dado sensível novo). Nenhum outro dado de outros clientes é exposto por esses endpoints. Rate-limit e captcha nesses endpoints ficaram deliberadamente fora de escopo desta entrega.
- **Fix de SQL injection (2026-07-11):** 6 endpoints de `relatorios.js` interpolavam o parâmetro `unidade` direto em SQL sem checar o resultado da validação do `express-validator` — corrigido com whitelist explícita no ponto único de extração. Ver registro de decisões para detalhe completo.
- **Credenciais fora do banco:** `EVOLUTION_API_KEY`, `RESEND_API_KEY`, `INTERNAL_SERVICE_KEY` (chave compartilhada com Cortex/Quasar, ver seção 3) seguem o mesmo padrão do `JWT_SECRET`: só em `.env`, nunca commitado. A sessão do WhatsApp em si (pareamento do número) fica dentro do container próprio da Evolution API, fora deste repositório — não existe mais sessão Baileys local em `backend/data/whatsapp-auth` (pivô de 2026-07-25, ver v2.21 no histórico de versão).
- **`X-Internal-Key` (desde 2026-07-25):** rotas serviço-a-serviço consumidas pelo Cortex/Quasar (`/notificacoes/transbordo`, `/notificacoes/relatorio-sob-demanda`, `/notificacoes/admin-autorizado`) validam essa chave compartilhada em vez de JWT de usuário — mesmo mecanismo depois reaproveitado no `authenticateInternal` do sistema-orbita-whitelabel.

---

## 6. Estratégia de escala

**Gargalos previstos:**
- Queries de relatório sem índice adequado em base com muitas vendas (já mitigado com índices em `data`, `unidade`, `profissional_id`)
- Leitura simultânea de múltiplos barbeiros durante horário de pico

**Estratégia atual (suficiente para escala da barbearia):**
- PostgreSQL lida com dezenas de conexões simultâneas sem problema
- Nginx balanceia futuras instâncias Node se necessário
- Backups manuais ou via cron do volume Docker

**O que exige reescrita acima de X:**
- Se o sistema crescer para múltiplas barbearias não relacionadas → multi-tenant requer separação de schemas ou instâncias
- Se relatórios em tempo real passarem de 100k registros → materializar views ou mover para data warehouse separado

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | 2024 | Criação inicial — Node + PostgreSQL + Docker |
| v1.1 | 2025 | Adição de unidade Mutinga, taxas diferenciadas por bandeira |
| v1.2 | 2026-05 | Separação de comissão por tipo_item (serviço vs. produto), backfill automático |
| v1.3 | 2026-05-29 | Produto na aba Combos; uso de combo ativo não gera venda de serviço (cortesia); reativação de combo vencido com pré-preenchimento do plano anterior |
| v1.4 | 2026-05-29 | Aba Lançamentos no login do barbeiro; PATCH /vendas liberado para barbeiro com guard de propriedade; cards de lançamento agrupados por atendimento (venda_origem_id) |
| v1.5 | 2026-05-29 | Modal de grupo com feedback visual isolado por item; estado de salvando/salvo gerenciado localmente no modal; observação obrigatória em todos os formulários de edição |
| v1.6 | 2026-05-29 | DRE exporta lançamentos e despesas individuais com filtros de data e unidade; endpoint /relatorios/dre ampliado com lancamentos, gastos_lista e resumo_diario |
| v1.7 | 2026-06-02 | Card "Meta da Barbearia" no painel do barbeiro (barra geral + pisos Bronze/Prata/Ouro + badge de nível + falta para próximo); fix de segurança: barbeiro não pode mais consultar meta de outra unidade via query param |
| v1.8 | 2026-06-05 | origem_venda em combos e combos_contratados; AppBarbeiro com sidebar completa (Painel/Registro/Lançamentos/Relatório/Meta); logins genéricos mutinga/tambore desativados; seletor de tipo de contratação unificado em 3 tabs; fix de comissão para qtd_clientes > 1 |
| v1.9 | 2026-06-05 | Nova tabela metas_diarias com cota individual dinâmica (meta_total ÷ barbeiros_ativos); card "Meta do Dia" no painel do barbeiro; admin GestaoMetasDiarias com importação via Markdown; nginx.conf com no-cache em JS assets |
| v2.0 | 2026-06-25 | 4 módulos novos: (1) percentual_comissao_produto por barbeiro — calcularComissao async via Profissional.findById; (2) taxas configuráveis — getTaxas() com cache 5min, PUT /configuracoes/taxas, Configuracoes.jsx; (3) notificações automáticas — tabela notificacoes, geradores estoque/meta/ranking, SinoBadge + drawer; (4) toggle escuro/claro — ThemeContext, lib/theme.js, botão sol/lua em Login + Header + MeuPainel |
| v2.1 | 2026-07-01 | Reconciliação completa de junho/2026 (Mutinga): corrige `vendas.valor` importado como líquido (deveria ser bruto, mesma convenção do resto do sistema — quebrava Lançamentos e Dashboard); corrige `calcularComissao()` que somava desconto de novo a um valor já bruto (inflava comissão de venda com desconto); corrige classificação serviço/produto na importação para usar o catálogo (`controla_estoque`) em vez de heurística instável por proporção de comissão; corrige contagem de atendimentos para agrupar por `venda_origem_id` (comanda), não por linha — ticket médio estava artificialmente baixo |
| v2.2 | 2026-07-01 | Aba Combos: botão "Reativar" para combos esgotados/vencidos (antes só mostrava texto "Renove na tela de Combos", sem ação); `verificarExpiracaoCliente` (chamado por `GET /combos/saldo`) passou a fechar também por esgotamento de crédito, não só por data — antes só a listagem admin detectava esgotamento, causando divergência entre telas |
| v2.3 | 2026-07-01 | **Migração completa do sistema de combos para V2 — V1 retirado do app.** A tela de venda tinha um formulário de 3 abas (Cliente Novo/Up-sell/Reativação) que gravava na tabela legada `combos` via `POST /combos/ativar` — sem crédito fracionado, invisível pro resto do sistema. Passou a usar `POST /combos/contratar` (mesmo endpoint do fluxo "Contratar próximo combo", já correto). Removidas as rotas V1 (`GET/POST /combos`, `GET /combos/buscar`, `POST /combos/uso`, `POST /combos/ativar`, `PATCH /combos/:id`), o model `Combo` e as funções de API V1 no frontend. Mantida `POST /combos/migrar-v2` como ferramenta de conversão pontual — usada para migrar 28 combos V1 reais que já estavam ativos em produção (créditos inferidos da descrição textual) |
| v2.4 | 2026-07-01 | Toggle escuro/claro (v2.0) corrigido — existia em nível de estado/localStorage desde 2026-06-25 mas nenhuma cor do Tailwind lia as CSS vars que `applyTenantTheme` definia, então clicar não mudava nada visualmente. `tailwind.config.js` (`onix`/`gold`/`surface`) agora lê `var(--cor-x, fallback)` com o padrão `withOpacity` do Tailwind (mantém suporte a `bg-gold/10` etc.); fallback = cor exata do modo escuro atual. Modo claro usa a mesma família dourada, só aprofundada para contraste em fundo branco |
| v2.5 | 2026-07-01 | Notificações: `POST /notificacoes/gerar` apagava TODAS as notificações voláteis (estoque/meta) e recriava do zero a cada chamada — como o painel chama `/gerar` toda vez que abre, marcar como lida e reabrir trazia a notificação de volta como não lida. `sincronizarAlertas()` agora faz upsert por chave (tipo + catalogo_id/meta_id), preservando `lida`. Adicionada retenção automática de 7 dias (qualquer notificação, lida ou não) |
| v2.6 | 2026-07-04 | Combos: créditos fixos (`limite_corte`/`limite_barba`/`limite_sobrancelha`) trocados por JSONB dinâmico (`creditos`/`creditos_originais`, chave = nome do serviço no catálogo) — qualquer combinação de pacote funciona sem migration. Nova `catalogo_combo_creditos` (receita de créditos por pacote, derivada do catálogo existente). `<select>` nativo de pacote trocado por seletor premium (busca + preço, valor travado ao selecionar). `ChecklistCreditosCombo` virou steppers travados no saldo real; `CardSaldoCombo` (novo componente compartilhado) reaproveitado na aba Combos, no modal de cliente e na tela de venda. Carrinho unificado de serviços/produtos avulsos com quantidade e split de pagamento; "Serviço adicional (upsell)" ganhou o mesmo padrão de "Adicionar" dos avulsos, reposicionado logo abaixo do card de saldo do combo; renovação exposta direto quando o saldo esgota |
| v2.7 | 2026-07-05 | **Consolidação de infraestrutura:** sistema-thieco migrado da VPS dedicada (`72.60.113.214`) para a VPS do vilamill-sistema (`2.24.93.178`), em stack Docker isolada (rede/volume/portas próprias, `127.0.0.1` only). 11.025 vendas migradas via `pg_dump`/`pg_restore`, DNS de `barbeariatl.online` repontado, SSL reemitido. Reconciliação pós-migração: 348 vendas junho/Mutinga + 4 junho/Tambore reimportadas, e-mails de profissionais corrigidos (dados que só existiam em backup Hostinger + banco local, ausentes no dump da VPS antiga). Hardening colateral: portas do próprio vilamill-sistema (3000/5433, antes em `0.0.0.0`) também restritas a `127.0.0.1`. VPS antiga descomissionada (containers parados) |
| v2.8 | 2026-07-05 | Despesas recorrentes: `gastos` ganha `recorrente`/`frequencia_recorrencia`/`gasto_origem_id`. Ao marcar recorrente na criação, gera em lote as próximas 11 ocorrências futuras (mensal/semanal/anual) — sem cron job. Toggle customizado no padrão visual dourado/onix (substitui checkbox nativo) |
| v2.9 | 2026-07-05 | Taxas de pagamento passam a ser por unidade + bandeira individual — antes eram globais (mesma taxa pra Tamboré e Mutinga, bug não percebido desde 2026-06-25). 28 chaves `taxa_{unidade}_{forma}[_{bandeira}]` (Visa/Mastercard/Elo/Hipercard/Diners), `calcularTaxaPagamento()` passa a receber `unidade`. Tela de Configurações ganha seletor de unidade. Corrigido de brinde: `invalidarCacheTaxas()` nunca era chamada de verdade (import apontava pro módulo errado) |
| v2.10 | 2026-07-11 | Fix de comissão subcalculada no backfill de migration quando `qtd_clientes > 1` (TASK-20, restrito na prática à Mutinga). Fix de SQL injection em 6 endpoints de `relatorios.js` (parâmetro `unidade` interpolado sem checar validação). Card de ranking por canal de aquisição (`RankingOrigemClientes`, já existia pronto e órfão) plugado em `IntelFinanceira.jsx` |
| v2.11 | 2026-07-12 | **Motor de Agendamento Nativo** (TASK-23) — substitui a dependência do Booksy. Novas tabelas `agendamentos`/`jornada_unidade`, `catalogo.duracao_minutos`, anti-overbooking em duas camadas (`OVERLAPS` na app + `EXCLUDE USING gist` no banco). Endpoints públicos sem login (`/servicos`, `/disponibilidade`, `/publico`) — primeira vez que o sistema expõe rotas sem JWT por design. Tela `Agenda` (barbeiro/operador/admin) e página pública `AgendamentoPublico` via `?agendar=<unidade>` |
| v2.12 | 2026-07-12 | Confirmação de presença do cliente (`codigo_confirmacao`, página pública `?confirmar=<codigo>`) e lembrete automatizado de agendamento (`gerarLembretesAgendamento()`, `setInterval` de 5min) — ambos só **enfileiram** mensagem pronta na tabela `notificacoes` (`canal='whatsapp'`); nenhum envio de WhatsApp de verdade acontece ainda |
| v2.13 | 2026-07-12 | Notificações Administrativas Configuráveis (TASK-29) — nova tabela `configuracoes_notificacoes`, 4 tipos (faturamento/produtos mais vendidos/serviços mais realizados/estoque parado) configuráveis por unidade com periodicidade e horário fixo de disparo. Reaproveita a mesma fila `canal='whatsapp'` do lembrete de agendamento. `Configuracoes.jsx` reestruturada em abas (Taxas + Notificações). Arquitetura de integração com agentes de IA (Horizon/Cortex pro disparo, Quasar pro agendamento conversacional) mapeada e documentada como pendência — nenhum código integrado ainda |
| v2.14 | 2026-07-12 | TASK-27 parcial: gatilho Aniversariante (nova tabela `configuracoes_gatilhos_cliente`, condição por cliente em vez de relatório agregado) e card "Dias de Menor Movimento" em Inteligência Financeira (analítica de apoio, não dispara nada sozinho). Inadimplentes sai de escopo definitivamente (não há módulo de Fiado) |
| v2.15 | 2026-07-12 | Cadastro único do administrador (`usuarios.telefone`/`email` + canais `notif_canal_whatsapp`/`notif_canal_email`) substitui o telefone digitado por card das notificações administrativas. Novo canal `email` na fila `notificacoes`, endpoints de consumo simétricos ao whatsapp. Número de WhatsApp remetente configurável por unidade (`whatsapp_remetente_{unidade}`) |
| v2.16 | 2026-07-12 | TASK-27 completa: gatilho Cliente Sumido (mesmo padrão do Aniversariante, limite de dias configurável) e aba "Promoções" — disparo manual segmentado (nova tabela `campanhas_promocionais`), com preview de audiência antes de enviar. Cooldown de marketing cross-tipo de 14 dias (`DIAS_COOLDOWN_MARKETING`) evita empilhar contato no mesmo cliente entre gatilhos/campanhas diferentes |
| v2.17 | 2026-07-12 | TASK-24: gatilho pós-venda com link de avaliação do Google Meu Negócio. Sem conceito de "atendimento fechado" no backend, o gerador agrupa vendas por `venda_origem_id` e usa um buffer de 5min (`vendas.created_at`) pra inferir que a comanda parou de crescer — padrão de polling por evento, primeira vez usado nesse formato (os outros gatilhos são por condição de cliente ou por horário) |
| v2.18 | 2026-07-12 | TASK-28: campanhas segmentadas com rastreamento de conversão. Filtros novos (ticket gasto, serviço consumido) na aba Promoções. Nova tabela `campanhas_destinatarios` (roster de quem recebeu cada campanha — antes só a contagem era guardada). `GET /campanhas/:id/resultados` mede conversão/faturamento gerado numa janela de 30 dias — métricas nomeadas assim, não "ROI %", por não existir custo por disparo rastreado no sistema ainda |
| v2.19 | 2026-07-21 | TASK-30 revisitada: disparo direto de notificações (sem agente externo), substituindo a espera por Horizon/Cortex. `emailService.js` (Nodemailer real) e `whatsappService.js` (Baileys/QR, implementado e testado localmente, mas **pausado** — handshake não completou em dev, suspeita de proxy de rede; Willians vai trazer a chave oficial da Meta Cloud API, plano de migração comentado no próprio arquivo). `jobs/notificacoesJob.js` (`node-cron`, hora cheia) substitui o `setInterval` de 15min só para `verificarNotificacoesConfiguradas`. Botão "QR Code" + modal em `Configuracoes.jsx`. Nenhuma tabela nova — reaproveita `usuarios`/`configuracoes_notificacoes` (TASK-29) |
| v2.20 | 2026-07-23 | Isolamento por unidade dos alertas internos (SinoBadge): `unidadeEfetiva(req)` em `backend/routes/notificacoes.js` corrige 3 bugs (admin caindo na própria unidade em vez de ver as duas; dedup de "ranking já gerado hoje" não escopado por unidade; `PATCH /:id/lida` sem checar dono da unidade). Sino liberado pros três papéis (antes só admin); selo de unidade no título de cada alerta (`NotificacoesPanel.jsx`). Backoff exponencial + limite de 15 tentativas na reconexão do `whatsappService.js` (fix de crash em teste longo local) |
| v2.21 | 2026-07-25 | **Pivô Baileys → Evolution API.** O plano de esperar a chave oficial da Meta Cloud API (v2.19) foi abandonado — `whatsappService.js` reescrito pra Evolution API self-hosted (container próprio, contorna o problema de proxy que travava o Baileys direto no processo do backend). E-mail migra de Nodemailer/Gmail pra Resend. Dependências `@whiskeysockets/baileys`/`qrcode`/`nodemailer` removidas |
| v2.22 | 2026-07-25/28 | **WhatsApp multi-canal em produção + IA conversacional ativa.** 3 canais reais (Mutinga, Tamboré, admin), cada um com instância Evolution API própria. Concierge Quasar responde automaticamente em todo canal de unidade (FAQ + transbordo pra humano + foto da unidade via `sendMedia`). Canal admin ganha par com Cortex: relatório sob demanda por WhatsApp (faturamento/ranking/estoque/ticket médio) + checagem de autorização (fix de loop infinito). Alertas de sistema (estoque/meta) passam a notificar o admin via WhatsApp, não só o SinoBadge. Testado ponta a ponta com mensagem real, deployado na VPS. Efeito colateral: contrato de `notificar-admin` do Cortex simplificado (`instancia` em vez de `tenant_id` + dicionário fixo), sem mudança de comportamento pro thieco — ver [[registro-de-decisoes-thieco]] |
| v2.23 | 2026-07-28 | Botão "Desconectar" do WhatsApp exposto direto no card de remetente de cada canal (Tamboré/Mutinga/Admin) em `Configuracoes.jsx`, sem precisar abrir o modal de QR Code pra achá-lo — status de pareamento carregado por canal via `GET /whatsapp/:canal/status`. Fix no PDV (`RegistroVenda.jsx`): seletor de Serviço/Produto passa a dividir o catálogo pela `categoria` do item, não por `controla_estoque` (que segue sendo a fonte da verdade só pra classificação de comissão/upsell/alertas de estoque) — item sem controle de estoque marcado não fica mais escondido dentro do seletor de Serviço. Ver [[registro-de-decisoes-thieco]] |
| v2.24 | 2026-08-04 | **Fix: canal de notificações administrativas do Cortex fora do ar desde 28/07.** A mudança de contrato registrada em v2.22 (`instancia` em vez de `tenant_id`) nunca foi de fato deployada no container do Cortex na VPS — toda chamada de `notificar-admin` retornava 422, silenciosamente. Descoberto na mesma investigação: `/var/www/orbita-agents/{cortex,quasar}` na VPS não são clones git (deploy manual, sem `.git` — atualização exige patch direto do arquivo, não `git pull`); e os 3 canais Evolution API (Mutinga/Tamboré/admin) estavam desconectados desde a mesma data (botão "Desconectar" de v2.23 usado em teste, nenhum reconectou) — atendimento automático do Quasar pode ter ficado fora do ar pra cliente a semana inteira, não só a notificação do admin. Reconexão pendente (Thieco loga o número dele em 05/08). FAQ do Theo (Quasar, `orbita-quasar/database.py`) ganha regra explícita de nunca arredondar preço na resposta. Ver [[registro-de-decisoes-thieco]] |
