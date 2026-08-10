---
status: draft
domain: kernel-academia
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Modelo de Dados — Kernel Academia

Extraído de `kernel-academia/prisma/schema.prisma` (423 linhas) e das 2 migrations aplicadas. Provider: `postgresql`. IDs: `uuid` em coluna `@db.Uuid`, gerados pela aplicação (`@default(uuid())`).

**16 models + 4 enums.** Todos os models de negócio carregam `tenantId`; as 3 exceções estão marcadas abaixo.

---

## Entidades

### Plano de controle (novo neste sistema — não existe no `academia-sandro`)

| Entidade | Tabela | Escopo | Papel |
|---|---|---|---|
| `Tenant` | `tenants` | — (é a raiz) | Cada academia cliente contratada no whitelabel |
| `SuperAdmin` | `super_admins` | **global** | Conta de onboarding — nunca pertence a um tenant |
| `ErrorLog` | `error_logs` | `tenantId?` | Erro técnico capturado; tenant é opcional (o erro pode ocorrer antes da sessão existir) |

### Domínio de academia (herdado do `academia-sandro`, agora com `tenantId`)

| Entidade | Tabela | Papel |
|---|---|---|
| `Usuario` | `usuarios` | Login de ADMIN ou ALUNO; opcionalmente ligado a um `Aluno` |
| `Aluno` | `alunos` | Aluno da academia — modalidade principal, faixa, vencimento, dados pessoais |
| `AgendaAula` | `agenda_aulas` | Horário recorrente: modalidade × dia da semana × hora, com capacidade |
| `Matricula` | `matriculas` | Matrícula do aluno num horário de modalidade **extra** |
| `AlunoFaixaModalidade` | `aluno_faixas_modalidade` | Faixa/graduação numa modalidade extra |
| `PresencaDiaria` | `presencas_diarias` | Presença por aluno × horário × data |
| `TransacaoFinanceira` | `transacoes_financeiras` | Receita/despesa; opcionalmente ligada a aluno e a matrícula |
| `Despesa` | `despesas` | Despesa da academia, com marcação de recorrência |
| `ModalidadePreco` | `modalidade_precos` | Preço da modalidade extra, por tenant |
| `Pacote` | `pacotes` | Agrupamento de desconto: FAMILIA ou COMBO_MODALIDADES |
| `PacoteMembro` | `pacote_membros` | Vínculo aluno ↔ pacote, com o percentual dele |
| `PreCadastro` | `pre_cadastros` | Lead da pré-matrícula pública |
| `ConfiguracaoAgenda` | `configuracao_agenda` | Janela de almoço — **uma linha por tenant** |
| `BloqueioAgenda` | `bloqueios_agenda` | Cancelamento pontual de aulas num intervalo |

### Enums

- `DiaSemana`: SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA, SABADO, DOMINGO
- `StatusPresenca`: AGENDADO, CONFIRMADO, CANCELADO, FALTA_SEM_AVISO
- `TipoPacote`: FAMILIA, COMBO_MODALIDADES
- `Role`: ADMIN, ALUNO

---

## Atributos por entidade — o que importa entender

### Tenant

`id`, `slug` (`@unique`), `nome`, `ativo` (default `true`), `features` (`Json`, default `{}`), `branding` (`Json?`), `createdAt`.

- `slug` é a chave pública: aparece em `/matricule-se/{slug}` e `/cadastro-aluno/{slug}`
- `ativo = false` derruba o login de todos os usuários do tenant e faz o slug público devolver 404 — **sem apagar nada**
- `features`: JSON livre. As chaves reconhecidas pelo formulário de onboarding são `portalAluno`, `preCadastroPublico`, `pacotesFamilia`, `whatsappGateway`. Sempre mescladas com as core (`alunos`, `agenda`, `financeiro`), que vencem
- `branding`: JSON tipado só no TypeScript (`TenantBranding`) — `slogan?`, `logoUrl?`, `corPrimaria?`, `corFundo?`. Sem validação no banco

### SuperAdmin

`id`, `nome`, `email` (`@unique`), `senhaHash`, `createdAt`. **Sem `tenantId` de propósito.** Bootstrapado pelo seed a partir de `SUPERADMIN_EMAIL`/`SUPERADMIN_SENHA`.

### ErrorLog

`id`, `tenantId?` (FK `onDelete: SetNull`), `rota` (ex.: `"POST /alunos"`), `status`, `mensagem`, `stack?`, `usuario?` (username em texto, não FK), `createdAt`. Índices: `[tenantId, createdAt]` e `[createdAt]`.

- `tenantId` é opcional porque o erro pode acontecer antes da sessão/tenant serem resolvidos
- `usuario` é snapshot textual — sobrevive à exclusão do usuário

### Usuario

`id`, `username` (`@unique` **global**), `email` (`@unique` **global**), `nome?`, `telefone?`, `pix?`, `passwordHash`, `role` (default `ALUNO`), `senhaTemporaria` (default `false`), `tokenRecuperacao?`, `tokenExpiracao?`, `alertasLidosEm?`, `alunoId?` (`@unique`), `tenantId`.

- A unicidade global é decisão deliberada, comentada no schema: o tenant é resolvido a partir de qual `Usuario` bate no login, sem slug na URL. Preço: duas academias não podem ambas ter um `admin`
- `telefone` do ADMIN é o destino do aviso automático de aula experimental
- `alertasLidosEm` é o marco temporal do sino de notificações

### Aluno

`nome`, `modalidade`, `graduacaoFaixa`, `dataMatricula` (default now), `dataVencimento?`, `statusPagamento`, `aptoExame`, `telefone?`, `email?`, `dataNascimento?`, `cidade?`, `lesoes?`, `mensalidadeValor?` (`Decimal(10,2)`), `agendaAulaReferenciaId?`.

- `modalidade` é string livre no banco — na prática restrita ao array `MODALIDADES` do código
- `mensalidadeValor` `null` = usa o preço da modalidade; preenchido = override individual daquele aluno
- `agendaAulaReferencia` é **só organização/exibição**: não restringe acesso, porque a modalidade principal já dá acesso a todos os horários dela
- `email` do aluno **não** é `@unique` (o `email` do `Usuario` é)

### AgendaAula

`diaSemana` (enum), `horarioInicio` (`@db.Time`), `horarioFim?` (`@db.Time`), `modalidade`, `capacidadeMax` (default 10), `createdAt`.

- Horas são `Time` puro, formatadas com `timeZone: "UTC"` para não deslocar o horário exibido

### Matricula

`criadoEm`, `dataVencimentoBase` (default now), `alunoId`, `agendaAulaId`, `tenantId`. `@@unique([tenantId, alunoId, agendaAulaId])`.

- `dataVencimentoBase` é a âncora do ciclo de 12 parcelas **daquela** modalidade extra — o equivalente de `Aluno.dataMatricula` para a mensalidade principal, e editável pelo admin de forma independente
- Uma `Matricula` gera **uma transação por mês** ao longo do ciclo, não uma única no ato

### AlunoFaixaModalidade

`modalidade`, `graduacaoFaixa`, `alunoId` (`onDelete: Cascade`), `tenantId`. `@@unique([tenantId, alunoId, modalidade])`.

- Uma linha **por modalidade extra**, não por horário — o aluno pode ter dois horários da mesma modalidade extra e a faixa é uma só

### PresencaDiaria

`data` (`@db.Date`), `status` (enum, default `AGENDADO`), `observacao?`, `createdAt`, `updatedAt`, `alunoId`, `agendaAulaId`, `tenantId`. `@@unique([tenantId, alunoId, agendaAulaId, data])`.

> **Entidade inerte.** A tabela existe e está migrada, mas **nenhuma page ou Server Action do repositório lê ou escreve nela**. Herdada do `academia-sandro`. Não confundir "existe no schema" com "existe no produto".

### TransacaoFinanceira

`tipo`, `categoria`, `valor` (`Decimal(10,2)`), `dataTransacao` (default now), `dataVencimento?`, `formaPagamento?`, `comprovanteUrl?`, `comprovanteEnviadoEm?`, `gatewayPagamentoId?`, `confirmadoEm?`, `alunoId?`, `matriculaId?`, `tenantId`.

- `tipo` e `categoria` são strings livres. `tipo = "Receita"` é o valor consultado por `getParcelasCiclo`
- `matriculaId` é o discriminador do ciclo: `null` = mensalidade principal, preenchido = ciclo daquela modalidade extra
- `gatewayPagamentoId` **nunca é escrito** por nenhum código do repositório — campo preparado para integração de pagamento que não existe
- `confirmadoEm` é o único critério de "pago"; comprovante anexado **não** marca pago

### Despesa

`categoria`, `descricao`, `valor` (`Decimal(10,2)`), `data`, `recorrente` (default false), `frequenciaRecorrencia?`, `grupoRecorrenciaId?`, `createdAt`, `tenantId`.

- Os três campos de recorrência existem, mas **não há job/cron no repositório que gere a próxima ocorrência** — recorrência é marcação, não automação

### ModalidadePreco

`modalidade`, `valor` (`Decimal(10,2)`, default 0), `atualizadoEm` (`@updatedAt`), `tenantId`. `@@unique([tenantId, modalidade])`.

### Pacote / PacoteMembro

`Pacote`: `nome`, `tipo` (enum), `criadoEm`, `descontoPadrao?` (`Decimal(5,2)`), `tenantId`.
`PacoteMembro`: `descontoPercentual` (`Decimal(5,2)`, default 0), `titular` (default false), `pacoteId` (Cascade), `alunoId` (`@unique`, Cascade), `tenantId`.

- `alunoId` é `@unique`: **um aluno pertence a no máximo um pacote**
- `descontoPadrao` só é usado por combo criado como **catálogo** (sem membros ainda), para o aluno escolher sozinho no autocadastro; pacotes FAMILIA nascem com membros e nunca usam esse campo
- `titular` só é relevante para FAMILIA — é quem vê no portal a mensalidade de todos os integrantes

### PreCadastro

`nome`, `idade?`, `dataNascimento?`, `telefone`, `email?`, `cidade?`, `lesoes?`, `modalidadeInteresse?`, `status` (default `"Pendente"`), `criadoEm`, `dataAulaExperimental?` (`@db.Date`), `termosAceitos` (default false), `termosAceitosEm?`, `tenantId`.

- `dataAulaExperimental` preenchido dispara WhatsApp automático ao admin do tenant
- `termosAceitos`/`termosAceitosEm` são o registro de consentimento LGPD com carimbo de tempo

### ConfiguracaoAgenda

`tenantId` **é a própria PK**, `almocoInicio?` (`@db.Time`), `almocoFim?` (`@db.Time`), `atualizadoEm`.

- Substituiu o antigo `@id @default("singleton")` da época single-tenant — comentado no schema

### BloqueioAgenda

`data` (`@db.Date`), `horaInicio` (`@db.Time`), `horaFim` (`@db.Time`), `motivo?`, `createdAt`, `tenantId`.

---

## Relacionamentos

```
Tenant 1─┬─N Usuario ──0..1── Aluno            (Usuario.alunoId é @unique)
         ├─N Aluno ──┬─N TransacaoFinanceira
         │           ├─N PresencaDiaria
         │           ├─N Matricula
         │           ├─N AlunoFaixaModalidade   (Cascade)
         │           └─0..1 PacoteMembro        (Cascade, alunoId @unique)
         ├─N AgendaAula ─┬─N Matricula
         │               ├─N PresencaDiaria
         │               └─N Aluno              (agendaAulaReferencia, opcional)
         ├─N Matricula ──N TransacaoFinanceira  (1 transação por mês do ciclo)
         ├─N Despesa
         ├─N ModalidadePreco
         ├─N Pacote ──N PacoteMembro            (Cascade)
         ├─N PreCadastro
         ├─N BloqueioAgenda
         ├─N ErrorLog                           (tenantId opcional, SetNull)
         └─0..1 ConfiguracaoAgenda              (tenantId é a PK)

SuperAdmin — sem relação com Tenant (global, por definição)
```

**`onDelete` explícito só em 4 pontos:** `AlunoFaixaModalidade.aluno` (Cascade), `PacoteMembro.pacote` (Cascade), `PacoteMembro.aluno` (Cascade) e `ErrorLog.tenant` (SetNull). Todo o resto usa o default do Prisma (`Restrict`) — na prática, **excluir um `Tenant` pelo banco falha** enquanto houver qualquer registro filho. Não há rota de exclusão de tenant no produto (só ativar/desativar), então isso é coerente com o comportamento pretendido.

---

## Estados e ciclo de vida

### Tenant

```
criado (ativo=true)  ──desativar──▶  inativo   ──reativar──▶  ativo
                                       │
                                       └─ login recusado no authorize()
                                          slug público devolve 404
                                          dado permanece intacto
```

### Parcela (derivada, não persistida)

```
                       ┌── mês futuro, sem transação ──▶  A vencer
data-base + i meses ───┤
                       └── mês passado, sem transação ──▶  Não paga

transação existe ──▶ Pendente
   └─ + comprovanteUrl ──▶ Aguardando confirmação
        └─ + confirmadoEm ──▶ Paga
```

Nunca há regressão automática: comprovante anexado não vira "Paga" sozinho — só a confirmação manual do admin (`confirmadoEm`) fecha a parcela.

### Comprovante

```
aluno anexa ──▶ arquivo em public/comprovantes/{uuid}-{timestamp}.{ext}
                comprovanteUrl + comprovanteEnviadoEm preenchidos
      │
      └─ 10 dias ──▶ limparComprovantesExpirados()
                     unlink do arquivo (falha ignorada)
                     comprovanteUrl = null, comprovanteEnviadoEm = null
                     (a transação em si nunca é apagada)
```

Disparo: preguiçoso (ao abrir telas que exibem comprovante) ou por `GET /api/cron/limpar-comprovantes`.

### Acesso do aluno ao portal

```
Aluno sem Usuario
   └─ admin cria acesso ──▶ Usuario ALUNO com senha aleatória de 24 bytes
                            senhaTemporaria=true + link de definição de senha
        ├─ reenviar ──▶ novo link
        ├─ aluno define senha ──▶ senhaTemporaria=false
        └─ revogar ──▶ Usuario removido, Aluno permanece
```

### Status de pagamento do aluno

`Aluno.statusPagamento` é **campo manual que não se atualiza sozinho**. O código registra que isso já causou tela mostrando "Em dia" para aluno com vencimento no passado. Por isso toda exibição passa por `statusPagamentoEfetivo()`:

```
dataVencimento != null && diasParaVencer(dataVencimento) < 0  ⇒  "Atrasado"
senão                                                          ⇒  statusPagamento (campo bruto)
```

---

## Padrão de IDs

- Todos `String @id @default(uuid()) @db.Uuid` — gerados pela aplicação, não pelo banco
- Exceção: `ConfiguracaoAgenda`, cuja PK é o `tenantId` (também UUID)
- Sem sequência/serial em lugar nenhum

---

## Regras de cálculo

### Ciclo de parcelas (`src/lib/parcelas.ts`)

```
TOTAL_MESES = 12
mesRef(i) = new Date(dataBase.getFullYear(), dataBase.getMonth() + i, 1)   i ∈ [0,11]
```

- Janela **fixa** ancorada na data-base, não "próximos 12 meses a partir de hoje"
- Casamento transação ↔ parcela por **(ano, mês)** de `dataTransacao`, nunca por dia
- Filtro: `tipo = "Receita"` **e** `matriculaId` exatamente igual ao do ciclo (inclusive `null`)

### Vencimento (`src/lib/vencimento.ts`)

```
calcularVencimento(dataBase) = dataBase + 30 dias
diasParaVencer(v) = round((v@00:00 − hoje@00:00) / 1 dia)   ← ambos com hora zerada
```

### Preço efetivo do aluno (`src/lib/precos.ts`)

```
base   = Aluno.mensalidadeValor ?? ModalidadePreco[modalidade principal] ?? 0
extras = Σ ModalidadePreco[modalidade de cada Matricula do aluno]
         ← por MATRÍCULA, não por modalidade distinta:
           2 horários da mesma modalidade extra somam 2×

sem pacote            ⇒ total = base + extras
FAMILIA               ⇒ total = base × (1 − d/100) + extras       (desconto só na mensalidade)
COMBO_MODALIDADES     ⇒ total = (base + extras) × (1 − d/100)     (desconto no combinado)
```

### Capacidade de horário (`src/lib/matricula.ts`)

```
ocupação = count(Aluno com modalidade == aula.modalidade)      ← acesso implícito
         + count(Matricula do agendaAulaId)                     ← extras
lotado ⇔ ocupação >= aula.capacidadeMax
```

A contagem de alunos principais é **por modalidade, não por horário** — todo aluno da modalidade conta em todos os horários dela.

### Alertas do sino (`src/lib/alertas.ts`)

```
inadimplente ⇔ diasParaVencer(dataVencimento) < 0
vencendo     ⇔ 0 <= diasParaVencer(dataVencimento) <= 3

"novo" ⇔ gatilho > Usuario.alertasLidosEm  (ou alertasLidosEm nulo)
   gatilho de pré-cadastro/matrícula = criadoEm
   gatilho de inadimplência          = vencimento @00:00
   gatilho de vencendo               = vencimento @00:00 − 3 dias
```

A hora zerada é intencional: sem isso, um vencimento com horário tardio ficava "novo" indefinidamente.

### Almoço e grade (`src/lib/configuracao-agenda.ts`, `agenda-constants.ts`)

- `caiNoAlmoco()` compara horas contra `ConfiguracaoAgenda.almocoInicio/almocoFim` do tenant
- `DIAS_GRADE` exibe segunda a sábado; domingo existe no enum mas não aparece na grade

---

## Lacunas do modelo (campos e tabelas sem uso real)

| Item | Situação |
|---|---|
| `PresencaDiaria` (model inteiro) | Migrado, sem nenhuma leitura ou escrita no repositório |
| `TransacaoFinanceira.gatewayPagamentoId` | Nunca escrito — não há integração de pagamento |
| `Despesa.recorrente` / `frequenciaRecorrencia` / `grupoRecorrenciaId` | Marcação apenas; sem job que gere a ocorrência seguinte |
| `Aluno.aptoExame` | Campo existe; sem regra de negócio que o consuma |
| `Tenant.features.portalAluno` / `pacotesFamilia` / `whatsappGateway` | Gravadas no onboarding, **nunca lidas** pelo código |
| `Usuario.pix` | Preenchível no perfil; não participa de nenhum cálculo |

Nenhuma dessas é bug — são heranças do `academia-sandro` e superfícies preparadas. Estão listadas para que ninguém as documente como funcionalidade existente.

---

## Links relacionados

[[arquitetura-kernel-academia]] — camadas, multi-tenancy e fluxos que operam sobre estas entidades
[[prd-kernel-academia]] — problema e escopo que este modelo sustenta
[[indice-kernel-academia]] — mapa completo dos artefatos do sistema
