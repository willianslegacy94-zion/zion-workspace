---
status: draft
domain: kernel-academia
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# PRD — Kernel Academia

> **Rastreabilidade:** este PRD foi reconstruído a partir do código existente em `orbita-workspace/kernel-academia/`, não de um briefing registrado. Cada afirmação aponta para um arquivo real. Onde o código não permite concluir a intenção de negócio, está escrito explicitamente que é pergunta aberta — nada foi suposto.

## 1. Contexto

O `academia-sandro` — sistema de gestão do Centro de Treinamento Sandro Freire — está em produção desde 2026-08-03 e cobre o ciclo completo de uma academia: alunos, agenda por modalidade e horário, financeiro com parcelas, pacotes de desconto, portal do aluno e WhatsApp real. É um sistema de **um cliente**: marca hardcoded, um banco, um deploy.

O `kernel-academia` é a versão **whitelabel multi-tenant** desse mesmo produto. Todo o domínio de academia foi herdado do `academia-sandro` (mesmos models, mesmas rotas, mesmos componentes); o que foi construído por cima é a camada que faltava para vender o produto a mais de uma academia com um único código-base: tabela `tenants`, plano de controle `/admin-kernel`, branding por cliente, módulos ligáveis por cliente e log de erro escopado por tenant.

O padrão de multi-tenancy não foi desenhado do zero: foi copiado do `kernel-foodservice`, citado nominalmente em 6 pontos do código como referência de decisão (schema `Tenant`/`SuperAdmin`, schema `ErrorLog`, login global em `src/auth.ts`, reset de senha no painel admin, captura de erro, `docker-compose.yml`).

## 2. Problema

**Dor específica:** não é possível vender o sistema do `academia-sandro` para uma segunda academia sem duplicar repositório, banco e deploy.

**Como se manifesta (no código do sistema de origem):**
- Marca e textos fixos no código — o `layout.tsx`, as mensagens de WhatsApp e o termo de LGPD citam "Centro de Treinamento Sandro Freire" literalmente
- Nenhuma tabela representa "cliente da plataforma" — não há a quem escopar dado
- Nenhum plano de controle: criar um cliente novo significa provisionar infraestrutura nova
- Nenhuma forma de ligar/desligar módulo por cliente: quem contrata leva tudo

**Por que ainda não foi resolvida:** o `academia-sandro` foi construído para atender um cliente real com urgência de produção, não como produto. Generalizar depois exigia refazer o schema inteiro com `tenantId` — o que este sistema fez, numa migration única (`init_multitenant`), sem passar por um estágio single-tenant.

## 3. Objetivo

Depois que o sistema estiver em pé:
- Willians cadastra uma academia nova em uma tela, em um passo, e recebe na hora o usuário e a senha temporária do admin dela
- Cada academia vê apenas os próprios alunos, transações, agenda e despesas — isolamento por `tenantId` em toda query
- Cada academia tem nome, slogan, logo e cores próprias, sem rebuild
- Módulos opcionais (portal do aluno, pré-matrícula pública, pacotes, WhatsApp) são ligados por contrato, não por código
- Willians desativa um tenant inadimplente sem apagar dado nenhum (`Tenant.ativo = false` derruba o login daquele tenant no `authorize`)
- Erro técnico em qualquer tenant fica registrado com rota, usuário e stack, visível em uma tela só

## 4. Usuário

**SuperAdmin (Willians — operador da plataforma).** Login separado, em `/admin-kernel/login`, com sessão própria por cookie HMAC — deliberadamente fora do NextAuth dos tenants, para que uma sessão de tenant nunca possa ser aceita como sessão de plataforma nem o contrário (`src/lib/superadmin-auth.ts`). Faz onboarding, ativa/desativa tenant, reseta senha de qualquer usuário e lê os logs de erro.

**Admin do tenant (dono/gestor da academia).** Role `ADMIN`. Usa as telas de gestão: dashboard, alunos, agenda, novas matrículas, transações, despesas, pré-cadastros (se o módulo estiver ligado) e configurações.

**Aluno do tenant.** Role `ALUNO`, vinculado a um `Aluno` via `Usuario.alunoId`. Usa o portal `/aluno`: vê os próprios horários, o próprio financeiro (parcelas + anexo de comprovante) e pode se matricular sozinho em horário extra.

**Lead público (sem login).** Acessa `/matricule-se/{tenantSlug}` (pré-matrícula com aceite de LGPD e escolha de data de aula experimental) ou `/cadastro-aluno/{tenantSlug}` (autocadastro completo, com modalidade principal + extras e escolha de pacote combo).

## 5. Hipótese de solução

Um único deploy Next.js 16 + Prisma 7 + PostgreSQL, com **multi-tenancy por coluna** (`tenantId` em toda tabela de negócio) em vez de banco/schema por cliente, e **login global** (username/email únicos na plataforma inteira, tenant resolvido a partir do usuário encontrado) em vez de slug de tenant na URL de login.

**Por que faz sentido:** é exatamente o padrão já rodando no `kernel-foodservice`, então não é aposta nova. Multi-tenancy por coluna mantém um deploy só, um pool de conexão só e uma migration só para todos os clientes — proporcional a um portfólio de dezenas de academias, não de milhares.

**Riscos centrais (todos evidenciados no código, ver [[registro-de-decisoes-kernel-academia]]):**
1. **Isolamento é disciplina, não garantia estrutural.** Não há Row Level Security no Postgres — o isolamento depende de toda query passar `tenantId`. Uma query esquecida vaza dado entre academias.
2. **Login global cria colisão de namespace.** Duas academias não podem ambas ter um usuário `admin` — o próprio `src/auth.ts` registra isso como consequência aceita.
3. **Sobrou marca do cliente de origem.** Textos e defaults ainda citam "Centro de Treinamento Sandro Freire" e `academia-sandro-admin` — bloqueante para vender a um cliente real.
4. **Catálogo de modalidades é fixo no código.** `src/lib/modalidades.ts` tem 5 modalidades herdadas do CT do Sandro; um tenant novo não consegue cadastrar as suas.

## 6. Escopo

**Dentro (implementado e verificável no código):**
- Plano de controle `/admin-kernel`: lista de tenants com contagem de usuários/alunos, criação de tenant + admin inicial em transação única, ativar/desativar tenant, reset de senha de qualquer usuário, lista dos 100 últimos erros de qualquer tenant
- Branding por tenant: `Tenant.branding` (slogan, logoUrl, corPrimaria, corFundo) aplicado via CSS custom properties inline no `AppShell`/`AlunoShell` e nas páginas públicas
- Feature flags por tenant: `Tenant.features` mesclado com 3 módulos core imutáveis (`alunos`, `agenda`, `financeiro`), resolvido uma vez no login e carregado no JWT
- Gestão de alunos: cadastro completo (modalidade principal + faixa, dados pessoais, lesões, horário de referência, override de mensalidade), edição, exclusão, criação/reenvio/revogação de acesso ao portal
- Agenda: grade por modalidade × dia da semana com capacidade por horário, janela de almoço configurável, bloqueios pontuais com aviso automático por WhatsApp a todos os alunos afetados
- Financeiro: transações receita/despesa, ciclo fixo de 12 parcelas mensais ancorado em data-base (mensalidade principal + um ciclo próprio por modalidade extra), confirmação manual de pagamento, retenção de comprovante por 10 dias
- Preços e pacotes: preço por modalidade, override individual por aluno, pacote FAMILIA (desconto só sobre a mensalidade) e COMBO_MODALIDADES (desconto sobre mensalidade + extras)
- Portal do aluno: horários próprios, parcelas, anexo de comprovante, automatrícula em horário extra com trava de capacidade
- Páginas públicas por slug: pré-matrícula com aceite LGPD e aviso de aula experimental por WhatsApp ao admin; autocadastro de aluno com múltiplas modalidades
- Notificações: WhatsApp real via Evolution API (bloqueio de agenda → alunos; aula experimental → admin) e links `wa.me` para cobrança manual
- Observabilidade: `onRequestError` grava toda exceção não tratada em `ErrorLog` com tenant, rota, usuário e stack truncado

**Fora (estado atual, não esquecimento — mas nenhuma delas está registrada como decisão explícita no código):**
- Deploy em produção — não existe `.env.production` no repositório
- Versionamento — o projeto inteiro está untracked no monorepo pai e não tem `.git` próprio
- Testes automatizados — nenhuma dependência de teste no `package.json`
- Row Level Security no banco
- Autoatendimento do cliente (signup sem passar pelo Willians), cobrança/billing, controle de assinatura
- Presença/chamada: o model `PresencaDiaria` existe e está migrado, mas **nenhuma tela ou action do repositório escreve nele** — funcionalidade herdada e ainda inerte

## 7. Métrica de sucesso

> Nenhuma métrica de negócio está declarada no código. As linhas abaixo são derivadas do que o sistema efetivamente mede/garante hoje — **precisam ser validadas pelo Willians antes de virarem meta**.

| Métrica | Referência atual | Meta candidata |
|---|---|---|
| Tempo para colocar uma academia nova no ar | duplicar repo + banco + deploy (`academia-sandro`) | um formulário, uma transação, zero rebuild |
| Isolamento entre academias | inexistente (single-tenant) | 100% das queries de negócio escopadas por `tenantId` |
| Módulos vendidos separadamente | impossível | 4 opcionais ligáveis por tenant — **hoje só 1 dos 4 é realmente consultado pelo código** |
| Diagnóstico de erro em cliente | via log de container | 100% dos erros não tratados em `ErrorLog`, com tenant e usuário |
| Tenants reais em produção | 0 | pendente de decisão comercial |

## 8. Requisitos de alto nível

**Funcionais:** ver [[requisitos-funcionais-kernel-academia]] — 47 RFs em 10 módulos, todos extraídos de código existente.

**Não funcionais (todos evidenciados no código):**
- Toda leitura e escrita de negócio escopada por `tenantId` obtido da sessão (`requireTenantId`), nunca de input do usuário
- Rotas públicas resolvem o tenant pelo slug da URL no servidor e devolvem 404 indistinto para slug inexistente ou tenant inativo (não revela qual dos dois)
- Falha de WhatsApp nunca derruba uma action de negócio — `enviarWhatsapp` nunca lança
- Senha sempre `bcrypt` com custo 12; comparação contra hash dummy quando o usuário não existe, para não vazar existência por tempo de resposta
- Valores monetários em `Decimal(10,2)` no banco
- Erro não tratado nunca chega cru ao usuário — vai para `ErrorLog` e o usuário vê tela genérica
- Mobile-first (sidebar off-canvas com overlay abaixo de `lg`)

---

## Links relacionados

[[indice-kernel-academia]] — mapa completo dos artefatos do sistema
[[requisitos-funcionais-kernel-academia]] — RFs/NFRs detalhados por módulo
[[system-creation-kernel-academia]] — threshold respondido e diferença formal para o `academia-sandro`
