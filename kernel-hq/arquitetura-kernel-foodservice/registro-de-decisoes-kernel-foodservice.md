---
status: draft
domain: kernel-foodservice
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Registro de Decisões — Kernel Foodservice

Decisões cronológicas com o que mudou, por que, e o impacto. Entradas novas sempre **no final** do arquivo (ver [[system-rules]], seção `ordem-de-entradas-em-logs`).

> **Fonte primária deste registro é atípica.** O repositório `Kernel Workspace/kernel-foodservice/` tem **zero commits** e nunca foi publicado — não existe mensagem de commit, PR ou issue pra reconstruir decisão nenhuma. As datas abaixo vêm de `mtime` de arquivo (aproximação, não histórico auditável) cruzadas com comentários densos deixados no próprio código, que neste projeto costumam explicar o *porquê*, não só o *o quê*. Onde não havia comentário explicando uma escolha, não há decisão registrada aqui — só o fato observado.

---

## 2026-07-29 — Fork do Jocley Grill como ponto de partida

`mtime` de `.eslintrc.json`, `.gitignore`, `tsconfig.json`, `Dockerfile` e `next-env.d.ts` marca o nascimento do repositório. Comparação de árvore (`diff -rq` contra `lanchonete-sistema/src/`) confirma que o Kernel Foodservice começou como cópia integral do Jocley Grill, não como projeto do zero.

**Por quê (inferido, sem comentário explícito para esta decisão específica):** o Jocley Grill era, na data, o sistema de foodservice mais completo e recente do workspace (PDV mesa+balcão, CMV por ficha técnica, KDS, inteligência financeira, gestão de time) — generalizar esse domínio pra multi-tenant reaproveita regra de negócio já validada em produção, em vez de reescrever do zero.

**Impacto:** todo bug/regra de negócio do domínio de foodservice existente no Jocley Grill (comissão, CMV, contador diário de comanda, split payment) foi herdado sem reescrita — só o isolamento por tenant é código novo.

---

## 2026-08-03/08 — Camadas de multi-tenancy adicionadas, inspiradas no Kernel

Entre essas datas (`mtime` de `deploy/nginx/`, `public/`, `.env.example`, `docker-compose.yml`, `package.json` na forma atual), as três camadas que diferenciam este sistema do Jocley foram construídas: isolamento por `tenantId`, modulação por `features`, e onboarding via painel super-admin.

**Por quê:** comentários no código citam o produto Kernel ([[arquitetura-kernel]]) nominalmente três vezes como referência conceitual — `admin-auth.ts` ("mesmo espírito do token `role: 'super_admin'` do Kernel"), `feature-guard.ts` ("mesmo espírito do `featureGate` do Kernel") e o schema Prisma (`SuperAdmin`, "mesmo espírito da conta `devmaster`"). Nunca código reaproveitado — o Kernel é Express+React, este é Next.js+Prisma — só o desenho.

**Impacto:** schema cresceu de 19 para 21 models (`+Tenant`, `+SuperAdmin`), `tenantId` propagado em 20 das 21 tabelas (exceto `OrderItem`, por decisão documentada no próprio schema — ver [[modelo-de-dados-kernel-foodservice]] §3).

**Decisão de produto que ficou sem registro explícito:** e-mail de usuário é único **globalmente**, não por tenant (`User.email @unique`, sem chave composta). O schema documenta a *consequência* ("usar `admin@nome-do-cliente`"), mas não o motivo da escolha original de não colocar slug na URL — ver pergunta 2 do threshold em [[system-creation-kernel-foodservice]], pendente de confirmação do Willians.

---

## 2026-08-09 — Migration única multi-tenant + correção de layout vazando entre painéis

Migration `20260809144326_init_multitenant` (510 linhas) é a **única** do projeto — o banco nasceu multi-tenant, não houve retrofit de um estado single-tenant anterior (mesmo padrão de decisão já visto em [[registro-de-decisoes-kernelmei]], sistema irmão da família `kernel*`).

Comentário no layout do painel `/admin` registra um bug real corrigido na mesma data: a sidebar do app de tenant aparecia dentro do painel super-admin porque os dois compartilhavam o layout raiz do Next.js. Corrigido isolando `admin/` do route group `(tenant)/`.

**Impacto:** os dois públicos (super-admin e equipe do tenant) hoje têm cascas visuais completamente independentes, sem risco de um vazar elementos de navegação do outro.

---

## 2026-08-10 — Criação desta documentação; sistema permanece nunca commitado, nunca deployado

Pasta `arquitetura-kernel-foodservice/` criada por leitura completa do código (174 arquivos), sem acesso a nenhum histórico de decisão além de comentários e `mtime`. Registrados **8 riscos não mitigados** (R1–R8 em [[arquitetura-kernel-foodservice]] §7), com destaque para R1 (instância de WhatsApp compartilhada entre todos os tenants — quebra a premissa de whitelabel) e R6 (credenciais de seed previsíveis, `superadmin@kernel`/`superadmin123`).

**Pendências que exigem decisão do Willians, sem as quais este documento não sai de `status: draft`:**
1. Quem é o público-alvo real / primeiro cliente (pergunta 2 do threshold — hoje só existe o tenant `demo`)
2. Por que este sistema foi construído agora, em paralelo ao [[arquitetura-kernelmei|KernelMei]] (mesma família, mesmo movimento arquitetural, nicho diferente)
3. Se o risco R1 (WhatsApp compartilhado) é aceitável pro primeiro cliente ou bloqueia deploy
4. Se `git init` + primeiro commit deve acontecer antes de qualquer mudança nova no código

---

## Links relacionados

[[system-creation-kernel-foodservice]] — threshold e lacunas
[[arquitetura-kernel-foodservice]] — riscos R1-R8 referenciados acima
[[indice-kernel-foodservice]] — mapa completo dos artefatos
