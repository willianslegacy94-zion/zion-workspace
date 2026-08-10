---
status: draft
domain: kernel-foodservice
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Requisitos Funcionais — Kernel Foodservice

> Referência: [[prd-kernel-foodservice]] | [[arquitetura-kernel-foodservice]]

Documento reconstruído por leitura do código em 2026-08-10, não capturado num kickoff — ver [[system-creation-kernel-foodservice]]. RFs numerados só nos módulos **novos** frente ao sistema de origem (multi-tenancy, modulação, onboarding). O domínio de foodservice em si (PDV, CMV, estoque, KDS, financeiro, gestão de time) é herdado sem mudança de regra de negócio de [[requisitos-funcionais-jocley-lanchonete]] — só ganhou escopo por `tenantId`, não referenciado aqui de novo pra não duplicar.

---

## Módulo 1 — Autenticação de tenant e isolamento

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-001 | Autentica usuário do tenant | dado e-mail + senha válidos via NextAuth Credentials | sessão JWT com `role`, `tenantId`, `tenantNome` e `features` resolvidos no login |
| RF-002 | Bloqueia login por tenant desativado | dado `Tenant.ativo = false` | login recusado pra **toda** a equipe do tenant, mesmo com senha certa |
| RF-003 | Bloqueia login por usuário desativado | dado `User.ativo = false` | login recusado só pra esse usuário |
| RF-004 | Escopa toda rota de negócio por tenant | dado requisição autenticada de tenant | `requireTenantId()` resolve `tenantId` da sessão e filtra a query — 40 das 44 rotas de negócio chamam essa função; as 4 restantes (`/api/users/*`, `/api/configuracoes/whatsapp/instancia`) escopam manualmente por `session.user.tenantId` |
| RF-005 | Impede vazamento de dado entre tenants em `OrderItem` | dado consulta a itens de comanda | isolamento por invariante de código (nunca consultado fora do contexto de uma `Order` já filtrada), não por coluna — ver risco R7 em [[arquitetura-kernel-foodservice]] |

---

## Módulo 2 — Modulação por feature flags

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-006 | Aplica módulo core obrigatório | qualquer tenant | `cardapio` sempre ligado, mesmo que `Tenant.features` tente desligar (`CORE_FEATURES` vence no merge) |
| RF-007 | Aplica 8 módulos opcionais por tenant | dado `Tenant.features = {chave: boolean}` | `mesas`, `balcao`, `cmv`, `estoque`, `inteligenciaFinanceira`, `gestaoDeTime`, `notificacoesWhatsapp`, `taxasDelivery` — cada um liga/desliga independente |
| RF-008 | Esconde módulo desligado da navegação | dado feature desligada pro tenant | `resolvePermissoes` zera as chaves de permissão associadas; sidebar/navbar não mostram o item, nem pra ADMIN |
| RF-009 | Bloqueia acesso a página de módulo desligado | dado usuário navega direto pra rota de módulo desligado | `requirePermissao` redireciona pro `/` |
| RF-010 | Bloqueia API de módulo desligado sem revelar existência | dado requisição a rota de módulo desligado | `guardFeature()` responde **404**, nunca 403 |

---

## Módulo 3 — Onboarding de tenant (painel super-admin)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-011 | Autentica super-admin fora do NextAuth | dado e-mail + senha de `SuperAdmin` válidos | cookie HMAC-SHA256 próprio (`kernel_admin_session`), 8h, `timingSafeEqual` na validação |
| RF-012 | Cadastra tenant novo numa única transação | dado nome, slug (validado por regex), cor primária, e-mail do admin e módulos marcados | cria `Tenant` + `User` ADMIN + `seedTenantBase` (12 mesas, 6 taxas de pagamento, 4 configs de notificação) — tudo ou nada |
| RF-013 | Gera senha temporária de acesso do tenant | dado tenant criado | `randomBytes(6)` devolvida uma única vez na resposta da criação — sem flag de "trocar no primeiro login" (ver risco R5) |
| RF-014 | Lista, edita e desativa tenants existentes | dado super-admin autenticado | CRUD completo em `/admin`, incluindo toggle de módulos e branding a qualquer momento |
| RF-015 | Cria e reseta senha de usuário de qualquer tenant | dado super-admin autenticado | mesmo padrão de credencial-única-vez de RF-013 |
| RF-016 | Lê logs de erro de todos os tenants | dado super-admin (ou conta fixa `devmaster`) autenticado | `ErrorLog` consultável globalmente, sem filtro de tenant |

---

## Módulo 4 — Notificações WhatsApp (multi-tenant)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-017 | Dispara notificações agendadas por tenant | dado `notificacoesWhatsapp` ligada e `ConfiguracaoNotificacao` configurada | agendador em processo (`instrumentation.ts`, tick de 60s) varre **todos** os tenants e dispara pros que estão na hora configurada |
| RF-018 | Envia via instância única compartilhada | dado disparo de qualquer tenant | usa a mesma instância Evolution API global (`EVOLUTION_INSTANCE` de env) — **risco R1**: cliente A recebe notificação vinda do número de WhatsApp do cliente B, quebra a premissa de whitelabel |
| RF-019 | Isola falha de notificação por tenant | dado um tenant falha o envio | os demais tenants continuam recebendo normalmente na mesma rodada do agendador |

---

## Lacunas conhecidas (não são requisitos — ausência confirmada no código)

- Sem slug na URL (`/t/:slug`) — e-mail de login é único globalmente, não por tenant (ver §5 do PRD)
- Sem entidade de billing/plano/assinatura — `Tenant.ativo` é o único controle comercial, manual
- Sem instância de WhatsApp por tenant (RF-018 acima)
- Sem testes automatizados de nenhum tipo
- Sem lock distribuído no agendador — só seguro com 1 réplica do app (risco R2)

---

## Links relacionados

[[prd-kernel-foodservice]] — problema, objetivo e escopo que estes RFs implementam
[[arquitetura-kernel-foodservice]] — como cada RF é tecnicamente garantido, riscos R1-R8
[[modelo-de-dados-kernel-foodservice]] — schema por trás de cada RF
[[indice-kernel-foodservice]] — mapa completo dos artefatos
[[requisitos-funcionais-jocley-lanchonete]] — RFs do domínio de foodservice herdado (PDV, CMV, KDS, financeiro)
