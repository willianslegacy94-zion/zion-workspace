---
status: draft
domain: kernelmei
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# PRD — KernelMei

> **Aviso de origem.** Este PRD foi escrito **a partir do código**, não antes dele. Não existe PRD original, README, story ou commit message no repositório `Kernel Workspace/kernelmei/` (o git local tem zero commits). Toda afirmação aqui rastreia a um arquivo real; onde a intenção do produto não é evidenciável, está marcado como pendente de confirmação, nunca preenchido por dedução.

## 1. Contexto

O [[prd-lane-confeitaria|lane-confeitaria]] é um sistema de gestão de confeitaria em produção — CRM em funil kanban, agenda com limite de produção diária, financeiro com CMV por sabor, e atendimento automático via WhatsApp (Mel/Quasar). Ele foi construído **single-tenant**: um `Usuario` sem dono, uma `ConfiguracaoSistema` singleton, um banco por cliente.

O KernelMei pega o mesmo domínio de negócio e o reconstrói como **produto whitelabel multi-tenant**. O comentário de cabeçalho do `prisma/schema.prisma` é a declaração de intenção mais explícita que existe no repositório:

> *"KernelMei — whitelabel multi-tenant pra confeitarias/doceiras. Regra de negócio (entidades, campos, cálculos) inspirada no lane-confeitaria (sistema single-tenant real da Confeitaria Artesanal da Lane) — mas este schema nasceu direto multi-tenant, nunca foi um retrofit: toda entidade de negócio carrega `tenantId` desde a primeira migration. Padrão de tenant (Tenant/SuperAdmin/features/branding) inspirado no kernel-foodservice."*

O nome situa o sistema numa família que já existe no workspace: `kernel/`, `kernel-academia/`, `kernel-foodservice/`, `kernelmei/`. O KernelMei é o **vertical de confeitaria** dessa família.

**O que "Mei" significa não está documentado no código** — nenhuma ocorrência de "MEI" ou "microempreendedor" em qualquer arquivo. Ver [[system-creation-kernelmei]], seção "O que este threshold NÃO conseguiu responder".

## 2. Problema

**Dor específica:** o produto de confeitaria só sabe atender um cliente por instalação.

**Como se manifesta (rastreado no schema do lane-confeitaria):**
- `ConfiguracaoSistema` é singleton — não há onde guardar "o limite de bolos/dia da doceira B"
- Não há entidade de cliente-da-plataforma: nenhum `Tenant`, nenhum ciclo de contratação
- Identidade visual embutida no CSS da marca da Lane, não configurável
- Todo módulo é obrigatório — não existe vender só o CRM sem o financeiro
- Cada nova cliente exigiria banco, deploy e domínio próprios

**Por que ferramenta genérica não resolve:** a mesma razão registrada no [[prd-lane-confeitaria]] — CRM/PDV de prateleira não tem o vocabulário do negócio (sabor, peso do bolo, sinal, acréscimo de glitter) nem o limite de produção diária embutido.

## 3. Objetivo

Após o sistema existir por completo:
- Uma confeitaria nova entra em operação por **provisionamento**, não por deploy — o operador cria o tenant no `/admin` e entrega login e senha
- Cada tenant enxerga **só** o próprio dado, com o isolamento garantido pela infraestrutura de acesso, não pela disciplina de quem escreve query
- Cada tenant tem cor e logo próprios sem fork de código
- Módulos são ligados/desligados por tenant, permitindo vender planos diferentes
- Inadimplência ou fim de teste se resolve com um kill-switch, não apagando dado

## 4. Usuário

Dois perfis, com **sessões deliberadamente separadas** no código (ver [[arquitetura-kernelmei]], seção 5):

**(a) A confeiteira/doceira — usuária de negócio.** Mesmo perfil descrito no [[prd-lane-confeitaria]]: acumula atendimento, produção e gestão. Loga em `/login` com e-mail e senha, cai direto em `/crm`. Nunca vê o slug do próprio tenant, nunca escolhe tenant na tela de login.

**(b) O operador da plataforma — SuperAdmin.** Não pertence a tenant nenhum. Loga em `/admin/login` (cookie próprio, sessão de 8h) e opera o ciclo de vida dos clientes: provisionar, ativar/desativar, redefinir senha de usuária, ler logs de erro de toda a plataforma. O `.env.example` nomeia o primeiro como `SUPERADMIN_NOME="Willians"`.

**Contexto de uso:** navegador. O `AppShell` tem navegação separada para `sm:` e mobile, o que indica intenção mobile-first herdada do lane — mas isso não foi validado com usuária real (nunca houve uma).

## 5. Hipótese de solução

Um único Next.js 16 multi-tenant, banco PostgreSQL compartilhado, discriminação por `tenantId` em toda entidade de negócio, com **três decisões que diferenciam o KernelMei dos sistemas de referência**:

1. **Isolamento estrutural, não disciplinar.** Um Prisma Client Extension (`scopedPrisma`) injeta `tenantId` em toda query e todo insert. Nenhum service escreve `tenantId` no `where` — a camada escreve por ele. O comentário no arquivo diz por quê: uma auditoria do `kernel-foodservice`, que usa só um `requireTenantId()` sem nada forçando seu uso, **encontrou 2 bugs reais de vazamento cross-tenant**.
2. **Schema multi-tenant desde a primeira migration**, nunca retrofit — a migration `20260809153741_multi_tenant` já cria tudo com `tenantId`.
3. **Sessão de SuperAdmin totalmente fora do NextAuth**, com cookie e JWT próprios, pra não espalhar um discriminador de tipo por toda checagem de sessão do sistema.

**Risco central herdado:** igual ao do lane — preço por sabor e custo de insumo dependem inteiramente de cadastro manual e não têm valor de fábrica. **Agravado aqui:** o KernelMei não semeia catálogo nenhum (o lane vinha com 44 sabores e 12 docinhos reais da cliente), então toda confeitaria nova começa com catálogo vazio.

## 6. Escopo

### Dentro — e implementado (verificado no código)

- **Ciclo de vida de tenant:** provisionamento transacional (Tenant + usuária admin + funil de 5 filas + config zerada), kill-switch `Tenant.ativo` checado no login, redefinição de senha de qualquer usuária, listagem cross-tenant
- **Isolamento por `tenantId`:** `scopedPrisma` cobrindo 14 modelos de negócio; verificado ponta a ponta por `scripts/verificar-isolamento.ts`
- **Autenticação dupla:** NextAuth v5 (Credentials, JWT) pra tenant + sessão `jose` separada pra SuperAdmin; mitigação de timing attack (hash dummy) nos dois fluxos
- **Feature flags por tenant:** núcleo inegociável (`pedidos`, `catalogo`, `agenda`) + 4 opcionais (`financeiro`, `dashboard`, `projecao`, `whatsappIA`), com o menu se adaptando
- **Branding por tenant:** `Tenant.branding` → CSS custom properties, com fallback pro tema de fábrica
- **CRM kanban:** filas configuráveis por 4 flags comportamentais, cards de `Pedido` e `Atendimento`
- **Catálogo:** sabores de bolo e itens de docinho, com preço e ativação
- **Precificação:** acréscimos configuráveis, sinal de 50%, retenção de sinal em cancelamento a menos de 24h
- **Observabilidade:** captura global de erro via `instrumentation.ts` → tabela `ErrorLog` → aba "Logs de Erro" no `/admin`
- **Camada de serviço completa:** 17 services cobrindo agenda, financeiro, CMV, metas, ranking, clientes, formas de pagamento

### Dentro do desenho, mas AINDA NÃO existe (lacuna real, não decisão)

- **4 das 7 telas do menu não têm página:** `/dashboard`, `/agenda`, `/financeiro`, `/projecao` estão no `AppShell` e no matcher do `src/proxy.ts`, e têm **service pronto por trás**, mas não têm `page.tsx`. Hoje esses links levam a 404.
- **Nenhum teste automatizado.** Vitest está no `devDependencies` e `npm test` está no `package.json`, mas **não existe um único arquivo de teste** nem `vitest.config`. Isso é uma regressão explícita em relação ao lane-confeitaria, cujo [[arquitetura-lane-confeitaria]] registra Vitest como "decisão de não repetir a lacuna" dos projetos de referência.
- **`recharts` e `zod` estão declarados como dependência e nunca importados** — provisionados para as telas de dashboard/validação que ainda não foram escritas.
- **Integração de entrada com o Quasar não foi portada:** o lane tem uma família de rotas `/api/internal/*` (atendimento automático, confirmação de sinal, movimentação de cartão). No KernelMei a única rota de API que existe é `/api/auth/[...nextauth]`.
- **Integração de saída com o Quasar é um stub consciente:** `quasarService.classificarDesistencia()` existe e é chamada de verdade, mas o próprio arquivo documenta que o endpoint do Quasar só atende o lane-confeitaria hoje — então a função **sempre retorna `INDEFINIDO`**. O comentário chama isso de "comportamento seguro" e aponta o padrão a construir (`buscar_tenant_whitelabel`, já usado pelo Kernel de barbearia).

### Fora (decisão registrada no próprio código)

- **Tela de criação de SuperAdmin** — o `.env.example` chama de "decisão deliberada: é uma conta de operação da plataforma, não de negócio". Novos SuperAdmins entram manualmente no banco.
- **Seletor de tenant no login** — o tenant é resolvido pelo e-mail. O schema documenta o efeito colateral aceito: e-mail é único **globalmente**, então dois tenants não podem ter o mesmo endereço; a convenção sugerida no onboarding é `admin@<slug>`.
- **Exclusão de tenant** — `Tenant` não tem `onDelete: Cascade` de propósito. O comentário em `verificar-isolamento.ts` explica: "deletar tenant é operação perigosa demais pra ser efeito colateral automático de FK — nunca exposta no produto, só o kill-switch `ativo` é".
- **Recálculo de features em runtime** — `features`/`branding` são snapshot no JWT, tirado no login. Trade-off explicitado em `src/lib/features.ts`: mudar `Tenant.features` só faz efeito no próximo login.

## 7. Métrica de sucesso

> Nenhuma métrica de sucesso está declarada no repositório. A tabela abaixo deriva das **garantias que o código se propõe a dar** e que são verificáveis hoje — não de metas de negócio, que precisam vir do Willians.

| Garantia | Como o código a sustenta | Verificada? |
|---|---|---|
| Tenant nunca enxerga dado de outro | `scopedPrisma` injeta `tenantId` em 14 modelos, em toda operação com `where`/`create`/`upsert` | Sim — `scripts/verificar-isolamento.ts` afirma 0 pedidos e 0 sabores visíveis cross-tenant |
| Tenant inadimplente perde acesso sem perder dado | `Tenant.ativo` checado no `authorize()` do NextAuth | Sim — mesmo script afirma o kill-switch |
| Onboarding não deixa tenant pela metade | `provisionTenant()` roda Tenant + Usuario + 5 Filas + Config numa `$transaction` | Sim — script afirma 5 filas e config zerada nos dois tenants |
| Erro em produção não some | `onRequestError` global grava em `ErrorLog`; falha de logging nunca mascara o erro original | Não — sem deploy, nunca exercitado em produção |
| Regra de negócio permanece testável | Cálculos puros isolados em `precificacaoService`/`rankingService`/`agendaService.dataMinimaEntrega` | **Não** — funções puras existem, testes não |

## 8. Requisitos de alto nível

**Funcionais:** ver [[requisitos-funcionais-kernelmei]] — RFs extraídos dos services e Server Actions realmente implementados, com marcação explícita do que tem service mas não tem tela.

**Não funcionais (todos rastreados a código):**
- Isolamento de tenant garantido por camada de acesso, não por convenção de escrita de query (`src/lib/scoped-prisma.ts`)
- Toda Server Action de negócio obtém o client já escopado via `requireDb()` — nunca importa `@/lib/prisma` direto. Exceção única e documentada: `onboardingService.ts`
- Senhas com bcrypt, custo 12; comparação em tempo constante contra hash dummy quando a conta não existe
- Valores monetários em `Decimal` no banco (`@db.Decimal`), com arredondamento explícito nas funções puras de precificação
- Rotas de negócio protegidas pelo matcher de `src/proxy.ts`; rotas `/admin/*` se protegem individualmente por não passarem pelo proxy
- Build Next.js em modo `standalone`, servido por imagem Docker slim sem `node_modules` de build

---

## Links relacionados

[[indice-kernelmei]] — mapa completo dos artefatos do sistema
[[system-creation-kernelmei]] — as 6 perguntas do threshold e o que ficou sem resposta
[[requisitos-funcionais-kernelmei]] — RFs por módulo, com estado real de cada um
[[arquitetura-kernelmei]] — stack, camadas, isolamento multi-tenant e lacunas técnicas
[[prd-lane-confeitaria]] — PRD do sistema de origem da regra de negócio
