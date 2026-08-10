---
status: draft
domain: kernel-academia
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Requisitos Funcionais — Kernel Academia

Requisitos **extraídos do código existente** em `kernel-academia/` — não há PRD original de produto neste repositório. Cada RF corresponde a comportamento verificável em uma Server Action, page ou lib. O status de cada módulo diz o que está implementado e o que está inerte.

47 RFs em 10 módulos.

---

## Módulo 1 — Plano de controle da plataforma (`/admin-kernel`)

#### Requisitos Funcionais

- RF-001: Login de SuperAdmin por e-mail + senha, em rota separada (`/admin-kernel/login`)
- RF-002: Listar todos os tenants com slug, contagem de usuários e de alunos, e status ativo/inativo
- RF-003: Criar tenant informando nome, slug (opcional — derivado do nome), usuário e e-mail do admin inicial, branding e módulos opcionais
- RF-004: Exibir a senha temporária do admin recém-criado uma única vez, na própria tela, via query string
- RF-005: Ativar/desativar tenant sem apagar dado
- RF-006: Resetar a senha de qualquer usuário de qualquer tenant e devolver a senha nova uma vez
- RF-007: Listar os 100 erros mais recentes de qualquer tenant, com rota, status, mensagem técnica, stack e usuário

#### Regras de negócio

- Sessão de SuperAdmin é **deliberadamente separada** do NextAuth dos tenants: cookie próprio (`kernel_superadmin_session`), payload assinado com HMAC-SHA256 sobre `AUTH_SECRET`, validade de 7 dias, escopo de path `/admin-kernel`. Motivo registrado no código: um `SuperAdmin` nunca pertence a um tenant e não deve, nem por bug, ser aceito como sessão de `Usuario` — nem o contrário
- Onboarding é atômico: `Tenant` + `Usuario` ADMIN na mesma `$transaction`. Sem isso o tenant existiria sem ninguém que consiga logar nele
- Colisão de slug, username ou e-mail (`P2002`) vira mensagem única: *"Slug, usuário ou e-mail já em uso por outro tenant"*
- Senha temporária: 9 bytes aleatórios em `base64url`, hash `bcrypt` custo 12, `senhaTemporaria = true`
- Reset de senha também limpa `tokenRecuperacao`/`tokenExpiracao`

#### Status

Implementado. **Lacuna:** `requireSuperAdmin()` protege as actions e as pages do grupo `(protegido)`, mas o `proxy.ts` **não cobre `/admin-kernel`** — a proteção é só de aplicação, não de middleware.

---

## Módulo 2 — Multi-tenancy, branding e feature flags

#### Requisitos Funcionais

- RF-008: Toda leitura/escrita de negócio escopada pelo `tenantId` da sessão
- RF-009: Login global — o tenant é resolvido a partir do `Usuario` encontrado, sem slug na URL
- RF-010: Login negado se o tenant do usuário estiver inativo
- RF-011: Branding por tenant (slogan, logo, cor primária, cor de fundo) aplicado sem rebuild
- RF-012: Módulos opcionais ligáveis por tenant, sobre uma base de módulos core imutáveis
- RF-013: Rotas públicas resolvem o tenant pelo slug da URL

#### Regras de negócio

- `requireTenantId()` lê o `tenantId` da sessão e lança se não houver — cair ali é bug de guarda, não caminho de usuário
- `username` e `email` são `@unique` **globais**, não por tenant. Consequência aceita e registrada no schema: duas academias não podem ambas ter um usuário literal `admin`
- `resolveFeatures()` mescla `Tenant.features` com `CORE_FEATURES` (`alunos`, `agenda`, `financeiro`) — **core sempre vence**, um tenant não consegue desligar módulo essencial nem manipulando o JSON
- Features são resolvidas **uma vez no login** e viajam no JWT (snapshot) — mudar a flag de um tenant só surte efeito no próximo login daquele usuário
- Branding vira CSS custom property inline (`--primary`, `--background`) no shell — o `globals.css` já expõe essa indireção
- `resolveTenantPublico()` devolve `notFound()` tanto para slug inexistente quanto para tenant inativo, sem distinguir os dois casos

#### Status

Implementado com **lacuna relevante**: das 4 features opcionais declaradas (`portalAluno`, `preCadastroPublico`, `pacotesFamilia`, `whatsappGateway`), **só `preCadastroPublico` é efetivamente consultada** — no `AppShell`, para esconder o item "Pré-cadastros" do menu. As outras 3 aparecem no formulário de onboarding e são gravadas no banco, mas nenhum código lê seu valor: desligar `portalAluno` ou `pacotesFamilia` num tenant hoje não muda nada no comportamento do sistema.

---

## Módulo 3 — Autenticação e acesso dos tenants

#### Requisitos Funcionais

- RF-014: Login por username + senha (NextAuth v5, Credentials Provider, sessão JWT)
- RF-015: Rotas de gestão exigem role `ADMIN`; rotas de portal exigem role `ALUNO`
- RF-016: Recuperação de senha por link com token e expiração
- RF-017: Definição de senha no primeiro acesso (senha temporária)
- RF-018: Admin cria, reenvia e revoga o acesso ao portal de um aluno

#### Regras de negócio

- `bcrypt.compare` roda sempre — contra um `DUMMY_HASH` quando o usuário não existe, para manter tempo de resposta constante (mitigação de timing attack)
- O callback `authorized` distingue `/alunos` (gestão) de `/aluno` (portal) por **segmento exato**, não por prefixo de string — sem isso os dois colidiriam
- Papel errado não vira 403: `ADMIN` em rota de aluno é redirecionado para `/`, `ALUNO` em rota de gestão é redirecionado para `/aluno`
- Acesso do aluno nasce com senha aleatória de 24 bytes que ninguém conhece + `senhaTemporaria = true`; o aluno só entra pelo link de definição de senha
- Username do aluno é derivado do nome (`primeiro.ultimo`, sem acento, minúsculo) com sufixo numérico incremental até ser único **na plataforma inteira**
- Contas fixas `devaluno` e `devmaster` (senha em `prisma/seed.ts`) devem sobreviver a qualquer re-seed, inclusive em produção, para diagnóstico do Willians — e, por causa do login global, só podem existir vinculadas a **um** tenant

#### Status

Implementado. **Risco registrado:** as duas contas fixas têm senha em texto no `seed.ts`, e `devmaster` é `ADMIN` do primeiro tenant demo — em produção multi-cliente isso é uma conta de suporte com acesso permanente aos dados de um cliente.

---

## Módulo 4 — Alunos

#### Requisitos Funcionais

- RF-019: Cadastrar aluno com modalidade principal, faixa/graduação, dados pessoais, cidade, lesões e horário de referência
- RF-020: Registrar modalidades extras com faixa própria por modalidade
- RF-021: Definir override de mensalidade individual
- RF-022: Editar e excluir aluno
- RF-023: Listar alunos com status de pagamento efetivo e botão de cobrança por WhatsApp
- RF-024: Vincular aluno a um pacote de desconto

#### Regras de negócio

- `Aluno.modalidade` (principal) dá acesso implícito a **todos** os horários daquela modalidade; `Matricula` é só para horário de modalidade **extra**
- `Aluno.agendaAulaReferencia` é organizacional — não restringe acesso a horário
- Faixa da modalidade principal fica em `Aluno.graduacaoFaixa`; faixas de modalidades extras ficam em `AlunoFaixaModalidade`, **uma linha por modalidade** (não por horário — o aluno pode ter dois horários da mesma modalidade extra)
- `statusPagamento` é um campo manual que não se atualiza sozinho. O código registra que isso **já causou tela mostrando "Em dia" para aluno vencido** — por isso toda exibição deve usar `statusPagamentoEfetivo()`, onde a data manda sobre o campo
- Vencimento padrão = data-base + 30 dias

#### Status

Implementado.

---

## Módulo 5 — Agenda

#### Requisitos Funcionais

- RF-025: Criar horário com modalidade, dia da semana, hora de início/fim e capacidade máxima
- RF-026: Alterar capacidade e excluir horário
- RF-027: Visualizar a grade modalidade × dia com vagas e roster de alunos por célula
- RF-028: Configurar janela de almoço (uma por tenant)
- RF-029: Criar e excluir bloqueios pontuais de agenda (data + intervalo + motivo)
- RF-030: Avisar por WhatsApp todos os alunos afetados por um bloqueio

#### Regras de negócio

- Ocupação de um horário = alunos cuja **modalidade principal** é a do horário + `Matricula` extras naquele horário
- `ConfiguracaoAgenda` usa `tenantId` como própria chave primária — substituiu o antigo `@id @default("singleton")` da época single-tenant, registrado como comentário no schema
- Bloqueio notifica: todos os alunos da modalidade afetada (acesso implícito) + quem tem `Matricula` no horário específico, deduplicados por id de aluno; só quem tem telefone
- Falha de envio por aluno apenas loga — nunca derruba a criação do bloqueio nem os envios seguintes
- Grade de exibição vai de segunda a sábado (`DIAS_GRADE`), embora o enum `DiaSemana` inclua domingo

#### Status

Implementado.

---

## Módulo 6 — Financeiro: transações e parcelas

#### Requisitos Funcionais

- RF-031: Lançar, editar e excluir transação (receita/despesa) com categoria, valor, datas e forma de pagamento
- RF-032: Confirmar pagamento de uma transação
- RF-033: Exibir o ciclo de 12 parcelas mensais da mensalidade principal
- RF-034: Exibir um ciclo de 12 parcelas próprio para cada modalidade extra
- RF-035: Lançar, editar e excluir despesa, com marcação de recorrência
- RF-036: Aluno anexa comprovante de pagamento pelo portal
- RF-037: Limpar comprovantes expirados

#### Regras de negócio

- O ciclo é uma **janela fixa de 12 meses ancorada numa data-base**, não "os próximos 12 meses a partir de hoje". Data-base da mensalidade = `Aluno.dataMatricula`; de cada extra = `Matricula.dataVencimentoBase` (editável pelo admin, cada modalidade extra pode ter vencimento próprio)
- Parcela casa com transação **por mês/ano**, não por dia
- Estados de parcela: `Paga` (tem `confirmadoEm`) → `Aguardando confirmação` (tem comprovante, sem confirmação) → `Pendente` (transação existe, sem comprovante) → `A vencer` (mês futuro sem transação) → `Não paga` (mês passado sem transação)
- Comprovante tem retenção de **10 dias**: arquivo removido do disco e `comprovanteUrl`/`comprovanteEnviadoEm` zerados. A limpeza é preguiçosa (roda quando alguém abre as telas que exibem comprovante) e também exposta em `GET /api/cron/limpar-comprovantes`
- `Despesa.recorrente`/`frequenciaRecorrencia`/`grupoRecorrenciaId` existem no schema — **o repositório não tem nenhum job que lance a despesa recorrente automaticamente**

#### Status

Implementado, com duas ressalvas: a limpeza de comprovante só é automática se alguém configurar um cron externo apontando para a rota (não há cron no `docker-compose.yml`), e **`GET /api/cron/limpar-comprovantes` não tem autenticação nenhuma** — qualquer um que alcance a porta dispara a limpeza de todos os tenants.

---

## Módulo 7 — Preços, pacotes e descontos

#### Requisitos Funcionais

- RF-038: Definir preço por modalidade (por tenant)
- RF-039: Definir mensalidade individual que sobrepõe o preço da modalidade
- RF-040: Criar pacote FAMILIA ou COMBO_MODALIDADES, atribuir membros, definir desconto por membro e marcar o titular
- RF-041: Exibir o valor efetivo de cada aluno (base + extras − desconto)

#### Regras de negócio

- Hierarquia de preço: `Aluno.mensalidadeValor` (override) > `ModalidadePreco` da modalidade principal > 0
- Extras são somados **por matrícula, não por modalidade distinta**: dois horários da mesma modalidade extra somam duas vezes, porque cada um gera cobrança própria
- Pacote **FAMILIA** desconta só a mensalidade (extras entram no total sem desconto); pacote **COMBO_MODALIDADES** desconta sobre o total combinado (mensalidade + extras)
- `PacoteMembro.titular` só é relevante para FAMILIA: é quem vê no portal a mensalidade de todos os integrantes
- `Pacote.descontoPadrao` só é usado por combo criado como **catálogo** (sem membro ainda), para o aluno escolher no autocadastro — pacotes FAMILIA nascem sempre com membros e nunca usam esse campo
- Um aluno pertence a no máximo um pacote (`PacoteMembro.alunoId` é `@unique`)

#### Status

Implementado. **Observação de arquitetura:** `getAlunosComPrecos()` chama `valorEfetivoAluno()` por aluno, que por sua vez consulta as matrículas de cada um — N+1 na tela de Preços. Irrelevante no volume atual, relevante se um tenant crescer.

---

## Módulo 8 — Portal do aluno

#### Requisitos Funcionais

- RF-042: Aluno vê os próprios horários e os bloqueios dos próximos 14 dias
- RF-043: Aluno vê o próprio financeiro (parcelas da mensalidade + de cada extra)
- RF-044: Aluno anexa comprovante numa parcela
- RF-045: Aluno se matricula sozinho em horário extra
- RF-046: Aluno cancela a própria matrícula extra

#### Regras de negócio

- `matricularAlunoEmAula()` recusa: horário inexistente, horário cuja modalidade já é a principal do aluno (*"Você já tem acesso a este horário pela sua modalidade principal"*), horário lotado, e matrícula duplicada (via `P2002` do índice `@@unique([tenantId, alunoId, agendaAulaId])`)
- A matrícula cria, junto, a `TransacaoFinanceira` da modalidade extra, com categoria `"Matrícula extra — {modalidade}"`
- A função aceita opcionalmente um client de transação em andamento — para ser usada tanto isolada (portal) quanto composta (autocadastro com várias modalidades)

#### Status

Implementado. **Não é governado pela feature flag `portalAluno`** (ver Módulo 2).

---

## Módulo 9 — Captação pública por slug do tenant

#### Requisitos Funcionais

- RF-047a: Pré-matrícula pública em `/matricule-se/{tenantSlug}` com aceite de LGPD e escolha de data de aula experimental
- RF-047b: Autocadastro completo de aluno em `/cadastro-aluno/{tenantSlug}` com modalidade principal + extras e escolha de pacote combo
- RF-047c: Admin trata pré-cadastros (fila de pendentes, rejeição)
- RF-047d: Aviso automático ao admin no WhatsApp quando há aula experimental agendada

#### Regras de negócio

- `tenantId` e `tenantSlug` vêm de `.bind()` na page, resolvidos no servidor a partir do slug da URL — **nunca de input do formulário**
- Consentimento LGPD é gravado com carimbo de tempo (`termosAceitos` + `termosAceitosEm`)
- O autocadastro roda em `$transaction`: cria `Aluno`, faixas extras, matrículas nos horários escolhidos, transações e usuário do portal
- O aviso de aula experimental vai para o telefone do **primeiro `Usuario` ADMIN do tenant** — não há campo de "telefone da academia"; se esse admin não preencheu telefone no perfil, ninguém é avisado
- Falha de envio nunca bloqueia o pré-cadastro

#### Status

Implementado. **Lacuna de produto:** o texto de consentimento em `TermosAceite.tsx` cita literalmente "Centro de Treinamento Sandro Freire" — um lead de outro tenant assina consentimento para a academia errada. É bloqueante para uso comercial.

---

## Módulo 10 — Observabilidade e notificações

#### Requisitos Funcionais

- RF-048: Registrar automaticamente toda exceção não tratada com tenant, rota, status, mensagem, stack e usuário
- RF-049: Sino de notificações com inadimplentes, vencimentos em até 3 dias, pré-cadastros pendentes e matrículas aguardando confirmação
- RF-050: Marcar notificações como lidas
- RF-051: Conectar/desconectar o WhatsApp do tenant por QR code, ver status da conexão e sincronizar o número pareado com o perfil

#### Regras de negócio

- A captura usa o hook nativo `onRequestError` do Next em vez de wrapper por rota, porque a maior parte das mutações do sistema é Server Action, não Route Handler
- `instrumentation.ts` só despacha; a implementação real fica em `instrumentation-node.ts` e só roda em runtime Node.js — o client do Prisma usa `node:path`/`node:url` e quebraria o bundle de Edge
- Falha ao gravar o log nunca propaga (try/catch com `console.error`)
- Mensagem truncada em 2000 caracteres, stack em 4000
- "Novo" no sino é por categoria: pré-cadastro/matrícula usam a data de criação; vencimento/inadimplência usam o instante em que a data cruzou o limiar (d-3 ou o próprio vencimento), com hora zerada — sem isso um vencimento de horário tardio ficava "novo" indefinidamente
- Cobrança por WhatsApp na lista de alunos e no sino é **link `wa.me` para clique manual**, não envio automático — envio real só nos dois casos do Módulo 5/9

#### Status

Implementado. **Lacuna de multi-tenancy:** `EVOLUTION_INSTANCE_NAME` é uma **variável de ambiente única do processo**, com default `"academia-sandro-admin"`. O `.env` afirma que a instância "é por tenant em produção (ver `Tenant.branding`/onboarding)", mas **isso não existe no código** — hoje todos os tenants compartilham a mesma instância de WhatsApp. É a maior divergência encontrada entre comentário e implementação.

---

## Requisitos não funcionais

| ID | Requisito | Status |
|---|---|---|
| NFR-001 | Isolamento por `tenantId` em toda query de negócio | Implementado por disciplina de código — **sem RLS no banco** |
| NFR-002 | Sessão de plataforma separada da sessão de tenant | Implementado (cookie HMAC próprio) |
| NFR-003 | Senha com `bcrypt` custo 12 e mitigação de timing attack | Implementado |
| NFR-004 | Falha de integração externa nunca derruba action de negócio | Implementado (`enviarWhatsapp` nunca lança) |
| NFR-005 | Valores monetários em `Decimal(10,2)` | Implementado no schema |
| NFR-006 | Erro não tratado nunca chega cru ao usuário | Implementado (`onRequestError` → `ErrorLog`) |
| NFR-007 | Mobile-first | Implementado (sidebar off-canvas com overlay abaixo de `lg`) |
| NFR-008 | Branding por tenant sem rebuild | Implementado (CSS custom properties inline) |
| NFR-009 | Imagem de produção enxuta | Implementado (Dockerfile multi-stage, `output: standalone`, usuário não-root) |
| NFR-010 | Testes automatizados | **Ausente** — nenhuma dependência de teste no `package.json` |

---

## Critérios de aceite gerais

- Build local: há `.next/` e `tsconfig.tsbuildinfo` de 2026-08-09, indicando build recente bem-sucedido
- Migrations: 2 aplicadas (`20260809120232_init_multitenant`, `20260809195433_error_logs`)
- Seed: cria SuperAdmin (de `.env`), 2 tenants demo com features/branding distintos e as contas fixas `devaluno`/`devmaster`
- **Não validado:** nenhum registro no repositório indica navegação real em browser, teste com usuário, ou execução contra um banco populado além do seed
- **Não validado:** deploy — não existe `.env.production`, exigido pelo `docker-compose.yml`
- **Não versionado:** a pasta inteira aparece como `?? kernel-academia/` no `git status` do monorepo pai, e não tem `.git` próprio

---

## Links relacionados

[[indice-kernel-academia]] — mapa completo dos artefatos do sistema
[[prd-kernel-academia]] — objetivo e escopo que estes RFs traduzem
[[modelo-de-dados-kernel-academia]] — entidades e regras de cálculo por trás destes requisitos
