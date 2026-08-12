---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-08-12
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
| [[requisitos-funcionais-academiasandro]] | @pm | 94 RFs em 17 módulos: Alunos (com vencimento editável), Transações Financeiras, Despesas, Cadastro público/Pré-cadastros (com termo de responsabilidade por lesão, 2026-08-12), Dashboard/Alertas, Agenda de Aulas, Área do Aluno/Financeiro, Matrícula em modalidade extra, Confirmação de pagamento/retenção de comprovante, Preço por modalidade, Configurações do perfil e contas fixas, Gestão de Agenda, Gestão de Preços e Pacotes, Autocadastro de aluno ativo (com data de vencimento informada + trava de duplicidade por telefone, 2026-08-12) — e três módulos novos (2026-08-12): **WhatsApp automático via Evolution API** (acesso do aluno, cobrança/aniversário via cron, confirmação de aula experimental por link), **Cadastro multi-modalidade** (2026-08-03, documentado agora), **Pacotes Combo em catálogo + valor fixo** (2026-08-03 catálogo, 2026-08-12 valor fixo) |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-academiasandro]] | @architect | Stack (Next.js 16 + Prisma 7 + PostgreSQL/Supabase + driver adapter `pg`), camadas (incl. `AppShell`/`AlunoShell`/`MatricularAcaoCelula`/`CriarPacoteForm`/`CopiarLink`/`WhatsappConexao`/`TermosAceite`/`CampoSenha` (2026-08-12)/route groups `(app)` e `aluno/`/`proxy.ts`, rotas públicas `/cadastro-aluno`, `/pre-cadastros/[id]`, `/aula-experimental/confirmada` e `api/aula-experimental/[id]/confirmar`/`api/cron/{cobranca,aniversario}` (2026-08-12)), fluxo de dados, integração real de WhatsApp via Evolution API (`src/lib/whatsapp-gateway.ts`, 2026-08-03, **muito expandida em 2026-08-12** — acesso automático, cobrança/aniversário via cron, confirmação de aula), segurança (autenticação **com checagem de `role` desde 2026-07-28**, `matcher`/`ADMIN_PATHS` sincronizados desde 2026-07-30, `CRON_SECRET` novo (2026-08-12), senha do Supabase reincidente exposta segue sem rotacionar de fato, contas fixas de suporte, retenção de comprovante de 10 dias), gestão de agenda e de preços/pacotes (`precos-actions.ts`, pacotes Combo em catálogo desde 2026-08-03, **valor fixo desde 2026-08-12**), **controle de versão corrigido em 2026-08-12: projeto tem repositório próprio e privado (`academia-sandro.git`), não é mais subpasta do monorepo `zion-workspace`** — `git push` deixou de ser reservado a um agente específico neste projeto — e pendências de escala |
| [[modelo-de-dados-academiasandro]] | @data-engineer | Entidades `Aluno` (com `mensalidadeValor` desde 2026-07-31, `ultimoAvisoCobrancaEm`/`ultimoParabensEm` desde 2026-08-12), `TransacaoFinanceira` (`matriculaId` deixou de ser `@unique` em 2026-08-03), `Despesa`, `PreCadastro` (com `dataAulaExperimental`/`termosAceitos` desde 2026-08-03, `aulaConfirmada`/`aulaConfirmadaEm` desde 2026-08-12), `Usuario` (com `role` checado, `alertasLidosEm`, `telefone`/`pix` desde 2026-07-30), `AgendaAula` (CRUD via UI desde 2026-07-30), `PresencaDiaria`, `Matricula` (com `dataVencimentoBase`, 2026-08-03), `ModalidadePreco`, `ConfiguracaoAgenda`/`BloqueioAgenda` (2026-07-30), `Pacote` (com `descontoPadrao` pra catálogo Combo, 2026-08-03; `valor` fixo opcional, 2026-08-12) /`PacoteMembro` (2026-07-31) — relacionamentos, ciclo de vencimento, parcelas de 12 meses, processo de migração manual neste ambiente |

---

## Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente | O que cobre |
|---|---|---|
| [[design-system-academiasandro]] | @ux-design-expert | Princípios de design, tokens de cor/tipografia reais de `globals.css` (incl. paleta onix/gold adaptada do sistema-thieco, fonte serifada Playfair Display), favicon, ícones temáticos e logos das modalidades no login |
| [[ui-kit-academiasandro]] | @ux-design-expert | Componentes extraídos (`AppShell`, `AlunoShell`, `NotificacaoSino`, `PageHeader`, `AgendaGrid`, `CampoSenha` desde 2026-08-12), templates das telas implementadas — **lacuna conhecida:** inventário incompleto entre 2026-07-23 e 2026-08-12, vários componentes intermediários não listados |

---

## Camada 4 — Funciona? (validação da experiência)

| Documento | Agente | O que cobre |
|---|---|---|
| [[ux-flows-academiasandro]] | @ux-design-expert | Jornadas de cadastro de aluno, registro de transação, Área do Aluno, autocadastro (com data de vencimento + trava de duplicidade, 2026-08-12), e confirmação de aula experimental pelo WhatsApp (2026-08-12); pesquisa formal ainda não realizada |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-academiasandro]] | @pm / todos | 47 decisões cronológicas — do schema inicial e correção do `.env` até, em 2026-08-03: deploy em produção (VPS Hostinger + Docker + nginx compartilhado), 12 melhorias encadeadas (WhatsApp real, financeiro por modalidade, pacotes-catálogo, LGPD), commit fechando lacuna de histórico, WhatsApp validado ao vivo, cron de comprovante; e em 2026-08-12: descoberta de repositório próprio/privado (fim da governança de monorepo), valor fixo no pacote combo, WhatsApp automático (acesso/cobrança/aniversário/confirmação de aula), autocadastro com vencimento informado + trava de duplicidade (com tentativa de convite por token revertida), termo de aceite com cláusula de lesão, olhinho de senha |
| [[backlog-tarefas-academiasandro]] | @pm / todos | 23 itens — 21 concluídos (checklist: 54 concluídos / 14 pendentes): deploy/hospedagem, WhatsApp real + automações de 2026-08-12, revisar armazenamento de comprovante, testes manuais em navegador, decidir confirmação de presença (check-in), confirmar crontab novo e envio real de WhatsApp em produção, itens ainda não iniciados (foto de perfil, grupos de WhatsApp por modalidade, vídeo de fundo no login) |

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
| Nova entrada no `registro-de-decisoes-academiasandro` | a cada mudança de schema ou decisão técnica estrutural (mantido em dia até 2026-08-12) |
| Atualizar `ui-kit-academiasandro` (catch-up completo) | pendente — só o componente mais recente (`CampoSenha`, 2026-08-12) foi adicionado; componentes intermediários (`MatricularAcaoCelula`, `SeletorModalidadeHorario`, `CriarPacoteForm`, `CopiarLink`, `WhatsappConexao`, `TermosAceite`, etc., de 2026-07-29 a 2026-08-03) seguem sem entrada própria no inventário |
| Decidir e documentar fluxo de confirmação de presença (check-in) | se/quando o item ficar em aberto no backlog for retomado — `PresencaDiaria`/`StatusPresenca` seguem sem uso |
| Confirmar crontab novo (`api/cron/cobranca`, `api/cron/aniversario`) e envio real de WhatsApp em produção | pendente — passado ao usuário em 2026-08-12, sem confirmação de volta ainda |

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
>
> **Nota (2026-08-12):** sessão longa, ~10 melhorias encadeadas + deploy real na VPS. **Achado importante:** `git remote -v` revelou que o projeto tem repositório próprio e privado (`github.com/willianslegacy94-zion/academia-sandro.git`), não é mais subpasta do `zion-workspace` — a regra de "`git push` reservado ao `aiox-devops`" descrita nas notas acima **não se aplica mais a este projeto especificamente** (não confirmado se os outros sistemas da Holding passaram pela mesma migração). Nesta sessão, `git push origin main` foi feito 6 vezes direto, sem intermediação. Resumo das melhorias: `Pacote.valor` fixo pro combo (removendo o campo de desconto da criação); WhatsApp automático expandido — acesso do aluno (usuário+senha) no cadastro, cobrança de vencendo/atrasado via cron, aniversário via cron, confirmação de aula experimental por link (decisão explícita de não usar botões nativos do WhatsApp, instáveis nesse gateway); autocadastro com data de vencimento informada pelo aluno + trava de duplicidade por telefone (uma tentativa por convite/token individual foi implementada e revertida no meio da sessão, a pedido do próprio usuário depois de ver a mudança na tela); termo de aceite com cláusula de responsabilidade por lesão não informada; botão de mostrar/esconder senha (`CampoSenha.tsx`). Deploy real feito na VPS (rsync + build + migrate + up), todas as migrations já aplicadas em produção — pendente: confirmar as 2 linhas de crontab novas e o envio real de WhatsApp em produção. Todos os artefatos desta camada (`arquitetura`, `modelo-de-dados`, `requisitos-funcionais`, `ux-flows`, `backlog-tarefas`, `registro-de-decisoes`, Playbook DevOps, e um catch-up parcial do `ui-kit`) atualizados nesta mesma sessão, a pedido explícito do usuário ("atualize tudo") — `design-system`/`prd`/`system-creation` deixados de fora por não terem mudança factual a registrar.
