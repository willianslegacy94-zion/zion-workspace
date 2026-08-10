---
status: stable
domain: governance
source: claude
created: 2026-05-24
updated: 2026-08-10
owner: willians
---

# Estrutura do kernel-hq

Mapa de cada pasta dentro de `kernel-hq`: o que representa, quando é usada e o que não pertence a ela.

Toda pasta nova criada aqui deve estar registrada neste documento antes de ser usada.

---

## 00-governance

**O que é:** lei dos documentos dentro dos sistemas de `kernel-hq`. Define o que um arquivo de sistema precisa ter.

Contém:
- propriedades obrigatórias de frontmatter (status, domain, source, created, updated, owner)
- estrutura de pastas do kernel-hq (este documento)
- workflow operacional de desenvolvimento
- protocolo de colaboração com IA (Claude e outros agentes)
- regras de promoção de status dos artefatos

Diferença do `00-governance-systems`: este define como os documentos devem ser estruturados. O `00-governance-systems` define o que um sistema precisa provar antes de virar pasta.

Quando usar: antes de criar qualquer arquivo dentro de qualquer sistema aqui. Antes de iniciar qualquer sessão com uma IA neste workspace.

---

## 00-governance-systems

**O que é:** lei de criação de sistemas. Define o que um sistema precisa ter para começar a ser construído — não sobre arquivos, mas sobre requisitos de existência.

Contém:
- `system-creation-threshold.md` — as 6 perguntas que todo sistema precisa responder antes de virar pasta
- templates das 8 camadas arquiteturais: PRD, requisitos funcionais, arquitetura técnica, modelo de dados, design system, UI kit, UX flows, registro de decisões

Quando usar: sempre que um novo sistema ou produto estiver sendo cogitado. Se não passa pelo threshold definido aqui, não vira pasta.

---

## 00-types

**O que é:** tipos e padrões reutilizáveis entre sistemas. Material compartilhado que não pertence a um sistema específico.

Quando usar: quando um padrão de um sistema pode ser aproveitado por outro — evita duplicação entre `arquitetura-thieco/` e `arquitetura-villamill/`.

---

## arquitetura-thieco

**O que é:** conjunto completo de artefatos do Sistema de Caixa Barbearia Thieco Leandro.

Contém (10 artefatos):
- `system-creation-thieco.md` — threshold respondido: as 6 perguntas que justificam a existência do sistema
- `indice-thieco.md` — mapa de todos os artefatos e ordem de leitura recomendada
- `prd-thieco.md` — problema, objetivo, usuário, escopo e métricas
- `requisitos-funcionais-thieco.md` — 39 RFs em 10 módulos + 6 RNFs
- `arquitetura-thieco.md` — stack (Node.js + Express + PostgreSQL + Docker + React + Nginx), camadas, fluxo de dados, segurança e escala
- `modelo-de-dados-thieco.md` — 11 entidades, atributos reais do banco, relacionamentos, estados e ciclo de retenção
- `design-system-thieco.md` — 5 princípios de design, tokens de cor/tipografia/espaçamento, componentes, voz
- `ui-kit-thieco.md` — inventário de componentes atômicos e compostos, layouts e templates de tela
- `ux-flows-thieco.md` — pesquisa, jornadas, arquitetura de informação, fluxos e iterações
- `registro-de-decisoes-thieco.md` — memória viva: 7 decisões cronológicas do sistema

Status do sistema: em produção desde 2024, evolução contínua.

Quando abrir: quando for trabalhar no Sistema de Caixa — desenvolvimento, decisão arquitetural, sessão de IA.

---

## arquitetura-villamill

**O que é:** conjunto completo de artefatos do Sistema VillaMill Tamboré — PDV full-stack para restaurante/bar com controle de mesas, insumos e relatório financeiro.

**Stack:** Next.js 15 + PostgreSQL 16 + NextAuth v5 + Docker

Contém (10 artefatos): mesma estrutura de `arquitetura-thieco/`, com sufixo `-villamill`.

Quando abrir: quando for trabalhar no Sistema VillaMill.

---

## arquitetura-ivsstore

**O que é:** artefatos do IVSSTORE — ERP para loja de vestuário infantil e perfumaria com PDV, importação de NF-e XML, caderninho de fiado e fluxo de caixa.

**Stack:** React 18 + Node.js/Express + PostgreSQL + Docker

Contém (4 artefatos — conjunto parcial, sem threshold nem indice):
- `prd-ivsstore.md` — problema, objetivo, usuário, funcionalidades MVP e roadmap
- `arquitetura-ivsstore.md` — stack, camadas e fluxo de dados
- `modelo-de-dados-ivsstore.md` — entidades, atributos e relacionamentos
- `design-system-ivsstore.md` — tokens visuais e sistema de design

Status: MVP funcional em produção local. Propriedade 100% Willians.

Quando abrir: quando for trabalhar no IVSSTORE — estoque, PDV, fiado ou fluxo de caixa.

---

## arquitetura-kernel

**O que é:** artefatos do Kernel — produto SaaS de gestão de caixa e comissões para estabelecimentos de serviços (barbearias, salões, clínicas), multi-tenant via variáveis de ambiente. Nasce do `sistema-thieco` generalizado.

**Stack:** React 18 + Node.js/Express + PostgreSQL + Docker (multi-tenant)

Contém (7 artefatos):
- `indice-kernel.md` — ponto de entrada e mapa de artefatos
- `prd-kernel.md` — produto, personas, problema e escopo
- `requisitos-funcionais-kernel.md` — RFs por módulo
- `arquitetura-kernel.md` — stack, camadas, multi-tenancy
- `modelo-de-dados-kernel.md` — entidades e relacionamentos
- `design-system-kernel.md` — tokens visuais por tenant e branding
- `registro-de-decisoes-kernel.md` — memória viva

Quando abrir: quando for onboarding de novo cliente, implementar feature no produto ou comparar com o sistema-thieco de origem.

---

## arquitetura-horizon

**O que é:** artefatos do Agente Órbita Horizon — atendimento receptivo EAD multi-tenant com validação de aluno por e-mail e transbordo para CRM humano. Primeiro nível da Holding de Robôs.

**Stack:** Python + FastAPI + SQLite + OpenRouter (Claude 3 Haiku)

Contém (8 artefatos):
- `system-creation-horizon.md` — threshold respondido
- `indice-horizon.md` — ponto de entrada e mapa de artefatos
- `prd-horizon.md` — problema, objetivo, usuário e métricas
- `requisitos-funcionais-horizon.md` — 4 módulos: tenants, autenticação, chat, infraestrutura
- `arquitetura-horizon.md` — stack, camadas, autenticação e escala
- `modelo-de-dados-horizon.md` — 3 entidades, feature flags e ciclo de vida
- `integracoes-horizon.md` — contrato OpenRouter, webhook, stub CRM
- `registro-de-decisoes-horizon.md` — memória viva

Quando abrir: quando for desenvolver ou configurar o agente de suporte EAD.

---

## arquitetura-pulsar

**O que é:** artefatos do Agente Órbita Pulsar — atendimento conversacional multi-tenant para PMEs com camada passiva (qualificação de leads) e camada ativa (disparos sistêmicos: alertas, cobranças, recuperação). Segundo nível da Holding de Robôs.

**Stack:** Python + FastAPI + SQLite + OpenRouter (Claude 3.5 Sonnet)

Contém (8 artefatos):
- `system-creation-pulsar.md` — threshold respondido
- `indice-pulsar.md` — ponto de entrada e mapa de artefatos
- `prd-pulsar.md` — problema, objetivo, usuário e métricas
- `requisitos-funcionais-pulsar.md` — 4 módulos: tenants, chat passivo, disparos, qualificação
- `arquitetura-pulsar.md` — stack, camadas, segurança e escala
- `modelo-de-dados-pulsar.md` — 3 entidades, feature flags e ciclo de vida
- `integracoes-pulsar.md` — contrato OpenRouter, webhook inbound/outbound, tags de automação
- `registro-de-decisoes-pulsar.md` — memória viva

Quando abrir: quando for trabalhar no agente Pulsar — qualificação de leads, webhook de disparos ou integração ERP.

---

## arquitetura-quasar

**O que é:** artefatos do Órbita Quasar — engine de atendimento AI para mentorias e serviços de alto ticket. Concierge de elite com agendamento autônomo via Function Calling e fechamento comercial. Terceiro nível da Holding de Robôs.

**Stack:** Python + FastAPI + SQLite + OpenRouter (Claude 3.5 Sonnet)

Contém (6 artefatos — conjunto parcial, sem indice nem system-creation):
- `prd-quasar.md` — o que é, problema, persona e capacidades por feature flag
- `arquitetura-tecnica-quasar.md` — stack, camadas e fluxo de dados
- `comportamento-quasar.md` — persona, tom de voz e regras conversacionais
- `fluxos-conversacionais-quasar.md` — fluxos de atendimento, agendamento e fechamento
- `base-de-conhecimento-quasar.md` — estrutura da base de conhecimento por tenant
- `registro-de-decisoes-quasar.md` — memória viva

Status: draft (2026-06-25). Em desenvolvimento.

Quando abrir: quando for trabalhar no Quasar — feature de agendamento, fechamento comercial ou onboarding de tenant de mentoria.

---

## arquitetura-cortex

**O que é:** artefatos do Órbita Cortex — cérebro analítico central da Holding de Robôs. Motor de ingestão de dados, classificação comportamental via IA e sincronização de flags operacionais (`status_churn_risk`, `recomendacao_upsell`) para os agentes Horizon, Pulsar e Quasar.

**Stack:** Python + FastAPI + SQLite + OpenRouter (Claude 3.5 Sonnet)

Contém (8 artefatos):
- `system-creation-cortex.md` — threshold respondido
- `indice-cortex.md` — ponto de entrada e mapa de artefatos
- `prd-cortex.md` — problema, objetivo, usuário e métricas
- `requisitos-funcionais-cortex.md` — 3 módulos: ingestão, classificação IA, sincronização de flags
- `arquitetura-cortex.md` — stack, camadas, fluxo de dados e escala
- `modelo-de-dados-cortex.md` — entidade `matriz_inteligencia`, flags operacionais e ciclo de vida
- `integracoes-cortex.md` — contratos de entrada (plataformas) e saída (Horizon, Pulsar, Quasar)
- `registro-de-decisoes-cortex.md` — memória viva

Quando abrir: quando for trabalhar no motor analítico — flags de classificação, contratos de integração ou entidade `matriz_inteligencia`.

---

## arquitetura-kalel

**O que é:** artefatos do Kernel Kalel — agente de atendimento e agendamento conversacional por WhatsApp **exclusivo do Kernel**. Fork do Quasar (2026-08-05), sem nenhuma lógica de sistema-thieco ou lane-confeitaria. Toda a persona e as regras de negócio vêm em tempo real do backend do Kernel (`/internal/*`); o agente não guarda configuração de tenant. Nome do assistente é customizável por tenant — "Kalel" é só o padrão.

**Stack:** Python 3.12 + FastAPI 0.110 + SQLite (só histórico de conversa) + OpenRouter + Evolution API

**Código-fonte:** `orbita-workspace/Kernel-Kalel/` — repositório próprio `github.com/willianslegacy94-zion/kernel-kalel` (privado, `main`)

Contém (8 artefatos):
- `system-creation-kalel.md` — threshold respondido
- `indice-kalel.md` — ponto de entrada e mapa de artefatos
- `prd-kalel.md` — problema, objetivo, usuário e métricas
- `requisitos-funcionais-kalel.md` — 21 RFs em 5 módulos: entrada, contexto/prompt, geração, ferramentas, saída no WhatsApp
- `arquitetura-kalel.md` — stack, camadas, fluxo de dados, Docker (porta 5013) e segurança
- `modelo-de-dados-kalel.md` — tabela `historico_conversas` e o que o Kalel deliberadamente não guarda
- `integracoes-kalel.md` — contratos com Kernel, Brainiac, OpenRouter, Evolution API e Telegram
- `registro-de-decisoes-kalel.md` — memória viva (RD-001 a RD-013)

Status do sistema: **experimental** — testado ponta a ponta localmente (2026-08-05), chaves OpenRouter/Evolution ainda placeholder e deploy na VPS nova pendente.

Quando abrir: quando for trabalhar no atendimento por WhatsApp do Kernel — persona/FAQ dinâmico, ferramentas de confirmação/cancelamento de agendamento, transbordo para humano ou integração com a Evolution API.

**Nota de governança:** o par do Kalel é o **Brainiac** (abaixo) — os dois formam os agentes próprios do Kernel.

---

## arquitetura-brainiac

**O que é:** artefatos do Kernel Brainiac — agente de notificações e "Raio-X do gestor" **exclusivo do Kernel**. Fork do Cortex (2026-08-05) **sem o núcleo analítico**: entrega no WhatsApp do admin as notificações geradas pelo backend, interpreta pergunta livre do gestor (faturamento, produtos mais vendidos, serviços mais realizados, estoque parado) e devolve o relatório formatado. Também serve o contexto de cliente que o Kalel consome.

**Stack:** Python 3.12 + FastAPI 0.110 + OpenRouter + Evolution API — **sem banco próprio** (todo dado vem do backend do Kernel via `/internal/*`)

**Código-fonte:** `orbita-workspace/Kernel-brainiac/` — repositório próprio `github.com/willianslegacy94-zion/kernel-brainiac` (privado, `main`, desde 2026-08-10)

Contém (8 artefatos):
- `system-creation-brainiac.md` — threshold respondido
- `indice-brainiac.md` — ponto de entrada, mapa de artefatos e comparativo Brainiac × Cortex
- `prd-brainiac.md` — problema, objetivo, usuário, métricas e a divergência entre o nome e o papel real
- `requisitos-funcionais-brainiac.md` — 4 módulos (contexto de cliente, notificação do admin, relatório sob demanda, observabilidade) + pontos de atenção
- `arquitetura-brainiac.md` — stack, camadas, fluxo de dados, Docker (porta 5010) e segurança
- `modelo-de-dados-brainiac.md` — ausência de persistência própria, estado volátil em memória e dados de terceiros
- `integracoes-brainiac.md` — contratos com Kalel, Kernel, Evolution API, OpenRouter e Telegram
- `registro-de-decisoes-brainiac.md` — memória viva (RD-001 a RD-012)

Status do sistema: **experimental** — testado ponta a ponta localmente (2026-08-05), chaves OpenRouter/Evolution ainda placeholder, deploy pendente. **Cutover pendente:** o backend do Kernel ainda chama o Cortex (`CORTEX_URL`), então `POST /api/v1/brainiac/notificar-admin` ainda não tem chamador em produção.

Quando abrir: quando for trabalhar no canal do gestor do Kernel — relatório sob demanda por WhatsApp, notificação de admin, alerta Telegram de falha de envio ou o cutover Cortex→Brainiac.

---

## arquitetura-insight

**O que é:** artefatos do Órbita Insight — engine SaaS de BI preditivo para infoprodutores. Ingere dados, classifica comportamento via IA e entrega insights acionáveis via API (24 RFs em 5 módulos). Complementa o Cortex no nível de análise preditiva.

**Stack:** Python + FastAPI + SQLite + OpenRouter

Contém (7 artefatos):
- `system-creation-insight.md` — threshold respondido
- `indice-insight.md` — ponto de entrada e mapa de artefatos
- `prd-insight.md` — problema, objetivo, usuário e métricas
- `requisitos-funcionais-insight.md` — 24 RFs em 5 módulos
- `arquitetura-insight.md` — stack, camadas, fluxo de dados e segurança
- `modelo-de-dados-insight.md` — tabela `logs_insights` e ciclo de vida
- `registro-de-decisoes-insight.md` — memória viva

Quando abrir: quando for trabalhar no engine de BI — tabela `logs_insights`, classificação comportamental ou endpoint de resposta da API.

---

## arquitetura-prospeccao

**O que é:** artefatos do Motor Ativo de Prospecção — gerencia fila de 1829 leads, dispara mensagens em lote via Evolution API/WhatsApp, classifica respostas via IA e aciona transbordo comercial automático.

**Stack:** Python + FastAPI + SQLite + OpenRouter

Contém (7 artefatos):
- `indice-prospeccao.md` — ponto de entrada e mapa de artefatos
- `prd-prospeccao.md` — problema, objetivo, usuário e métricas
- `requisitos-funcionais-prospeccao.md` — módulos: fila de leads, motor de disparo, classificação IA, webhook, transbordo
- `arquitetura-prospeccao.md` — stack, camadas, integrações e escala
- `modelo-de-dados-prospeccao.md` — entidade `leads_prospeccao`, estados e ciclo de vida
- `fluxos-prospeccao.md` — fluxos de disparo, recebimento de resposta, classificação e transbordo
- `registro-de-decisoes-prospeccao.md` — memória viva

Quando abrir: quando for trabalhar no motor de prospecção — fila de leads, disparos em lote, classificação de resposta ou webhook de transbordo.

---

## arquitetura-lane-confeitaria

**O que é:** artefatos do Lane Confeitaria — sistema de gestão para a Confeitaria Artesanal da Lane (MEI solo), com CRM em funil kanban, Agenda de produção com limite diário e Dashboard de inteligência financeira (CMV, metas, projeção, clientes recorrentes, ranking por peso).

**Stack:** Next.js 16 + Prisma 7 + PostgreSQL + NextAuth v5 + Tailwind v4 + Recharts + SWR

Contém (10 artefatos): mesma estrutura de `arquitetura-thieco/`, com sufixo `-lane-confeitaria`.

Status do sistema: implementado e validado contra PostgreSQL real (Docker local); pendente deploy em produção (Vercel + Neon recomendado).

Quando abrir: quando for trabalhar no Lane Confeitaria — CRM, agenda, precificação, CMV ou dashboard financeiro.

---

## arquitetura-academiasandro

**O que é:** artefatos do sistema de gestão do Centro de Treinamento Sandro Freire (ex-"Academia Prof. Sandro") — cadastro de alunos, financeiro (mensalidade + modalidades extras com ciclo de parcelas próprio), agenda de aulas (horários, almoço, bloqueios pontuais), pacotes de desconto (família/combo de modalidades), pré-cadastro público e autocadastro de aluno ativo, com WhatsApp real via Evolution API.

**Stack:** Next.js 16 (App Router) + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL (Supabase, mesmo banco em dev e produção) + NextAuth v5

Contém (12 artefatos): `system-creation-academiasandro.md`, `indice-academiasandro.md`, `prd-academiasandro.md`, `requisitos-funcionais-academiasandro.md`, `arquitetura-academiasandro.md`, `modelo-de-dados-academiasandro.md`, `design-system-academiasandro.md`, `ui-kit-academiasandro.md`, `ux-flows-academiasandro.md`, `registro-de-decisoes-academiasandro.md`, `backlog-tarefas-academiasandro.md`.

Status do sistema: **em produção desde 2026-08-03** (`https://sandrofreiresf.online`, VPS Hostinger compartilhada com VillaMill/Sistema Thieco atrás de um nginx no host).

**Nota de governança:** esta pasta existia desde 2026-07-11 mas nunca tinha sido registrada aqui — lacuna encontrada e corrigida em 2026-08-03. Qualquer outra pasta `arquitetura-*` sem entrada correspondente neste documento deve ser tratada com a mesma suspeita (checar se não é o mesmo tipo de lacuna).

Quando abrir: quando for trabalhar no sistema do Centro de Treinamento — cadastro de aluno, financeiro, agenda, pacotes ou integração de WhatsApp.

---

## arquitetura-kernelmei

**O que é:** artefatos do KernelMei — whitelabel multi-tenant para confeitarias/doceiras. Mesmo domínio de negócio do `arquitetura-lane-confeitaria` (CRM em funil kanban, agenda de produção com limite diário, financeiro/CMV, metas, ranking), reconstruído para atender várias clientes no mesmo código-base e no mesmo banco, com marca (`Tenant.branding`) e módulos (`Tenant.features`) por tenant, mais um painel de operação (`/admin`) para provisionar e gerenciar clientes.

**Stack:** Next.js 16 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 16 + NextAuth v5 (tenant) + `jose` (SuperAdmin) + Tailwind v4 + Docker

Contém (7 artefatos):
- `system-creation-kernelmei.md` — threshold respondido **retroativamente**, com rastreio por arquivo e a lista do que não foi possível responder
- `indice-kernelmei.md` — mapa dos artefatos, ordem de leitura e estado real do sistema
- `prd-kernelmei.md` — problema, dois perfis de usuário (confeiteira e SuperAdmin), escopo entregue vs. lacunas
- `requisitos-funcionais-kernelmei.md` — 60 RFs em 9 módulos + 8 RNFs, cada um marcado como OK / sem tela / stub
- `arquitetura-kernelmei.md` — stack, herança dupla (lane-confeitaria + kernel-foodservice), Prisma Extension de isolamento, sessões duplas, observabilidade e lacunas técnicas
- `modelo-de-dados-kernelmei.md` — 19 entidades, 5 enums, heurística de quem carrega `tenantId` e regras de cálculo
- `design-system-kernelmei.md` — mecanismo de branding por tenant (token estável, valor variável) e inventário de componentes
- `registro-de-decisoes-kernelmei.md` — memória viva: 15 decisões + 8 pendências que exigem decisão do Willians

**Sem `ui-kit` e `ux-flows` de propósito:** 4 das 7 telas do menu ainda não existem; documentar inventário ou jornada agora exigiria supor. Registrados como backlog no índice.

Status do sistema: **draft**. Fundação multi-tenant completa e verificada por script; interface parcial; **git local com zero commits e sem remote**; nunca deployado; sem testes (Vitest instalado, nenhum arquivo de teste).

**Nota de governança:** documentação criada em 2026-08-10 para um sistema já construído — o threshold foi respondido depois da construção, invertendo a ordem prescrita por `00-governance-systems/system-creation-threshold.md`. Assumido explicitamente em `system-creation-kernelmei.md`.

Quando abrir: quando for trabalhar no KernelMei — onboarding de tenant, isolamento multi-tenant, feature flags, branding, ou completar as telas de agenda/financeiro/dashboard/projeção.

---

## arquitetura-kernel-foodservice

**O que é:** artefatos do Kernel Foodservice — whitelabel multi-tenant pro domínio de restaurante/lanchonete. Fork do `arquitetura-jocley-lanchonete` (PDV mesa+balcão, CMV por ficha técnica com rendimento, KDS, DRE, gestão de time) generalizado com os mesmos três padrões do produto Kernel: isolamento por `tenantId`, feature flags (`Tenant.features`) e onboarding via painel super-admin isolado.

**Stack:** Next.js 15 + Prisma 6.4 + PostgreSQL 16 + NextAuth v5 (tenant) + HMAC-SHA256 nativo (super-admin) + Tailwind v4 + Docker

Contém (7 artefatos):
- `system-creation-kernel-foodservice.md` — threshold respondido retroativamente; 2 das 6 perguntas sem resposta no código (público-alvo, por que agora)
- `indice-kernel-foodservice.md` — mapa dos artefatos e estado real do sistema
- `prd-kernel-foodservice.md` — problema, dois públicos (super-admin e equipe do tenant), escopo dentro/fora, métricas propostas
- `requisitos-funcionais-kernel-foodservice.md` — 19 RFs em 4 módulos novos (auth/isolamento, modulação, onboarding, notificações); domínio de foodservice herdado sem RF duplicado
- `arquitetura-kernel-foodservice.md` — stack, as 3 camadas novas com cobertura verificada, **8 riscos não mitigados (R1–R8)**
- `modelo-de-dados-kernel-foodservice.md` — 21 models / 13 enums, `Tenant`+`SuperAdmin` novos, `OrderItem` como única tabela sem `tenantId`
- `registro-de-decisoes-kernel-foodservice.md` — memória viva reconstruída por `mtime` + comentários (zero commits no repo)

**Sem `design-system`, `ui-kit` e `ux-flows` de propósito:** UI herdada do Jocley Grill sem mudança visual documentada além da cor primária por tenant. Criar se/quando a modulação de UI exigir decisão de design própria.

Status do sistema: **draft**. Implementado (174 arquivos) e nunca commitado, nunca deployado, sem testes. Risco de maior severidade: instância de WhatsApp compartilhada entre todos os tenants (R1) — quebra a premissa de whitelabel se não corrigido antes do primeiro cliente real.

**Nota de governança:** mesmo padrão do `arquitetura-kernelmei` — documentação criada em 2026-08-10 para sistema já construído, threshold respondido depois da construção.

Quando abrir: quando for trabalhar no Kernel Foodservice — onboarding de tenant, isolamento multi-tenant, feature flags, ou mitigação dos riscos R1-R8.

---

## arquitetura-kernel-academia

**O que é:** artefatos do Kernel Academia — whitelabel multi-tenant pro domínio de academia/CT. Fork do `arquitetura-academiasandro` (gestão de alunos, financeiro com ciclo de 12 parcelas, agenda de aulas, pacotes de desconto, portal do aluno) generalizado com o padrão whitelabel emprestado do `arquitetura-kernel-foodservice` (`Tenant`/`SuperAdmin`/`ErrorLog`, login global, painel `/admin-kernel`). **Não confundir com `arquitetura-academiasandro`** — são dois sistemas diferentes, o primeiro é de um cliente real em produção, este é o derivado whitelabel sem cliente real ainda.

**Stack:** Next.js + Prisma + PostgreSQL 16 (Docker local, porta 5441) + NextAuth (tenant) + auth própria (SuperAdmin) + Evolution API

Contém (7 artefatos):
- `system-creation-kernel-academia.md` — threshold aprovado retroativamente; origem dupla (domínio + padrão whitelabel); tabela "não confundir" com o academia-sandro; 4 perguntas abertas
- `indice-kernel-academia.md` — mapa dos artefatos e estado real do sistema
- `prd-kernel-academia.md` — problema, dois públicos, escopo, métricas propostas
- `requisitos-funcionais-kernel-academia.md` — 51 RFs em 10 módulos
- `arquitetura-kernel-academia.md` — stack, herança dupla, multi-tenancy, **8 bloqueantes pro primeiro cliente real**
- `modelo-de-dados-kernel-academia.md` — 16 models herdados + `tenantId` em 15 deles, `Tenant`/`SuperAdmin` novos
- `registro-de-decisoes-kernel-academia.md` — memória viva reconstruída por `mtime` + nome de migration (sem git)

**Sem `design-system`, `ui-kit` e `ux-flows` de propósito:** UI herdada do `academia-sandro` sem mudança visual documentada além de `Tenant.branding`.

Status do sistema: **draft**. **Bloqueante crítico e único entre os sistemas da família `kernel*`:** a marca do cliente de origem (Centro de Treinamento Sandro Freire) vazou pro produto whitelabel — título da página, termo de consentimento LGPD, mensagens de WhatsApp e default de `EVOLUTION_INSTANCE_NAME` citam o nome do cliente real. Um tenant diferente assinaria consentimento pra academia errada. Sem `.git`, nunca deployado, sem testes.

**Nota de governança:** mesmo padrão dos outros `kernel-*` — documentação criada em 2026-08-10 para sistema já construído.

Quando abrir: quando for trabalhar no Kernel Academia — onboarding de tenant, correção do vazamento de marca (bloqueante), ou qualquer um dos outros 7 bloqueantes registrados.

---

## Pastas pendentes de classificação

| Pasta | Situação |
|---|---|
| — | `kernel-hq-arquitetura` já classificada — é a pasta de documentos de negócio (portfólio, precificação, playbooks operacionais, contrato de sociedade), renomeada de `orbita-black-arquitetura` em 2026-08-10 junto com o rename do cofre inteiro (`orbita-black` → `kernel-hq`). Não é um sistema, não segue o padrão `arquitetura-{nome}` — é infraestrutura documental do próprio cofre, mesmo papel que já tinha antes do rename. |

---

## Fluxo dentro do kernel-hq

```
00-governance-systems  →  define threshold + templates de criação de sistemas
00-governance          →  define como os documentos devem ser estruturados

ERPs e Gestão:
  arquitetura-thieco            →  sistema de caixa barbearia (em produção)
  arquitetura-villamill         →  sistema villamill restaurante (em produção)
  arquitetura-ivsstore          →  ERP vestuário/perfumaria (MVP local)
  arquitetura-kernel            →  produto SaaS multi-tenant de caixa (Kernel)
  arquitetura-lane-confeitaria  →  CRM + agenda + inteligência financeira para confeitaria (dev, validado)
  arquitetura-academiasandro    →  gestão de academia/CT (alunos, financeiro, agenda, pacotes) — em produção
  arquitetura-kernelmei         →  whitelabel multi-tenant de confeitaria (draft, fundação pronta, UI parcial)
  arquitetura-kernel-foodservice →  whitelabel multi-tenant de restaurante (draft, 174 arquivos, nunca commitado)
  arquitetura-kernel-academia    →  whitelabel multi-tenant de academia/CT (draft, marca do cliente de origem vazada — bloqueante)

Holding de Robôs — Agentes:
  arquitetura-horizon     →  suporte EAD multi-tenant (infoprodutores)
  arquitetura-pulsar      →  atendimento + disparos para PMEs
  arquitetura-quasar      →  concierge alto ticket + agendamento (em dev)
  arquitetura-kalel       →  atendimento/agendamento por WhatsApp, exclusivo do Kernel (fork do Quasar)
  arquitetura-brainiac    →  notificações + raio-X do gestor, exclusivo do Kernel (fork do Cortex, sem núcleo analítico)

Holding de Robôs — Módulos de IA:
  arquitetura-cortex      →  cérebro analítico central
  arquitetura-insight     →  BI preditivo SaaS
  arquitetura-prospeccao  →  motor ativo de prospecção (1829 leads)

00-types               →  padrões reutilizáveis entre sistemas
```
