---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-08-03
owner: willians
---

# Índice — Academia Prof. Sandro

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/arquitetura-academiasandro/` com sufixo `-academiasandro`.

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-academiasandro]] | As 6 perguntas respondidas antes da criação do sistema — threshold aprovado informalmente (MVP em construção) |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-academiasandro]] | @pm | Contexto, problema, objetivo, usuário, hipótese, escopo e métricas do sistema de gestão de alunos e financeiro |
| [[requisitos-funcionais-academiasandro]] | @pm | 80 RFs em 14 módulos: Alunos (com vencimento editável), Transações Financeiras, Despesas, Cadastro público/Pré-cadastros, Dashboard/Alertas, Agenda de Aulas, Área do Aluno/Financeiro (com confirmação de pagamento visível e valor calculado), Matrícula em modalidade extra, Confirmação de pagamento/retenção de comprovante, Preço por modalidade, Configurações do perfil (admin, com PIX) e contas fixas de suporte, Gestão de Agenda (horários/aulas, almoço, bloqueios pontuais), Gestão de Preços e Pacotes (override individual, família/combo de modalidades, "1 login por família"), Autocadastro de aluno ativo |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-academiasandro]] | @architect | Stack (Next.js 16 + Prisma 7 + PostgreSQL/Supabase + driver adapter `pg`), camadas (incl. `AppShell`/`AlunoShell`/`MatricularAcaoCelula`/`CriarPacoteForm`/`CopiarLink`/`WhatsappConexao`/`TermosAceite`/route groups `(app)` e `aluno/`/`proxy.ts`, rotas públicas `/cadastro-aluno` e `/pre-cadastros/[id]` desde 2026-08-03), fluxo de dados, integração real de WhatsApp via Evolution API (`src/lib/whatsapp-gateway.ts`, 2026-08-03), segurança (autenticação **com checagem de `role` desde 2026-07-28**, `matcher`/`ADMIN_PATHS` sincronizados desde 2026-07-30, senha do Supabase reincidente exposta — inclusive em `.claude/settings.local.json`, 2026-08-03 — segue sem rotacionar de fato, contas fixas de suporte, retenção de comprovante de 10 dias, "1 login por família" não é mudança de auth — só consulta cruzada em `/aluno/financeiro`), gestão de agenda (horários/almoço/bloqueios, migrada pra Configurações → Agenda) e de preços/pacotes (`precos-actions.ts`, pacotes Combo em catálogo desde 2026-08-03), controle de versão (GitHub público, risco do monorepo com `orbita-lobo`, lacuna de meses sem commit fechada em 2026-08-03 via `aiox-devops`, único agente autorizado a `git push` neste workspace) e pendências de escala |
| [[modelo-de-dados-academiasandro]] | @data-engineer | Entidades `Aluno` (com `mensalidadeValor` desde 2026-07-31), `TransacaoFinanceira` (`matriculaId` deixou de ser `@unique` em 2026-08-03 — 1:N com `Matricula`, não mais 1:0..1), `Despesa`, `PreCadastro` (com `dataAulaExperimental`/`termosAceitos` desde 2026-08-03), `Usuario` (com `role` checado, `alertasLidosEm`, `telefone`/`pix` desde 2026-07-30), `AgendaAula` (CRUD via UI desde 2026-07-30), `PresencaDiaria`, `Matricula` (com `dataVencimentoBase` — ciclo de parcelas próprio, 2026-08-03), `ModalidadePreco`, `ConfiguracaoAgenda`/`BloqueioAgenda` (2026-07-30), `Pacote` (com `descontoPadrao` pra catálogo Combo, 2026-08-03) /`PacoteMembro` (2026-07-31 — tipos `FAMILIA`/`COMBO_MODALIDADES`) — relacionamentos, ciclo de vencimento de matrícula (agora também editável direto, por modalidade), parcelas de 12 meses generalizadas (`getParcelasCiclo`), processo de migração manual neste ambiente (17 migrações confirmadas, nem todas exigindo o workaround) |

---

## Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente | O que cobre |
|---|---|---|
| [[design-system-academiasandro]] | @ux-design-expert | Princípios de design, tokens de cor/tipografia reais de `globals.css` (incl. paleta onix/gold adaptada do sistema-thieco, fonte serifada Playfair Display), favicon, ícones temáticos e logos das modalidades no login |
| [[ui-kit-academiasandro]] | @ux-design-expert | Componentes extraídos (`AppShell`, `AlunoShell`, `NotificacaoSino`, `PageHeader`, `AgendaGrid`), templates das telas implementadas (admin + Área do Aluno) |

---

## Camada 4 — Funciona? (validação da experiência)

| Documento | Agente | O que cobre |
|---|---|---|
| [[ux-flows-academiasandro]] | @ux-design-expert | Jornadas de cadastro de aluno, registro de transação e uso da Área do Aluno (agenda + comprovante); pesquisa formal ainda não realizada |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-academiasandro]] | @pm / todos | 42 decisões cronológicas: schema inicial, correção do `.env`, `sslmode=no-verify`, migração aplicada, bug da senha com colchetes, driver adapter do Prisma 7, telas de Alunos/Transações, edição de registros, autenticação (NextAuth v5 + username), fix de fonte, sidebar/login (adaptado do sistema-thieco), módulo financeiro completo, dados fictícios + bug de saldo, polimento visual, primeiro commit + push pro GitHub (com incidente do `orbita-lobo`), redesign do login com logos, expansão do schema (Role/AgendaAula/PresencaDiaria), vínculo Usuario↔Aluno, Área do Aluno completa, Agenda compartilhada + grade real — e, em 2026-07-28/29: rotação de senha, correção do gap de `role`, grade reseedada do quadro físico, matrícula em modalidade extra com modal de pagamento, fluxo financeiro completo (confirmação/parcelas/expiração de comprovante), tela Novas Matrículas + filtros, sino com marcar-como-lido, e rebrand — e, em 2026-07-30: contas fixas de suporte (`devaluno`/`devmaster`), tela de Configurações do admin, correção do gap de autorização entre `matcher` (`proxy.ts`) e `ADMIN_PATHS` (`auth.ts`), gestão de horários/almoço/bloqueios na Agenda, e migração dessa gestão pra Configurações → Agenda + campo PIX no perfil — e, em 2026-07-31: correção de marca "Sandro Freire", Gestão de Preços e Pacotes (`FAMILIA`/`COMBO_MODALIDADES`, "1 login por família"), vencimento editável, confirmação de pagamento visível ao aluno, e autocadastro de aluno ativo (`/cadastro-aluno`) |
| [[backlog-tarefas-academiasandro]] | @pm / todos | 16 itens — 34 concluídos e 6 pendentes (checklist "Status do Backlog"): deploy/hospedagem, testes manuais em navegador, revisar armazenamento de comprovante, configurar cron real de expiração, apagar dados fictícios antes de produção, decidir se haverá confirmação de presença (check-in) |

---

## Ordem de leitura recomendada

```
system-creation-academiasandro
        ↓
   prd-academiasandro
        ↓
requisitos-funcionais-academiasandro
        ↓
arquitetura-academiasandro  ←→  design-system-academiasandro
        ↓                          ↓
modelo-de-dados-academiasandro   ui-kit-academiasandro
        ↓                          ↓
        └────── ux-flows-academiasandro ┘
                        ↓
        registro-de-decisoes-academiasandro (atualização contínua)
                        ↓
        backlog-tarefas-academiasandro (o que fazer a seguir)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-academiasandro  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-academiasandro  ←  regra de negócio alterada
  - arquitetura-academiasandro            ←  decisão técnica estrutural (ex: nova migration)
  - modelo-de-dados-academiasandro        ←  entidade ou campo alterado no schema Prisma
  - design-system-academiasandro          ←  cor semântica ou padrão visual alterado
```

Alterações sem impacto sistêmico (bugs cosméticos, ajustes de texto, linting) não precisam atualizar estes documentos.

---

## Próximos artefatos a criar (backlog de governança)

| Artefato | Quando criar |
|---|---|
| Nova entrada no `registro-de-decisoes-academiasandro` | a cada mudança de schema ou decisão técnica estrutural (mantido em dia até 2026-07-30) |
| Atualizar `design-system-academiasandro`/`ui-kit-academiasandro` | pendente — cobrir os componentes novos de 2026-07-29 (`MatricularAcaoCelula`, `SeletorModalidadeHorario`, `MatriculaGrid`, `NotificacaoSino` reescrito), o rebrand "Centro de Treinamento" com mais profundidade do que a nota já feita, e a tela `/configuracoes` de 2026-07-30 com abas (Perfil/Agenda) — sem componente novo, reaproveita `card-premium`/`input-dark` do login e o padrão de aba (`Link`+`searchParams`) já usado em `/alunos` |
| Atualizar `ux-flows-academiasandro` | pendente — cobrir os fluxos novos de 2026-07-29 (matricular-se em modalidade extra + pagar, anexar comprovante por parcela, marcar alertas como lidos) |
| Decidir e documentar fluxo de confirmação de presença (check-in) | se/quando o item ficar em aberto no backlog for retomado — `PresencaDiaria`/`StatusPresenca` seguem sem uso |
| Atualizar `requisitos-funcionais-academiasandro` | pendente — propagar as regras de negócio novas de 2026-08-03 (horário sempre obrigatório, termo LGPD obrigatório, ciclo de parcelas por modalidade extra, pacote Combo como catálogo autosserviço) pros RFs formais |

> **Nota (2026-07-23):** documentação inteira revisada e trazida em dia após ~11 dias de desenvolvimento não documentado (login redesenhado, schema expandido, Área do Aluno construída do zero, Agenda compartilhada com grade real). O item 15 (calendário do Sandro + Matrícula) foi registrado como **plano**, não como implementação.
>
> **Nota (2026-07-29):** item 15 implementado integralmente, junto com uma expansão grande de escopo pedida ao longo da sessão — fluxo financeiro completo (confirmação de pagamento, parcelas de 12 meses, expiração de comprovante), tela "Novas Matrículas", filtros em Alunos, sino com marcar-como-lido (4 categorias), correção do gap de `role` e rotação de senha (ambos pendências de segurança abertas desde 2026-07-23/10), e rebrand "Academia" → "Centro de Treinamento". `design-system`/`ui-kit`/`ux-flows` **não foram atualizados com o mesmo nível de detalhe** nesta rodada — próxima sessão de documentação.
>
> **Nota (2026-07-30):** contas fixas de suporte `devaluno`/`devmaster` (senha `dev1807194`, protegidas contra exclusão, garantidas pelo seed) criadas a partir do usuário de teste `pedro.lima`; `Usuario.telefone` (novo campo) e tela `/configuracoes` pro admin editar nome/e-mail/telefone; e um gap de autorização real encontrado e corrigido no mesmo processo — `/configuracoes` ficou acessível sem login até o `matcher` de `src/proxy.ts` ser sincronizado com `ADMIN_PATHS` de `src/auth.ts` (os dois precisam ser atualizados juntos pra qualquer rota admin nova, lição também registrada no Playbook DevOps do `kernel-hq`).
>
> **Nota (2026-07-30, continuação da mesma sessão):** dois pedidos em sequência depois do acima — (1) gestão completa de horários/aulas em `/agenda` (CRUD de `AgendaAula`, antes só via script), `ConfiguracaoAgenda` (horário de almoço único, valida criação) e `BloqueioAgenda` (bloqueio pontual por data, com banner de aviso em `/aluno`); (2) o usuário gostou do resultado e pediu pra migrar essa gestão inteira pra dentro de `/configuracoes` como aba "Agenda" (`?aba=perfil|agenda`), junto com um campo **PIX** no perfil (substitui a env var `PIX_KEY_CT`, morta desde então). `/agenda` virou só visualização. Todas as actions de agenda passaram a revalidar as rotas do aluno também — reflexo automático, sem passo manual, como pedido explicitamente.
>
> **Nota (2026-07-31):** sessão nova, cinco pedidos encadeados — (1) corrigir o nome "Sandro Ferreira" → "Sandro Freire" em toda a UI; (2) gestão de preços mais sofisticada: override de mensalidade por aluno individual + "Pacotes" com desconto, generalizados em dois tipos (`FAMILIA` — vários alunos, cada um com seu %; `COMBO_MODALIDADES` — 1 aluno com 2+ modalidades, desconto no valor total combinado), com a regra de "1 login por família" (só o titular do pacote família tem `Usuario`, e vê a mensalidade de todos os integrantes no próprio financeiro); (3) vencimento editável direto pelo admin; (4) confirmação de pagamento visível pro aluno em cobranças extras (antes só o admin via isso em `/transacoes`); (5) `/cadastro-aluno` — link público novo, distinto do `/matricule-se`, pra aluno **ativo** se cadastrar direto na base (sem fila de aprovação) e já sair com acesso ao portal liberado. Escopo do item (2) refinado com o usuário via pergunta antes de implementar (pacote genérico, não fixo em "família"; e o modelo de "1 login" só afeta consulta em `/aluno/financeiro`, não o schema de autenticação). Nova migração (`20260731011546_pacotes_preco_individual`) aplicada direto via `npx prisma migrate dev`, sem precisar do workaround manual. Testado ponta a ponta via HTTP real (login por credentials, autocadastro completo, pacote família de teste com valores calculados conferidos manualmente) — `design-system`/`ui-kit`/`ux-flows` **não foram atualizados com o mesmo nível de detalhe** nesta rodada (nenhum padrão visual novo foi introduzido — os 2 componentes novos, `CriarPacoteForm`/`CopiarLink`, só reaproveitam tokens já existentes).
>
> **Nota (2026-08-03):** sessão de 12 pedidos soltos numa mensagem só. Antes de implementar, descoberto que a VPS compartilhada já roda um gateway real de WhatsApp (Evolution API) usado por outros produtos da Holding — mudou o desenho dos 3 itens de "avisar por WhatsApp", que deixaram de ser link `wa.me` manual e viraram envio automático de verdade (`src/lib/whatsapp-gateway.ts`, novo). Resumo dos 12: ficha completa do pré-cadastro; username na mensagem de acesso; horário sempre obrigatório; financeiro com parcelas por modalidade (`Matricula.dataVencimentoBase`, `getParcelasCiclo`); badges de modalidade extra em `/alunos`; pacotes Combo em catálogo + Família isolado; bloqueio de agenda avisa o aluno; aula experimental avisa o admin; horário de almoço com default seguro; aba WhatsApp em Configurações; termo LGPD no pré-cadastro; despesas recorrentes (já existia). Migration única (`20260803191927_melhorias_agosto`). Dois bugs achados e corrigidos **durante o teste ao vivo** (não previstos no plano): datas formatadas sem `timeZone: "UTC"` aparecendo um dia a menos, e `valorEfetivoAluno` (função pré-existente) não somando modalidades extras no total pra aluno sem pacote. Na sequência da mesma sessão: usuário pediu commit + push — revelou meses de trabalho nunca commitado (fechado no commit `74e7f11`, push via `aiox-devops`) e um achado de segurança (senha real do Supabase em texto puro dentro de `.claude/settings.local.json`, excluída do commit). Depois, deploy guiado na VPS (achado: bug de cache do Turbopack corrompendo o dev server local, erro do usuário rodando `rsync` de dentro da sessão SSH da VPS em vez do terminal local) e geração de um manual de usuário em PDF pra entregar ao Sandro (`academia-sandro/Manual-do-Usuario-Sandro.pdf`, via `pdfkit` — Chromium headless não funciona neste ambiente sandbox). `design-system`/`ui-kit`/`ux-flows`/`requisitos-funcionais` **não foram atualizados nesta rodada** (nenhum padrão visual novo — os componentes novos reaproveitam tokens existentes; regras de negócio novas ainda não propagadas pros RFs formais).
>
> **Nota (2026-08-03, continuação):** WhatsApp pareado de verdade na VPS (rede `orbita_shared` + `EVOLUTION_API_KEY` + QR code escaneado) e **validado ao vivo** — primeira vez neste projeto que uma feature de WhatsApp é confirmada com mensagem realmente recebida no celular, não só `enviado: true`/HTTP 200. Teste revelou um bug real: aviso de aula experimental (item 8) falhou silenciosamente porque `Usuario.telefone` da conta `sandro` estava vazio — o código pula o envio sem logar nada quando esse campo está vazio (diferente do item 7, que já loga falha). Corrigido preenchendo o campo; reteste confirmou. A pedido do usuário (confuso com precisar "conectar em 2 abas diferentes"), adicionadas 2 melhorias de UX: texto explicando a diferença entre o campo Telefone do Perfil (pra onde chegam avisos) e o número pareado no WhatsApp (quem envia), e um botão de sincronização de 1 clique (`buscarNumeroConectado`/`sincronizarTelefonePerfilAction`, novos) que copia o número pareado pro campo Telefone. Limpeza de dados de teste no mesmo processo (2 pré-cadastros, 1 bloqueio de teste, o aluno "Aluno Teste Badges" inteiro). Commit `2b3be3a` + push via `aiox-devops` (2º push do dia, também fast-forward puro). Manual em PDF atualizado (16→17 páginas) com o diagnóstico real do bug encontrado.
>
> **Nota (2026-08-03, mais uma continuação):** cron real configurado pra `/api/cron/limpar-comprovantes` (`crontab` na VPS, `0 3 * * *` — a rota já existia desde 2026-07-29, só faltava agendar) e correção do "Valor total" do financeiro (`somaExtrasAluno` passou a somar por `Matricula`, não por nome de modalidade distinto — um aluno com 2 matrículas na mesma modalidade extra agora conta 2x, batendo com a cobrança real). Commit `71835cf`, 3º push da sessão via `aiox-devops`, mesmo fast-forward limpo dos dois anteriores.
