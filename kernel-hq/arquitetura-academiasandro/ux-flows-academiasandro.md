---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-08-12
owner: willians
---

# UX — Academia Prof. Sandro

> Referência: [[prd-academiasandro]] | [[design-system-academiasandro]]

---

## 1. Pesquisa

**Método:** nenhuma pesquisa formal foi conduzida. O escopo das duas primeiras telas (Alunos, Transações Financeiras) veio diretamente do schema Prisma definido para o MVP, não de entrevista ou observação de uso real.

**Participantes:** nenhum formal — sistema está em produção desde 2026-08-03 e o Sandro já usa no dia a dia, mas não houve entrevista/observação estruturada, só ajustes reativos a pedidos pontuais dele numa sessão de cada vez.

> Esta seção deve ser preenchida com descobertas reais de uso — hoje é ajuste reativo, não pesquisa formal.

---

## 2. Jornada do usuário

### Jornada principal — Cadastro de aluno

| Etapa | O que o usuário faz | Ponto de fricção conhecido |
|---|---|---|
| Acessa `/alunos` | vê formulário no topo e tabela de alunos existentes abaixo | nenhum reportado até o momento (sistema não usado em produção ainda) |
| Preenche formulário | nome, modalidade (select fixo), faixa (texto livre), status de pagamento (select fixo), apto para exame (checkbox) | modalidade e status são listas fixas no código — nova modalidade exige alteração de código, não é configurável pela UI |
| Envia | clica em "Cadastrar aluno" | sem confirmação nem mensagem de sucesso explícita — o retorno visual é o aluno aparecer na tabela abaixo |

### Jornada secundária — Registro de transação financeira

| Etapa | O que o usuário faz | Ponto de fricção conhecido |
|---|---|---|
| Acessa `/transacoes` | vê saldo atual no topo, formulário de cadastro, tabela de transações | saldo é recalculado a cada carregamento da página — não é um valor persistido |
| Preenche formulário | tipo (Receita/Despesa), categoria (texto livre), valor, data, aluno vinculado (opcional) | nenhum aluno cadastrado ainda → select mostra apenas "Nenhum" |
| Envia | clica em "Registrar transação" | idem — sem mensagem de sucesso explícita |

### Jornada — Aluno consulta agenda e anexa comprovante (2026-07-23)

| Etapa | O que o usuário faz | Ponto de fricção conhecido |
|---|---|---|
| Login | acessa `/login` com `username`/senha (mesma tela do Sandro, sem distinção visual por papel) | usuário comum não sabe de antemão se sua conta tem `alunoId` vinculado — só descobre ao tentar acessar `/aluno` |
| Vê a Agenda | cai em `/aluno`, sidebar com Agenda/Financeiro | a grade mostra **todas** as modalidades, não só as do próprio aluno — ponto de fricção conhecido, é a próxima etapa planejada (filtrar pra "meus dias de aula") |
| Acessa Financeiro | clica em "Financeiro" na sidebar | vê status da mensalidade, vencimento, chave PIX (cadastrada pelo admin em Configurações → Perfil desde 2026-07-30; aparece "não configurada" se `Usuario.pix` do admin estiver vazio) |
| Anexa comprovante | escolhe um arquivo (imagem/PDF) e clica "Anexar Comprovante" | sem confirmação visual imediata de "enviado com sucesso" além do link "visualizar" aparecer após o reload da página |

### Jornada — Autocadastro de aluno ativo (2026-07-31; data de vencimento + trava de duplicidade 2026-08-12)

| Etapa | O que o usuário faz | Ponto de fricção conhecido |
|---|---|---|
| Recebe o link | admin compartilha manualmente a URL de `/cadastro-aluno` (copiada via botão no topo de `/alunos`) — não é divulgado em nenhum canal público automático | pessoa que recebe o link errado (ex: alguém que ainda não é aluno) cadastra um `Aluno` de verdade sem fila de aprovação — mitigado só pelo admin controlar a quem repassa, e desde 2026-08-12 pela trava de duplicidade por telefone (não impede um cadastro errado, só impede repetir com o mesmo número) |
| Preenche formulário | nome, modalidade + horário (opcional), telefone, e-mail, **data de vencimento da mensalidade** (2026-08-12, obrigatória — o próprio aluno informa, já que o sistema não calcula mais automático), faixa (opcional), nascimento/cidade/lesões (opcionais) | faixa/graduação sem valor vira "A definir" — sem feedback explicando isso na tela; aluno pode não saber de cabeça a própria data de vencimento |
| Envia | clica em "Concluir cadastro" | e-mail já cadastrado no portal gera mensagem de erro orientando a usar "Esqueci minha senha" — o `Aluno` já foi criado mesmo assim, sem acesso, exigindo intervenção do admin depois. Desde 2026-08-12: telefone já cadastrado noutro `Aluno` é rejeitado antes de criar qualquer coisa ("Esse telefone já está cadastrado. Se você já é aluno, fale com a recepção") |
| Recebe acesso | tela de sucesso mostra botão "Definir minha senha", já apontando pro link de `/resetar-senha` | link não expira imediatamente (7 dias, mesmo padrão do link gerado pelo admin) — pessoa pode fechar a aba sem definir a senha e o admin não é avisado disso |
| Recebe WhatsApp (2026-08-12) | usuário+link de definir senha chegam automaticamente no WhatsApp do telefone informado, sem precisar copiar da tela | se o número informado estiver errado, a mensagem vai pro número errado — não há confirmação de telefone (ex: código SMS) antes do envio |

### Jornada — Admin confirma/recusa aula experimental pelo WhatsApp (2026-08-12)

| Etapa | O que o usuário faz | Ponto de fricção conhecido |
|---|---|---|
| Recebe o aviso | lead marca uma data de aula experimental em `/matricule-se`; admin recebe WhatsApp automático com 2 links (✅ Confirmar / ❌ Recusar) | admin precisa estar com o WhatsApp em mãos pra agir — não há lembrete se ele não abrir a mensagem |
| Clica num dos links | abre o link direto do WhatsApp (celular ou desktop), sem precisar logar no sistema | se clicar no link errado por engano, não tem como desfazer — "primeira resposta vence" (ver Módulo 15, RN-044) |
| Vê a confirmação | página simples (`/aula-experimental/confirmada`) mostra "Aula confirmada!" ou "Aula recusada", confirmando que o lead foi avisado | página sem nenhuma ação adicional (ex: não linka de volta pra ficha do pré-cadastro) — fricção pequena, exige navegação manual se o admin quiser ver mais detalhe |
| Lead recebe a decisão | WhatsApp automático confirma ou avisa que não vai dar pra confirmar aquela aula | mensagem de recusa não sugere um novo horário — pede pra "falar com a gente pra reagendar", sem link direto |

---

## 3. Arquitetura de informação

```
/ (Dashboard — autenticado, route group (app))
├── /alunos — cadastro + listagem de alunos
├── /transacoes — cadastro + listagem de transações financeiras, com saldo
├── /despesas — gastos operacionais, com recorrência
├── /pre-cadastros — fila de aprovação do cadastro público
├── /agenda — grade semanal de horários (AgendaGrid)
├── /aluno — Área do Aluno (self-service, shell próprio)
│     ├── /aluno (Agenda — tela inicial)
│     ├── /aluno/matricula
│     └── /aluno/financeiro (2026-07-31: multi-perfil se titular de pacote família)
├── /configuracoes — Perfil / Agenda / Preços (abas, admin)
├── /matricule-se — cadastro público (pré-cadastro), sem login
├── /cadastro-aluno — autocadastro de aluno ativo (2026-07-31), sem login
├── /aula-experimental/confirmada — (2026-08-12) retorno público depois do admin clicar confirmar/recusar aula experimental
└── /login, /esqueci-senha, /resetar-senha — autenticação
```

**Critério de organização (atualizado 2026-07-23):** dois shells distintos — `AppShell` (admin, todas as telas de gestão) e `AlunoShell` (self-service do aluno, só Agenda e Financeiro). Sem hierarquia entre eles: um `Usuario` pode em tese acessar ambos se tiver `alunoId` preenchido, já que não há checagem de `role` (ver [[arquitetura-academiasandro]], seção 5).

---

## 4. Fluxos principais

### Fluxo: Cadastro de aluno

```
[/alunos]
    ↓ preenche formulário
    ↓ clica "Cadastrar aluno"
[Server Action createAluno valida campos obrigatórios]
    ↓ (válido)                    ↓ (inválido)
[prisma.aluno.create]        [navegador bloqueia submit — required nativo]
    ↓
[revalidatePath("/alunos") → tabela atualizada]
```

### Fluxo: Registro de transação vinculada a aluno

```
[/transacoes]
    ↓ seleciona tipo, categoria, valor, data
    ↓ (opcional) seleciona aluno no dropdown
    ↓ clica "Registrar transação"
[Server Action createTransacao]
    ↓
[prisma.transacaoFinanceira.create com alunoId ou null]
    ↓
[revalidatePath("/transacoes") → saldo e tabela atualizados]
```

---

## 5. Testes de usabilidade

Nenhum teste de usabilidade foi realizado — sistema ainda não usado por Sandro no dia a dia. Seção mantida como placeholder para preenchimento futuro.

---

## 6. Iterações registradas

| Data | O que mudou | Por que mudou |
|---|---|---|
| 2026-07-11 | Implementação inicial de `/alunos` e `/transacoes` | Primeira entrega do MVP, após schema e conexão com banco estabilizados |
| 2026-07-22 | Login redesenhado com logos + título de marca completo | Usuário pediu identidade visual mais forte na porta de entrada do sistema |
| 2026-07-23 | Área do Aluno criada e reestruturada em sidebar (Agenda/Financeiro) na mesma sessão | Pedido do usuário; a primeira versão (sem sidebar) foi reestruturada horas depois a pedido do mesmo usuário, no mesmo dia |
| 2026-07-31 | Novo link de autocadastro (`/cadastro-aluno`), distinto do `/matricule-se`, com acesso ao portal liberado na hora | Usuário queria um jeito de aluno que já treina entrar no sistema sozinho, sem passar pela fila de aprovação pensada pra quem ainda não é aluno |
| 2026-08-03 | Deploy em produção; WhatsApp real (bloqueio de agenda, aula experimental); autocadastro multi-modalidade | Sistema saiu do ambiente de dev, primeira vez usado por Sandro no dia a dia |
| 2026-08-12 | Confirmação de aula experimental por link no WhatsApp; usuário/senha e cobrança/aniversário automáticos por WhatsApp; data de vencimento informada pelo aluno no autocadastro; trava de duplicidade por telefone (uma tentativa por convite/token foi feita e revertida no caminho, ver [[registro-de-decisoes-academiasandro]]) | Sequência de pedidos do usuário focados em reduzir trabalho manual do admin — a maior parte dos avisos do sistema passou a ser automática nesta sessão |

> Para o histórico técnico completo (bugs de conexão, correções de `.env`), ver [[registro-de-decisoes-academiasandro]] — esta seção é reservada só para iterações de UX validadas com uso real.
