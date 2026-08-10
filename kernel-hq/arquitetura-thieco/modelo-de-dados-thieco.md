---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-07-28 (rev 9)
owner: willians
---

# Modelo de Dados — Sistema de Caixa Barbearia Thieco Leandro

> Referência: [[prd-thieco]] | [[arquitetura-thieco]]

---

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| Profissional | O barbeiro que executa os atendimentos | Vincula cada venda ao executante e determina a comissão devida |
| Venda | Um atendimento registrado no caixa | Núcleo do sistema — faturamento, comissão e rastreio partem daqui |
| Gasto | Uma despesa da barbearia, com recorrência opcional (mensal/semanal/anual, desde 2026-07-05) | Necessário para calcular resultado operacional real (DRE); recorrência evita relançar manualmente despesas fixas todo mês |
| Catalogo | Serviços e produtos disponíveis | Define preços de referência e distingue serviço de produto físico |
| ComboContratado | Pacote de créditos pré-pago por cliente, quantidade por serviço dinâmica (JSONB, desde 2026-07-04) | Fidelização — cliente paga antecipado, usa fracionadamente até esgotar ou vencer, qualquer combinação de serviços do catálogo |
| ComboConsumo | Cada crédito debitado de um ComboContratado | Rastreia data/profissional/serviço do uso, sem gerar venda duplicada |
| CatalogoComboCreditos | Receita de créditos de um pacote de combo do catálogo (desde 2026-07-04) | Define quantos créditos de cada serviço um pacote concede ao ser contratado — usada pelo seletor premium na tela de venda |
| Cliente | Pessoa que frequenta a barbearia | Rastreio de recorrência, histórico e origem |
| Meta | Objetivo financeiro mensal por profissional | Acompanhamento de performance individual com três pisos de gamificação |
| MetaUnidade | Meta mensal específica por unidade | Separação de performance entre Tambore e Mutinga com pisos Bronze/Prata/Ouro |
| MetaDiaria | Meta financeira diária por unidade | Base para cálculo de cota individual do barbeiro no dia |
| DebitoBarbeiro | Desconto interno lançado pelo admin contra um barbeiro | Registra consumo de produto ou adiantamento a ser descontado da comissão |
| Configuracao | Par chave/valor de configuração do sistema, taxas sempre por unidade + bandeira (desde 2026-07-05) | Armazena taxas de pagamento editáveis pelo admin sem redeploy, com o acordo comercial real de cada unidade |
| Notificacao | Alerta gerado automaticamente pelo sistema, ou mensagem enfileirada pra disparo externo de WhatsApp (desde 2026-07-12) | Proatividade — estoque baixo, meta em risco, ranking semanal, lembrete de agendamento, relatório periódico |
| Agendamento | Um horário reservado na agenda de um barbeiro (desde 2026-07-12) | Núcleo do motor de agendamento nativo — substitui o Booksy; origem admin/operador/barbeiro/público |
| JornadaUnidade | Horário de funcionamento de uma unidade por dia da semana (desde 2026-07-12) | Base de cálculo de disponibilidade real — sem isso não dá pra saber quando um horário pode ser oferecido |
| ConfiguracaoNotificacao | Configuração de uma notificação administrativa periódica por unidade (desde 2026-07-12) | Liga/desliga, periodicidade e horário de disparo de faturamento/ranking/estoque parado, controlados pelo admin sem precisar de deploy |
| ConfiguracaoGatilhoCliente | Configuração de um gatilho de mensagem individual por cliente (desde 2026-07-12) | Aniversariante, cliente sumido e avaliação pós-venda — condição por cliente, não relatório agregado |
| CampanhaPromocional | Registro de uma promoção disparada manualmente (desde 2026-07-12) | Histórico de disparo em lote segmentado, base pro rastreamento de conversão (TASK-28) |
| CampanhaDestinatario | Um cliente que recebeu uma CampanhaPromocional específica (desde 2026-07-12) | Roster necessário pra cruzar com vendas/agendamentos posteriores e medir conversão |
| Feedback | Registro de elogio ou melhoria sobre profissional | Gestão de qualidade e desenvolvimento de time |
| PlanoAcao | Plano PDCA vinculado a um feedback | Transformar observação em melhoria estruturada |
| Sugestão | Ideia ou problema reportado pela equipe | Canal de comunicação bottom-up |

---

## Atributos por entidade

### Profissional

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único auto-incrementado |
| nome | VARCHAR(100) | sim | não | nome do barbeiro — UNIQUE |
| unidade | unidade_enum | sim | não | 'tambore' ou 'mutinga' — unidade principal |
| percentual_comissao | NUMERIC(5,2) | sim | não | padrão 40,00; 0 para o dono — comissão sobre serviços |
| percentual_comissao_produto | NUMERIC(5,2) | sim | não | padrão 10,00 — comissão sobre produtos físicos; separado para permitir customização por barbeiro. Thieco (dono/admin) sempre 0 — migração idempotente zera as duas colunas de comissão dele especificamente depois que esta coluna existe (bug corrigido em 2026-07-18: a migração de zeragem original rodava antes do `ALTER` que criou esta coluna, então o `DEFAULT 10,00` nunca era corrigido para ele) |
| ativo | BOOLEAN | sim | não | false = desativado, não aparece em registros novos |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |

### Venda

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| unidade | unidade_enum | sim | não | onde ocorreu o atendimento |
| profissional_id | INTEGER | não | não | FK → profissionais; null se profissional removido |
| servico | VARCHAR(120) | sim | não | nome do serviço ou produto prestado |
| valor | NUMERIC(10,2) | sim | não | **Preço de tabela (bruto), ANTES do desconto** — mesma convenção usada em toda venda lançada ao vivo (`calcularFinanceiro`). O desconto é subtraído depois (`valor - desconto`), nunca somado de volta. Corrigido em 2026-07-01: a importação de histórico salvava aqui o valor já líquido (C/Desc), o oposto da convenção do resto do sistema — quebrava Lançamentos (dupla subtração de desconto) e o card "Faturamento Bruto" do Dashboard. Ver registro de decisões. |
| comissao | NUMERIC(10,2) | sim | sim | comissão total (servico + produto) — calculada sobre `valor` (já é o preço de tabela; nunca somar `desconto` de novo — esse era o bug corrigido em 2026-07-01) |
| comissao_servico | NUMERIC(10,2) | sim | sim | 40% de `valor` se tipo_item != 'produto' e percentual_comissao > 0 |
| comissao_produto | NUMERIC(10,2) | sim | sim | 10% de `valor` se tipo_item = 'produto' e percentual_comissao > 0 |
| forma_pagamento | VARCHAR(30) | sim | não | dinheiro / pix / credito / debito / cortesia |
| data | DATE | sim | não | data do atendimento |
| tipo_item | VARCHAR(10) | sim | não | 'servico' ou 'produto' |
| tipo_cliente | VARCHAR(20) | sim | não | agendado / esporadico / primeira_vez |
| desconto | NUMERIC(10,2) | sim | não | abatimento dado ao cliente. Subtraído de `valor` para chegar no valor líquido efetivamente cobrado: `valor - desconto = líquido`. `valor` já é o preço cheio de tabela — nunca somar desconto a ele. |
| upsell | BOOLEAN | sim | não | true se é item adicional de uma comanda |
| venda_origem_id | INTEGER | não | não | FK → vendas(id) para itens upsell. **Também define "atendimento"** em todos os relatórios/painéis: `COUNT(DISTINCT COALESCE(venda_origem_id, id))` conta comandas (visitas), não linhas — várias vendas com o mesmo `venda_origem_id` (serviço + produto + upsell da mesma visita) contam como 1 atendimento. Import de histórico deve sempre popular este campo (agrupando por cliente+data+profissional) — omiti-lo infla atendimentos e derruba o ticket médio artificialmente (bug corrigido em 2026-07-01). |
| qtd_clientes | SMALLINT | sim | não | padrão 1; combos com múltiplos clientes |
| nome_cliente | VARCHAR(120) | não | não | nome do cliente quando informado |
| origem_cliente | VARCHAR(30) | não | não | whatsapp / indicacao / organico |
| bandeira_cartao | VARCHAR(30) | não | não | visa / mastercard / outras — para cálculo de taxa Mutinga |
| valor_liquido | NUMERIC(10,2) | não | sim | valor após desconto de taxa PagBank |
| custo_produto | NUMERIC(10,2) | não | não | custo interno do produto físico consumido no atendimento — registrado pelo admin para controle de margem; não afeta comissão nem receita |
| caixinha | NUMERIC(10,2) | sim | não | default 0 — gorjeta recebida pelo barbeiro. **100% repasse, fora do faturamento e da comissão da empresa** (`comissao` continua calculada só sobre `valor`; `financeiro_vendas.receita_bruta_ajustada` nunca inclui `caixinha`). Desde 2026-07-09. |
| caixinha_forma_pagamento | VARCHAR(30) | não | não | dinheiro / pix / credito / debito — forma de pagamento **da caixinha**, independente da `forma_pagamento` da venda (importa pra reconciliação de caixa físico). Nunca `cortesia` — caixinha é sempre pagamento real. |
| observacao | TEXT | não | não | nota livre |
| importado | BOOLEAN | sim | não | true para dados históricos importados |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |

### Gasto

> Recorrência opcional desde 2026-07-05: ao marcar `recorrente=true` na criação, o backend gera automaticamente as próximas 11 ocorrências futuras (mensal/semanal/anual), cada uma como uma linha independente já persistida, vinculada à despesa original via `gasto_origem_id`. Não existe job/cron — a geração é só em lote, uma vez, no ato da criação.

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| unidade | unidade_enum | sim | não | onde ocorreu o gasto |
| categoria | VARCHAR(60) | sim | não | ex: aluguel, produto, manutenção |
| descricao | VARCHAR(255) | sim | não | descrição do gasto |
| valor | NUMERIC(10,2) | sim | não | valor realizado |
| valor_previsto | NUMERIC(10,2) | não | não | orçado — para comparação |
| data | DATE | sim | não | data do gasto |
| observacao | TEXT | não | não | nota livre |
| importado | BOOLEAN | sim | não | true para dados históricos |
| recorrente | BOOLEAN | sim | não | default false — opcional; true marca despesa com repetição automática |
| frequencia_recorrencia | VARCHAR(10) | não | não | `semanal` / `mensal` / `anual` — obrigatório apenas quando `recorrente=true` |
| gasto_origem_id | INTEGER | não | não | FK → gastos(id), ON DELETE SET NULL — presente só nas ocorrências geradas, aponta para a despesa original |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |

### Catalogo

> `unidade` é **obrigatória para qualquer categoria** desde 2026-07-20 (antes só serviço/combo exigiam). Um item sem unidade aparece/edita nas duas unidades ao mesmo tempo (`unidade IS NULL OR unidade = :unidade` na listagem) — foi a causa raiz de um bug onde deletar um produto numa unidade apagava o mesmo produto (a mesma linha) na outra. 38 itens cadastrados antes do fix ainda têm `unidade = NULL` (a maioria já inativa); seguem compartilhados até serem editados manualmente com a unidade correta — nenhuma migração automática foi feita por falta de sinal nos dados para decidir a unidade certa de cada um.

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| nome | VARCHAR(120) | sim | não | nome do serviço/produto — UNIQUE por `(nome, unidade)` |
| categoria | VARCHAR(30) | sim | não | `servico` \| `combo` \| `produto_capilar` \| `produto_barba` (desde 2026-07-20) \| `bebida` \| `snack` \| `vestuario` \| `outro` — default `servico` |
| unidade | VARCHAR(20) | **sim** (desde 2026-07-20, qualquer categoria) | não | `tambore` \| `mutinga`. `NULL` só existe em itens legados pré-fix (ver nota acima) — nunca gravado em item novo |
| preco_venda | NUMERIC(10,2) | sim | não | preço de venda — default 0 |
| preco_custo | NUMERIC(10,2) | não | não | custo de aquisição — usado no consumo interno de estoque quando não informado na hora |
| quantidade | INTEGER | sim | não | estoque atual — só relevante quando `controla_estoque = true` |
| quantidade_minima | INTEGER | sim | não | limiar de alerta de estoque baixo — default 0 |
| unidade_medida | VARCHAR(20) | sim | não | `un`, etc. — default `un` |
| controla_estoque | BOOLEAN | sim | não | true = produto físico com controle de quantidade — altera comissionamento |
| duracao_minutos | INTEGER | sim | não | default 30 — desde 2026-07-12, usado pelo motor de agendamento pra calcular `hora_fim` de cada slot. Seed com a duração real por serviço/unidade (fonte: PDF Onboarding Zion Ops); itens sem correspondência ficam no default |
| ativo | BOOLEAN | sim | não | visibilidade no sistema — exclusão é sempre soft delete (`ativo = false`) |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação. Desde 2026-07-12, também usado pelo motor de agendamento pra calcular "estoque parado" (dias desde o cadastro) |

### ComboContratado (créditos dinâmicos por JSONB desde 2026-07-04)

> A tabela V1 `combos` (cliente_nome texto, sem cliente_id, sem crédito fracionado, campo `ativo` booleano) foi **retirada do app** em 2026-07-01 — nenhuma rota ou tela viva grava/lê mais nela. Preservada apenas como histórico morto (não é FK de nada, pode ficar inerte indefinidamente). Todo combo é `combos_contratados` a partir de agora.
>
> Em 2026-07-04, as colunas fixas `limite_corte`/`limite_barba`/`limite_sobrancelha` foram substituídas por duas colunas JSONB (`creditos`, `creditos_originais`) — chave = nome exato do serviço no catálogo (ex.: `"Corte"`, `"Risco"`, `"Sobrancelha com Cera"`, `"Limpeza de pele (facial)"`). Qualquer combinação de serviços cadastrada no catálogo como pacote de combo passa a funcionar sem migration nem alteração de código. As colunas antigas permanecem no banco (não removidas) só não são mais lidas/escritas pelo app — migração via backfill idempotente, sem perda de combos já contratados.

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| cliente_id | INTEGER | sim | não | FK → clientes(id) — diferente do V1, aqui é relacional, não texto solto |
| profissional_id | INTEGER | não | não | FK → profissionais |
| unidade | unidade_enum | sim | não | unidade do combo |
| data_compra | DATE | sim | não | quando o combo foi comprado. Editável pelo admin desde 2026-07-08 (`PATCH /combos/contratados/:id/data-compra`) — corrige cadastros retroativos (ex.: venda feita via Booksy fora do caixa) para que a contagem de validade conte da data real, não da data do cadastro manual. Ver "Estados e ciclo de vida" abaixo. |
| data_validade | DATE | não | não | validade — `hoje + 30 dias` quando ativado; NULL enquanto o combo está `na_fila` (só ganha validade ao ser ativado) |
| creditos | JSONB | sim | não | saldo atual por serviço, ex. `{"Corte": 1, "Barba": 0, "Sobrancelha": 1}` — decrementado a cada consumo, chave = nome do serviço no catálogo |
| creditos_originais | JSONB | sim | não | total concedido na contratação, imutável — usado para exibir "1/2" (atual/original) nas telas |
| status | combo_status_enum | sim | não | `em_uso` / `na_fila` / `encerrado` |
| valor | NUMERIC(10,2) | sim | não | valor pago pelo combo (cobrado no ato da contratação, gera venda) |
| forma_pagamento | VARCHAR(30) | sim | não | forma de pagamento da contratação |
| bandeira_cartao | VARCHAR(30) | não | não | quando forma = crédito/débito |
| venda_id | INTEGER | não | não | FK → vendas(id) — a venda de faturamento criada na contratação |
| servicos_descricao | TEXT | não | não | descrição gerada dinamicamente a partir de `creditos` (ex.: "2 Corte(s) + 2 Barba(s)") |
| origem_venda | VARCHAR(20) | não | não | NULL (ativação padrão) / 'upsell' / 'reativacao' — rastreia contexto da contratação |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |

### ComboConsumo

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| combo_contratado_id | INTEGER | sim | não | FK → combos_contratados(id) |
| servico_utilizado | VARCHAR(60) | sim | não | nome livre do serviço (desde 2026-07-04, era `combo_servico_enum` fixo 'corte'/'barba') — sempre o nome exato do serviço no catálogo, ex. "Corte", "Risco", "Sobrancelha com Cera" |
| data_uso | DATE | sim | não | data em que o crédito foi utilizado — DEFAULT CURRENT_DATE |
| profissional_id | INTEGER | não | não | FK → profissionais — quem atendeu nessa utilização |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |

> Cada linha é **1 crédito debitado**, nunca gera venda. É a fonte do "último uso" exibido na tela de venda e no painel do barbeiro (`data_uso`, `profissional_nome`, `servico_utilizado` — a linha mais recente por `combo_contratado_id`). Um consumo de N créditos do mesmo serviço numa visita (steppers) grava N linhas idênticas exceto `id`.

### CatalogoComboCreditos (desde 2026-07-04)

> Receita de créditos de cada pacote de combo já cadastrado no catálogo (`categoria = 'combo'`). Derivada uma única vez do nome de cada pacote existente (ex.: "Combo - Corte + Barba + Sobrancelha" → Corte:1, Barba:1, Sobrancelha:1) — nenhum cadastro novo foi necessário. `GET /catalogo` embute essa receita em cada item de combo (`creditos: { servico: quantidade }`), consumida pelo seletor premium de pacote na tela de venda (autopreenche créditos e valor, trava o valor após selecionar).

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| catalogo_id | INTEGER | sim | não | FK → catalogo(id) — o pacote de combo |
| servico | VARCHAR(120) | sim | não | nome do serviço concedido (nome exato do catálogo) |
| quantidade | SMALLINT | sim | não | créditos concedidos desse serviço ao contratar o pacote — `CHECK (quantidade > 0)` |

> `UNIQUE (catalogo_id, servico)` — um pacote não pode ter duas linhas para o mesmo serviço.

### MetaDiaria

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| unidade | unidade_enum | sim | não | unidade da meta |
| data | DATE | sim | não | data do dia — UNIQUE com unidade |
| meta_total | NUMERIC(10,2) | sim | não | meta da casa para o dia inteiro |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |

> A **cota individual** do barbeiro não é armazenada — é calculada em tempo real: `meta_total ÷ barbeiros_ativos_da_unidade`. Mínimo 1 no denominador para evitar divisão por zero. Constraint UNIQUE em `(unidade, data)` garante uma meta por unidade por dia.

### DebitoBarbeiro

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| profissional_id | INTEGER | sim | não | FK → profissionais — a quem o débito pertence |
| descricao | TEXT | sim | não | descrição do débito (ex: "Pomada Loreal consumida") |
| valor | NUMERIC(10,2) | sim | não | valor a descontar — CHECK valor > 0 |
| data | DATE | sim | não | data do registro — DEFAULT CURRENT_DATE |
| periodo | VARCHAR(7) | sim | não | mês de referência no formato YYYY-MM |
| unidade | unidade_enum | não | não | unidade onde ocorreu |
| criado_por | INTEGER | não | não | FK → usuarios(id) — admin que registrou |
| criado_em | TIMESTAMPTZ | sim | sim | gerado na criação |

### Configuracao

> Desde 2026-07-05: taxa é sempre por unidade (`taxa_debito`/`taxa_credito` globais, que aplicavam a mesma taxa pra Tamboré e Mutinga por engano, foram removidas). Formato real da chave: `taxa_{unidade}_{forma}` (Pix/Dinheiro/Cortesia, nunca têm bandeira) ou `taxa_{unidade}_{forma}_{bandeira}` (Débito/Crédito — uma chave "padrão" sem bandeira, mais uma por bandeira individual: Visa, Mastercard, Elo, Hipercard, Diners). 28 chaves no total (14 por unidade).

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| chave | VARCHAR(80) | sim | não | **chave primária** (não tem `id` separado) — ex: `taxa_tambore_credito_elo` |
| valor | TEXT | sim | não | decimal como string — ex: `'0.0499'` (= 4,99%) |
| descricao | TEXT | não | não | texto legível gerado no seed — ex: "Tamboré — Crédito à vista Elo — 4,99%" |
| updated_at | TIMESTAMPTZ | sim | sim | atualizado a cada `PUT /configuracoes/taxas` |

> Admin altera via `PUT /configuracoes/taxas` (chave validada por regex `^taxa_(tambore|mutinga)_([a-z]+)(?:_([a-z]+))?$`, bandeira restrita à whitelist de 5 valores). Leitura em `getTaxas()` com cache 5 min — invalidado por `invalidarCacheTaxas()` ao salvar (bug de invalidação nunca funcionar corrigido em 2026-07-05, junto com a introdução da unidade). `calcularTaxaPagamento()` busca `taxa_{unidade}_{forma}_{bandeira}`, cai pra `taxa_{unidade}_{forma}` se a bandeira não tiver chave específica, nunca cruza unidades.
>
> **Desde 2026-07-12**, mais dois padrões de chave por unidade nessa mesma tabela genérica: `whatsapp_remetente_{unidade}` (número de WhatsApp que aparece como remetente das mensagens da unidade — `GET/PUT /configuracoes/whatsapp-remetente`) e `link_avaliacao_{unidade}` (link do Google Meu Negócio pro gatilho de avaliação pós-venda — `GET/PUT /configuracoes/link-avaliacao`). Ambos vazios por padrão, admin preenche quando tiver o dado.

---

### Notificacao

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| unidade | VARCHAR(100) | não | não | unidade destinatária; NULL = todas |
| tipo | VARCHAR(60) | sim | não | `estoque_baixo` / `estoque_zerado` / `meta_risco` / `ranking_semanal_servicos` / `ranking_semanal_produtos` (canal `sistema`, alertas do SinoBadge) — mais, desde 2026-07-12, `lembrete_agendamento` / `faturamento` / `produtos_mais_vendidos` / `servicos_mais_realizados` / `estoque_parado` / `aniversariante_cliente` / `cliente_sumido` / `avaliacao_pos_venda` / `promocao` (canais `whatsapp`/`email`, fila de disparo externo) |
| nivel | VARCHAR(20) | sim | não | `critico` / `aviso` / `info` — default `info` |
| titulo | TEXT | sim | não | título curto do alerta |
| mensagem | TEXT | não | não | detalhe ou contexto adicional. Para `canal='whatsapp'`/`'email'`, já é o texto pronto pra enviar (não precisa reformatar) |
| meta | JSONB | não | não | payload estruturado. Para `canal='sistema'`: `catalogo_id`/`meta_id` — chave de identidade pra sincronizar sem duplicar (ver abaixo). Para `canal='whatsapp'`/`'email'`: dados estruturados do disparo (ex.: `agendamento_id`, `atendimento_id`, `cliente_id`, `telefone_destino`, `email_destino`, `telefone_remetente`, `link_confirmacao`, `ranking`) |
| lida | BOOLEAN | sim | não | default false; marcar como lida não volta a false enquanto a condição do alerta continuar ativa (corrigido em 2026-07-01). Não usado pelos canais externos |
| canal | VARCHAR(20) | sim | não | default `sistema` (alerta interno, SinoBadge). `whatsapp` (desde 2026-07-12) = fila de disparo externo por WhatsApp. `email` (desde 2026-07-12) = mesma fila, canal e-mail — ambos consumidos via `GET /notificacoes/{whatsapp,email}/pendentes` |
| enviado_whatsapp | BOOLEAN | sim | não | default false. Desde 2026-07-21, reflete o resultado **real** do envio: `verificarNotificacoesConfiguradas()` chama `whatsappService.enviarWhatsapp()` antes de gravar a linha e grava o `{ok}` retornado. Desde 2026-07-25, o envio é de verdade via Evolution API (pivô do Baileys/Meta Cloud API pausados anteriormente — ver [[registro-de-decisoes-thieco]] 2026-07-25). Também pode ser marcado via `PATCH /notificacoes/whatsapp/:id/enviado` para reenvio manual/externo |
| enviado_email | BOOLEAN | sim | não | default false — simétrico a `enviado_whatsapp`. Desde 2026-07-21, reflete o resultado real de `emailService.enviarEmail()` — desde 2026-07-25 via Resend (era Nodemailer/SMTP) |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |

> Índices: `(tipo)` e `(unidade, lida)`.
>
> **`canal='sistema'`** — gerada pelo endpoint `POST /notificacoes/gerar` — chamado automaticamente ao abrir o painel de notificações. `SinoBadge` no Header conta notificações não lidas com polling. Visível pros três papéis desde 2026-07-23 (antes só admin).
>
> **Isolamento por unidade (desde 2026-07-23):** `POST /gerar`, `GET /`, `PATCH /lidas` e `PATCH /:id/lida` usam `unidadeEfetiva(req)` — barbeiro/operador só leem/escrevem na própria unidade (JWT prevalece sobre query, mesmo padrão de Profissionais/Catálogo/Clientes); admin sem filtro vê as duas unidades juntas (fix: o JWT do admin carrega `unidade='tambore'` herdada do vínculo como profissional, e o código antigo caía nesse valor por padrão em vez de não filtrar). `PATCH /:id/lida` agora exige que a linha pertença à unidade do usuário (ou tenha `unidade IS NULL`) — antes marcava como lida qualquer `id`, de qualquer unidade. O frontend (`NotificacoesPanel.jsx`) exibe um selo com o nome da unidade ao lado do título sempre que `unidade` não é nula.
>
> **Sincronização, não recriação (corrigido em 2026-07-01):** `POST /notificacoes/gerar` costumava apagar TODAS as notificações voláteis (`estoque_baixo`, `estoque_zerado`, `meta_risco`) e recriar do zero a cada chamada — como o painel chama `/gerar` toda vez que é aberto, marcar uma notificação como lida e reabrir o painel fazia ela reaparecer como não lida. Agora `sincronizarAlertas()` faz upsert por chave (`tipo` + `meta->>'catalogo_id'` ou `meta->>'meta_id'`): se o alerta já existe (lido ou não), só atualiza os dados preservando `lida`; só remove quando a condição deixou de ser válida (estoque reabastecido, meta fora de risco).
>
> **Retenção de 7 dias:** toda notificação (lida ou não) com `created_at` há mais de 7 dias é apagada a cada chamada de `POST /notificacoes/gerar` — evita acúmulo indefinido no inbox. Só se aplica a `canal='sistema'`.
>
> **`canal='whatsapp'`/`'email'` (desde 2026-07-12)** — seis origens geram essas linhas: `gerarLembretesAgendamento()` (5min, agendamentos a 15min de começar), `verificarNotificacoesConfiguradas()` (desde 2026-07-21, `node-cron` a cada hora cheia — ver `backend/jobs/notificacoesJob.js` — antes era `setInterval` de 15min; respeitando `ConfiguracaoNotificacao`, gera até 2 linhas por conteúdo, uma por canal ativado no cadastro do admin), `gerarGatilhoAniversariante()` e `gerarGatilhoClienteSumido()` (15min, condição por cliente), `gerarGatilhoAvaliacaoPosVenda()` (5min, por evento — atendimento fechado) e `POST /campanhas` (disparo manual, TASK-27/28). Nenhum job apaga/expira essas linhas automaticamente. **Desde 2026-07-21**, `verificarNotificacoesConfiguradas()` já dispara de verdade antes de gravar (e-mail e WhatsApp reais desde 2026-07-25, ver `enviado_whatsapp` acima) — as demais cinco origens continuam só enfileirando, sem envio automático ainda; revisitar retenção quando todas tiverem envio real. **Alertas de sistema (`canal='sistema'`) também passaram a notificar por WhatsApp desde 2026-07-28** (via `notificarAdminViaCortex`), sem deixar de existir no SinoBadge.
>
> **Cooldown de marketing (desde 2026-07-12):** os tipos `aniversariante_cliente`, `cliente_sumido`, `avaliacao_pos_venda` e `promocao` compartilham uma regra cross-tipo — nenhum cliente recebe mais de uma dessas mensagens dentro de `DIAS_COOLDOWN_MARKETING` (14 dias), mesmo se ele se encaixar em mais de um gatilho/campanha diferente no período. Implementado via `NOT EXISTS` correlacionado por `meta->>'cliente_id'`, não uma coluna própria.

---

### Agendamento (desde 2026-07-12)

> Núcleo do motor de agendamento nativo. Anti-overbooking em duas camadas: checagem `OVERLAPS` na aplicação (mensagem amigável) + `EXCLUDE USING gist` no Postgres (`btree_gist`) como rede de segurança contra corrida — nunca existe sobreposição real no banco, mesmo se dois clientes reservarem o mesmo horário pelo link público ao mesmo tempo.

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| unidade | unidade_enum | sim | não | onde o atendimento vai ocorrer |
| profissional_id | INTEGER | sim | não | FK → profissionais |
| catalogo_id | INTEGER | não | não | FK → catalogo, ON DELETE SET NULL — serviço agendado |
| servico_nome | VARCHAR(120) | sim | não | snapshot do nome do serviço no momento — sobrevive a mudança/remoção do item no catálogo |
| cliente_nome | VARCHAR(120) | sim | não | nome de quem vai ser atendido |
| cliente_contato | VARCHAR(30) | não | não | telefone/WhatsApp — obrigatório pra receber lembrete automatizado |
| data | DATE | sim | não | dia do atendimento |
| hora_inicio | TIME | sim | não | início do slot |
| hora_fim | TIME | sim | sim | `hora_inicio + catalogo.duracao_minutos` (ou duração informada explicitamente) — `CHECK (hora_fim > hora_inicio)` |
| status | VARCHAR(20) | sim | não | `confirmado` / `cancelado` / `concluido` / `no_show` |
| origem | VARCHAR(20) | sim | não | `admin` / `operador` / `barbeiro` / `publico` — quem criou o agendamento |
| observacao | TEXT | não | não | nota livre |
| codigo_confirmacao | VARCHAR(20) | não | não | token único (hex aleatório), gerado em toda criação — usado no link público de confirmação de presença (`?confirmar=<codigo>`) |
| confirmado_cliente_em | TIMESTAMPTZ | não | não | preenchido quando o cliente clica "vou comparecer" na página pública; null até lá |
| venda_id | INTEGER | não | não | FK → vendas(id), ON DELETE SET NULL — reservado pra vincular o agendamento à venda de fato quando o atendimento acontecer (ainda não conectado automaticamente) |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |

> Índices: `(data)` e `(profissional_id)`.

### JornadaUnidade (desde 2026-07-12)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| unidade | unidade_enum | sim | não | qual unidade |
| dia_semana | SMALLINT | sim | não | 0=domingo ... 6=sábado (igual `EXTRACT(DOW)` do Postgres) |
| hora_inicio | TIME | sim | não | abertura |
| hora_fim | TIME | sim | não | fechamento |
| ativo | BOOLEAN | sim | não | false = fechado nesse dia da semana |

> `UNIQUE (unidade, dia_semana)`. Horário é por **unidade**, não por barbeiro individual — todos os barbeiros de uma unidade atendem na mesma janela; a agenda de cada um é que fica bloqueada pelos próprios `agendamentos` já marcados. Seed real: Ter-Qui 9h-20h, Sex-Sáb 9h-19h, domingo/segunda fechado (fonte: PDF Onboarding Zion Ops).

### ConfiguracaoNotificacao (desde 2026-07-12)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| unidade | unidade_enum | sim | não | qual unidade |
| tipo | VARCHAR(40) | sim | não | `faturamento` / `produtos_mais_vendidos` / `servicos_mais_realizados` / `estoque_parado` |
| ativo | BOOLEAN | sim | não | default false — admin liga o que quiser |
| periodicidade | VARCHAR(20) | sim | não | `diario` / `semanal` / `quinzenal` / `personalizado` |
| periodicidade_dias | INTEGER | não | não | só usado quando `periodicidade='personalizado'` |
| hora_disparo | TIME | sim | não | default `20:00` — horário fixo de disparo, não só intervalo solto |
| parametros | JSONB | sim | não | específico por tipo — hoje só `estoque_parado` usa (`{"dias_estoque_parado": 60}`) |
| ultimo_disparo_em | TIMESTAMPTZ | não | não | atualizado a cada checagem dentro da janela de horário, tenha ou não gerado conteúdo — evita reavaliar a mesma janela repetidamente |

> `UNIQUE (unidade, tipo)` — uma configuração por combinação. Seed com 8 linhas (4 tipos × 2 unidades), todas `ativo=false`.
>
> **Coluna `telefone_destino` removida em 2026-07-12** — o destino passou a vir do cadastro único do administrador (`usuarios.telefone`/`email` + `notif_canal_whatsapp`/`notif_canal_email`), não mais digitado por card. Ver seção "Usuario — campos de notificação" mais abaixo.

---

### Usuario — campos de notificação (desde 2026-07-12)

> `usuarios` já existe desde a autenticação (TASK-18); esta seção documenta só os atributos novos, adicionados pro cadastro do administrador (destino das notificações administrativas).

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| telefone | VARCHAR(20) | não | não | WhatsApp do usuário — usado como destino quando `notif_canal_whatsapp=true` |
| email | VARCHAR(150) | não | não | usado como destino quando `notif_canal_email=true` |
| notif_canal_whatsapp | BOOLEAN | sim | não | default `true` — liga o canal WhatsApp pras notificações administrativas (exige `telefone` preenchido) |
| notif_canal_email | BOOLEAN | sim | não | default `false` — liga o canal e-mail (exige `email` preenchido) |

> Auto-serviço via `GET/PUT /configuracoes/perfil-admin` — cada admin edita o próprio cadastro (`req.user.id`), não existe tela de admin editando o cadastro de outro. `verificarNotificacoesConfiguradas()` busca `role='admin' AND ativo=true ORDER BY id ASC LIMIT 1` — o `ORDER BY id ASC` é deliberado: se existir mais de um usuário admin (ex.: conta de teste/dev também marcada admin), sempre pega a conta mais antiga (a principal), nunca uma aleatória.

---

### ConfiguracaoGatilhoCliente (desde 2026-07-12)

> Diferente de `ConfiguracaoNotificacao` (relatório agregado periódico pro admin): aqui cada linha dispara mensagem personalizada por CLIENTE quando uma condição individual é satisfeita (aniversário, ausência prolongada, atendimento recém-concluído).

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| unidade | unidade_enum | sim | não | qual unidade |
| tipo | VARCHAR(40) | sim | não | `aniversariante` / `cliente_sumido` / `avaliacao_pos_venda` |
| ativo | BOOLEAN | sim | não | default false |
| hora_disparo | TIME | sim | não | default `09:00` — só relevante pra `aniversariante`/`cliente_sumido` (condição avaliada por horário); `avaliacao_pos_venda` é disparado por evento e ignora este campo |
| template_mensagem | TEXT | sim | não | placeholders `{nome_cliente}`, `{nome_barbearia}` (todos os tipos) e `{link_avaliacao}` (só `avaliacao_pos_venda`) |
| parametros | JSONB | sim | não | default `{}` — só `cliente_sumido` usa hoje (`{"dias_sem_visita": 45}`) |

> `UNIQUE (unidade, tipo)`. Idempotência é por tipo: `aniversariante` uma vez por ano por cliente; `cliente_sumido` uma vez por "sequência de ausência" (não reenvia até o cliente voltar e sumir de novo); `avaliacao_pos_venda` uma vez por atendimento (`meta->>'atendimento_id'`). Os três, mais `promocao`, também respeitam o cooldown de marketing cross-tipo (ver `Notificacao`).

---

### CampanhaPromocional (desde 2026-07-12)

> Diferente de `ConfiguracaoGatilhoCliente` (liga/desliga + roda sozinho): aqui não existe `ativo`/`hora_disparo` — é log de **disparo manual**, o admin escreve e clica "enviar" na hora. A tabela guarda o que já foi mandado (histórico + evita reenvio acidental duplicado).

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| unidade | unidade_enum | sim | não | qual unidade |
| titulo | VARCHAR(120) | sim | não | uso interno (não vai na mensagem) |
| mensagem | TEXT | sim | não | texto disparado (sem placeholders — a promoção é escrita pronta) |
| filtro | JSONB | sim | não | snapshot do filtro usado no disparo — `dias_sem_visita_min`, `tipo`, `ticket_gasto_min`, `ticket_gasto_max`, `servico_consumido` |
| total_destinatarios | INTEGER | sim | não | quantos clientes bateram o filtro no momento do disparo |
| criado_por | INTEGER | não | não | FK → usuarios(id), ON DELETE SET NULL |
| created_at | TIMESTAMPTZ | sim | sim | é também o "momento do envio" — usado como `enviado_em` de referência |

---

### CampanhaDestinatario (desde 2026-07-12)

> `CampanhaPromocional` sozinha só guarda a *contagem* de destinatários — sem saber *quem* recebeu, não dá pra cruzar com vendas/agendamentos posteriores pra medir conversão (TASK-28). Esta tabela é o roster.

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| campanha_id | INTEGER | sim | não | FK → campanhas_promocionais(id), ON DELETE CASCADE |
| cliente_id | INTEGER | sim | não | FK → clientes(id), ON DELETE CASCADE |
| cliente_nome | VARCHAR(100) | sim | não | snapshot do nome no momento do envio — o casamento com `vendas`/`agendamentos` posteriores é sempre por nome (mesmo padrão usado no resto do sistema), então precisa do nome como estava naquele momento |
| enviado_em | TIMESTAMPTZ | sim | sim | início da janela de atribuição de conversão |

> Índice em `campanha_id`. `GET /campanhas/:id/resultados` cruza esta tabela com `vendas`/`agendamentos` criados entre `enviado_em` e `enviado_em + 30 dias` (constante `DIAS_JANELA_CONVERSAO`) pra calcular conversão, faturamento gerado e agendamentos gerados.

---

### Feedback

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| profissional_id | INTEGER | sim | não | FK → profissionais (CASCADE DELETE) |
| tipo | feedback_tipo_enum | sim | não | 'elogio' ou 'melhoria' |
| categoria | VARCHAR(60) | sim | não | ex: atendimento, pontualidade |
| titulo | VARCHAR(150) | sim | não | resumo do feedback |
| descricao | TEXT | sim | não | detalhamento |
| data | DATE | sim | não | data do registro |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |

### PlanoAcao

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | identificador único |
| profissional_id | INTEGER | sim | não | FK → profissionais (CASCADE DELETE) |
| titulo | VARCHAR(200) | sim | não | objetivo do plano |
| planejar | TEXT | sim | não | fase P do PDCA |
| executar | TEXT | sim | não | fase D do PDCA |
| checar | TEXT | sim | não | fase C do PDCA |
| agir | TEXT | sim | não | fase A do PDCA |
| status | pdca_status_enum | sim | não | pendente / em_andamento / concluido / cancelado |
| data_inicio | DATE | sim | não | início do plano |
| data_meta | DATE | não | não | prazo esperado |
| data_conclusao | DATE | não | não | preenchida ao concluir |
| created_at | TIMESTAMPTZ | sim | sim | gerado na criação |
| updated_at | TIMESTAMPTZ | sim | sim | atualizado a cada modificação |

---

## Relacionamentos

| De | Para | Tipo | Atributos do relacionamento | Regra |
|---|---|---|---|---|
| Venda | Profissional | N:1 | — | ON DELETE SET NULL — venda preservada se profissional for removido |
| Venda | Venda | N:1 (auto) | venda_origem_id | venda filho referencia venda pai (upsell); ON DELETE SET NULL |
| Gasto | Gasto | N:1 (auto) | gasto_origem_id | ocorrência futura gerada referencia a despesa original recorrente; ON DELETE SET NULL |
| DebitoBarbeiro | Profissional | N:1 | — | débito vinculado ao profissional; sem CASCADE — profissional não pode ser excluído enquanto tiver débitos |
| DebitoBarbeiro | Usuario | N:1 | criado_por | rastreia qual admin registrou o débito |
| Feedback | Profissional | N:1 | — | ON DELETE CASCADE — feedbacks são excluídos junto com o profissional |
| PlanoAcao | Profissional | N:1 | — | ON DELETE CASCADE |
| ComboContratado | Profissional | N:1 | — | ON DELETE SET NULL |
| ComboContratado | Cliente | N:1 | cliente_id | relacional (V1 usava cliente_nome texto solto) |
| ComboContratado | Venda | N:1 | venda_id | a venda de faturamento criada na contratação |
| ComboConsumo | ComboContratado | N:1 | combo_contratado_id | cada linha = 1 crédito debitado |
| CatalogoComboCreditos | Catalogo | N:1 | catalogo_id | ON DELETE CASCADE — receita some se o pacote for removido do catálogo |
| Agendamento | Profissional | N:1 | profissional_id | sem ON DELETE definido — profissional não deve ser removido enquanto tiver agendamento futuro |
| Agendamento | Catalogo | N:1 | catalogo_id | ON DELETE SET NULL — `servico_nome` (snapshot) preserva o registro mesmo se o item sumir do catálogo |
| Agendamento | Venda | N:1 | venda_id | ON DELETE SET NULL — vínculo reservado, ainda não conectado automaticamente no fluxo |

---

## Estados e ciclo de vida

### Profissional

```
ativo → inativo
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| ativo | aparece em selects, recebe vendas | → inativo | admin desativa manualmente |
| inativo | não aparece, histórico preservado | — | irreversível (soft delete) |

### ComboContratado (V2)

```
na_fila → em_uso
em_uso → encerrado
encerrado → (novo ComboContratado via reativação — não reabre o mesmo registro)
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| na_fila | contratado enquanto cliente já tinha outro `em_uso`; sem `data_validade` ainda | → em_uso | `ativarProximoNaFila()` quando o combo ativo do cliente encerra |
| em_uso | cliente pode debitar créditos de qualquer serviço presente em `creditos` | → encerrado | esgotamento de crédito (todas as chaves de `creditos` ≤ 0, checado dinamicamente — desde 2026-07-04, antes era `limite_corte + limite_barba = 0` fixo) OU `data_validade < hoje` — checado tanto em `GET /combos/saldo` quanto na listagem admin, com o **mesmo critério** (ver RN-011) |
| encerrado | esgotado ou vencido — sem crédito utilizável | — (reativação cria um **novo** ComboContratado) | automático (checagem de esgotamento) ou manual (`PATCH /combos/contratados/:id/encerrar`) |

> Reativar não reabre o registro `encerrado` — contrata um novo, com `origem_venda = 'reativacao'`, disponível tanto na aba Combos (botão "Reativar") quanto direto na tela de venda (mesmo seletor de 3 abas usado para clientes novos).

> **Correção de `data_compra` (desde 2026-07-08):** admin pode editar a data de lançamento de um combo já contratado (`PATCH /combos/contratados/:id/data-compra`), útil para cadastro retroativo. Se o combo está `em_uso`, `data_validade` é recalculada automaticamente (`data_compra + 30 dias`); combos `na_fila` (ainda sem validade) e `encerrado` (histórico fechado) só têm `data_compra` atualizada, sem recálculo.

### PlanoAcao

```
pendente → em_andamento → concluido
pendente → cancelado
em_andamento → cancelado
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| pendente | plano criado, não iniciado | → em_andamento, → cancelado | gestão inicia ou cancela |
| em_andamento | execução em curso | → concluido, → cancelado | gestão avança ou cancela |
| concluido | ação implementada | — | gestão marca como concluído |
| cancelado | plano abandonado | — | gestão cancela |

### Agendamento (desde 2026-07-12)

```
confirmado → cancelado
confirmado → concluido
confirmado → no_show
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| confirmado | horário reservado, ocupa a agenda do barbeiro (conta pra anti-overbooking) | → cancelado, → concluido, → no_show | criação (admin/operador/barbeiro/público) |
| cancelado | não ocupa mais a agenda — `EXCLUDE` constraint ignora linhas nesse status | — | `PATCH /:id/status`, admin/operador/barbeiro dono |
| concluido | atendimento realmente aconteceu | — | `PATCH /:id/status`, marcado manualmente por quem atendeu ou pelo admin |
| no_show | cliente não compareceu | — | `PATCH /:id/status`, marcado manualmente |

> Diferente de `ComboContratado`, não há fechamento automático por tempo — todas as transições de status são manuais (`PATCH /agendamentos/:id/status`), feitas por quem gerencia a agenda depois do horário passar.

---

## Propriedade e acesso

| Entidade | Quem cria | Quem lê | Quem edita | Quem exclui |
|---|---|---|---|---|
| Profissional | admin | admin | admin | admin (soft delete) |
| Venda | admin ou barbeiro (própria) | admin (todas), barbeiro (próprias) | não editável | admin |
| Gasto | admin | admin | admin | admin |
| Catalogo | admin | todos | admin | admin |
| ComboContratado | admin, operador, barbeiro (via tela de venda) | admin (todos), barbeiro (próprios) | admin (encerrar, corrigir data_compra) | não exclui — só encerra |
| CatalogoComboCreditos | admin (implícito, via cadastro do pacote no catálogo) | todos (embutido em `GET /catalogo`) | admin | admin (CASCADE com o pacote) |
| Cliente | admin | admin | admin | admin |
| Feedback | admin | admin | admin | admin |
| PlanoAcao | admin | admin | admin | admin |
| DebitoBarbeiro | admin | admin (todos), barbeiro (próprios) | admin | admin |
| Sugestão | qualquer autenticado | admin | admin | admin |
| Agendamento | admin/operador/barbeiro (autenticado) OU **qualquer pessoa sem login** (`POST /agendamentos/publico`) | admin (todos), operador (própria unidade), barbeiro (próprios), qualquer pessoa (`GET /disponibilidade`, sem dado sensível) | admin/operador (qualquer), barbeiro (próprios) | não exclui — só muda status |
| JornadaUnidade | admin (via API — sem tela nesta fase) | qualquer pessoa (`GET /agendamentos/disponibilidade` usa indiretamente) | admin | não exclui |
| ConfiguracaoNotificacao | seed automático (migration) | admin | admin | não exclui |

---

## Ciclo de retenção

| Entidade | Retenção | Arquivado após | Excluído após | Nunca excluir |
|---|---|---|---|---|
| Venda | permanente | — | nunca | dados históricos 2024-2026 |
| Gasto | permanente | — | nunca | necessário para DRE histórico |
| Profissional | permanente | — | nunca (soft delete) | histórico de comissões depende do registro |
| Feedback | permanente | — | apenas com o profissional (CASCADE) | — |
| PlanoAcao | permanente | — | apenas com o profissional (CASCADE) | — |
| ComboContratado | permanente | — | nunca | histórico de fidelização; combos `encerrado` nunca são apagados, só marcados |
| ComboConsumo | permanente | — | nunca | rastreio de uso é auditável indefinidamente |
| CatalogoComboCreditos | permanente | — | com o pacote (CASCADE) | — |
| DebitoBarbeiro | permanente | — | nunca | histórico de descontos compõe fechamento financeiro do barbeiro |
| Cliente | enquanto ativo | — | mediante solicitação explícita | — |
| Agendamento | permanente | — | nunca (só muda status) | histórico de agenda é auditável — inclusive cancelamentos e no-show |
| Notificacao (`canal='whatsapp'`) | sem retenção definida ainda | — | nunca hoje | fila só cresce até existir consumidor real; revisitar quando a integração de envio existir (ver registro de decisões) |
