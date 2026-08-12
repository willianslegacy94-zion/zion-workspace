---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-08-12
owner: willians
---

# Modelo de Dados — Academia Prof. Sandro

> Referência: [[prd-academiasandro]] | [[arquitetura-academiasandro]]

---

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| Aluno | Pessoa matriculada na academia, com modalidade, graduação e controle de vencimento de matrícula | Unidade central do cadastro — quem treina, em que nível, e se está em dia com o pagamento |
| TransacaoFinanceira | Lançamento de receita ou despesa da academia, opcionalmente vinculado a um aluno | Controle financeiro básico — o que entrou e o que saiu, com saldo calculado |
| Despesa | Gasto operacional categorizado (aluguel, salário, equipamento etc.), com suporte a recorrência | Tela dedicada de despesas, separada de `TransacaoFinanceira` — inspirada no `RegistroGasto` do sistema-thieco |
| PreCadastro | Fila de auto-cadastro feito pelo próprio interessado via link público (`/matricule-se`) | Antes de virar `Aluno` de verdade, passa por aprovação manual do Sandro |
| Usuario | Conta de acesso ao sistema — Sandro (ADMIN) ou aluno (ALUNO), vinculável a um `Aluno` | Autenticação via NextAuth v5, login por `username` (não e-mail); desde 2026-07-23 suporta múltiplos papéis via `role` |
| AgendaAula | Um slot fixo e recorrente na grade semanal (dia + horário + modalidade + capacidade) | Base da Agenda — usada tanto na tela do Sandro (`/agenda`) quanto na Área do Aluno (`/aluno`), via componente compartilhado `AgendaGrid`. Desde 2026-07-30, CRUD completo em Configurações → Agenda (antes só via script de seed) |
| PresencaDiaria | Registro de presença de um aluno numa `AgendaAula` numa data específica | Rastreia quem efetivamente esteve/vai estar em cada aula — nenhum fluxo cria esses registros ainda (não usada no cálculo de vagas desde 2026-07-29 — ver `Matricula`); ainda não há UI de check-in ou lista de presença |
| Matricula (2026-07-29; ciclo próprio 2026-08-03) | Vínculo de um aluno a uma `AgendaAula` de modalidade **extra** (além da principal) | A modalidade principal (`Aluno.modalidade`) já dá acesso implícito a todos os horários dela — `Matricula` só existe pra registrar (e cobrar) inscrição numa modalidade adicional. Desde 2026-08-03, cada `Matricula` tem seu próprio ciclo de 12 parcelas mensais (`dataVencimentoBase`), igual a mensalidade principal |
| ModalidadePreco (2026-07-29) | Preço cobrado do aluno ao se matricular numa modalidade extra | Configurável pelo admin em Configurações → Agenda (2026-07-30; antes em `/agenda`); usado pra gerar a `TransacaoFinanceira` no momento da matrícula |
| ConfiguracaoAgenda (2026-07-30) | Linha singleton com o horário de almoço da academia | Único pra toda a academia (não varia por modalidade/dia) — bloqueia criação de `AgendaAula` dentro do intervalo |
| BloqueioAgenda (2026-07-30) | Bloqueio pontual da agenda numa data específica (compromisso do Sandro) | Aviso pro aluno de que não vai ter aula naquele dia — não cancela `Matricula`/`PresencaDiaria` automaticamente (o sistema não tem conceito de "aula do dia X", só grade semanal recorrente) |
| Pacote (2026-07-31; catálogo Combo 2026-08-03; valor fixo 2026-08-12) | Agrupamento de alunos com desconto — tipo `FAMILIA` (vários alunos) ou `COMBO_MODALIDADES` (1 aluno com 2+ modalidades) | Autonomia total do admin pra criar quantos pacotes quiser, com % de desconto configurável por integrante **ou**, desde 2026-08-12 (só `COMBO_MODALIDADES`), um valor fixo em R$ que substitui o cálculo por desconto. Desde 2026-08-03, `COMBO_MODALIDADES` pode nascer sem nenhum `PacoteMembro` ainda (`descontoPadrao`) — vira um "modelo" de catálogo que o próprio aluno escolhe no autocadastro/matrícula; `FAMILIA` continua sempre montado pelo admin com os membros já definidos |
| PacoteMembro (2026-07-31) | Vínculo de um `Aluno` a um `Pacote`, com seu próprio % de desconto e flag `titular` | Um aluno só pode estar em 1 pacote por vez (`alunoId` `@unique`); em pacote `FAMILIA`, o `titular` é quem tem login no portal e vê a mensalidade de todos os integrantes |
| AlunoFaixaModalidade (2026-08-03) | Faixa/graduação do aluno numa modalidade **extra** (além da principal) | `Aluno.graduacaoFaixa` só guarda a faixa da modalidade principal; um aluno com `Matricula` em modalidade(s) extra(s) pode ter faixa diferente em cada uma — capturado hoje só no autocadastro (`/cadastro-aluno`) |

---

## Atributos por entidade

### Aluno

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único gerado automaticamente |
| nome | String | sim | não | nome do aluno |
| modalidade | String | sim | não | modalidade praticada (ex: Jiu-Jitsu, Muay Thai, Judô, Boxe) — texto livre no schema, restrito a um `<select>` fixo na UI |
| graduacaoFaixa | String | sim | não | faixa/graduação atual (ex: "Faixa Azul") |
| dataMatricula | DateTime | sim | sim | data de matrícula — default `now()` na criação |
| dataVencimento | DateTime? | não | sim | vencimento da mensalidade — calculado como `dataMatricula + 30 dias` na criação, e recalculado (`data do pagamento + 30 dias`) toda vez que uma `TransacaoFinanceira` de tipo "Receita" é registrada vinculada a este aluno (ver `src/lib/vencimento.ts`) |
| statusPagamento | String | sim | não | "Em dia" / "Pendente" / "Atrasado" — texto livre no schema, restrito a um `<select>` fixo na UI |
| aptoExame | Boolean | sim | não | se true, aluno está apto para o próximo exame de graduação — default `false` |
| telefone | String? | não | não | telefone/WhatsApp do aluno — usado para gerar o link de cobrança `wa.me` |
| email | String? | não | não | e-mail de contato |
| dataNascimento | DateTime? | não | não | usada para calcular idade/faixa etária no dashboard |
| cidade | String? | não | não | cidade do aluno |
| lesoes | String? | não | não | observação livre sobre lesões/restrições — campo de texto, sem estrutura |
| agendaAulaReferenciaId | String (uuid)? | não | não | (2026-07-29) FK → `AgendaAula` — horário informado no cadastro, **só exibição/organização**, não restringe acesso (a modalidade já dá acesso a todos os horários dela) |
| mensalidadeValor | Decimal(10,2)? | não | não | (2026-07-31) override do preço padrão da modalidade pra este aluno específico — `null` = usa `ModalidadePreco[modalidade]`. Existe pra cobrir caso de 2 alunos da mesma modalidade pagando valores diferentes (ex: por quantidade de aulas na semana), sem precisar de um pacote pra isso |
| ultimoAvisoCobrancaEm | DateTime? | não | sim | (2026-08-12) data do último aviso automático de cobrança (vencendo/atrasado) mandado por WhatsApp via cron — só atualizado quando o envio teve sucesso; controla duplicidade (no máx. 1 aviso/dia), não dispara nada por si só (ver `src/lib/cobranca.ts`) |
| ultimoParabensEm | DateTime? | não | sim | (2026-08-12) data do último parabéns de aniversário automático mandado por WhatsApp via cron — mesmo padrão do campo acima (`src/lib/aniversario.ts`) |

> `modalidade` desde 2026-07-29: `Musculação/Personal`, `Capoeira`, `Boxe/Muay Thai`, `Kids`, `Aula para Idosos` (`src/lib/modalidades.ts`) — substituiu o placeholder genérico inicial (`Jiu-Jitsu`, `Muay Thai`, `Judô`, `Boxe`, `Outra`), sem relação real com o que a academia ensina.

### TransacaoFinanceira

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| tipo | String | sim | não | "Receita" / "Despesa" — texto livre no schema, restrito a um `<select>` fixo na UI |
| categoria | String | sim | não | agrupamento livre (ex: Mensalidade, Exame de Graduação, Aluguel) |
| valor | Decimal(10,2) | sim | não | valor da transação — **`Decimal`, nunca `Float`**, para evitar erro de arredondamento com dinheiro |
| dataTransacao | DateTime | sim | sim | data da transação — default `now()` na criação |
| dataVencimento | DateTime? | não | não | (2026-07-29) prazo pra pagar essa cobrança específica — editável pelo admin em `/transacoes/[id]/editar`; setada automaticamente (hoje) na criação de cobrança de matrícula extra |
| formaPagamento | String? | não | não | (2026-07-29) "PIX" / "Dinheiro" / "Cartão" — texto livre, escolhido pelo aluno no modal de matrícula extra ou preenchido manualmente pelo admin |
| comprovanteUrl | String? | não | não | caminho do arquivo em `public/comprovantes/` — `null` até o aluno anexar, e volta a `null` quando o arquivo expira (10 dias, ver `Matricula`/ciclo de retenção) |
| comprovanteEnviadoEm | DateTime? | não | sim | (2026-07-29) timestamp do upload — base pro cálculo dos 10 dias de retenção, **não** é o mesmo que `dataTransacao` |
| confirmadoEm | DateTime? | não | sim | (2026-07-29) preenchido quando o admin clica "Confirmar pagamento" — `null` enquanto aguarda revisão. Confirmar uma Receita vinculada a aluno também atualiza `Aluno.statusPagamento` para "Em dia" |
| gatewayPagamentoId | String? | não | não | reservado pra uma integração de gateway de pagamento real — nunca usado (não há gateway implementado) |
| alunoId | String (uuid)? | não | não | FK → Aluno — opcional; transação pode não estar vinculada a nenhum aluno |
| matriculaId | String (uuid)? | não | não | (2026-07-29; deixou de ser `@unique` em 2026-08-03) FK → `Matricula` — presente só quando a cobrança nasceu de uma matrícula extra; `null` pra mensalidade normal ou despesa. Desde 2026-08-03 uma `Matricula` pode ter **várias** `TransacaoFinanceira` (1 por mês do ciclo próprio dela), não mais no máximo 1 |

> Uma transação "Receita" vinculada a um aluno dispara o recálculo de `Aluno.dataVencimento` (ver acima) — é o mecanismo que "renova" a mensalidade a cada pagamento.
> **Parcelas de 12 meses** (2026-08-03: `getParcelasCiclo({alunoId, matriculaId, dataBase})`, generalização de `getParcelas`, `src/lib/parcelas.ts`): mesmo algoritmo de janela fixa de 12 meses reaproveitado pra mensalidade principal (`matriculaId: null`, `dataBase = Aluno.dataMatricula`) e pra cada modalidade extra (`matriculaId` específico, `dataBase = Matricula.dataVencimentoBase`) — `/aluno/financeiro` renderiza um card com tabela de parcelas por modalidade, não mais uma seção "Outras cobranças" com lista plana de transações avulsas.

### Despesa

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| categoria | String | sim | não | Aluguel, Salário, Equipamento, Marketing, Manutenção, Utilidades, Impostos, Outros (`<select>` fixo na UI) |
| descricao | String | sim | não | texto livre |
| valor | Decimal(10,2) | sim | não | mesmo motivo do `TransacaoFinanceira.valor` — nunca `Float` |
| data | DateTime | sim | não | data da despesa (ou da ocorrência gerada, se recorrente) |
| recorrente | Boolean | sim | não | default `false` |
| frequenciaRecorrencia | String? | não | não | "Semanal" / "Mensal" / "Anual" — só preenchido se `recorrente = true` |
| grupoRecorrenciaId | String (uuid)? | não | sim | mesmo valor para todas as ocorrências geradas de uma mesma recorrência (não é FK — só agrupamento lógico) |
| createdAt | DateTime | sim | sim | default `now()` |

> Ao marcar "recorrente" com uma frequência, `createDespesa` gera a ocorrência atual **+ 11 futuras** (12 no total) de uma vez, mesmo padrão do `RegistroGasto.jsx` do sistema-thieco. Editar uma ocorrência (`updateDespesa`) altera só aquele registro, não o grupo inteiro.

### PreCadastro

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| nome | String | sim | não | — |
| idade | Int? | não | não | capturado como campo próprio no formulário público (redundante com `dataNascimento`, mas pedido explicitamente) |
| dataNascimento | DateTime? | não | não | — |
| telefone | String | sim | não | único campo realmente obrigatório além do nome — necessário pro Sandro entrar em contato |
| email | String? | não | não | — |
| cidade | String? | não | não | — |
| lesoes | String? | não | não | — |
| modalidadeInteresse | String? | não | não | (2026-07-29) modalidade que a pessoa quer praticar, escolhida no formulário público — pré-preenche a modalidade no formulário de novo aluno quando o pré-cadastro é aprovado |
| status | String | sim | não | "Pendente" (default) / "Aprovado" / "Rejeitado" |
| criadoEm | DateTime | sim | sim | default `now()` |
| dataAulaExperimental | DateTime? (`@db.Date`) | não | não | (2026-08-03) data escolhida pela pessoa pra conhecer o CT — se preenchida, dispara aviso automático via WhatsApp pro admin (ver `src/lib/whatsapp-gateway.ts`) assim que o formulário é enviado, com links de confirmar/recusar desde 2026-08-12 (ver campos abaixo) |
| termosAceitos | Boolean | sim | não | (2026-08-03) default `false` — consentimento LGPD, checkbox obrigatório no formulário público. Desde 2026-08-12, o texto associado (`TermosAceite.tsx`, não é campo de banco) também cobre responsabilidade por lesão/condição de saúde não informada |
| termosAceitosEm | DateTime? | não | sim | (2026-08-03) timestamp de quando o checkbox foi marcado — `null` só é possível em registros criados antes desta data |
| aulaConfirmada | Boolean? | não | sim | (2026-08-12) `null` = admin ainda não respondeu ao aviso de aula experimental; `true`/`false` = confirmou ou recusou clicando num dos 2 links mandados no WhatsApp (`api/aula-experimental/[id]/confirmar`). Dispara aviso automático de volta pro lead com a decisão, uma única vez — clique duplicado (mesmo link ou o oposto) não regrava nem reenvia |
| aulaConfirmadaEm | DateTime? | não | sim | (2026-08-12) timestamp da primeira resposta do admin — `null` enquanto `aulaConfirmada` for `null` |

> Fluxo: pessoa preenche `/matricule-se` (público, sem login) → cria `PreCadastro` com `status="Pendente"` → aparece em `/pre-cadastros` (autenticado) → Sandro abre a ficha completa (`/pre-cadastros/[id]`, nova rota 2026-08-03) → clica "Aprovar" (linka pra `/alunos/novo?preCadastroId=...` desde 2026-07-29, que pré-preenche o form de novo aluno) ou "Rejeitar" (`status="Rejeitado"`, registro fica só como histórico). Aprovar de fato só acontece quando `createAluno` roda e recebe o `preCadastroId` — nesse momento o `PreCadastro` vira `status="Aprovado"` **e** ganha acesso ao portal automaticamente (2026-08-12: mesmo sem `email` preenchido, já que só `telefone` é garantido nesse formulário — usa e-mail placeholder `${username}@sistema.local` só pra satisfazer o `@unique` de `Usuario.email`). Nunca vira `Aluno` automaticamente. `status` (aprovação) e `aulaConfirmada` (confirmação da aula experimental) são independentes — dá pra confirmar/recusar a aula sem aprovar o cadastro, e vice-versa; não há transição automática entre os dois.

### Usuario

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único — exposto em `session.user.id` desde 2026-07-29 (necessário pra saber qual `Usuario` atualizar ao marcar alertas como lidos) |
| username | String | sim | não | único — usado pro login (não é e-mail) |
| email | String | sim | não | único — usado só pelo fluxo de recuperação de senha (`/esqueci-senha`), não pro login |
| nome | String? | não | não | (2026-07-29) nome de exibição — usado no "Bem-vindo, {nome}" da sidebar/dashboard admin; `null` pra contas de aluno (a Área do Aluno mostra `Aluno.nome`, não este campo) |
| telefone | String? | não | não | (2026-07-30) telefone de contato do admin — editável em Configurações → Perfil; não existe equivalente pro aluno aqui (ver `Aluno.telefone`, entidade separada) |
| pix | String? | não | não | (2026-07-30) chave PIX do admin — editável em Configurações → Perfil, mostrada ao aluno em `/aluno/financeiro`. Substitui a antiga env var `PIX_KEY_CT`; a busca pro aluno é sempre pelo `username` de `ADMIN_USERNAME` (não "qualquer `role=ADMIN`"), pra não pegar o PIX de `devmaster` por engano |
| passwordHash | String | sim | sim | bcrypt, custo 12 |
| role | Role (enum) | sim | não | `ADMIN` ou `ALUNO`, default `ALUNO`. **Checagem de acesso implementada em 2026-07-28** (ver `arquitetura-academiasandro`, seção 5) — antes disso o campo só existia no schema sem nenhuma rota checar |
| alertasLidosEm | DateTime? | não | sim | (2026-07-29) timestamp da última vez que este admin clicou "Marcar como lida" no sino de notificações — usado por `src/lib/alertas.ts` pra decidir quais itens são "novos" |
| senhaTemporaria | Boolean | sim | não | default `false` — fica `true` quando o usuário é criado via seed com senha padrão |
| tokenRecuperacao | String? | não | sim | token opaco (`crypto.randomBytes(32).toString('hex')`), gerado em `/api/auth/esqueci-senha` |
| tokenExpiracao | DateTime? | não | sim | expira 1h após gerado; token é zerado (`null`) após uso — single-use |
| createdAt | DateTime | sim | sim | default `now()` |
| alunoId | String (uuid)? | não | não | FK → Aluno, `@unique` (2026-07-23) — vincula esta conta a um cadastro de `Aluno`; opcional porque a conta do Sandro (ADMIN) não tem `Aluno` correspondente |

> **Enum `Role`:** `ADMIN` | `ALUNO`. Criado junto com `AgendaAula`/`PresencaDiaria` (2026-07-22), **checagem de acesso implementada em 2026-07-28**: `/alunos`, `/transacoes`, `/despesas`, `/pre-cadastros`, `/agenda`, `/matriculas`, `/configuracoes` (2026-07-30) exigem `role=ADMIN`; `/aluno` exige `role=ALUNO`. Sessão com `role` incompatível é redirecionada (não recebe erro) pro grupo de rota correto.

> **Contas fixas de suporte (2026-07-30):** `devaluno` (`role=ALUNO`, vinculado ao `Aluno` "Aluno Teste (Dev)") e `devmaster` (`role=ADMIN`, sem `Aluno` vinculado) — senha sempre `dev1807194`, garantida por `prisma/seed.ts` (`garantirContasFixas`) a cada `npm run db:seed`, mesmo num banco recriado do zero. Únicas duas linhas de `Usuario` com proteção de exclusão em código (`src/lib/contas-fixas.ts`, checado em `deleteAluno`/`revogarAcessoAluno`).

### AgendaAula

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| diaSemana | DiaSemana (enum) | sim | não | `SEGUNDA`\|`TERCA`\|`QUARTA`\|`QUINTA`\|`SEXTA`\|`SABADO`\|`DOMINGO` |
| horarioInicio | DateTime (`@db.Time`) | sim | não | hora de início — Prisma normaliza `@db.Time` como `Date` na data fixa `1970-01-01`, sempre em UTC pra evitar deslocamento de fuso |
| horarioFim | DateTime? (`@db.Time`) | não | não | hora de término — hoje não preenchida em nenhum registro real (a grade seedada só usa `horarioInicio`) |
| modalidade | String | sim | não | texto livre — desde 2026-07-29, uma das 5 modalidades unificadas (ver `Aluno.modalidade`); as variações antigas `"Muay Thai - Idosos"`/`"Muay Thai - Kids"` foram removidas e reseedadas como `"Aula para Idosos"`/`"Kids"` |
| capacidadeMax | Int | sim | não | default `10` |
| createdAt | DateTime | sim | sim | default `now()` |

> Reseedada em 2026-07-29 a partir do quadro físico real da academia (`prisma/seed-agenda.ts`) — as 63 linhas anteriores (ditadas por mensagem em 2026-07-23, com suposições não confirmadas) foram removidas; 80 linhas novas inseridas, batendo exatamente com a foto do quadro. **Desde 2026-07-30, também editável via UI** (Configurações → Agenda) — criar valida contra `ConfiguracaoAgenda` (não pode cair no horário de almoço); excluir é bloqueado (`P2003`) se houver `Matricula`/`PresencaDiaria` vinculada.

### PresencaDiaria

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| data | DateTime (`@db.Date`) | sim | não | data específica da presença |
| status | StatusPresenca (enum) | sim | não | `AGENDADO` (default) \| `CONFIRMADO` \| `CANCELADO` \| `FALTA_SEM_AVISO` — nenhuma UI hoje transiciona esse status; **não é mais usado no cálculo de vagas** (ver `Matricula`, 2026-07-29) |
| observacao | String? | não | não | texto livre |
| createdAt | DateTime | sim | sim | default `now()` |
| updatedAt | DateTime | sim | sim | `@updatedAt` |
| alunoId | String (uuid) | sim | não | FK → Aluno |
| agendaAulaId | String (uuid) | sim | não | FK → AgendaAula |

> `@@unique([alunoId, agendaAulaId, data])` — um aluno não pode ter duas presenças pro mesmo slot na mesma data. Segue sem nenhum fluxo que crie esses registros.

### Matricula (2026-07-29; ciclo próprio 2026-08-03)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| criadoEm | DateTime | sim | sim | default `now()` — usado como instante de gatilho no sino de alertas ("Novas matrículas") |
| dataVencimentoBase | DateTime | sim | sim | (2026-08-03) default `now()` — âncora do ciclo de 12 parcelas mensais dessa modalidade extra, mesmo papel que `Aluno.dataMatricula` tem pra mensalidade principal. Editável pelo admin por matrícula, em `/alunos/[id]/editar` (`atualizarVencimentoMatricula`) |
| alunoId | String (uuid) | sim | não | FK → Aluno |
| agendaAulaId | String (uuid) | sim | não | FK → AgendaAula |

> `@@unique([alunoId, agendaAulaId])` — um aluno não pode se matricular duas vezes no mesmo horário (mas **pode** ter `Matricula` em 2 horários diferentes da mesma modalidade extra — cada uma com seu próprio ciclo de parcelas e cobrança independente, não é limitado por modalidade). Representa só modalidade **extra**: a principal (`Aluno.modalidade`) já dá acesso a todos os horários dela sem precisar de registro aqui. Desde 2026-08-03, cada `Matricula` pode ter **várias** `TransacaoFinanceira` vinculadas (`TransacaoFinanceira.matriculaId`, deixou de ser `@unique`) — uma por mês do ciclo, não mais uma cobrança única no ato da matrícula.

### ModalidadePreco (2026-07-29)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| modalidade | String | sim | não | chave primária — mesmo texto usado em `Aluno.modalidade`/`AgendaAula.modalidade` |
| valor | Decimal(10,2) | sim | não | default `0` — preço cobrado ao matricular nessa modalidade como extra |
| atualizadoEm | DateTime | sim | sim | `@updatedAt` |

> Editável num card em Configurações → Agenda (admin; até 2026-07-30 era em `/agenda`), um campo por modalidade. Enquanto `valor = 0`, a matrícula extra continua funcionando normalmente, só gera cobrança de R$0.

### ConfiguracaoAgenda (2026-07-30)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String | sim | não | fixo `"singleton"` (`@default("singleton")`) — única linha da tabela, mesmo truque de chave fixa usado pra evitar duplicidade sem precisar de lógica extra de "linha única" |
| almocoInicio | DateTime? (`@db.Time`) | não | não | início do horário de almoço |
| almocoFim | DateTime? (`@db.Time`) | não | não | fim do horário de almoço |
| atualizadoEm | DateTime | sim | sim | `@updatedAt` |

> Único horário de almoço pra toda a academia (não varia por modalidade/dia — decisão do usuário). `criarAula` rejeita horário novo dentro do intervalo (`caiNoAlmoco`, comparação só pela parte de hora). Não afeta `AgendaAula` já existentes — só valida na criação.

### BloqueioAgenda (2026-07-30)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| data | DateTime (`@db.Date`) | sim | não | data específica do calendário (não dia da semana — é um bloqueio pontual, não recorrente) |
| horaInicio | DateTime (`@db.Time`) | sim | não | início do período bloqueado |
| horaFim | DateTime (`@db.Time`) | sim | não | fim do período bloqueado |
| motivo | String? | não | não | texto livre opcional (ex: "consulta médica") |
| createdAt | DateTime | sim | sim | default `now()` |

> Registra um compromisso pontual do Sandro. **Limitação estrutural deliberada:** como `AgendaAula`/`Matricula`/`PresencaDiaria` não têm nenhum conceito de "ocorrência numa data específica" (só grade semanal recorrente), um `BloqueioAgenda` não cancela matrícula nem impede check-in — não existe isso pra nenhuma aula, bloqueada ou não. O valor prático é avisar: `getBloqueiosFuturos()` alimenta a gestão em Configurações → Agenda, `getBloqueiosProximos(14)` alimenta um banner em `/aluno` pros próximos 14 dias.

### Pacote (2026-07-31; catálogo Combo 2026-08-03; valor fixo 2026-08-12)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| nome | String | sim | não | nome livre dado pelo admin (ex: "Família Silva", "Combo Boxe+Capoeira — João") |
| tipo | TipoPacote (enum) | sim | não | `FAMILIA` (vários alunos diferentes, cada um com seu % de desconto na própria mensalidade) ou `COMBO_MODALIDADES` (um único aluno praticando 2+ modalidades, desconto sobre o valor total combinado — mensalidade + extras) |
| descontoPadrao | Decimal(5,2)? | não | não | (2026-08-03) só usado por `COMBO_MODALIDADES` criado como catálogo, sem `PacoteMembro` ainda — vira o `descontoPercentual` do `PacoteMembro` criado quando um aluno escolhe esse pacote sozinho (autocadastro/matrícula) ou quando o admin atribui manualmente depois (`atribuirAlunoPacote`). Desde 2026-08-12, o formulário de criação de combo não pede mais desconto (%) — esse campo só é preenchido depois, editando o `PacoteMembro` já vinculado |
| valor | Decimal(10,2)? | não | não | (2026-08-12) só `COMBO_MODALIDADES` — preço fixo opcional do combo. Quando preenchido, `valorEfetivoAluno` (`src/lib/precos.ts`) usa esse valor **direto** como total do aluno, ignorando `descontoPercentual`/`descontoPadrao` por completo (base + extras deixam de entrar na conta). `null` = comportamento antigo, cálculo por desconto percentual |
| criadoEm | DateTime | sim | sim | default `now()` |

> **Enum `TipoPacote`:** `FAMILIA` \| `COMBO_MODALIDADES`. Um `Pacote` é um conceito genérico — não existe restrição de quantidade mínima de integrantes no schema (a UI de criação orienta pra 2+ em `FAMILIA`, mas não bloqueia 1). **Desde 2026-08-03:** `COMBO_MODALIDADES` pode ser criado com **zero** `PacoteMembro` (só `nome` + `descontoPadrao`/`valor`) — vira um "modelo" de catálogo, listado em `getPacotesComboDisponiveis()` (`Pacote` com `membros: { none: {} }`) e oferecido ao próprio aluno no autocadastro (`/cadastro-aluno`, ao adicionar 2ª+ modalidade) ou na matrícula extra. `FAMILIA` nunca entra nesse catálogo — continua sempre criado pelo admin com os membros já definidos, em bloco visual separado na aba Preços. **`valor` e `descontoPadrao`/`descontoPercentual` não são mutuamente exclusivos no schema** (nada impede os dois preenchidos ao mesmo tempo), mas na prática `valorEfetivoAluno` sempre prioriza `valor` quando presente — o desconto percentual fica sem efeito nesse caso, não é somado nem combinado.

### PacoteMembro (2026-07-31)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| descontoPercentual | Decimal(5,2) | sim | não | default `0` — percentual de desconto (0–100), configurado pelo admin por integrante |
| titular | Boolean | sim | não | default `false` — só relevante pra `Pacote.tipo = FAMILIA`: o integrante marcado como titular é quem tem login no portal (`Usuario.alunoId`) e vê a mensalidade de **todos** os integrantes na aba Financeiro dele. Pra `COMBO_MODALIDADES` (sempre 1 integrante só) o valor não muda nada na prática |
| pacoteId | String (uuid) | sim | não | FK → `Pacote`, `onDelete: Cascade` |
| alunoId | String (uuid) | sim | não | FK → `Aluno`, `@unique`, `onDelete: Cascade` — um aluno só pode estar em 1 pacote por vez |

> Regra de negócio implementada em `src/lib/precos.ts` (`valorEfetivoAluno`): a base é `Aluno.mensalidadeValor ?? ModalidadePreco[modalidade]`; se o aluno tem `PacoteMembro`, o desconto é aplicado em cima dela — só na base pra `FAMILIA`, em cima de (base + soma das modalidades extras matriculadas) pra `COMBO_MODALIDADES`. **"1 login por família" não é uma restrição de banco** — nada impede tecnicamente um integrante não-titular de ter `Usuario` próprio; é só convenção reforçada na UI (`/alunos/[id]/editar` mostra aviso, não bloqueia, quando o aluno é integrante não-titular de um pacote família).

### AlunoFaixaModalidade (2026-08-03)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (uuid) | sim | sim | identificador único |
| modalidade | String | sim | não | mesmo texto usado em `Aluno.modalidade`/`AgendaAula.modalidade`/`ModalidadePreco.modalidade` |
| graduacaoFaixa | String | sim | não | faixa/graduação do aluno **nessa** modalidade específica |
| alunoId | String (uuid) | sim | não | FK → `Aluno`, `onDelete: Cascade` |

> `@@unique([alunoId, modalidade])` — no máximo uma faixa registrada por (aluno, modalidade extra). Não existe linha aqui pra modalidade **principal** — essa faixa continua em `Aluno.graduacaoFaixa`, sem duplicação. Uma linha por modalidade, não por horário: um aluno pode ter `Matricula` em 2 horários diferentes da mesma modalidade extra e só precisa de 1 `AlunoFaixaModalidade` pra ela. Capturado hoje só pelo formulário de `/cadastro-aluno` (`SeletorModalidadesMultiplas.tsx`) — nem as telas de admin (`/alunos/novo`, `/alunos/[id]/editar`) nem o autoatendimento (`/aluno/matricula`) pedem faixa ao adicionar uma modalidade extra, por decisão explícita de escopo do usuário.

---

## Relacionamentos

| De | Para | Tipo | Atributos do relacionamento | Regra |
|---|---|---|---|---|
| TransacaoFinanceira | Aluno | N:0..1 | — | `alunoId` opcional — uma transação pode existir sem vínculo a aluno (ex: despesa de aluguel avulsa) |
| Aluno | TransacaoFinanceira | 1:N | — | um aluno pode ter múltiplas transações associadas (ex: mensalidades ao longo do tempo) |
| PreCadastro | Aluno | 0..1:0..1 (não é FK) | — | sem relação formal no schema — a ligação é só o fluxo de aprovação copiando os dados na criação do `Aluno`; `PreCadastro` não referencia o `Aluno` gerado |
| Despesa | — | nenhuma | — | entidade isolada, sem FK — não se relaciona com Aluno nem TransacaoFinanceira |
| Usuario | Aluno | 0..1:0..1 | `alunoId` `@unique` | vínculo 1:1 opcional (2026-07-23) — permite que um `Usuario` (conta de login) represente um `Aluno` específico na Área do Aluno; a conta ADMIN do Sandro não tem `Aluno` vinculado |
| Aluno | PresencaDiaria | 1:N | — | um aluno pode ter presenças em várias `AgendaAula`/datas diferentes |
| AgendaAula | PresencaDiaria | 1:N | — | um slot da grade pode ter várias presenças (uma por aluno/data) |
| Aluno | Matricula | 1:N | — | (2026-07-29) um aluno pode se matricular em várias modalidades extras |
| AgendaAula | Matricula | 1:N | — | (2026-07-29) um slot pode ter vários alunos matriculados como extra |
| Matricula | TransacaoFinanceira | 1:N | `matriculaId` | (2026-07-29; deixou de ser `@unique` em 2026-08-03) uma transação por mês do ciclo próprio da matrícula extra — não mais só a cobrança única gerada no ato da matrícula |
| Aluno | AgendaAula (referência) | N:0..1 | `agendaAulaReferenciaId` | (2026-07-29) horário informado no cadastro, só exibição — não é `Matricula`, não dá nem restringe acesso |
| Aluno | PacoteMembro | 0..1:0..1 | `alunoId` `@unique`, `onDelete: Cascade` | (2026-07-31) vínculo opcional a um pacote — excluir o `Aluno` remove o `PacoteMembro` junto |
| Pacote | PacoteMembro | 1:N | `onDelete: Cascade` | (2026-07-31) excluir o `Pacote` remove todos os `PacoteMembro` vinculados; a Server Action `removerMembroPacote` também exclui o `Pacote` se ele ficar sem nenhum integrante |
| Aluno | AlunoFaixaModalidade | 1:N | `onDelete: Cascade` | (2026-08-03) uma linha por modalidade extra praticada, cada uma com sua própria faixa; excluir o `Aluno` remove as faixas extras junto |

---

## Estados e ciclo de vida

### Aluno (`statusPagamento`)

```
"Em dia" | "Pendente" | "Atrasado"
```

Definido na criação, editável via `/alunos/[id]/editar` (item 2 do backlog, implementado).

### Aluno (`dataVencimento`)

```
criação → dataMatricula + 30 dias
pagamento (Receita vinculada) → data do pagamento + 30 dias
```

Ciclo fixo de 30 dias, sem transição manual — só avança automaticamente a cada pagamento registrado.

### TransacaoFinanceira (`tipo`)

```
"Receita" | "Despesa"
```

Fixado na criação — sem edição posterior do tipo (demais campos são editáveis via `/transacoes/[id]/editar`).

### PreCadastro (`status`)

```
"Pendente" → "Aprovado"  (via createAluno com preCadastroId)
"Pendente" → "Rejeitado" (via rejeitarPreCadastro)
```

Transição única — uma vez aprovado ou rejeitado, não há caminho de volta implementado.

### TransacaoFinanceira (`confirmadoEm`) (2026-07-29)

```
null → preenchido (via confirmarPagamento, admin)
```

Transição única e manual — não há "desconfirmar". Só é possível confirmar depois que `comprovanteUrl` está preenchido (validação na Server Action). Confirmar uma Receita vinculada a aluno também atualiza `Aluno.statusPagamento` para "Em dia" como efeito colateral.

### TransacaoFinanceira (`comprovanteUrl` / `comprovanteEnviadoEm`) (2026-07-29)

```
null → preenchido (aluno anexa arquivo)
preenchido → null (10 dias depois, via limparComprovantesExpirados — arquivo apagado do disco)
```

Só `comprovanteUrl`/`comprovanteEnviadoEm` voltam a `null` na expiração — `confirmadoEm` permanece intacto se já tiver sido confirmado antes.

### Aluno (`statusPagamento` exibido) (2026-07-29)

O valor exibido em qualquer tela (`/alunos`, `/aluno/financeiro`) é sempre `statusPagamentoEfetivo(aluno)` (`src/lib/vencimento.ts`), não o campo bruto: se `dataVencimento` já passou, mostra "Atrasado" mesmo que o campo gravado diga outra coisa. O campo bruto (`statusPagamento`) continua existindo e editável, mas deixou de ser a fonte de verdade única pra exibição.

---

## Propriedade e acesso

| Entidade | Quem cria | Quem lê | Quem edita | Quem exclui |
|---|---|---|---|---|
| Aluno | Sandro (autenticado) ou aprovação de PreCadastro | Sandro (autenticado) | Sandro | Sandro |
| TransacaoFinanceira | Sandro (autenticado) | Sandro (autenticado) | Sandro | Sandro |
| Despesa | Sandro (autenticado) | Sandro (autenticado) | Sandro (só a ocorrência editada) | Sandro |
| PreCadastro | Qualquer pessoa, via link público `/matricule-se` (sem login) | Sandro (autenticado, em `/pre-cadastros`) | ninguém (só troca de `status`) | não implementado |
| Usuario | seed inicial (`npm run db:seed`) ou automático (`createAluno` com e-mail) | ninguém lê diretamente (usado só pelo NextAuth); admin edita o próprio nome/e-mail/telefone/pix em Configurações → Perfil | senha: o próprio usuário, via `/resetar-senha`; nome/e-mail/telefone/pix: o próprio admin, via Configurações → Perfil | `revogarAcessoAluno` (admin, via tela do aluno) — **bloqueado** pra `devaluno`/`devmaster` (`src/lib/contas-fixas.ts`) |
| AgendaAula | Sandro, via Configurações → Agenda (2026-07-30; antes só via script de seed) — valida contra `ConfiguracaoAgenda` | Sandro (`/agenda`, com roster) e aluno (`/aluno`, filtrado — `getMeusHorarios`), ambos autenticados, **com filtro por `role`** desde 2026-07-28 | só `capacidadeMax`, Sandro em Configurações → Agenda | Sandro, em Configurações → Agenda — **bloqueado** (`P2003`) se houver `Matricula`/`PresencaDiaria` vinculada |
| PresencaDiaria | não implementado (nenhum fluxo cria registros ainda) | não lida em nenhuma tela desde 2026-07-29 (vagas calculadas via roster de `Aluno`/`Matricula`, não mais via `PresencaDiaria`) | não implementado | não implementado |
| Matricula (2026-07-29) | o próprio aluno, via `/aluno/matricula` (`matricularEmAula`) | Sandro (`/agenda` roster, `/matriculas`) e o próprio aluno (`/aluno/matricula`, `/aluno` se confirmada) | não implementado (só criação/exclusão) | o próprio aluno, via `cancelarMatricula` |
| ModalidadePreco (2026-07-29) | upsert automático na primeira gravação (admin em Configurações → Agenda) | Sandro (Configurações → Agenda), e implicitamente pelo aluno no modal de matrícula (mostra o valor) | Sandro, em Configurações → Agenda | não implementado |
| ConfiguracaoAgenda (2026-07-30) | upsert automático na primeira gravação (admin em Configurações → Agenda) | Sandro (Configurações → Agenda) e implicitamente todo aluno (legenda da grade em `AgendaGrid`) | Sandro, em Configurações → Agenda | não implementado (é singleton — não faz sentido excluir) |
| BloqueioAgenda (2026-07-30) | Sandro, via Configurações → Agenda (`criarBloqueio`) | Sandro (gestão) e aluno (banner em `/aluno`, só os próximos 14 dias) | não implementado (só criação/exclusão) | Sandro, em Configurações → Agenda |
| Pacote / PacoteMembro (2026-07-31) | Sandro, via Configurações → Preços (`criarPacote`) — ou direto no cadastro/edição do aluno (`pacoteId`/`descontoPercentual` no form) | Sandro (Configurações → Preços) e, indiretamente, o aluno titular de um pacote família (vê o resultado calculado em `/aluno/financeiro`, não o pacote em si) | Sandro — desconto por integrante (`atualizarDescontoMembro`), titular (`definirTitular`), vínculo do aluno (`sincronizarPacoteAluno`, upsert ao salvar o form de Aluno) | Sandro — `removerMembroPacote` (integrante) ou `excluirPacote` (pacote inteiro, cascade) |

> Autenticação implementada desde 2026-07-12 (NextAuth v5, Credentials provider, login por `username`) — `/alunos`, `/transacoes`, `/despesas`, `/pre-cadastros`, `/agenda`, `/matriculas`, `/configuracoes` e `/` exigem sessão válida via `src/proxy.ts`. **Checagem de `role` implementada em 2026-07-28** (fechando a pendência registrada em 2026-07-23): rotas administrativas exigem `role=ADMIN`, `/aluno` exige `role=ALUNO`, com redirecionamento cruzado quando não bate. `/matricule-se`, `/login`, `/esqueci-senha` e `/resetar-senha` são públicas.

---

## Ciclo de retenção

| Entidade | Retenção | Arquivado após | Excluído após | Nunca excluir |
|---|---|---|---|---|
| Aluno | permanente até exclusão manual | — | exclusão manual pelo usuário | — |
| TransacaoFinanceira | permanente até exclusão manual | — | exclusão manual pelo usuário | — |
| Despesa | permanente até exclusão manual | — | exclusão manual pelo usuário | — |
| PreCadastro | permanente (histórico de Pendente/Aprovado/Rejeitado) | — | não implementado | — |
| Usuario | permanente | — | não implementado | — |
| Matricula (2026-07-29) | permanente até cancelamento pelo aluno | — | exclusão via `cancelarMatricula` — a `TransacaoFinanceira` vinculada permanece (`matriculaId` só perde o valor, `onDelete: SetNull`) | — |
| `TransacaoFinanceira.comprovanteUrl` (2026-07-29) | **10 dias** a partir de `comprovanteEnviadoEm` | — | arquivo apagado do disco + campo zerado, via `limparComprovantesExpirados` (reativo, sem cron real) | o registro `TransacaoFinanceira` em si nunca é excluído por isso — só o arquivo/URL |
| Pacote / PacoteMembro (2026-07-31) | permanente até exclusão manual | — | exclusão manual pelo admin (`excluirPacote`/`removerMembroPacote`), ou automática (cascade) se o `Aluno` vinculado for excluído | — |

Nenhuma entidade tem soft delete ou auditoria de exclusão — a remoção é definitiva (`DELETE` direto no banco via Prisma), exceto `PreCadastro`, que só muda de `status` (nunca é fisicamente excluído pelo fluxo atual). `TransacaoFinanceira` é a primeira entidade com retenção de **conteúdo** com prazo (o comprovante, não o registro).

---

## Padrão de IDs

Todas as entidades usam `uuid()` como estratégia de ID (`@default(uuid()) @db.Uuid`), gerado pelo Prisma no momento da criação. `Despesa.grupoRecorrenciaId` também é UUID, mas gerado manualmente via `crypto.randomUUID()` na Server Action — não é PK/FK, é só uma tag de agrupamento.

---

## Notas de geração do client

O schema usa o gerador `prisma-client` (não o tradicional `prisma-client-js`), com saída em `src/generated/prisma`. Esse gerador exige que o `PrismaClient` seja instanciado com um **driver adapter** explícito:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

Sem o adapter, `new PrismaClient()` não compila (`Expected 1 arguments, but got 0`) — diferente de gerações anteriores do Prisma, que liam `DATABASE_URL` implicitamente.

## Nota sobre migrações neste ambiente

`npx prisma migrate dev` trava com "Prisma Migrate has detected that the environment is non-interactive" mesmo com `--create-only` — o processo usado em todas as migrações deste projeto (desde `add_usuario` até `modulo_financeiro_cadastro`) foi:
1. `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` para gerar o SQL
2. Criar a pasta `prisma/migrations/<timestamp>_<nome>/migration.sql` manualmente com esse SQL
3. `npx prisma migrate deploy` (não-interativo) para aplicar e registrar no `_prisma_migrations`

**Reconfirmado em 2026-07-22/23** com mais duas migrações usando o mesmo fluxo:
- `20260722012129_expansao_agenda_role` — `Role`, `AgendaAula`, `PresencaDiaria`, campos de comprovante em `TransacaoFinanceira`
- `20260723002845_usuario_aluno_link` — `Usuario.alunoId`

**Atualização 2026-07-29 — nem sempre trava:** na sessão de 2026-07-29, `npx prisma migrate dev` funcionou **normalmente** (sem workaround) pra 4 das 6 migrações novas (`matricula_e_nome_usuario`, `aluno_horario_referencia_precadastro_modalidade`, `preco_modalidade`, `comprovante_expira_alertas_lidos`, `transacao_confirmacao_pagamento`). O travamento "non-interactive" só reapareceu numa migração específica (`transacao_vencimento_pagamento_matricula`) que adicionava uma constraint `@unique` — nesse caso o Prisma emite um aviso extra pedindo confirmação interativa ("pode falhar se já existirem duplicados"), e é **esse prompt adicional**, não a ausência de TTY em si, que trava neste ambiente. Pra esses casos específicos, o fluxo manual (`migrate diff --script` → pasta manual → `migrate deploy`) continua sendo o caminho. Migrações "simples" (coluna nova nullable, sem constraint que exija confirmação) tendem a funcionar direto com `migrate dev`.

Migrações desta sessão: `20260729033723_matricula_e_nome_usuario`, `20260729042548_aluno_horario_referencia_precadastro_modalidade`, `20260729051016_preco_modalidade`, `20260729053258_transacao_vencimento_pagamento_matricula` (via fluxo manual), `20260729055440_transacao_confirmacao_pagamento`, `20260729070606_comprovante_expira_alertas_lidos`.

Armadilha já cometida e corrigida nesta sessão: rodar o redirect do `--script` direto pra um arquivo solto em `prisma/migrations/manual_<timestamp>_<nome>.sql` **não funciona** — o Prisma só reconhece migrações dentro de uma subpasta própria (`prisma/migrations/<timestamp>_<nome>/migration.sql`), senão `migrate deploy` ignora silenciosamente o arquivo. Sempre confirmar com `npx prisma migrate status` antes de rodar `deploy` — o comando lista corretamente quais migrações estão pendentes.

**2026-07-30:** `npx prisma migrate dev --name usuario_telefone` funcionou direto, sem workaround (coluna nova nullable, sem constraint) — gerou `20260730143418_usuario_telefone`. Depois de rodar a migração, **rodar `npx prisma generate` de novo** é obrigatório antes de usar o campo novo no código: o `tsc --noEmit` acusou o campo `telefone` como inexistente até o client ser regenerado, mesmo a coluna já estando aplicada no banco.

**2026-07-30 (mesma sessão, mais duas migrações):** `20260730180035_configuracao_agenda_bloqueios` (models novos `ConfiguracaoAgenda`/`BloqueioAgenda`, sem constraint complexa) e `20260730191937_usuario_pix` (`Usuario.pix`) — ambas via `npx prisma migrate dev` direto, sem workaround. Mesmo padrão de armadilha do servidor local se repetiu **fora do escopo do Prisma**: depois de rodar `npx prisma generate`, o `next dev` local precisou ser reiniciado matando o processo por **PID exato** (`kill -9 <pid>`, achado via `ss -tlnp`), porque `pkill -f "next dev"`/`pkill -f "next-server"` silenciosamente não encontrou o processo (mesmo ele existindo) — rodar `npm run dev` de novo sem confirmar que o processo antigo morreu de fato deixa dois servidores no ar ao mesmo tempo, um deles servindo com o Prisma Client desatualizado (`Unknown field` em produção mesmo com a migração já aplicada no banco).

**2026-07-31:** `20260731011546_pacotes_preco_individual` (`Aluno.mensalidadeValor`, models novos `Pacote`/`PacoteMembro`, enum `TipoPacote`) — `npx prisma migrate dev --name pacotes_preco_individual` funcionou direto, sem workaround (mesmo padrão: coluna nova nullable + tabelas novas, sem constraint que exija confirmação interativa). **Reconfirma um detalhe já registrado em 2026-07-30:** `npx prisma migrate dev` roda a migração mas **não regenera o client automaticamente de forma confiável neste ambiente** — `npx prisma generate` precisou ser rodado manualmente de novo antes do `tsc --noEmit` parar de acusar `pacoteMembro`/`mensalidadeValor` como campos inexistentes, mesmo a migração já aplicada no banco. Mesma armadilha de processo antigo do `next dev` ocupando a porta se repetiu aqui também (ver [[registro-de-decisoes-academiasandro]], entrada de 2026-07-31) — resolvida achando o PID real via `ps` em vez de confiar em `pkill`.

**2026-08-03:** `20260803191927_melhorias_agosto` (`Matricula.dataVencimentoBase`, `Pacote.descontoPadrao`, `PreCadastro.dataAulaExperimental`/`termosAceitos`/`termosAceitosEm`, remoção do `@unique` de `TransacaoFinanceira.matriculaId`) — `npx prisma migrate dev --name melhorias-agosto` funcionou direto, sem workaround, mesmo removendo uma constraint `@unique` existente (diferente do padrão observado em 2026-07-29, onde adicionar `@unique` exigia o fluxo manual — remover parece não disparar o mesmo prompt de confirmação). Como o ambiente de dev aponta pro **mesmo banco Supabase usado em produção**, essa migração já foi aplicada na produção no instante em que rodou localmente — o `docker compose run --rm migrate` posterior na VPS só confirma "no pending", não é ele que aplica de fato (ver Playbook DevOps, seção Academia Prof. Sandro).
