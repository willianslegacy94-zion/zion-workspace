---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-07-31
owner: willians
---

# Requisitos Funcionais — Academia Prof. Sandro

> Referência: [[prd-academiasandro]]

---

## Módulos funcionais

### Módulo 1 — Alunos

Cadastro e acompanhamento dos alunos matriculados na academia.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-001 | Lista todos os alunos | dado acesso à `/alunos` | renderiza tabela com nome, modalidade, faixa, status de pagamento, aptidão para exame e data de matrícula, ordenada por matrícula decrescente |
| RF-002 | Cadastra novo aluno | dado nome, modalidade, faixa/graduação e status de pagamento preenchidos | persiste `Aluno` com `dataMatricula` = agora e `aptoExame` conforme checkbox marcado |
| RF-003 | Exibe status de pagamento com cor semântica | dado `statusPagamento` do aluno | badge verde ("Em dia"), âmbar ("Pendente") ou vermelho ("Atrasado") |
| RF-004 | Exclui aluno | dado clique em "Excluir" na linha do aluno | remove o registro `Aluno` permanentemente |
| RF-005 | Exibe estado vazio | dado nenhum aluno cadastrado | mensagem "Nenhum aluno cadastrado ainda." no lugar da tabela |
| RF-012 | Edita aluno existente | dado clique em "Editar" na linha do aluno | abre `/alunos/[id]/editar` com os campos preenchidos; salvar atualiza o registro e volta pra listagem |
| RF-013 | Captura dados de contato e saúde do aluno | dado cadastro ou edição | campos opcionais: telefone (WhatsApp), e-mail, data de nascimento, cidade, lesões (texto livre) |
| RF-014 | Calcula e exibe vencimento da mensalidade | dado aluno com `dataVencimento` preenchida | badge colorido na listagem: vermelho se vencida, âmbar se vence em até 3 dias, neutro caso contrário |
| RF-015 | Gera link de cobrança via WhatsApp | dado aluno com telefone cadastrado | botão "WhatsApp" na listagem abre `wa.me/55<telefone>` com mensagem pré-preenchida (varia se já venceu, vence hoje ou vence em N dias) |
| RF-016 | Pré-preenche cadastro a partir de um pré-cadastro aprovado | dado acesso a `/alunos/novo?preCadastroId=<id>` | formulário de novo aluno vem com nome/telefone/e-mail/data de nascimento/cidade/lesões/modalidade de interesse já preenchidos; falta só faixa/status; ao salvar, marca o `PreCadastro` como "Aprovado" |
| RF-041 (2026-07-29) | Filtra a lista de alunos | dado clique numa aba de filtro em `/alunos` | "Todos" (padrão), "Pagamento vencido" (`dataVencimento` no passado) ou "Aguardando confirmação" (tem `TransacaoFinanceira` com comprovante enviado e não confirmado) — cada aba mostra a contagem |
| RF-042 (2026-07-29) | Cria acesso ao portal automaticamente no cadastro | dado `email` preenchido no formulário de novo aluno | cria `Usuario` (`role=ALUNO`) vinculado, gera link de definição de senha e redireciona pra `/alunos/[id]/editar` já mostrando o link (WhatsApp/e-mail) — sem precisar do passo manual de "Criar acesso" |
| RF-043 (2026-07-29) | Exibe status de pagamento sempre coerente com a data | dado aluno com `dataVencimento` no passado | mostra "Atrasado" mesmo que o campo `statusPagamento` gravado esteja desatualizado — data manda sobre o valor manual |
| RF-068 (2026-07-31) | Permite editar o vencimento diretamente | dado admin altera o campo "Vencimento" em `/alunos/[id]/editar` e salva | atualiza `Aluno.dataVencimento` com o valor exato informado, sem passar pelo cálculo automático |

#### Regras de negócio
- **RN-001:** `nome`, `modalidade`, `graduacaoFaixa` e `statusPagamento` são obrigatórios — formulário não envia sem eles (validação nativa HTML `required`)
- **RN-002:** `aptoExame` é `false` por padrão — só vira `true` se o checkbox for marcado no cadastro
- **RN-003:** Excluir um aluno que tem transações financeiras vinculadas define `alunoId` dessas transações como `null` (FK opcional, sem `onDelete: Cascade` configurado) — a transação permanece, só perde o vínculo
- **RN-007 (revisado 2026-07-31):** `dataVencimento` é recalculada automaticamente a cada Receita vinculada registrada em `/transacoes` (`data do pagamento + 30 dias`) e na criação do aluno (`dataMatricula + 30 dias`), mas desde 2026-07-31 **também pode ser editada diretamente** pelo admin em `/alunos/[id]/editar` — a edição manual vale até a próxima Receita ser registrada, que recalcula por cima
- **RN-016 (2026-07-29):** `/alunos/novo` é rota própria — a listagem (`/alunos`) não tem mais formulário embutido, só a tabela + botão "Novo Aluno"
- **RN-017 (2026-07-29):** o status de pagamento exibido é sempre `statusPagamentoEfetivo` (derivado da data), nunca o `statusPagamento` bruto direto — vale em `/alunos` e em `/aluno/financeiro`

---

### Módulo 2 — Transações Financeiras

Registro de receitas e despesas da academia, com vínculo opcional a um aluno.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-006 | Lista todas as transações | dado acesso à `/transacoes` | renderiza tabela com data, tipo, categoria, aluno vinculado (se houver) e valor, ordenada por data decrescente |
| RF-007 | Calcula e exibe saldo do período | dado todas as transações carregadas | soma valores de tipo "Receita" e subtrai valores de tipo "Despesa"; exibe em verde (≥ 0) ou vermelho (< 0) |
| RF-008 | Cadastra nova transação | dado tipo, categoria, valor e data preenchidos | persiste `TransacaoFinanceira`; `alunoId` é opcional |
| RF-009 | Vincula transação a um aluno existente | dado seleção de aluno no campo opcional do formulário | preenche `alunoId` com o aluno selecionado; lista de alunos ordenada por nome |
| RF-010 | Exclui transação | dado clique em "Excluir" na linha da transação | remove o registro `TransacaoFinanceira` permanentemente |
| RF-011 | Exibe estado vazio | dado nenhuma transação registrada | mensagem "Nenhuma transação registrada ainda." no lugar da tabela |
| RF-017 | Edita transação existente | dado clique em "Editar" na linha | abre `/transacoes/[id]/editar`; tipo não é editável, demais campos sim |
| RF-018 | Recalcula vencimento do aluno ao registrar pagamento | dado transação tipo "Receita" com `alunoId` preenchido | atualiza `Aluno.dataVencimento` para `data da transação + 30 dias` |

#### Regras de negócio
- **RN-004:** `valor` é armazenado como `Decimal(10,2)` — nunca `Float` — para evitar erro de arredondamento com dinheiro
- **RN-005:** `tipo` aceita apenas "Receita" ou "Despesa" (imposto pelo `<select>` da UI; sem `enum` no schema — validação é só de interface, não de banco)
- **RN-006:** Transação sem aluno vinculado (`alunoId = null`) exibe "—" na coluna Aluno da listagem

---

### Módulo 3 — Despesas

Registro de gastos operacionais categorizados (aluguel, salário, equipamento etc.), separado das transações vinculadas a alunos, com suporte a recorrência.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-019 | Lista despesas | dado acesso a `/despesas` | tabela com data, categoria, descrição, valor, recorrência, ordenada por data decrescente |
| RF-020 | Cadastra despesa | dado categoria, descrição, valor e data preenchidos | persiste `Despesa` |
| RF-021 | Gera ocorrências recorrentes automaticamente | dado checkbox "recorrente" marcado + frequência selecionada | cria a ocorrência atual + as próximas 11 (12 no total), todas com o mesmo `grupoRecorrenciaId` |
| RF-022 | Edita uma ocorrência | dado clique em "Editar" | altera só aquele registro — não recalcula as demais ocorrências do grupo |
| RF-023 | Exclui despesa | dado clique em "Excluir" | remove o registro permanentemente |

#### Regras de negócio
- **RN-008:** Frequências suportadas: Semanal (+7 dias), Mensal (+1 mês), Anual (+1 ano)
- **RN-009:** `Despesa` não tem FK com `Aluno` nem `TransacaoFinanceira` — é uma entidade isolada

---

### Módulo 4 — Cadastro público e pré-cadastros

Auto-cadastro via link público, com fila de aprovação manual antes de virar `Aluno`.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-024 | Recebe auto-cadastro público | dado acesso a `/matricule-se` (sem login) e envio do formulário (nome + telefone obrigatórios; modalidade de interesse, idade, data de nascimento, e-mail, cidade, lesões opcionais) | cria `PreCadastro` com `status="Pendente"`, mostra tela de sucesso |
| RF-025 | Lista pré-cadastros pendentes | dado acesso a `/pre-cadastros` (autenticado) | tabela com nome, telefone, cidade, data de recebimento |
| RF-026 | Aprova pré-cadastro | dado clique em "Aprovar" | redireciona pra `/alunos?preCadastroId=<id>`, pré-preenchendo o formulário de novo aluno |
| RF-027 | Rejeita pré-cadastro | dado clique em "Rejeitar" | marca `status="Rejeitado"`, sai da listagem de pendentes |

---

### Módulo 5 — Dashboard e alertas

Visão consolidada (saldo, ranking, faixa etária) e sino de notificação para ação proativa.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-028 | Exibe dashboard na home | dado acesso a `/` (autenticado) | cards de total de alunos, saldo financeiro, alunos vencendo em 3 dias |
| RF-029 | Calcula saldo consolidado | dado todas as receitas/despesas | Receitas de `TransacaoFinanceira` − Despesas de `TransacaoFinanceira` − todas as `Despesa` |
| RF-030 | Exibe ranking de modalidades | dado alunos cadastrados | barra de progresso por modalidade, ordenada por quantidade de alunos |
| RF-031 | Exibe distribuição por faixa etária | dado alunos com `dataNascimento` preenchida | barra de progresso por faixa (até 12, 13-17, 18-25, 26-35, 36-45, 46+) |
| RF-032 | Alerta matrículas vencendo ou já vencidas | dado aluno com `dataVencimento` no passado (inadimplente) ou até 3 dias no futuro (vencendo) | aparecem em duas seções separadas no sino ("Alunos inadimplentes" e "Vencendo em até 3 dias"), com botão de cobrança via WhatsApp |
| RF-033 | Alerta pré-cadastros pendentes | dado `PreCadastro` com `status="Pendente"` | contagem no sino de notificação e badge no item de menu "Pré-cadastros" |
| RF-044 (2026-07-29) | Marca alertas como lidos | dado clique em "Marcar como lida" no sino | grava `Usuario.alertasLidosEm = agora`; o contador do sino zera, mas os itens continuam visíveis na lista |
| RF-045 (2026-07-29) | Exibe indicador de alerta novo | dado item cujo instante de gatilho é posterior a `alertasLidosEm` | ponto indicador ao lado do item na lista do sino |
| RF-046 (2026-07-29) | Exibe contadores de pendência no dashboard | dado acesso a `/` (autenticado) | cards clicáveis "Novas matrículas" e "Pré-cadastros", cada um linkando pra respectiva tela |

#### Regras de negócio
- **RN-010:** O sino de notificação é calculado ao vivo a cada carregamento de página autenticada — não há tabela de notificações persistente, mas desde 2026-07-29 há estado de "lido" por admin (`Usuario.alertasLidosEm`, um timestamp só — não é lida/não-lida por item individual)
- **RN-018 (2026-07-29):** O instante de gatilho ("quando esse alerta nasceu") é específico por categoria: pré-cadastro/matrícula = `criadoEm`; vencendo em 3 dias = `dataVencimento - 3 dias`; inadimplente = o próprio `dataVencimento`. Um item é "novo" se esse instante for posterior a `alertasLidosEm`
- **RN-019 (2026-07-29):** Os badges de contagem nos itens de menu da sidebar ("Novas Matrículas", "Pré-cadastros") são sempre a contagem total absoluta — só o sino usa o conceito de lido/não-lido

---

### Módulo 6 — Agenda de Aulas (2026-07-22/23, expandido 2026-07-29)

Grade semanal de horários por modalidade, compartilhada entre a tela do Sandro (admin) e a Área do Aluno, com roster real de alunos por horário.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-034 | Exibe grade semanal de horários | dado acesso a `/agenda` (admin) ou `/aluno` (aluno) | tabela modalidade × dia da semana (Segunda a Sábado), célula com os horários daquele slot |
| RF-035 | Calcula vagas disponíveis por horário | dado `AgendaAula.capacidadeMax` e roster real (alunos da modalidade principal + `Matricula` extra) naquele slot | horário exibido em dourado (tem vaga) ou vermelho (lotado); `title` do badge mostra "N vaga(s) de M" |
| RF-036 (2026-07-29) | Exibe lista de alunos por horário (admin) | dado clique no indicador "N aluno(s)" numa célula de `/agenda` | expande (`<details>`) a lista de nomes; alunos com matrícula extra ainda não confirmada aparecem com aviso "(pagamento pendente)" |
| RF-047 (2026-07-29) | Mostra só os horários confirmados na agenda pessoal do aluno | dado acesso a `/aluno` | linha inteira da modalidade principal + só as células específicas de modalidades extras cuja `Matricula` já teve o pagamento confirmado pelo admin |

#### Regras de negócio
- **RN-011:** A mesma consulta (`getAgendaGrade`) e o mesmo componente (`AgendaGrid`) são usados nas duas telas. Desde 2026-07-29, `/aluno` usa `getMeusHorarios` (que filtra em cima de `getAgendaGrade`), enquanto `/agenda` (admin) mostra a grade completa com roster
- **RN-012 (revisado 2026-07-29):** A modalidade principal (`Aluno.modalidade`) dá acesso implícito a todos os horários dela, sem precisar de registro de matrícula. Horários de modalidades **extras** exigem um registro em `Matricula` (ver Módulo 8) — `PresencaDiaria` (registro de presença numa data específica) segue sem nenhum fluxo que a crie

---

### Módulo 7 — Área do Aluno / Financeiro do aluno (2026-07-23, reescrito 2026-07-29)

Self-service do aluno: ver sua agenda, parcelas dos próximos 12 meses e anexar comprovante de pagamento por cobrança específica.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-037 | Autentica aluno e vincula à sua conta | dado `Usuario.alunoId` preenchido | `/aluno` carrega o `Aluno` correspondente; sem `alunoId`, redireciona pra `/login` |
| RF-038 | Exibe menu lateral da Área do Aluno | dado aluno autenticado | sidebar com "Agenda" (tela inicial), "Matrícula" (2026-07-29) e "Financeiro", drawer colapsável em mobile |
| RF-039 | Exibe status financeiro do aluno | dado acesso a `/aluno/financeiro` | badge de status de mensalidade (`statusPagamentoEfetivo`), data de vencimento com contagem de dias, chave PIX do CT (`PIX_KEY_CT`) |
| RF-040 (reescrito 2026-07-29) | Permite anexar comprovante de pagamento por cobrança | dado envio de arquivo (imagem ou PDF) numa cobrança específica sem comprovante | salva o arquivo em `public/comprovantes/`, atualiza `comprovanteUrl`/`comprovanteEnviadoEm` **daquela transação** (não mais "a mais recente do aluno") |
| RF-048 (2026-07-29) | Exibe parcelas dos próximos 12 meses | dado acesso a `/aluno/financeiro` | tabela com 12 linhas, uma por mês, a partir do mês da matrícula — cada linha com status (Paga / Aguardando confirmação / Pendente / A vencer / Não paga) e valor, se houver cobrança registrada naquele mês |
| RF-049 (2026-07-29) | Separa cobranças de modalidade extra das parcelas mensais | dado o aluno ter `TransacaoFinanceira` vinculada a uma `Matricula` | aparece numa seção à parte ("Outras cobranças"), fora da janela de 12 meses |
| RF-069 (2026-07-31) | Exibe confirmação de pagamento pro aluno | dado admin clicou "Confirmar pagamento" numa cobrança extra (`confirmadoEm` preenchido) | badge de sucesso "Pagamento confirmado" no lugar do link "comprovante enviado" — antes disso o aluno não tinha como saber, pela própria tela, se o comprovante já tinha sido revisado |
| RF-070 (2026-07-31) | Exibe o valor calculado da mensalidade | dado acesso a `/aluno/financeiro` | mostra "Valor da mensalidade" já com override individual (`Aluno.mensalidadeValor`) e/ou desconto de pacote aplicados (`valorEfetivoAluno`) — valor sempre correto, independente do que já foi lançado manualmente em `TransacaoFinanceira` |
| RF-071 (2026-07-31) | Consolida financeiro da família no login do titular | dado o aluno logado ser o `titular` de um `PacoteMembro` do tipo `FAMILIA` | `/aluno/financeiro` lista a mensalidade, vencimento e cobranças (com upload de comprovante) de **todos** os integrantes do pacote, não só do titular — cada um com o próprio valor calculado |

#### Regras de negócio
- **RN-013:** `PIX_KEY_CT` (env var) sem valor real definido ainda — enquanto vazia, a tela exibe "Chave ainda não configurada — fale com a recepção" em vez de quebrar
- **RN-014:** Upload de comprovante grava no filesystem local do servidor (`public/comprovantes/`) — **não sobrevive a um deploy serverless/efêmero** (ex: Vercel); revisitar armazenamento (S3, Supabase Storage etc.) antes de produção. Desde 2026-07-29, o arquivo **expira e é apagado automaticamente 10 dias** após o envio (ver Módulo 9) — reduz o problema de espaço, mas não resolve a durabilidade em deploy efêmero
- **RN-015 (revisado 2026-07-29):** Desde a correção do gap de `role` (2026-07-28), `/aluno` exige `role=ALUNO` — uma conta `ADMIN` não acessa mais a Área do Aluno mesmo que tenha `alunoId` preenchido por engano
- **RN-020 (2026-07-29):** A janela de parcelas é **fixa** (mês da matrícula + 11 meses seguintes, sempre os mesmos 12), não uma janela móvel "próximos 12 meses a partir de hoje"
- **RN-032 (2026-07-31):** Hierarquia do valor calculado (`valorEfetivoAluno`, `src/lib/precos.ts`): base = `Aluno.mensalidadeValor` (se definido) senão `ModalidadePreco[modalidade]`; se o aluno tem `PacoteMembro`, o desconto aplica só sobre a base (pacote `FAMILIA`) ou sobre base + soma das modalidades extras matriculadas (pacote `COMBO_MODALIDADES`) — sem pacote, o valor calculado é só a base, sem desconto
- **RN-033 (2026-07-31):** Integrante não-titular de um pacote `FAMILIA` **não precisa ter `Usuario` próprio** — é o titular que anexa comprovante em nome dele (`anexarComprovante` aceita `alunoId` de qualquer integrante do mesmo pacote, não só o da sessão logada)

---

### Módulo 8 — Matrícula em modalidade extra (2026-07-29)

Aluno já matriculado se inscreve numa modalidade além da principal, com pagamento manual via modal tipo PDV.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-050 | Exibe horários de outras modalidades | dado acesso a `/aluno/matricula` | grade com todas as modalidades exceto a principal do aluno, cada célula mostrando vagas e se ele já está matriculado ali |
| RF-051 | Abre modal de confirmação ao matricular | dado clique em "Matricular-se" numa célula disponível | modal mostra modalidade, horário, valor (`ModalidadePreco`) e seletor de forma de pagamento (PIX/Dinheiro/Cartão) |
| RF-052 | Confirma matrícula e gera cobrança | dado clique em "Confirmar pagamento" no modal | cria `Matricula` + `TransacaoFinanceira` vinculada, numa transação atômica; horário lotado ou já matriculado retorna erro sem criar nada |
| RF-053 | Permite cancelar matrícula extra | dado clique em "Cancelar" numa modalidade já matriculada | remove o registro `Matricula`; a `TransacaoFinanceira` já gerada permanece (só perde o vínculo) |

#### Regras de negócio
- **RN-021:** Uma pessoa que ainda não é aluna continua indo pra fila de `PreCadastro` via `/matricule-se` — esse fluxo não muda; a matrícula extra com pagamento é exclusiva de quem já é `Aluno`
- **RN-022:** Capacidade (`AgendaAula.capacidadeMax`) é checada contra o roster real (alunos da modalidade principal + `Matricula`), não contra `PresencaDiaria`

---

### Módulo 9 — Confirmação de pagamento e retenção de comprovante (2026-07-29)

Revisão manual do Sandro sobre comprovantes enviados, e limpeza automática de arquivos antigos.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-054 | Lista matrículas extras aguardando confirmação | dado acesso a `/matriculas` ("Novas Matrículas") | tabela com aluno, horário, forma de pagamento, valor e status do comprovante; some da lista assim que confirmada |
| RF-055 | Confirma pagamento manualmente | dado clique em "Confirmar pagamento" (em `/matriculas` ou `/transacoes`) | grava `confirmadoEm`; se a transação é Receita vinculada a aluno, atualiza `Aluno.statusPagamento` para "Em dia" |
| RF-056 | Apaga comprovantes vencidos | dado comprovante com `comprovanteEnviadoEm` há mais de 10 dias | remove o arquivo do disco e limpa `comprovanteUrl`/`comprovanteEnviadoEm` — roda ao abrir `/matriculas` ou `/transacoes` (sem cron configurado no ambiente) |

#### Regras de negócio
- **RN-023:** Não existe validação automática de autenticidade do comprovante (é uma imagem/PDF enviado pelo aluno) — a confirmação é sempre uma decisão manual do Sandro, depois de olhar o arquivo
- **RN-024:** Existe uma rota (`GET /api/cron/limpar-comprovantes`) pronta pra quem quiser agendar a limpeza de verdade num cron externo (Vercel Cron, cron de sistema) — sem isso configurado, a limpeza só roda de forma reativa quando as telas relevantes são abertas

---

### Módulo 10 — Preço por modalidade (2026-07-29)

Configuração do valor cobrado quando um aluno se matricula numa modalidade extra.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-057 | Configura preço por modalidade | dado acesso a Configurações → Agenda (admin; até 2026-07-30 era em `/agenda`), card "Preços por modalidade" | um campo de valor por modalidade cadastrada; salvar atualiza `ModalidadePreco` (upsert) |

#### Regras de negócio
- **RN-025:** Preço default é `0` até o admin configurar — matrícula extra continua funcionando (gera cobrança de R$0) enquanto o valor real não é definido

---

### Módulo 11 — Configurações do perfil (admin) e contas fixas de suporte (2026-07-30, abas + PIX desde 2026-07-30)

Tela pro Sandro editar os próprios dados de contato (com abas — Perfil / Agenda, desde a mesma sessão), e duas contas de acesso fixas (senha sempre igual) reservadas pra teste/suporte técnico.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-058 | Edita perfil do admin | dado acesso a `/configuracoes?aba=perfil` (role `ADMIN`), preenchendo nome/e-mail/telefone/**PIX** e salvando | atualiza `Usuario.nome`/`email`/`telefone`/`pix`; e-mail duplicado mostra erro amigável em vez de falhar sem explicação |
| RF-059 | Disponibiliza contas fixas de suporte | dado login com `devaluno` ou `devmaster` (senha `dev1807194`) | acesso ao portal do aluno (`devaluno`, `role=ALUNO`) ou à área administrativa completa (`devmaster`, `role=ADMIN`), sem depender de senha alterada por terceiros |
| RF-060 | Impede exclusão das contas fixas | dado tentativa de excluir o aluno vinculado ao `devaluno`, ou revogar seu acesso, pela UI de `/alunos` | operação bloqueada com mensagem de erro, nada é excluído |
| RF-061 | Mostra a chave PIX cadastrada pro aluno | dado acesso do aluno a `/aluno/financeiro` | exibe `Usuario.pix` do admin identificado por `ADMIN_USERNAME` (não de qualquer conta `role=ADMIN`); se vazio, mostra aviso pra falar com a recepção |

#### Regras de negócio
- **RN-026:** `devaluno`/`devmaster` são recriadas/reforçadas a cada `npm run db:seed` (senha sempre `dev1807194`) — mesmo num banco recriado do zero, essas duas contas voltam a existir
- **RN-027:** O fluxo de recuperação de senha (`/esqueci-senha` → `/resetar-senha`, existente desde 2026-07-12) já cobre tanto aluno quanto admin definindo a própria senha — nenhuma mudança foi necessária nele para este módulo
- **RN-028:** O PIX exibido pro aluno vem sempre da conta identificada pelo `username` em `ADMIN_USERNAME` (env var) — se `devmaster` cadastrar um PIX diferente no próprio perfil, isso não afeta o que o aluno vê

---

### Módulo 12 — Gestão de Agenda: horários/aulas, horário de almoço, bloqueios pontuais (2026-07-30, migrado pra Configurações → Agenda na mesma sessão)

Ferramentas administrativas pra manter a grade de horários sem precisar de script — antes só existia via `prisma/seed-agenda.ts`. Vive em `/configuracoes?aba=agenda` (migrado de `/agenda`, que virou só visualização, na mesma sessão em que foi criado).

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-062 | Cria horário de aula | dado acesso a Configurações → Agenda, preenchendo modalidade/dia/hora/capacidade | cria `AgendaAula`; rejeita se o horário cair dentro do intervalo de almoço configurado |
| RF-063 | Edita capacidade de um horário | dado ajuste do campo capacidade numa linha da tabela de horários | atualiza só `AgendaAula.capacidadeMax` |
| RF-064 | Exclui horário de aula | dado clique em excluir numa linha da tabela | remove `AgendaAula`; **bloqueado** com mensagem amigável se existir `Matricula`/`PresencaDiaria` vinculada (violação de FK) |
| RF-065 | Configura horário de almoço | dado preenchimento de início/fim e salvar | upsert em `ConfiguracaoAgenda` (linha singleton); único horário pra toda a academia (não varia por modalidade/dia) |
| RF-066 | Cria bloqueio pontual | dado preenchimento de data + hora início/fim + motivo opcional | cria `BloqueioAgenda`; aparece na lista de gestão e, se dentro de 14 dias, no banner de aviso em `/aluno` |
| RF-067 | Exclui bloqueio pontual | dado clique em excluir na lista de bloqueios | remove `BloqueioAgenda` das duas telas |

#### Regras de negócio
- **RN-029:** Bloqueio pontual é sempre por **data específica do calendário**, nunca recorrente por dia da semana — decisão confirmada com o usuário antes de implementar
- **RN-030:** Bloqueio pontual **não cancela** `Matricula`/`PresencaDiaria` automaticamente — o sistema não tem conceito de "aula do dia X" (só grade semanal recorrente), então isso não existe pra nenhuma aula, bloqueada ou não. O valor é avisar, não impedir tecnicamente
- **RN-031:** Toda mudança feita em Configurações → Agenda revalida `/aluno` e `/aluno/matricula` além de `/agenda`/`/configuracoes` — reflexo automático pro aluno, sem precisar de ação manual extra

---

### Módulo 13 — Gestão de Preços e Pacotes (2026-07-31)

Preço individual por aluno e pacotes com desconto (família ou combo de modalidades), configuráveis pelo admin com autonomia total. Vive na nova aba "Preços" de `/configuracoes` (`?aba=precos`), ao lado de Perfil e Agenda.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-072 | Define valor individual (override) por aluno | dado admin preenche "Valor mensal" na linha do aluno, na tabela da aba Preços | atualiza `Aluno.mensalidadeValor`; campo vazio volta a usar o preço padrão da modalidade |
| RF-073 | Cria pacote | dado admin escolhe tipo (`FAMILIA` ou `COMBO_MODALIDADES`), nome, e os alunos + % de desconto de cada um | cria `Pacote` + um `PacoteMembro` por aluno selecionado; em `FAMILIA`, um dos selecionados é marcado `titular` |
| RF-074 | Edita desconto de um integrante | dado ajuste do campo % na linha do integrante, dentro do card do pacote | atualiza só `PacoteMembro.descontoPercentual` daquele integrante |
| RF-075 | Troca o titular de um pacote família | dado clique em "tornar titular" na linha de outro integrante | zera `titular` de todos os integrantes do pacote e marca `true` só no escolhido |
| RF-076 | Remove integrante ou exclui pacote | dado clique em excluir (integrante ou pacote inteiro) | remove o `PacoteMembro` (e o `Pacote`, se ficar sem nenhum integrante) ou o `Pacote` inteiro (cascade) |
| RF-077 | Vincula aluno a um pacote direto no cadastro/edição | dado seleção de um pacote existente + % de desconto no formulário de `/alunos/novo` ou `/alunos/[id]/editar` | cria ou atualiza o `PacoteMembro` daquele aluno; selecionar "Nenhum" remove o vínculo existente |

#### Regras de negócio
- **RN-034:** Um aluno só pode pertencer a **1 pacote por vez** (`PacoteMembro.alunoId` `@unique`) — vincular a um novo pacote (pela aba Preços ou pelo form do aluno) substitui o vínculo anterior, não soma
- **RN-035:** Não há mínimo de integrantes imposto pelo schema — a UI de criação orienta pra 2+ em pacotes `FAMILIA`, mas tecnicamente aceita 1. Pacotes `COMBO_MODALIDADES` são sempre de 1 aluno só, por definição
- **RN-036:** "1 login por família" é uma convenção reforçada na UI, não uma restrição de banco — `/alunos/[id]/editar` mostra um aviso (não bloqueia) quando o aluno é integrante não-titular de um pacote família, indicando quem é o titular do login

---

### Módulo 14 — Autocadastro de aluno ativo (2026-07-31)

Link público diferente do `/matricule-se` (fila de pré-cadastro pra quem ainda não é aluno): pra quem já treina na academia mas ainda não está no sistema, com entrada direta na base e acesso ao portal liberado no mesmo fluxo.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-078 | Recebe autocadastro de aluno ativo | dado acesso a `/cadastro-aluno` (sem login) e envio do formulário (nome, telefone, e-mail e modalidade obrigatórios; faixa/graduação, horário de referência, nascimento, cidade, lesões opcionais) | cria `Aluno` direto (`statusPagamento="Pendente"`, `dataVencimento` calculada), sem passar por fila de aprovação |
| RF-079 | Libera acesso ao portal automaticamente | dado `Aluno` criado com sucesso pelo autocadastro | cria `Usuario` (`role=ALUNO`) vinculado no mesmo fluxo, gera link de definição de senha e mostra na própria tela de sucesso (botão "Definir minha senha") |
| RF-080 | Trata e-mail já cadastrado | dado o e-mail informado já pertencer a outro `Usuario` | não cria o `Usuario` (o `Aluno` já criado permanece, sem acesso), mostra mensagem orientando a usar "Esqueci minha senha" ou falar com a recepção |

#### Regras de negócio
- **RN-037:** `/cadastro-aluno` é intencionalmente separado de `/matricule-se` — este continua sendo só pré-cadastro (fila de aprovação manual) pra quem ainda não é aluno; aquele cria `Aluno` de verdade na hora, sem aprovação, pra quem já treina
- **RN-038:** O link de `/cadastro-aluno` não é divulgado automaticamente pra ninguém — aparece só pro admin, num card copiável no topo de `/alunos`, pra ele decidir com quem compartilhar

---

## Requisitos não funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-001 | Persistência | Dados armazenados em PostgreSQL (Supabase), acessados via Prisma 7 com driver adapter `pg` |
| RNF-002 | Consistência de dados | Valores monetários usam `Decimal(10,2)` em todo o schema — nunca `Float` |
| RNF-003 | Segurança | Autenticação implementada via NextAuth v5 (login por username, sessão JWT) — `/`, `/alunos`, `/transacoes`, `/despesas`, `/pre-cadastros`, `/agenda`, `/matriculas`, `/configuracoes` (2026-07-30) e `/aluno` exigem sessão válida via `src/proxy.ts`. `/matricule-se`, `/cadastro-aluno` (2026-07-31), `/login`, `/esqueci-senha`, `/resetar-senha` são públicas. **Checagem de `role` implementada em 2026-07-28** — rotas administrativas exigem `role=ADMIN`, `/aluno` exige `role=ALUNO`, com redirecionamento cruzado (não erro) quando a `role` não bate. **Atenção:** a proteção real depende do array `matcher` em `src/proxy.ts` estar sincronizado com `ADMIN_PATHS`/`ALUNO_PATHS` em `src/auth.ts` — rota fora do `matcher` fica pública mesmo que listada em `ADMIN_PATHS` (bug real cometido e corrigido em 2026-07-30) |
| RNF-004 | Ambiente | Aplicação roda em Next.js 16 (App Router + Turbopack), sem deploy em produção até o momento |
| RNF-005 | Integração externa | Cobrança via WhatsApp usa link `wa.me` simples (sem API paga) — nenhuma integração de envio automatizado de mensagens |

---

## Estados e transições

| Entidade | Estados possíveis | Transições válidas | O que dispara |
|---|---|---|---|
| Aluno (`statusPagamento`) | "Em dia", "Pendente", "Atrasado" | qualquer → qualquer | edição manual via `/alunos/[id]/editar` |
| Aluno (`dataVencimento`) | qualquer data futura/passada | avança em +30 dias | criação do aluno, ou Receita vinculada registrada em `/transacoes` |
| TransacaoFinanceira (`tipo`) | "Receita", "Despesa" | fixo na criação | definido no cadastro, sem edição posterior |
| PreCadastro (`status`) | "Pendente", "Aprovado", "Rejeitado" | "Pendente" → "Aprovado" ou "Rejeitado" (única transição, sem volta) | aprovação (via criação do Aluno) ou rejeição manual |

---

## Critérios de aceite gerais

- [x] Sandro cadastra um aluno com nome, modalidade, faixa e status de pagamento, e ele aparece na listagem
- [x] Sandro registra uma transação (receita ou despesa) e o saldo é recalculado corretamente
- [x] Transação pode ser vinculada a um aluno existente ou ficar sem vínculo
- [x] Exclusão de aluno ou transação remove o registro da listagem imediatamente
- [x] Sandro edita um aluno ou transação já cadastrados
- [x] Sistema exige login antes de exibir qualquer dado
- [x] Aluno tem vencimento de matrícula calculado automaticamente e recalculado a cada pagamento
- [x] Pessoa interessada se auto-cadastra via link público, sem entrar direto na base de alunos
- [x] Rotas administrativas e Área do Aluno restritas por `role` (ADMIN vs. ALUNO) — 2026-07-28
- [x] Aluno se matricula numa modalidade extra, paga via modal, e ela só aparece na agenda dele depois de confirmada pelo admin — 2026-07-29
- [x] Aluno vê parcelas dos próximos 12 meses a partir da matrícula, com status por mês — 2026-07-29
- [x] Comprovante enviado expira e é removido do disco 10 dias depois — 2026-07-29
- [x] Sino de notificação com marcar-como-lido e 4 categorias (inadimplentes, vencendo D+3, pré-cadastros, novas matrículas) — 2026-07-29
- [x] Admin edita o vencimento de um aluno diretamente, sem depender de um novo pagamento registrado — 2026-07-31
- [x] Aluno vê "Pagamento confirmado" numa cobrança extra depois que o admin confirma — 2026-07-31
- [x] Admin cria pacote (família ou combo de modalidades), define desconto por integrante, e o valor calculado aparece correto pro aluno em `/aluno/financeiro` — 2026-07-31
- [x] Titular de um pacote família vê e gerencia (upload de comprovante incluso) a mensalidade de todos os integrantes no próprio login — 2026-07-31
- [x] Aluno ativo se autocadastra via `/cadastro-aluno` e já recebe acesso ao portal, sem passar por fila de aprovação — 2026-07-31
- [ ] Fluxo completo do módulo financeiro (item 11 do backlog) testado manualmente em navegador real — pendente, usuário optou por testar por conta própria
