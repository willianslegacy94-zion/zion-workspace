---
status: draft
domain: kernelmei
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Registro de Decisões — KernelMei

Decisões cronológicas com o que mudou, por que, e o impacto. Entradas novas sempre **no final** do arquivo (ver [[system-rules]], seção `ordem-de-entradas-em-logs`).

> **Fonte primária deste registro é atípica.** Não existe Dev Agent Record, story, PRD ou commit message para este sistema — o repositório `orbita-workspace/kernelmei/` tem **zero commits**. As decisões abaixo foram reconstruídas a partir de **comentários de código**, que neste projeto são densos e explicam rationale (não apenas o "o quê"). Toda entrada cita o arquivo de onde veio. Onde não havia comentário, não há decisão registrada — e isso está dito.

---

## 2026-08-09 — Schema nasce multi-tenant, sem retrofit

Primeira migration do projeto (`20260809153741_multi_tenant`) já cria **toda** entidade de negócio com `tenantId`. O cabeçalho do `prisma/schema.prisma` marca isso como decisão explícita: *"este schema nasceu direto multi-tenant, nunca foi um retrofit"*.

**Por quê:** o caminho alternativo — nascer single-tenant e adicionar `tenantId` depois — produz uma janela em que linhas antigas ficam sem dono, e obriga uma migração de dados com backfill arriscado. Começar multi-tenant elimina a classe de bug inteira.

**Impacto:** o KernelMei não herda o schema do lane-confeitaria; herda o **domínio** dele. São dois bancos e dois schemas independentes, sem caminho de migração de dados entre eles.

---

## 2026-08-09 — Duas fontes de herança, mantidas separadas

O schema declara suas duas origens: regra de negócio do [[modelo-de-dados-lane-confeitaria|lane-confeitaria]] (entidades, campos, cálculos) e padrão de tenant do `kernel-foodservice` (`Tenant`/`SuperAdmin`, `features`, `branding`, junções puras sem `tenantId`).

**Impacto:** nenhuma regra de confeitaria foi inventada — cada uma rastreia ao lane, que por sua vez rastreia ao briefing real da cliente. E nenhum padrão de multi-tenancy foi improvisado.

---

## 2026-08-09 — Isolamento por Prisma Extension em vez de `requireTenantId()` solto

**A decisão técnica mais importante do sistema.** `src/lib/scoped-prisma.ts` intercepta `$allOperations` e injeta `tenantId` automaticamente em 14 modelos, em `where`, `data`, `createMany` e `upsert`.

**Por quê (citado do comentário do arquivo):** a referência de arquitetura, o `kernel-foodservice`, usa só um `requireTenantId()` que devolve o valor sem nada forçando seu uso — e *"uma auditoria de código encontrou 2 bugs reais de vazamento cross-tenant lá por causa disso (rota que esqueceu `tenantId` no `where`)"*.

**Trade-off assumido, declarado no próprio arquivo:** o extension não impede alguém de importar `@/lib/prisma` (o client cru) por engano. Isso segue sendo convenção, reforçada pelo padrão de todo service receber `db: ScopedPrisma` por parâmetro.

**Impacto:** nenhum service escreve `tenantId` em `where`. Um bug de vazamento passa a exigir um erro estrutural (importar o client errado), não um esquecimento de uma linha.

---

## 2026-08-09 — `tenantId` próprio só para quem é ponto de entrada de consulta

`PedidoSabor` e `ReceitaInsumo` **não** carregam `tenantId` — são junções puras, só alcançadas através de um pai já escopado. `Agendamento`, que também é filho de `Pedido`, **carrega**, porque é *"consultado diretamente por `(tenantId, data)` pra checar limite diário, não só alcançado através de um `Pedido` já filtrado"*.

**Impacto:** a heurística está registrada e é aplicável a entidades futuras — a pergunta certa não é "é filho?", é "alguém consulta isso direto?".

---

## 2026-08-09 — Login global por e-mail, sem seletor de tenant

O tenant é resolvido a partir de qual `Usuario` bateu com o e-mail. Não há campo de tenant na tela de login, e o `slug` *"nunca aparece na tela de login da usuária"*.

**Por quê:** minimizar fricção pra confeiteira, que não deveria precisar saber o que é um tenant.

**Custo aceito, documentado no schema e implementado como erro de validação:** e-mail é único **globalmente**. Duas confeitarias não podem ter o mesmo endereço, e `provisionTenant()` rejeita a colisão sugerindo `admin@<slug>`.

---

## 2026-08-09 — Sessão de SuperAdmin fora do NextAuth

`src/lib/admin-session.ts` implementa JWT HS256 com `jose`, cookie `kernelmei_admin_session`, 8h de validade — sem nenhuma dependência do NextAuth.

**Por quê (comentário do arquivo):** *"um SuperAdmin nunca pertence a um tenant, e misturar os dois num único `session.user` exigiria um discriminador de tipo espalhado por toda checagem de sessão do sistema"*.

**Consequência arquitetural em cascata:** `/admin/*` fica **fora** do matcher de `src/proxy.ts` (o proxy é o `auth` do NextAuth e redirecionaria um SuperAdmin válido pro `/login`), e cada página de admin chama `obterSessaoAdmin()` por conta própria.

---

## 2026-08-09 — Kill-switch em vez de exclusão de tenant

`Tenant.ativo` é checado no `authorize()` do NextAuth. `Tenant` **não** tem `onDelete: Cascade` em nenhuma relação filha.

**Por quê** (comentário em `scripts/verificar-isolamento.ts`): *"deletar tenant é operação perigosa demais pra ser um efeito colateral automático de FK — nunca exposta no produto, só o kill-switch `ativo` é"*.

**Impacto:** inadimplência e fim de teste se resolvem sem perder dado. Apagar um tenant de verdade exige limpar 14 tabelas na ordem correta, manualmente — como o próprio script de verificação faz com seus tenants descartáveis.

---

## 2026-08-09 — Features e branding como snapshot no JWT

`resolveFeatures()` é chamado uma vez, no login, e o resultado vai pro token. `CORE_FEATURES` (`pedidos`, `catalogo`, `agenda`) é aplicado **por último** no spread, tornando impossível desligá-los via `Tenant.features`.

**Trade-off explicitado em `src/lib/features.ts`:** *"mudar `Tenant.features` exige a usuária deslogar/logar de novo pra ver o efeito"*. Decisão herdada do `kernel-foodservice`.

---

## 2026-08-09 — Branding por CSS custom property com fallback, não por objeto de tema

`brandingParaCssVars()` só escreve a variável CSS que o tenant configurou; o resto é coberto pelo `var(--tenant-X, <fallback>)` do `globals.css`.

**Por quê:** elimina merge de objeto de tema e default espalhado em JavaScript. Um tenant que configurou só a cor primária herda todo o resto sem código adicional.

**Impacto:** nenhum componente lê `Tenant.branding`; nomes de classe Tailwind são estáveis entre tenants. Ver [[design-system-kernelmei]].

---

## 2026-08-09 — Provisionamento transacional com funil padrão

`provisionTenant()` cria, numa `$transaction`, o `Tenant` + a usuária admin + 5 `Fila` + `ConfiguracaoSistema` zerada. O funil padrão replica o funil **real de produção** do lane-confeitaria (Novo Cliente → Em negociação → Atendimento humanizado → Agendado → Pago), com os flags correspondentes.

**Duas decisões deliberadas de "nascer vazio":**
- `ConfiguracaoSistema` nasce com todos os acréscimos em zero — *"a usuária configura depois"*
- **Nenhum catálogo é semeado** — diferente do lane, que vinha com 44 sabores e 12 docinhos da cliente real

**Impacto:** onboarding nunca deixa tenant pela metade, mas a confeitaria nova começa com catálogo e preços vazios. Ver [[requisitos-funcionais-kernelmei]], RF-5.5.

---

## 2026-08-09 — Sem tela de criação de SuperAdmin

O `.env.example` registra a decisão em comentário: novos SuperAdmins são *"criados manualmente no banco (não há tela de 'criar SuperAdmin' — decisão deliberada, é uma conta de operação da plataforma, não de negócio)"*. `prisma/seed.ts` cria só o primeiro, por `upsert`.

---

## 2026-08-09 — Isolamento verificado por execução, não só por revisão

`scripts/verificar-isolamento.ts` provisiona dois tenants reais, cria sabor e pedido no A, e afirma que o B enxerga **zero** pedidos e **zero** sabores, enquanto o client cru confirma que o dado existe no banco. Depois desativa o A e confirma o kill-switch. No final, limpa tudo.

O cabeçalho do arquivo define seu papel: *"não faz parte do produto, roda uma vez pra provar isolamento real entre tenants antes de considerar a fundação pronta"*.

**Impacto:** a garantia central do produto tem prova de execução. **Limite:** é asserção manual contra banco real, não repetível em CI (cria e apaga dado sem rollback).

---

## 2026-08-09 — Lição de deploy importada antes do primeiro deploy

O comentário do serviço `migrate` no `docker-compose.yml` referencia o playbook do lane-confeitaria: *"Sempre `docker compose build migrate` antes do `run` quando houver migration nova — imagem em cache não pega migration nova"*.

**Por que vale registrar:** esse foi um incidente real de produção no lane (migration commitada, imagem em cache, coluna faltando no Postgres, 500 opaco em `/crm` — ver [[modelo-de-dados-lane-confeitaria]]). Aqui ele chegou como comentário preventivo, num sistema que ainda nem tem deploy. É conhecimento operacional atravessando sistemas, que é exatamente o que o kernel-hq existe pra fazer.

---

## 2026-08-10 — Observabilidade global via `instrumentation.ts`

Migration `add_error_log` + `onRequestError` capturando erro de Server Component, Route Handler e Server Action **sem instrumentar cada action individualmente**, alimentando a aba "Logs de Erro" do `/admin`.

**Três cuidados implementados de propósito:**
- guard `NEXT_RUNTIME !== "nodejs"` — Prisma não roda no Edge, e o proxy roda no Edge
- imports dinâmicos de `@/lib/error-log` e `@/auth`, pra não puxar Prisma pro bundle Edge
- `registrarErro` **nunca lança** — *"se a própria gravação falhar, só loga no console pra não mascarar o erro original com um erro secundário de logging"*

`ErrorLog.tenantId` é opcional porque *"um erro pode acontecer antes da sessão/tenant serem resolvidos (ex.: no próprio login)"*.

---

## 2026-08-10 — Integração com o Quasar entregue pela metade, conscientemente

Só a direção **de saída** existe: `quasarService.classificarDesistencia()`, chamada de verdade por `pedidoService` e `atendimentoService`. Mas o comentário do arquivo abre com "GAP CONHECIDO" e explica que o endpoint do Quasar hoje só atende o lane-confeitaria (instância fixa), então a função **sempre devolve `INDEFINIDO`** — *"comportamento seguro (nunca trava a Lane marcando desistência), só não classifica de verdade ainda"*.

O caminho de solução também está registrado: o padrão `buscar_tenant_whitelabel`/`resolve-instancia` já usado pelo Kernel de barbearia, a ser construído do lado do Quasar.

A direção **de entrada** (rotas `/api/internal/*` do lane) não foi portada.

**Impacto:** o flag `whatsappIA` liga/desliga só a UI, e o comentário em `features.ts` diz isso — *"o flag existe pra não bloquear o desenho da tela enquanto essa integração não é construída do lado do Quasar"*.

---

## 2026-08-10 — Documentação de arquitetura criada no kernel-hq

Pasta `arquitetura-kernelmei/` criada com 7 artefatos, por leitura direta do código (nenhuma outra fonte de intenção existe no repositório). Registrada em [[folder-purpose]] e [[ecosystem-guide]].

**Threshold respondido retroativamente** — ver [[system-creation-kernelmei]]. Isso viola a ordem prescrita pela regra operacional do [[system-creation-threshold]] ("se você não consegue responder as seis perguntas, não crie a pasta"), e está assumido explicitamente: o sistema foi construído primeiro.

**Decisão de escopo da documentação:** `ui-kit-kernelmei` e `ux-flows-kernelmei` **não** foram criados. Com 4 das 7 telas do menu ainda inexistentes, um inventário de componentes ou um mapa de jornadas ficaria desatualizado na sessão seguinte, e boa parte teria que ser suposta. Registrados como backlog em [[indice-kernelmei]].

---

## Pendências que exigem decisão do Willians

Levantadas durante a documentação. Nenhuma tem resposta no código — por isso estão aqui e não como decisão registrada.

| # | Pendência | Por que importa |
|---|---|---|
| 1 | **O que "Mei" significa no nome.** Nenhuma ocorrência de "MEI"/"microempreendedor" em nenhum arquivo. A única glosa existente é *"whitelabel multi-tenant pra confeitarias/doceiras"*. | Define se o produto é "o Kernel para MEIs" (posicionamento transversal, que um dia serviria outros nichos) ou "o Kernel de confeitaria" (vertical). Muda o roadmap. |
| 2 | **Zero commits e sem remote.** O código existe em uma única cópia, numa máquina só. | Risco de perda total. É a pendência mais urgente e independe de qualquer decisão de produto. |
| 3 | **Vitest instalado, nenhum teste escrito.** | Regressão explícita frente ao lane-confeitaria, cuja arquitetura registra Vitest como "decisão de não repetir a lacuna" dos projetos de referência. As funções puras de precificação são alvo barato e de alto retorno. |
| 4 | **Tema de fábrica é a paleta da Lane.** Toda confeitaria nova, antes de configurar branding, se parece com a Lane. | Aceitável como provisório, questionável como default de produto. Não há registro de que tenha sido avaliado. |
| 5 | **Sinal de 50% e retenção em 24h fixos no código.** Uma confeitaria que trabalhe com 30% exige mudança de código. | Num whitelabel, é candidato natural a `ConfiguracaoSistema`. Não há comentário indicando se foi avaliado. |
| 6 | **KernelMei substitui ou coexiste com o lane-confeitaria?** | Não há script de migração de dados; o `quasarService` fala do lane no presente. Define se a Lane vira o primeiro tenant ou segue em instalação própria. |
| 7 | **`Tenant.features` e `Tenant.branding` não têm UI de edição no `/admin`.** | Hoje só dá pra alterar direto no banco, o que trava o onboarding autônomo que o painel se propõe a resolver. |
| 8 | **Existe cliente real esperando este produto?** | O sistema nunca rodou com tenant de negócio. Define se a prioridade é completar as 4 telas faltantes ou consolidar a fundação. |

---

## Links relacionados

[[indice-kernelmei]] — mapa completo dos artefatos do sistema
[[prd-kernelmei]] — problema, escopo e o que ainda não existe
[[requisitos-funcionais-kernelmei]] — RFs com estado real de cada um
[[arquitetura-kernelmei]] — decisões técnicas em detalhe
[[registro-de-decisoes-lane-confeitaria]] — memória do sistema de origem
