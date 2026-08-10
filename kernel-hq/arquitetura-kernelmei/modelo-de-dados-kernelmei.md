---
status: draft
domain: kernelmei
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Modelo de Dados — KernelMei

Schema real em `kernelmei/prisma/schema.prisma` (Prisma 7, PostgreSQL 16). **19 modelos e 5 enums.** Client gerado em `src/generated/prisma` (gitignored, regenerar com `npx prisma generate`).

Duas migrations aplicadas:

| Migration | Data | Conteúdo |
|---|---|---|
| `20260809153741_multi_tenant` | 2026-08-09 | Schema inteiro — **toda entidade de negócio já nasce com `tenantId`** |
| `20260810024348_add_error_log` | 2026-08-10 | Tabela `error_logs` + índices + FK opcional para `tenants` |

> **Nunca aplicado contra banco de produção.** Não há deploy. As migrations só rodaram contra o Postgres local (`docker-compose`, porta 5438).

---

## 1. A decisão estruturante: quem carrega `tenantId`

Esta é a decisão que define o modelo inteiro, e o schema a documenta caso a caso.

### Carregam `tenantId` (14 modelos — escopados por `scopedPrisma`)

`Usuario`, `Fila`, `Cliente`, `Atendimento`, `Pedido`, `Agendamento`, `DiaBloqueado`, `SaborBolo`, `ItemDocinho`, `Insumo`, `Despesa`, `Meta`, `FormaPagamento`, `ConfiguracaoSistema`

### Não carregam — e por quê

| Modelo | Motivo (citado do schema) |
|---|---|
| `Tenant`, `SuperAdmin` | Não pertencem a tenant nenhum — `SuperAdmin` é "conta de operação da plataforma, não do negócio" |
| `PedidoSabor` | "Tabela de junção pura — só alcançada através de um `Pedido` já filtrado por tenant (nunca consultada sozinha) — sem `tenantId` próprio de propósito, mesmo padrão de `OrderItem` no kernel-foodservice" |
| `ReceitaInsumo` | "Junção pura `SaborBolo`↔`Insumo` — mesma lógica de `PedidoSabor`" |
| `ErrorLog` | `tenantId` **opcional**: "um erro pode acontecer antes da sessão/tenant serem resolvidos (ex.: no próprio login)" |

### O caso instrutivo: `Agendamento`

`Agendamento` **poderia** ser tratado como junção (é 1:1 com `Pedido`, que já é escopado), mas carrega `tenantId` próprio. O schema explica: *"consultado diretamente por `(tenantId, data)` pra checar limite diário, não só alcançado através de um `Pedido` já filtrado. Por isso carrega `tenantId` próprio, diferente de `PedidoSabor`/`ReceitaInsumo`."*

**A regra derivada:** `tenantId` próprio existe quando a entidade é **ponto de entrada de consulta**; junção pura não precisa. Essa é a heurística a aplicar em qualquer entidade nova.

---

## 2. Entidades

### Plataforma

| Entidade | Papel |
|---|---|
| `Tenant` | Cada confeitaria/doceira contratada no whitelabel |
| `SuperAdmin` | Conta de operação da plataforma (onboarding) — fora de qualquer tenant |
| `ErrorLog` | Erro técnico capturado globalmente, alimenta a aba de logs do `/admin` |

### Negócio (herdadas do [[modelo-de-dados-lane-confeitaria|lane-confeitaria]], agora com `tenantId`)

| Entidade | Papel |
|---|---|
| `Usuario` | Conta de acesso da confeiteira |
| `Fila` | Coluna do kanban, nome livre, comportamento por flags |
| `Cliente` | Cliente final da confeitaria |
| `Atendimento` | Card leve, antes de existir dado de bolo |
| `Pedido` | Entidade central — a encomenda |
| `PedidoSabor` | Junção `Pedido`↔`SaborBolo` |
| `SaborBolo` | Item do catálogo de sabores |
| `ItemDocinho` | Item do menu de docinhos por cento |
| `Agendamento` | Compromisso de produção |
| `DiaBloqueado` | Dia indisponível sem pedido vinculado |
| `Insumo` | Ingrediente, base do CMV |
| `ReceitaInsumo` | Junção `SaborBolo`↔`Insumo` com quantidade |
| `Despesa` | Lançamento financeiro |
| `Meta` | Meta de faturamento por período |
| `FormaPagamento` | Taxa % por forma de pagamento |
| `ConfiguracaoSistema` | Parâmetros configuráveis **por tenant** |

---

## 3. Atributos das entidades de plataforma

### Tenant

| Campo | Tipo | Nota (do schema) |
|---|---|---|
| id | cuid | PK |
| slug | string único | "usado só no onboarding/painel admin — **nunca aparece na tela de login da usuária**" |
| nome | string | exibido no cabeçalho do `AppShell` |
| ativo | boolean, default true | "kill-switch (inadimplência, teste vencido etc.) — checado no login" |
| features | Json, default `{}` | `{chave: boolean}` — módulos opcionais além do `CORE_FEATURES` |
| branding | Json? | `{ logoUrl?, corPrimaria?, corFundo?, corDourado?, slogan? }` — sem isso, cai no tema de fábrica |
| createdAt | datetime | |

**Sem `onDelete: Cascade` em nenhuma relação filha — de propósito.** O comentário em `scripts/verificar-isolamento.ts` justifica: *"deletar tenant é operação perigosa demais pra ser um efeito colateral automático de FK — nunca exposta no produto, só o kill-switch `ativo` é"*. Consequência prática: apagar um tenant exige apagar 14 tabelas filhas na ordem correta, manualmente. O script faz exatamente isso para limpar seus tenants de teste.

### Usuario

| Campo | Tipo | Nota |
|---|---|---|
| id | cuid | PK |
| tenantId | string | FK, indexado |
| nome | string | |
| email | string **único global** | "login global (não por tenant) — tenant é resolvido a partir de qual `Usuario` bateu o e-mail (sem seletor de tenant na tela de login)" |
| senhaHash | string | bcrypt custo 12 |

**Efeito colateral assumido, documentado no schema:** dois tenants não podem ambos ter, por exemplo, `contato@gmail.com`. A convenção sugerida no onboarding é `admin@<slug-do-tenant>` em caso de colisão — e `provisionTenant()` devolve exatamente essa mensagem de erro quando detecta o conflito.

### ErrorLog

| Campo | Tipo | Nota |
|---|---|---|
| tenantId | string? | **opcional** — erro pode ocorrer antes de haver sessão |
| rota | string | ex.: `"GET /crm"` ou nome da server action |
| status | int | HTTP, ou 500 quando não aplicável |
| mensagem | string | truncada em 2000 chars por `registrarErro` |
| stack | string? | truncada em 4000 chars |
| usuario | string? | e-mail de quem estava logado |
| createdAt | datetime | indexado (junto com `rota`) |

---

## 4. Atributos das entidades de negócio — o que difere do lane-confeitaria

Os campos de domínio são os mesmos do [[modelo-de-dados-lane-confeitaria]]. Só as diferenças estão listadas aqui.

### ConfiguracaoSistema — deixou de ser singleton

O schema explica: *"Config por tenant — deixou de ser singleton (id fixo) porque agora existe mais de um tenant; cada linha nasce com valores zerados no provisionamento, a usuária configura depois."*

| Campo | Default | Nota |
|---|---|---|
| tenantId | — | `@unique` — garante 1 config por tenant |
| limiteFilas | 7 | limite do kanban |
| limiteBolosPorDia | 5 | limite de produção diária |
| valorAcrescimoCartao / Glitter / Topper | **0** | topper = topo simples |
| valorTopo3dAPartirDe | **0** | "topo 3D é 'a partir de', nunca fixo" |

**Consequência de produto importante:** todo tenant novo nasce com **todos os valores de acréscimo zerados**. Um pedido criado antes de a confeiteira configurar isso terá `valorAcrescimos = 0` mesmo com os checkboxes marcados. O lane-confeitaria tinha o mesmo comportamento, mas com um catálogo de 44 sabores pré-carregado; aqui o catálogo também nasce vazio, então o vazio inicial é maior.

### Fila — 4 flags, nenhum nome fixo

O schema é explícito: *"Sem convenção fixa de nome de fila (livre por tenant) — comportamento derivado inteiramente destes 4 flags, **nunca de string matching**."*

| Flag | Efeito |
|---|---|
| `disparaAgendamento` | mover pedido pra cá cria `Agendamento` (com trava de dia cheio) |
| `contaComoConcluido` | define "pedido concluído" pro CMV e indicadores financeiros |
| `recebePedidoAutomatico` | destino do avanço automático de funil |
| `disparaAtendimentoHumano` | destino do transbordo |

`provisionTenant()` semeia o funil padrão de 5 filas — o mesmo funil real do lane-confeitaria:

| Ordem | Nome | Flags |
|---|---|---|
| 0 | Novo Cliente | nenhuma |
| 1 | Em negociação | `recebePedidoAutomatico` |
| 2 | Atendimento humanizado | `disparaAtendimentoHumano` |
| 3 | Agendado | `disparaAgendamento` |
| 4 | Pago | `contaComoConcluido` |

Editável depois em Configurações → Filas.

### Índices — todos compostos, começando por `tenantId`

`Pedido`: `[tenantId, filaId]`, `[tenantId, dataEntrega]`, `[tenantId, desistenciaEm]`
`Atendimento`: `[tenantId, filaId]` · `Agendamento`: `[tenantId, data]` · `Despesa`: `[tenantId, data]` · `Cliente`: `[tenantId]` e `[tenantId, contato]`

Uniques também escopados: `SaborBolo` e `ItemDocinho` por `[tenantId, nome]`, `FormaPagamento` por `[tenantId, nome]`, `DiaBloqueado` por `[tenantId, data]`. Isso é o que permite duas confeitarias terem, cada uma, um sabor chamado "Ninho com Nutella".

---

## 5. Enums

| Enum | Valores |
|---|---|
| `TipoMassa` | BRANCA, CHOCOLATE |
| `StatusPagamento` | PENDENTE, PAGO |
| `UnidadeInsumo` | KG, GRAMA, UNIDADE, LITRO |
| `MotivoAtendimentoHumano` | PAGAMENTO_CARTAO, GERAL |
| `MotivoDesistencia` | PRECO, PRAZO, INDISPONIBILIDADE, INDEFINIDO |

---

## 6. Regras de cálculo (funções puras, sem banco)

`src/server/services/precificacaoService.ts` — o arquivo declara seu próprio escopo: *"Regra de negócio idêntica em qualquer confeitaria que usa o whitelabel: sinal de 50%, retenção em cancelamento <24h etc. — isso já é config por tenant onde faz sentido, não fica hardcoded aqui, só a fórmula em cima do valor configurado é comum a todos."*

| Função | Regra |
|---|---|
| `calcularValorAcrescimos` | soma os acréscimos marcados, usando os valores da `ConfiguracaoSistema` do tenant |
| `calcularValorFinal` | `valorBase + valorAcrescimos` |
| `calcularSinal` | **`valorFinal × 0.5`** — os 50% são fixos no código, não configuráveis por tenant |
| `calcularSaldo` | `valorFinal − valorSinal` |
| `deveReterSinal` | `true` se faltam **menos de 24h** para a entrega |
| `aplicarTaxaPagamento` | `valor × (1 − taxa/100)` — só na Calculadora de Projeção |

Todas arredondam com `Math.round(v * 100) / 100`.

**Ponto de atenção para o whitelabel:** o sinal de 50% e as 24h de retenção são regras da Lane que viraram regra do produto. Se uma segunda confeitaria trabalhar com 30% de sinal, isso hoje exige mudar código, não configuração. **Não documentado se foi decisão consciente** — nenhum comentário fala sobre generalizar isso.

Outras regras fixas no código, não por tenant:
- `agendaService.dataMinimaEntrega` — **3 dias de antecedência, sem contar domingo**. O comentário diz: *"Pura — não varia por tenant (é regra do produto, não config)"*
- `rankingService.faixaDePeso` — faixas 5kg / 10kg / 15kg / outros

### CMV com tratamento explícito de dado ausente

`cmvService.calcularCmvPorSabor` mantém a garantia central do lane: se **qualquer** insumo do sabor não tiver custo cadastrado, o resultado vem `cmv: null` e `custoNaoCalculado: true` — **nunca uma soma parcial que pareceria correta**. "Pedido concluído" é definido por `fila.contaComoConcluido`, nunca por nome de fila.

---

## 7. Ciclo de vida

### Provisionamento de tenant (transacional)

`onboardingService.provisionTenant()` roda numa `$transaction`: `Tenant` → `Usuario` admin → 5 `Fila` → `ConfiguracaoSistema` zerada. Se qualquer passo falhar, nada fica pela metade. Validações prévias: slug contra `/^[a-z0-9]+(-[a-z0-9]+)*$/`, unicidade de slug e de e-mail, senha com no mínimo 8 caracteres.

### Seed

`prisma/seed.ts` cria **apenas o primeiro `SuperAdmin`**, via `upsert` a partir de `SUPERADMIN_EMAIL`/`SUPERADMIN_SENHA`. Não semeia nenhum tenant nem catálogo — "tenants nascem via `provisionTenant()`, pelo próprio painel `/admin`".

### Retenção

`Atendimento` e `Pedido` guardam `desistencia`, `desistenciaMotivo` e `desistenciaEm`. O índice `[tenantId, desistenciaEm]` sugere a mesma retenção de 30 dias sem apagar o registro que o lane-confeitaria implementa — mas **no KernelMei não existe nenhuma rotina de expurgo**; o índice está pronto e ninguém o usa ainda.

---

## Links relacionados

[[indice-kernelmei]] — mapa completo dos artefatos do sistema
[[arquitetura-kernelmei]] — camadas, `scopedPrisma` e estratégia de isolamento
[[prd-kernelmei]] — escopo de produto e lacunas
[[modelo-de-dados-lane-confeitaria]] — modelo single-tenant de origem
