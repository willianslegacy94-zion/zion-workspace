---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-08-03
owner: willians
---

# BACKLOG DE DESENVOLVIMENTO — ACADEMIA PROF. SANDRO

Este arquivo documenta as tarefas pendentes acordadas para o sistema de gestão da **Centro de Treinamento Sandro Freire** (Next.js 16 + Prisma 7 + PostgreSQL/Supabase). Autenticação com controle por `role` (NextAuth v5, login por username), layout com sidebar, um módulo financeiro/cadastro completo (despesas, vencimento de matrícula editável, cobrança via WhatsApp, sino de notificação com marcar-como-lido, cadastro público, autocadastro de aluno ativo com múltiplas modalidades/faixa por modalidade), gestão de preços e pacotes (override individual, família/combo de modalidades com desconto), polimento visual (fonte serifada, cabeçalhos de página, favicon, ícones temáticos, rebrand "Centro de Treinamento" e correção de marca "Sandro Freire"), redesign do login com logos, expansão do schema (Role/AgendaAula/PresencaDiaria/Matricula/ModalidadePreco/Pacote/PacoteMembro/AlunoFaixaModalidade), a Área do Aluno completa (Agenda pessoal, Matrícula em modalidade extra, Financeiro com parcelas de 12 meses e visão consolidada de pacote família) e o Calendário do Sandro (roster por horário) já foram implementados — ver [[registro-de-decisoes-academiasandro]] para o histórico completo. Código versionado e publicado no GitHub desde 2026-07-12. **Em produção desde 2026-08-03** (`https://sandrofreiresf.online`, VPS Hostinger compartilhada + Docker + nginx do host). Rotação da senha do Supabase: estado incerto — um registro anterior (2026-07-28) afirma rotação feita, mas evidência de 2026-08-03 contradiz isso (ver [[registro-de-decisoes-academiasandro]]); usuário optou por manter a senha atual por ora.

---

## ✅ 1. Rotacionar senha do banco de dados (Supabase) — CONCLUÍDO (2026-07-28)

### 📌 Contexto
A senha real do Postgres apareceu em texto puro múltiplas vezes durante a depuração da conexão (`.env` originalmente quebrado, e novamente ao investigar o bug dos colchetes no placeholder da Supabase). Por segurança, a senha deve ser trocada mesmo já tendo sido corrigida no `.env`.

### 🛠️ Como foi implementado
- Nova senha gerada no painel da Supabase (Settings → Database → Reset Database Password), `DATABASE_URL`/`DIRECT_URL` atualizadas no `.env` mantendo o formato já validado
- Guiado sem que o Claude ecoasse a senha de volta em nenhuma resposta — usuário colou o valor novo diretamente, reduzindo o risco de reincidência do problema original (senha em texto puro na conversa)

---

## ✅ 2. Edição de Aluno e de Transação Financeira — CONCLUÍDO (2026-07-11)

### 📌 Contexto
O MVP atual só implementa criação, listagem e exclusão (`RF-002`/`RF-004` e `RF-008`/`RF-010`). Não há como corrigir um cadastro sem excluir e recriar o registro — especialmente limitante para `statusPagamento` do aluno, que deveria mudar ao longo do tempo.

### 🛠️ Como foi implementado
- `updateAluno(id, formData)` / `updateTransacao(id, formData)` em `actions.ts`, reaproveitando as validações de `createAluno`/`createTransacao`
- UI: página de edição separada (`/alunos/[id]/editar`, `/transacoes/[id]/editar`) — não modal
- Testado via HTTP simulando os Server Actions (progressive enhancement, `$ACTION_ID` + multipart/form-data)

---

## ✅ 3. Autenticação e controle de acesso — CONCLUÍDO (2026-07-12)

### 📌 Contexto
Sistema hoje não tem login — qualquer pessoa com acesso à URL lê e escreve todos os dados. Aceitável enquanto é só uso local do Sandro, mas bloqueante antes de qualquer deploy público. Ver item 9 para a tela de login em si (parte visual desta mesma frente).

### 🛠️ Como foi implementado
- **NextAuth v5** (Credentials provider), usuário único (Sandro)
- Login por **username** (não e-mail — decisão revisada no meio da sessão), senha padrão temporária + fluxo de recuperação por token (`/esqueci-senha`, `/resetar-senha`), replicando um padrão usado em outro sistema do mesmo operador
- `src/proxy.ts` (não `middleware.ts` — Next 16 renomeou pra "Proxy") protege `/`, `/alunos`, `/transacoes`, `/despesas`, `/pre-cadastros`, `/agenda`
- Detalhes completos em [[registro-de-decisoes-academiasandro]]

---

## ✅ 4. Corrigir inconsistência de fonte (Geist vs. Arial/Helvetica) — CONCLUÍDO (2026-07-12)

### 📌 Contexto
`src/app/layout.tsx` carrega as fontes Geist/Geist Mono via `next/font/google` e declara `--font-sans`/`--font-mono` em `@theme inline` (`globals.css`), mas o seletor `body` no mesmo arquivo fixa `font-family: Arial, Helvetica, sans-serif` diretamente — a fonte Geist carregada nunca é usada no corpo da página.

### 🛠️ Como foi implementado
- `body { font-family: var(--font-sans) }` no lugar do valor hardcoded — Geist definitivamente escolhida

---

## ✅ 5. Personalizar a Home (`/`) — CONCLUÍDO (2026-07-12)

### 📌 Contexto
A página inicial ainda é o template padrão gerado pelo `create-next-app` (logo do Next.js, links para a Vercel) — não reflete a identidade da Academia Prof. Sandro.

### 🛠️ Como foi implementado
- `/` virou o **dashboard** autenticado (movida pra dentro do route group `(app)`): cards de total de alunos/saldo/vencendo em 3 dias, ranking de modalidades, faixa etária
- Resolvido junto com o módulo financeiro completo (item novo abaixo), não isoladamente

---

## ✅ 6. Decidir hospedagem e revisar `sslmode` para produção — CONCLUÍDO (2026-08-03)

### 📌 Contexto
Sistema rodava só em ambiente de desenvolvimento local até 2026-08-03. `sslmode=no-verify` foi aceito como solução temporária para o pooler da Supabase. Domínio de produção (`sandrofreiresf.online`) registrado em 2026-07-29, sem deploy associado até então.

### 🛠️ O que foi feito
- Hospedagem decidida e executada: **VPS Hostinger com Docker**, compartilhada com VillaMill e Sistema Thieco atrás de um nginx no host (não Vercel) — ver [[arquitetura-academiasandro]] seção 9 e [[registro-de-decisoes-academiasandro]] (2026-08-03)
- `https://sandrofreiresf.online` no ar, HTTPS via Certbot/Let's Encrypt, renovação automática
- Armazenamento de comprovante (`public/comprovantes/`) resolvido pro deploy atual via volume Docker nomeado — sobrevive a rebuild/redeploy do container
- **Ainda pendente:** `sslmode=no-verify` → `verify-full` (conexão app↔Supabase) não foi revisitado nesta rodada; cron real pra `/api/cron/limpar-comprovantes` também não — a limpeza continua só reativa

---

## ✅ 12. Apagar dados fictícios de demonstração antes de produção — CONCLUÍDO (2026-08-03)

### 📌 Contexto
18 alunos fictícios + 50 transações + 15 despesas foram gerados via `npm run db:seed-demo` e `npm run db:seed-demo-financeiro` (2026-07-12), pra o usuário apresentar o sistema a um cliente. Esses dados estavam persistidos de verdade no Supabase — o mesmo banco usado em produção desde o deploy de 2026-08-03.

### 🛠️ O que foi feito
- Apagados: 19 `Aluno` (18 fictícios `@exemplo.com` + 2 cadastros de teste do próprio usuário/esposa), 55 `TransacaoFinanceira`, 15 `Despesa`, 1 `Matricula` extra, `Usuario` vinculados aos 2 alunos de teste
- Também removido, a pedido explícito numa segunda rodada: o `Aluno` fixo "Aluno Teste (Dev)" (login `devaluno` mantido, sem `alunoId`)
- Preservado propositalmente: os 81 `AgendaAula` (grade real, não é dado de teste) e os `Usuario` `sandro`/`devmaster`
- Detalhes em [[registro-de-decisoes-academiasandro]] (2026-08-03)

---

## 📋 7. Testar fluxos de criação/exclusão em navegador real

### 📌 Contexto
A implementação das telas `/alunos` e `/transacoes` foi verificada via `tsc`, `lint` e `curl` (confirmando que a leitura funciona e consulta o banco corretamente), mas o fluxo de escrita via Server Actions (`<form action={...}>`) nunca foi exercitado clicando de fato nos formulários — não havia ferramenta de browser disponível na sessão em que foi implementado.

### 🛠️ Especificações Técnicas
- Rodar `npm run dev` e cadastrar/excluir um aluno e uma transação manualmente, confirmando que `revalidatePath` atualiza a tabela sem erro

---

## ✅ 8. Redesenhar layout — menu lateral (sidebar) em vez de navbar superior — CONCLUÍDO (2026-07-12)

### 📌 Contexto
**Feedback do usuário (2026-07-11):** o layout atual (navbar horizontal simples com 2 links no topo) ficou "fraco e sem graça". Quer um menu lateral fixo com as funcionalidades do sistema separadas por módulo — mais alinhado a um painel de gestão real do que a um app de vitrine.

### 🛠️ Como foi implementado
- `src/components/AppShell.tsx` — sidebar fixa (colapsável em mobile via drawer), navegação agrupada por seção, item ativo destacado por rota
- Estrutura e segmentação adaptadas do `Sidebar.jsx`/`Header.jsx` do `sistema-thieco` (a pedido do usuário) — só layout, sem lógica de negócio copiada
- Route group `src/app/(app)/` aplica o shell só nas rotas autenticadas

---

## ✅ 9. Tela de Login — CONCLUÍDO (2026-07-12)

### 📌 Contexto
Parte visual da frente de autenticação (item 3) — pedida explicitamente pelo usuário junto com o redesign do layout. Hoje não existe nenhuma tela de login; o sistema é acessado diretamente sem nenhuma barreira.

### 🛠️ Como foi implementado
- `/login` com formulário de **usuário/senha** (não e-mail — ver item 3), identidade visual dourado/bronze adaptada do `Login.jsx` do `sistema-thieco`, sem slogan (decisão do usuário — só nome + selo "Sistema de Gestão")
- Depois do login, redireciona pro `callbackUrl`; `/alunos`, `/transacoes`, `/despesas`, `/pre-cadastros` e `/` protegidas via `src/proxy.ts`

---

## 🔄 10. Sistema de Agenda de Aulas — PARCIALMENTE CONCLUÍDO (2026-07-22/23)

### 📌 Contexto
**Pedido do usuário (2026-07-11):** consultar horários livres de aula e quantos alunos estão treinando em determinado período/horário. Hoje o sistema só modela `Aluno` e `TransacaoFinanceira` — não existe conceito de aula, horário ou turma no schema.

### ✅ O que já foi implementado
- Models `AgendaAula` e `PresencaDiaria` no schema (dia da semana, horário, modalidade, capacidade máxima; presença por data com status)
- Tela `/agenda` (admin) e tela inicial de `/aluno` — grade semanal completa (`AgendaGrid`), mostrando vagas disponíveis por horário
- 63 horários reais da academia seedados no Supabase (Musculação/Personal, Capoeira, Muay Thai + Idosos/Kids)

### 📋 O que ainda falta (ver decisão de 2026-07-23 "Planejamento da próxima etapa" no [[registro-de-decisoes-academiasandro]])
- Aluno tem horário fixo ou faz check-in livre? — ainda não decidido; hoje não existe nenhuma tabela de "matrícula recorrente por horário", só `PresencaDiaria` por data específica (e nenhum fluxo cria essas linhas ainda)
- Calendário do Sandro mostrando **quem** são os alunos em cada slot (hoje só mostra a contagem de vagas, não a lista de nomes)
- Envio de mensagem de confirmação de presença (canal a definir — provavelmente `wa.me`, seguindo o padrão já usado pra cobrança)
- Filtrar a Agenda do aluno pra mostrar só os horários em que ele está matriculado (hoje mostra a grade completa, igual à do admin)
- Aba "Matrícula" na Área do Aluno — aluno se inscreve numa modalidade nova, vendo os horários com vaga daquela modalidade

---

## ✅ 11. Módulo financeiro completo + vencimento de matrícula + cadastro público — CONCLUÍDO (2026-07-12)

### 📌 Contexto
**Pedido do usuário (2026-07-12):** trazer do `sistema-thieco` os módulos de despesas, faturamento e cadastro de alunos, adaptando ao stack daqui, somado a três funcionalidades novas: controle de validade de matrícula com cobrança via WhatsApp, sino de notificação (matrículas vencendo em 3 dias) e link público de auto-cadastro (nome, idade, data de nascimento, telefone, email, lesões opcional, cidade).

### 🛠️ Como foi implementado
- `Aluno` ganhou `telefone`, `email`, `dataNascimento`, `cidade`, `lesoes`, `dataVencimento` (ciclo fixo de 30 dias, recalculado a cada pagamento vinculado)
- Novo model `Despesa` (categorias + recorrência, gera 12 ocorrências de uma vez) — tela própria `/despesas`, separada de `TransacaoFinanceira`
- Novo model `PreCadastro` — fila de auto-cadastro via `/matricule-se` (público), revisada em `/pre-cadastros` (Aprovar/Rejeitar)
- Cobrança via WhatsApp: link `wa.me` simples (sem API paga), tanto na lista de alunos quanto no sino de notificação
- Sino de notificação (`NotificacaoSino.tsx`): matrículas vencendo em 3 dias + pré-cadastros pendentes, calculado ao vivo (sem tabela de notificações persistente)
- Ranking de modalidades e faixa etária entraram no dashboard (`/`, item 5)
- Detalhes completos, decisões e simplificações registradas em [[registro-de-decisoes-academiasandro]]
- **Pendente:** verificação funcional completa via navegador — os testes automatizados via HTTP foram interrompidos a pedido do usuário, que preferiu testar manualmente

---

## ✅ 13. Redesign da tela de login — CONCLUÍDO (2026-07-22)

### 📌 Contexto
Usuário pediu remoção do slogan antigo, título "Centro de Treinamento Sandro Ferreira" em `font-serif`, e os 3 logos das modalidades (Personal, Capoeira, Muay Thai) numa linha acima do título.

### 🛠️ Como foi implementado
- Logos processados (remoção de fundo + recompressão) já que os originais eram JPEGs opacos salvos como `.png`
- Layout final em formação triangular (Personal no topo, Capoeira + Muay Thai lado a lado abaixo), tamanhos ajustados pra legibilidade no mobile
- Testado via Playwright headless (mobile 390px + desktop 1280px), sem erros de console
- Detalhes completos em [[registro-de-decisoes-academiasandro]]

---

## ✅ 14. Área do Aluno (self-service) — CONCLUÍDO (2026-07-23)

### 📌 Contexto
Usuário pediu uma área do próprio aluno acessar: ver sua agenda, situação financeira (mensalidade, vencimento, PIX) e anexar comprovante de pagamento — depois reestruturada no mesmo dia pra ter menu lateral (Agenda/Financeiro) reaproveitando a grade de horários também usada pelo admin.

### 🛠️ Como foi implementado
- Schema: `Usuario.alunoId` (FK 1:1 opcional pra `Aluno`) — decisão tomada via pergunta ao usuário (FK explícita, não casar por e-mail)
- `/aluno` protegida via `proxy.ts`/`auth.ts`, shell próprio (`AlunoShell.tsx`)
- Tela inicial = Agenda (grade compartilhada com o admin); `/aluno/financeiro` — status, vencimento, PIX (desde 2026-07-30: `Usuario.pix`, cadastrado pelo admin em Configurações → Perfil — antes era a env var `PIX_KEY_CT`, sempre vazia), upload de comprovante
- Testado via Playwright headless: redirect de não-autenticado, upload real de arquivo (grava em `public/comprovantes/` + atualiza `TransacaoFinanceira.comprovanteUrl`)
- Detalhes completos em [[registro-de-decisoes-academiasandro]]

---

## ✅ 15. Calendário do Sandro (quem está em cada horário) + Agenda pessoal do aluno + Aba de Matrícula — CONCLUÍDO (2026-07-29)

### 📌 Contexto
**Pedido do usuário (2026-07-23):** registrado como plano; implementado integralmente em 2026-07-29, com um refinamento pedido no meio do trabalho (modal de pagamento tipo PDV na matrícula extra).

### 🛠️ Como foi implementado
1. `/agenda` (admin) mostra, por horário, a **lista de alunos** alocados (roster real: modalidade principal + `Matricula` extra) via indicador expansível — decisão tomada: **sem** envio de mensagem de confirmação de presença por enquanto (não foi pedido explicitamente nesta etapa; `PresencaDiaria`/`StatusPresenca` seguem sem uso)
2. Agenda da Área do Aluno (`getMeusHorarios`) filtrada pra mostrar só a modalidade principal + horários de modalidades extras já **confirmados** pelo admin
3. Aba "Matrícula" (`/aluno/matricula`) — aluno vê horários de outras modalidades, matricula-se via modal de pagamento (forma de pagamento + geração de cobrança), pode cancelar
4. **Decisão sobre a entidade:** criada `model Matricula` (aluno × `AgendaAula`) — só pra modalidades extras; a principal continua sendo inferida de `Aluno.modalidade`, sem registro
5. **Decisão sobre aprovação:** matrícula extra é **direta** (sem aprovação prévia do Sandro pra se inscrever), mas o **pagamento** exige confirmação manual do admin antes da modalidade aparecer na agenda do aluno — ver decisão de 2026-07-29 no [[registro-de-decisoes-academiasandro]]

---

## ✅ 16. Correção de marca, Gestão de Preços (Pacotes), vencimento editável, confirmação visível e autocadastro de aluno ativo — CONCLUÍDO (2026-07-31)

### 📌 Contexto
Cinco pedidos encadeados na mesma sessão: (1) corrigir "Sandro Ferreira" → "Sandro Freire" em toda a UI (nome errado desde o redesign do login em 2026-07-22 — os logos e o domínio de produção já usavam o nome certo); (2) gestão de preços mais sofisticada — override de mensalidade por aluno individual e "pacotes" com desconto (família ou combo de modalidades pro mesmo aluno); (3) vencimento editável direto pelo admin; (4) confirmação de pagamento visível pro aluno em cobranças extras; (5) link público de autocadastro pra aluno ativo, diferente do `/matricule-se` (fila de pré-cadastro).

### 🛠️ Como foi implementado
- `Aluno.mensalidadeValor` (override individual), `Pacote`/`PacoteMembro`/`TipoPacote` (`FAMILIA`/`COMBO_MODALIDADES`) — migração `20260731011546_pacotes_preco_individual`
- Nova aba "Preços" em `/configuracoes` — preço por modalidade, gestão de pacotes (`CriarPacoteForm.tsx`), tabela de override individual
- Vínculo aluno↔pacote também direto no formulário de cadastro/edição (`pacoteId`/`descontoPercentual`), além da aba Preços
- `dataVencimento` editável no formulário de edição do aluno
- `/aluno/financeiro`: badge "Pagamento confirmado" em cobranças extras, linha "Valor da mensalidade" calculada (`valorEfetivoAluno`), e visão consolidada de todos os integrantes pro titular de um pacote família ("1 login por família" — só o titular tem `Usuario`, mas gerencia o financeiro de todo mundo)
- `/cadastro-aluno` (nova rota pública) — autocadastro que cria `Aluno` direto (sem fila de aprovação) e já libera acesso ao portal no mesmo fluxo; `src/lib/acesso-portal.ts` extraído pra reaproveitar essa lógica entre o cadastro manual (admin) e o autocadastro
- Testado ponta a ponta via HTTP real (login por credentials, autocadastro completo, cálculo de desconto de pacote conferido manualmente), `tsc`/`lint`/`build` limpos
- Detalhes completos em [[registro-de-decisoes-academiasandro]]

---

## ✅ 17. 12 melhorias encadeadas: WhatsApp real, financeiro por modalidade, pacotes-catálogo, LGPD — CONCLUÍDO (2026-08-03)

### 📌 Contexto
Lista de 12 pedidos soltos numa mensagem só. Descoberto no meio do mapeamento: a VPS compartilhada já roda um gateway real de WhatsApp (Evolution API), o que mudou o desenho dos itens de "avisar por WhatsApp" de link manual pra envio automático.

### 🛠️ Como foi implementado
- WhatsApp real (`src/lib/whatsapp-gateway.ts`) — aba Configurações → WhatsApp (QR/status/desconectar), bloqueio de agenda avisa o aluno, aula experimental agendada avisa o admin
- Financeiro com parcelas por modalidade (`Matricula.dataVencimentoBase`, `getParcelasCiclo`) — cada modalidade extra com seu próprio ciclo de 12 parcelas, vencimento editável por matrícula em `/alunos/[id]/editar`
- Pacotes Combo em catálogo (`Pacote.descontoPadrao`, sem `PacoteMembro` até ser escolhido) + Pacote Família isolado, nunca oferecido ao aluno
- Ficha completa do pré-cadastro (`/pre-cadastros/[id]`), username na mensagem de acesso, horário sempre obrigatório, badges de modalidade extra em `/alunos`, horário de almoço com default seguro, termo LGPD no pré-cadastro
- Despesas recorrentes — já estava implementado, confirmado
- Migration única `20260803191927_melhorias_agosto`
- Detalhes completos em [[registro-de-decisoes-academiasandro]]

### 🐛 Bugs achados e corrigidos durante o teste ao vivo (não previstos no plano)
- Datas formatadas sem `timeZone: "UTC"` (`dataNascimento`, `dataAulaExperimental`, `dataVencimentoBase`) apareciam um dia a menos
- `valorEfetivoAluno` (função pré-existente) não somava modalidades extras no total pra aluno sem pacote — corrigido, com efeito colateral positivo na tabela de preços individuais em Configurações

### 📎 Sequência da mesma sessão
- Commit + push — revelou meses de trabalho nunca commitado (fechado no `74e7f11`, push via `aiox-devops`) e achado de segurança (senha real do Supabase em `.claude/settings.local.json`, excluída do commit)
- Deploy guiado na VPS — achado bug de cache do Turbopack corrompendo o dev server local, e erro do usuário rodando `rsync` de dentro da sessão SSH da VPS
- Manual do usuário em PDF gerado via `pdfkit` (`academia-sandro/Manual-do-Usuario-Sandro.pdf`) — Chromium headless não funciona neste ambiente sandbox

---

## ✅ 18. WhatsApp validado ao vivo em produção + UX de telefone vs. conexão — CONCLUÍDO (2026-08-03)

### 📌 Contexto
Sequência do item 17: usuário pareou o WhatsApp na VPS e pediu pra testar os dois avisos automáticos com mensagem chegando de verdade, não só via banco/HTTP.

### 🛠️ O que foi feito
- Bloqueio de agenda → aluno: funcionou de primeira
- Aula experimental → admin: falhou na primeira tentativa (silenciosamente) — causa raiz: `Usuario.telefone` da conta `sandro` estava vazio. Corrigido preenchendo o campo; reteste confirmou
- 2 melhorias de UX a pedido do usuário: texto explicando a diferença entre o campo Telefone (Perfil) e o número conectado (WhatsApp), e botão de sincronização de 1 clique (`buscarNumeroConectado`, `sincronizarTelefonePerfilAction`)
- Limpeza de dados de teste (2 pré-cadastros, 1 bloqueio de teste, o aluno "Aluno Teste Badges" inteiro)
- Commit `2b3be3a` + push via `aiox-devops`; manual em PDF atualizado com o diagnóstico real do bug
- Detalhes completos em [[registro-de-decisoes-academiasandro]]

---

### 📆 Status do Backlog
- [x] Schema inicial (Aluno + TransacaoFinanceira)
- [x] Conexão com Supabase estabilizada (`sslmode=no-verify` + driver adapter `pg`)
- [x] Migração `init_aluno_transacao` aplicada
- [x] Telas `/alunos` e `/transacoes` (criar, listar, excluir)
- [x] Edição de Aluno e de Transação Financeira
- [x] Autenticação e controle de acesso
- [x] Corrigir inconsistência de fonte (Geist vs. Arial/Helvetica)
- [x] Personalizar a Home (virou dashboard)
- [x] Redesenhar layout com menu lateral (sidebar)
- [x] Tela de Login
- [x] Módulo financeiro completo (despesas, vencimento, WhatsApp, sino, cadastro público)
- [x] Dados fictícios de demonstração gerados (alunos + transações + despesas)
- [x] Polimento visual (fonte serifada, cabeçalhos de página, favicon, ícones temáticos)
- [x] Código versionado e publicado no GitHub (`zion-workspace`)
- [x] Redesign da tela de login (logos + título de marca)
- [x] Schema expandido (Role, AgendaAula, PresencaDiaria, vínculo Usuario↔Aluno)
- [x] Área do Aluno (Agenda + Financeiro + upload de comprovante)
- [x] Agenda compartilhada (admin + aluno) com grade real de 63 horários
- [x] ~~Rotacionar senha do banco no Supabase (2026-07-28)~~ — **estado incerto**, evidência de 2026-08-03 contradiz este registro (ver nota no topo do arquivo e [[registro-de-decisoes-academiasandro]])
- [x] Restringir rotas por `role` (ADMIN vs. ALUNO) (2026-07-28)
- [x] Grade real reseedada a partir do quadro físico + modalidades unificadas (2026-07-29)
- [x] Calendário do Sandro com lista de alunos por horário (roster), sem confirmação de presença por WhatsApp (2026-07-29)
- [x] Agenda pessoal do aluno (filtrada — modalidade principal + extras confirmadas) (2026-07-29)
- [x] Aba de Matrícula (aluno se inscreve em nova modalidade, com modal de pagamento) (2026-07-29)
- [x] Fluxo financeiro: confirmação manual de pagamento, parcelas de 12 meses, expiração de comprovante em 10 dias (2026-07-29)
- [x] Tela "Novas Matrículas" (admin) + filtros em Alunos (vencido/aguardando confirmação) (2026-07-29)
- [x] Criação automática de acesso do aluno no cadastro admin (2026-07-29)
- [x] Sino de notificações com marcar-como-lido + 4 categorias (2026-07-29)
- [x] Rebrand "Academia" → "Centro de Treinamento" em toda a UI (2026-07-29)
- [x] Correção de marca "Sandro Ferreira" → "Sandro Freire" em toda a UI (2026-07-31)
- [x] Gestão de Preços: override individual de mensalidade + Pacotes (família/combo de modalidades) com desconto (2026-07-31)
- [x] Vencimento (`dataVencimento`) editável direto pelo admin (2026-07-31)
- [x] Confirmação de pagamento visível pro aluno em cobranças extras (2026-07-31)
- [x] Autocadastro de aluno ativo (`/cadastro-aluno`) com acesso ao portal automático (2026-07-31)
- [x] Decidir hospedagem e ir ao ar — VPS Hostinger + Docker + nginx compartilhado + Certbot (2026-08-03)
- [x] Revisar armazenamento de comprovante antes de produção — volume Docker nomeado, sobrevive a redeploy (2026-08-03)
- [x] Apagar dados fictícios de demonstração antes de produção (2026-08-03)
- [x] Faixa/graduação por modalidade extra no autocadastro (`AlunoFaixaModalidade`, `/cadastro-aluno` com múltiplas modalidades) (2026-08-03)
- [x] WhatsApp real via Evolution API (bloqueio de agenda avisa aluno, aula experimental avisa admin, aba de conexão) (2026-08-03)
- [x] Financeiro com parcelas por modalidade extra, vencimento editável por matrícula (2026-08-03)
- [x] Pacotes Combo em catálogo autosserviço + Pacote Família isolado (2026-08-03)
- [x] Ficha completa do pré-cadastro, username na mensagem de acesso, horário sempre obrigatório, badges de modalidade extra, almoço com default seguro, termo LGPD (2026-08-03)
- [x] Lacuna de meses sem commit fechada (`74e7f11`) — push via `aiox-devops`, único agente autorizado nesta regra de governança (2026-08-03)
- [x] Manual do usuário em PDF pra entregar ao Sandro (`Manual-do-Usuario-Sandro.pdf`, via `pdfkit`) (2026-08-03)
- [ ] Testar fluxos de criação/exclusão em navegador real (parcialmente coberto via HTTP; módulo do item 11 ainda não testado manualmente)
- [ ] Revisitar `sslmode=no-verify` → `verify-full` (conexão app↔Supabase)
- [x] Configurar cron real pra expiração de comprovante — `crontab` na VPS chamando `/api/cron/limpar-comprovantes` diariamente às 3h (2026-08-03; rota já existia desde 2026-07-29, só faltava o agendamento em si)
- [ ] Rotacionar a senha do Supabase de verdade (estado atual incerto, reforçado por nova reincidência em `.claude/settings.local.json` — ver nota no topo do arquivo)
- [ ] Definir se haverá confirmação de presença (check-in) — `PresencaDiaria`/`StatusPresenca` seguem sem nenhum fluxo que os use
- [x] Parear o WhatsApp do CT na VPS de produção — feito e **validado ao vivo** (mensagem realmente recebida no celular, os dois avisos automáticos) (2026-08-03)
- [ ] Padronizar o log de falha de envio de WhatsApp — `criarPreCadastro` (aviso de aula experimental) não loga nada se o envio falhar/for pulado, diferente de `criarBloqueio` (já loga `console.error`); achado ao debugar o primeiro teste ao vivo, que falhou sem deixar rastro nenhum (causa real era `Usuario.telefone` do admin vazio)
- [x] Corrigir "Valor total" do financeiro pra somar extras por matrícula, não por nome de modalidade distinto (2026-08-03) — `somaExtrasAluno`, `src/lib/precos.ts`
- [ ] Decidir se o "Valor total" do financeiro deve somar por matrícula (não por nome de modalidade) — hoje um aluno com 2 matrículas na mesma modalidade extra (2 horários) só conta o valor uma vez no total, mas gera 2 cobranças reais separadas
- [ ] Avaliar fixar `"dev": "next dev --webpack"` no `package.json` — Turbopack teve cache corrompido nesta sessão (`.next/dev/cache/turbopack`), causa aparente ligada a processos `next dev` não encerrados corretamente neste ambiente (WSL, `/mnt/c`)
- [ ] Atualizar `requisitos-funcionais-academiasandro`/`design-system`/`ui-kit`/`ux-flows` com as regras de negócio e componentes novos de 2026-08-03 (não feito nesta rodada, mesmo padrão de lacuna já registrado em sessões anteriores)
