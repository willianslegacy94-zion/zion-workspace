---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-08
owner: willians
---

# Modelo de Dados — Lane Confeitaria

Schema real em `lane-confeitaria/prisma/schema.prisma` (Prisma 7, PostgreSQL). Migrations aplicadas contra o Postgres real de produção (VPS) desde 2026-08-03/04 via `docker compose run --rm migrate` (`prisma migrate deploy`).

**Regra dura aprendida em produção (2026-08-04):** todo campo adicionado/alterado no `schema.prisma` precisa de uma migration correspondente em `prisma/migrations/` **no mesmo commit** — `Pedido.comprovanteParaValidar`/`resumoComprovante` ficaram só no schema por uma sessão inteira sem migration, e o Prisma Client gerado (que reflete o `schema.prisma`, não o banco real) passou a tentar ler colunas inexistentes em produção, quebrando `/crm`, o dashboard e a criação de pedido com 500 opaco. Ver `registro-de-decisoes-lane-confeitaria.md` (2026-08-04) pro relato completo.

**Segunda regra dura, mesma classe de bug, causa diferente (2026-08-08):** ter a migration commitada não basta — o serviço `migrate` do `docker-compose.yml` (`profiles: ["tools"]`) **não é reconstruído automaticamente** por `docker compose up -d --build`. Se `docker compose run --rm migrate` rodar sem um `docker compose build migrate` explícito antes, ele reaproveita a imagem antiga e reporta "No pending migrations to apply" mesmo com uma migration nova esperando — o Postgres real fica sem a coluna, com o mesmo sintoma de 500 opaco em `/crm`. Migration `20260808000024_desistencia` foi a vítima dessa vez. Comando correto sempre com os dois passos, nunca só o segundo — ver `docs/architecture/deploy-playbook.md`, seção Redeploy.

---

## Entidades

| Entidade | Papel |
|---|---|
| `Usuario` | Conta de acesso (single-tenant) |
| `Fila` | Coluna do kanban de pedidos, nome livre |
| `Cliente` | Cliente da confeitaria |
| `Atendimento` | Conversa em andamento antes de virar `Pedido` — card leve, sem dado de bolo |
| `SaborBolo` | Item do catálogo de sabores de bolo |
| `ItemDocinho` | Item do menu de docinhos por cento |
| `Pedido` | Entidade central — encomenda de bolo |
| `PedidoSabor` | Junção Pedido↔SaborBolo (até 2 por pedido) |
| `Agendamento` | Compromisso de produção na Agenda |
| `Insumo` | Ingrediente, base do cálculo de CMV |
| `ReceitaInsumo` | Junção SaborBolo↔Insumo com quantidade |
| `Despesa` | Lançamento financeiro |
| `Meta` | Meta de faturamento por período |
| `ConfiguracaoSistema` | Singleton com os parâmetros configuráveis |
| `FormaPagamento` | Taxa % por forma de pagamento — usada só pela Calculadora de Projeção (desde 2026-08-05), nunca por `Pedido` real |

---

## Atributos por entidade

### Usuario

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| nome | string | |
| email | string | único, usado como login |
| senhaHash | string | bcrypt |
| createdAt | datetime | |

### Fila

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| nome | string | livre, definida pela usuária |
| ordem | int | posição de exibição |
| disparaAgendamento | boolean | default false — quando true, pedido que entra aqui gera `Agendamento`; **saindo** de uma fila com esse flag pra uma sem, o `Agendamento` é apagado automaticamente (libera a vaga — ver Estados e ciclo de vida) |
| contaComoConcluido | boolean | default false — quando true, pedidos aqui contam para receita/CMV/recorrência/ranking |
| recebePedidoAutomatico | boolean | default false — fila pra onde o `Atendimento`/`Pedido` avança automaticamente vindos do canal automatizado (Quasar), a partir da 2ª mensagem da conversa |
| disparaAtendimentoHumano | boolean | default false — fila destino quando o Quasar aciona a ferramenta `acionar_atendimento_humano` |

Os quatro flags acima são a resposta a uma lacuna real do PRD: filas têm nome livre, então não há convenção fixa para identificar "produção confirmada", "concluído", "recebe a IA" ou "atendimento humano" — a usuária marca manualmente em Configurações → Filas.

**Funil real de produção (definido e replicado em 2026-08-04, via `scripts/seed-filas-funil.ts`, idempotente por `nome`):**

| Fila (ordem) | disparaAgendamento | contaComoConcluido | recebePedidoAutomatico | disparaAtendimentoHumano |
|---|---|---|---|---|
| Novo Cliente (0) | — | — | — | — |
| Em negociação (1) | — | — | ✅ | — |
| Atendimento humanizado (2) | — | — | — | ✅ |
| Agendado (3) | ✅ | — | — | — |
| Pago (4) | — | ✅ | — | — |

"Novo Cliente" nunca leva nenhum flag — é a fila de menor `ordem`, e todo `Pedido`/`Atendimento` cai nela automaticamente na 1ª mensagem/criação, por ser a primeira, não por marcação (ver `pedidoService.criarPedido`/`atendimentoService.registrarProgressoAtendimento`, que buscam `fila.findFirst({ orderBy: { ordem: "asc" } })`).

### Cliente

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| nome | string | |
| contato | string? | telefone/WhatsApp — chave de identidade usada tanto por `buscarOuCriarCliente` (dedup) quanto pelo Quasar/Atendimento |

### Atendimento

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| clienteId / filaId | uuid | FKs — mesma `Fila` do Kanban de pedidos |
| createdAt / updatedAt | datetime | |
| motivoAtendimentoHumano | enum `MotivoAtendimentoHumano`? | preenchido só pela Mel ao acionar atendimento humano; volta a `null` em qualquer movimentação manual do card |
| desistencia | boolean | default false — `true` tira o card do Kanban **pra sempre** (ver `listarAtendimentosPorFila`), nunca volta sozinho |
| desistenciaMotivo | enum `MotivoDesistencia`? | classificado pela Mel via chamada ao Quasar (nunca escolhido pela Lane), ver Estados e ciclo de vida abaixo |
| desistenciaEm | datetime? | zerado (junto com `desistenciaMotivo`) por limpeza diária depois de 30 dias — `desistencia` continua `true` |

Sem nenhum campo de bolo (sabor, peso, data, valor) — existe só pra representar visualmente, no mesmo Kanban dos pedidos, uma conversa que a Mel já iniciou mas ainda não virou `Pedido` de verdade (que exige esses campos como `NOT NULL`). Quando o `Pedido` real é criado pro mesmo cliente (origem automática), o `Atendimento` correspondente é apagado — nunca coexistem os dois representando o mesmo card.

### SaborBolo

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| nome | string | único — catálogo real de 44 sabores no seed |
| precoPorKg | decimal? | **nulo até cadastro manual** — cliente não forneceu tabela de preço por sabor |
| ativo | boolean | soft delete |

### ItemDocinho

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| nome | string | único — 12 itens reais no seed |
| precoCento | decimal | R$150 ou R$180, valores reais do cardápio |
| ativo | boolean | soft delete |

### Pedido

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| clienteId / filaId | uuid | FKs |
| massa | enum `BRANCA \| CHOCOLATE` | sem custo adicional |
| pesoKg | decimal(6,3) | |
| dataEntrega | date | |
| modeloReferencia | string? | texto/link — sem upload de imagem |
| valorBase | decimal | valor combinado (sabor/peso) |
| acrescimoCartao/Glitter/Topper | boolean | marcação por pedido |
| valorAcrescimos | decimal | soma dos acréscimos marcados × valor configurado |
| valorFinal | decimal | valorBase + valorAcrescimos |
| valorSinal | decimal | 50% do valorFinal |
| statusSinal / statusSaldo | enum `PENDENTE \| PAGO` | marcação manual via modal do card (`PedidoDetalheModal`) |
| comprovanteParaValidar | boolean | default false — a Mel (Quasar) sinaliza aqui quando lê um comprovante de Pix por foto e o valor/destinatário parecem corretos; **nunca** marca `statusSinal=PAGO` sozinha |
| resumoComprovante | string? | o que a Mel viu na imagem do comprovante — exibido no modal pra Lane decidir aprovar/rejeitar |
| cancelado / canceladoEm / sinalRetido | boolean/datetime/boolean | regra de cancelamento 24h |
| motivoAtendimentoHumano | enum `MotivoAtendimentoHumano`? | preenchido só pela Mel ao acionar atendimento humano; volta a `null` em qualquer movimentação manual do card |
| desistencia / desistenciaMotivo / desistenciaEm | boolean / enum `MotivoDesistencia` (`PRECO \| PRAZO \| INDISPONIBILIDADE \| INDEFINIDO`)? / datetime? | mesma regra do campo homônimo em `Atendimento` — `desistencia=true` é permanente (some do Kanban pra sempre), mas o `Pedido` **nunca é apagado**: só `desistenciaMotivo`/`desistenciaEm` somem depois de 30 dias, preservando sabor/valor/histórico financeiro |

### PedidoSabor

Junção `Pedido`↔`SaborBolo`, `@@unique([pedidoId, saborBoloId])` — máximo 2 por pedido, validado no Service (`pedidoService.criarPedido`), não apenas no schema.

### Agendamento

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| pedidoId | uuid | único — 1:1 com Pedido |
| data | date | indexado, base da checagem de limite diário |

### Insumo

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| nome | string | |
| unidade | enum `KG \| GRAMA \| UNIDADE \| LITRO` | |
| custoUnitario | decimal(10,4) | |

### ReceitaInsumo

Junção `SaborBolo`↔`Insumo`, `@@unique([saborBoloId, insumoId])` — `upsert` na associação (reassociar atualiza quantidade, não duplica).

### Despesa / Meta

Lançamentos financeiros simples — categoria/descrição/valor/data (Despesa) e período/valorMeta (Meta).

`Despesa.recorrente` (boolean, default false, desde 2026-08-04) — **só marcação visual** (badge "Recorrente" na lista), pra Lane identificar despesas fixas (aluguel, internet). Decisão explícita do usuário: **não** gera lançamento automático todo mês — sem job/cron nenhum associado a esse campo.

### ConfiguracaoSistema

Singleton (`id` sempre 1) com `limiteFilas` (default 7), `limiteBolosPorDia` (default 5) e os 3 valores de acréscimo — **nenhum desses valores é hardcoded no código**, todos lidos desta tabela.

### FormaPagamento

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid | PK |
| nome | string | único, livre (ex.: "Pix", "Crédito 3x") — cadastrado em Configurações → Formas de pagamento |
| taxa | decimal(5,2) | percentual, ex.: `4.50` = 4,5% |
| ativo | boolean | soft delete |

**Só existe pra alimentar a Calculadora de Projeção** (`/projecao`) — nenhuma tabela real (`Pedido`, `Despesa`) referencia `FormaPagamento`, e nenhum fluxo de criação/edição de pedido lê essa taxa. Ver seção "Calculadora de Projeção" abaixo.

---

## Relacionamentos

```
Usuario (isolado — single-tenant, sem FK para dados de negócio)

Fila 1—N Pedido
Fila 1—N Atendimento
Cliente 1—N Pedido
Cliente 1—N Atendimento
Pedido 1—N PedidoSabor N—1 SaborBolo   (até 2 por Pedido, validado em Service)
Pedido 1—1 Agendamento (opcional)
SaborBolo 1—N ReceitaInsumo N—1 Insumo
```

---

## Estados e ciclo de vida

### Pedido

```
criado (fila inicial, ordem 0)
   → se origem="automatico" (Quasar): avança sozinho
       → fila.recebePedidoAutomatico (ex.: "Em negociação")
       → fila.disparaAgendamento (ex.: "Agendado") — mesma trava de dia cheio
       → (best-effort: para na última fila alcançada se alguma etapa falhar)
   → movido entre filas (kanban, manual ou via API do Quasar)
       → entrando numa fila com disparaAgendamento=true: gera Agendamento (bloqueado se dia cheio)
       → saindo de uma fila com disparaAgendamento=true pra uma sem: libera o Agendamento (vaga volta a ficar livre)
       → se fila.contaComoConcluido: passa a contar em receita/CMV/recorrência/ranking
   → comprovante de Pix analisado por foto (Quasar): comprovanteParaValidar=true, resumoComprovante preenchido
       → Lane aprova (modal): statusSinal=PAGO, comprovanteParaValidar=false
       → Lane rejeita (modal): só comprovanteParaValidar=false, statusSinal continua PENDENTE
   → cancelado (a qualquer momento)
       → se < 24h da entrega: sinalRetido = true
   → marcado como desistência (botão no card, a qualquer momento)
       → Lane chama a ação; ação chama o Quasar (POST classificar-desistencia) que classifica o motivo
       → desistencia=true (permanente — nunca some do Kanban de volta sozinho)
       → desistenciaMotivo/desistenciaEm preenchidos com o retorno da Mel (INDEFINIDO se o Quasar falhar/não tiver conversa)
       → 30 dias depois: limpeza diária (crontab → POST /api/internal/desistencias/limpar) zera só desistenciaMotivo/desistenciaEm
           → Pedido em si nunca é apagado — some da aba Clientes, mas sabor/valor/histórico continuam no banco
```

Não há campo de "status" único no Pedido — o estado operacional é a própria `filaId` (kanban), e os flags de fila (`disparaAgendamento`, `contaComoConcluido`, `recebePedidoAutomatico`, `disparaAtendimentoHumano`) derivam comportamento a partir dela.

### Atendimento

```
criado (fila inicial, ordem 0) — na 1ª mensagem de um contato novo ao Quasar
   → avança pra fila.recebePedidoAutomatico a partir da 2ª mensagem em diante
   → movido manualmente pela Lane (drag/select), igual um Pedido
   → apagado quando um Pedido de verdade é criado pro mesmo Cliente (origem automática)
   → marcado como desistência (botão no card) — mesmo fluxo do Pedido (ver acima): desistencia=true
     permanente, desistenciaMotivo/desistenciaEm classificados pela Mel e zerados depois de 30 dias
```

Nunca gera `Agendamento` nem conta como concluído — esses comportamentos só existem no `Pedido`, que tem os campos (`dataEntrega`, `valorFinal`) que eles dependem.

### SaborBolo / ItemDocinho

`ativo=false` = soft delete (desativação via UI de catálogo), preserva histórico de pedidos que já referenciam o item.

---

## Padrão de IDs

Todas as entidades usam `uuid()` como PK (`@db.Uuid`), exceto `ConfiguracaoSistema` (`id Int @default(1)`, singleton proposital).

---

## Regras de cálculo

### Precificação (`precificacaoService.ts`, funções puras)

```
valorAcrescimos = soma dos acréscimos marcados × valor configurado em ConfiguracaoSistema
valorFinal = valorBase + valorAcrescimos
valorSinal = valorFinal × 0.5
valorSaldo = valorFinal − valorSinal
sinalRetido = (dataEntrega − agora) < 24 horas, no momento do cancelamento
```

### CMV (`financeiroService.calcularCustoSabor` + `cmvService.calcularCmvPorSabor`)

```
custoSabor(saborId) = soma(insumo.custoUnitario × receitaInsumo.quantidade) para todos os insumos associados
                     = null se nenhum insumo associado (nunca 0 — distinção crítica)

cmvPedido = custoSabor × pedido.pesoKg  (proporcional ao peso vendido)

cmvAgregadoPorSabor(periodo) = soma dos cmvPedido de todos os pedidos concluídos no período
                              = null (custoNaoCalculado=true) se QUALQUER pedido do sabor no período tem custo null
```

### Calculadora de Projeção (`/projecao`, `precificacaoService.aplicarTaxaPagamento`)

```
tipo "bolo":
  faturamentoBruto = precoPorKg(sabor) × pesoKg × quantidade + acréscimos marcados (topper/glitter,
                      mesmos valores de ConfiguracaoSistema usados no Pedido real)
  valorLíquido = faturamentoBruto × (1 − taxa(formaPagamento) / 100)
  lucro = custoPorKg(sabor) === null ? null : valorLíquido − custoPorKg × pesoKg × quantidade

tipo "docinho":
  faturamentoBruto = precoCento(item) × quantidadeCentos
  valorLíquido = faturamentoBruto × (1 − taxa(formaPagamento) / 100)
  lucro = sempre null — ItemDocinho não tem ReceitaInsumo, sem custo cadastrado pra calcular CMV
```

Simulação de **um cenário por vez** (escolhe tipo/sabor-ou-item/quantidade/acréscimos/forma de pagamento, clica "Simular", entra numa lista comparável) — decisão explícita do usuário em vez de uma matriz exaustiva de todas as combinações possíveis. Nada aqui é persistido nem afeta `Pedido`/`Despesa` reais.

### Faixa de peso (`rankingService.faixaDePeso`)

```
"5kg"    → peso > 2.5 e <= 7.5
"10kg"   → peso > 7.5 e <= 12.5
"15kg"   → peso > 12.5 e <= 17.5
"outros" → qualquer outro peso (nunca descartado da contagem)
```

---

## Links relacionados

[[arquitetura-lane-confeitaria]] — camadas do sistema e fluxos de dados que usam este modelo
[[prd-lane-confeitaria]] — requisitos que originaram cada entidade
[[indice-lane-confeitaria]] — mapa completo dos artefatos do sistema
