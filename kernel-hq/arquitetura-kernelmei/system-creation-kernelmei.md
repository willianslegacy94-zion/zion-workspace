---
status: draft
domain: kernelmei
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# System Creation Threshold — KernelMei

Resposta às 6 perguntas obrigatórias de [[system-creation-threshold]].

**Particularidade deste threshold:** ele foi respondido **retroativamente**, lendo o código real em `Kernel Workspace/kernelmei/`, e não antes da construção como manda a regra operacional. O sistema foi construído primeiro, a pasta de arquitetura veio depois. Onde o código não evidencia a resposta, está escrito que não evidencia — nenhuma resposta foi preenchida por dedução.

---

## Respostas ao threshold

| Pergunta | Resposta | Rastreio |
|---|---|---|
| **1. Qual problema esse sistema resolve?** | O [[indice-lane-confeitaria\|lane-confeitaria]] resolveu a gestão de uma confeitaria (CRM em funil, agenda com limite de produção, financeiro/CMV), mas nasceu **single-tenant**: uma instância inteira — banco, deploy, domínio — por cliente. Vender esse mesmo produto pra uma segunda doceira exigiria duplicar o sistema. O KernelMei existe pra que várias confeitarias/doceiras rodem no **mesmo código-base e no mesmo banco**, isoladas por `tenantId`, com marca e módulos próprios. | Comentário de cabeçalho do `prisma/schema.prisma`: *"whitelabel multi-tenant pra confeitarias/doceiras"*; `Tenant.features`, `Tenant.branding`, `src/lib/scoped-prisma.ts` |
| **2. Para quem?** | Dois públicos distintos, com sessões separadas no código: **(a) a confeiteira/doceira** de cada tenant, que usa `/crm`, `/clientes`, `/configuracoes` — mesmo perfil de usuária da Lane; **(b) o operador da plataforma** (SuperAdmin), que usa `/admin` pra provisionar tenants, ativar/desativar, redefinir senha e ler logs de erro. O `.env.example` nomeia o SuperAdmin inicial como `SUPERADMIN_NOME="Willians"`. | `src/app/(app)/*` vs `src/app/admin/*`; `src/lib/admin-session.ts`; `.env.example` |
| **3. Qual é o output esperado?** | Uma plataforma web multi-tenant onde cada confeitaria recebe: funil kanban de pedidos com filas configuráveis, catálogo de sabores/docinhos, precificação automática (sinal 50%, acréscimos), agenda com limite diário, financeiro/CMV, metas, ranking e projeção — **com módulos ligáveis por tenant** (`Tenant.features`) e **cor/logo próprios** (`Tenant.branding`). Mais um painel de operação (`/admin`) pra onboarding de novos clientes. **Estado real: entregue parcialmente** — ver [[prd-kernelmei]], seção 6. | `src/lib/features.ts`, `src/lib/theme.ts`, `src/server/services/onboardingService.ts` |
| **4. Quais inputs o sistema precisa para funcionar?** | Um `SuperAdmin` semeado via `prisma/seed.ts` (a partir de `SUPERADMIN_EMAIL`/`SUPERADMIN_SENHA` no `.env`); depois disso, cada tenant nasce por `provisionTenant()` com slug, nome e a conta admin da usuária. O provisionamento já cria o funil padrão de 5 filas e uma `ConfiguracaoSistema` **zerada**. Todo o resto — preço por sabor, custo de insumo, valores de acréscimo, limite de bolos/dia — é cadastro manual de cada confeitaria. **O sistema não semeia catálogo nenhum** (diferente do lane-confeitaria, que vinha com 44 sabores + 12 docinhos da cliente real). | `prisma/seed.ts`, `onboardingService.provisionTenant()`, `ConfiguracaoSistema` com `@default(0)` |
| **5. Qual é o primeiro artefato concreto?** | O par **painel `/admin` + isolamento de tenant provado**: provisionar dois tenants e demonstrar que um não enxerga o dado do outro. Isso existe e foi executado — `scripts/verificar-isolamento.ts` cria os tenants A e B, cria sabor e pedido em A, afirma que B não vê nada, testa o kill-switch `Tenant.ativo` e limpa tudo no final. | `scripts/verificar-isolamento.ts` |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Tem código-base próprio (`Kernel Workspace/kernelmei/`), schema Prisma próprio, banco próprio (`kernelmei` na porta 5438), Dockerfile e `docker-compose.yml` próprios, ciclo de vida de tenant próprio (provisionamento, kill-switch, features, branding) e um público — o SuperAdmin — que **não existe** no lane-confeitaria. Não é uma variação de configuração do lane: é um produto de plateleira com onboarding, enquanto o lane é a instalação de uma cliente. | `package.json` (`name: kernelmei`), `docker-compose.yml`, `prisma/migrations/20260809153741_multi_tenant/` |

---

## O que este threshold NÃO conseguiu responder

Registrado aqui porque o Artigo IV (No Invention) proíbe preencher com suposição:

### O significado de "Mei" no nome

Não há **nenhuma** ocorrência de "MEI", "microempreendedor" ou qualquer expansão da sigla no código, comentários, schema, `.env.example` ou config. A única glosa do nome que existe no repositório é a primeira linha do `prisma/schema.prisma`:

> `// KernelMei — whitelabel multi-tenant pra confeitarias/doceiras.`

A leitura "MEI = Microempreendedor Individual" é **plausível** (o [[prd-lane-confeitaria]] descreve a Lane como "MEI solo", e o público-alvo do produto é exatamente esse perfil), mas é inferência, não evidência. **Pendente de confirmação do Willians** — ver [[registro-de-decisoes-kernelmei]].

### Se existe cliente real contratado

O sistema nunca foi executado com um tenant de negócio real: os únicos tenants que o código cria são `verif-a-*` e `verif-b-*`, do script de verificação, e ambos são apagados ao final. Não há seed de tenant, não há dado de cliente, não há deploy. Se já existe uma segunda doceira aguardando esse produto, isso não está no repositório.

### Se o KernelMei substitui ou coexiste com o lane-confeitaria

O código trata o lane-confeitaria como **referência de regra de negócio**, não como algo a ser migrado — não há script de migração de dados, e o `quasarService.ts` fala do lane no presente ("hoje só existe pro lane-confeitaria"), sugerindo coexistência. Mas nenhuma decisão de descontinuar o lane está registrada em lugar nenhum.

---

## Status do threshold

**Status:** aprovado retroativamente (pasta criada em 2026-08-10 para um sistema já construído).

**Estado real do sistema em 2026-08-10:**
- Fundação multi-tenant **completa e verificada** (isolamento provado por script, kill-switch testado)
- Camada de serviço **portada quase inteira** do lane-confeitaria (17 services, 8 módulos de Server Actions)
- Interface **parcial** — 4 dos 7 destinos do menu não têm página (`/dashboard`, `/agenda`, `/financeiro`, `/projecao`)
- **Nunca versionado:** repositório git local com **zero commits** e sem remote
- **Nunca deployado:** sem VPS, sem domínio, sem tenant real
- **Sem testes:** Vitest instalado e com script `npm test`, mas nenhum arquivo de teste existe

Ver [[prd-kernelmei]] (escopo entregue vs. pendente) e [[arquitetura-kernelmei]] (lacunas técnicas).

---

## Links relacionados

[[indice-kernelmei]] — mapa de todos os artefatos do sistema
[[prd-kernelmei]] — problema, usuário, escopo e o que ainda não existe
[[system-creation-threshold]] — as 6 perguntas na sua forma canônica
[[system-creation-lane-confeitaria]] — threshold do sistema de origem da regra de negócio
