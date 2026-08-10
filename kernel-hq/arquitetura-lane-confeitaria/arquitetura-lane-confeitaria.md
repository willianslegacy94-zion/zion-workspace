---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-08
owner: willians
---

# Arquitetura Técnica — Lane Confeitaria

## 1. Stack de decisão

| Camada                | Tecnologia                                           | Rationale                                                                                                                   |
| --------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Framework fullstack   | Next.js 16.2 (App Router, Turbopack)                 | Monolito único — proporcional a um MEI solo, sem necessidade de backend separado                                            |
| Linguagem             | TypeScript ^5                                        | Mesmo padrão dos projetos de referência                                                                                     |
| ORM                   | Prisma ^7 (`@prisma/adapter-pg`)                     | Versão mais recente entre os dois projetos de referência (`academia-sandro`)                                                |
| Banco                 | PostgreSQL 16.x                                      | Recomendado: Neon (gerenciado) — decisão do @architect, ver seção 6                                                         |
| Auth                  | NextAuth v5 (beta), Credentials Provider, sessão JWT | Mesmo padrão de `academia-sandro`/`lanchonete-sistema`                                                                      |
| Estilo                | Tailwind CSS ^4 (CSS-first, `@theme inline`)         | Tokens de marca aplicados diretamente em `globals.css`                                                                      |
| Gráficos/dados client | Recharts + SWR                                       | Replica o padrão do `lanchonete-sistema`                                                                                    |
| Ícones                | lucide-react                                         | Padrão dos dois projetos de referência                                                                                      |
| Testes                | Vitest                                               | Introduzido desde a Story 1.1 — nenhum dos projetos de referência tinha suíte de testes; decisão de não repetir essa lacuna |

**Repositório:** `Kernel Workspace/lane-confeitaria/` — polyrepo (não monorepo), código fora do Obsidian.

---

## 2. Breaking changes descobertos durante a implementação

Esta seção existe porque o Next.js 16 e o Prisma 7 têm mudanças que não estavam nos padrões dos projetos de referência mais antigos, e foram descobertas na prática:

- **`middleware.ts` → `src/proxy.ts`:** Next.js 16 renomeou o arquivo de middleware; o export precisa se chamar `proxy`, não `middleware`/`default`. Confirmado em `node_modules/next/dist/docs/`.
- **`prisma.config.ts` obrigatório:** Prisma 7 não aceita mais `url` no bloco `datasource` do `schema.prisma` — a URL de conexão precisa vir de `defineConfig({ datasource: { url: ... } })` em `prisma.config.ts` na raiz do projeto.

---

## 3. Camadas do sistema

```
Browser (mobile-first)
   ↓ HTTPS
Vercel Edge/CDN (produção, recomendado)
   ↓
Next.js App Router
   ├─ Server Components (leitura direta, CRM/Agenda/Configurações)
   ├─ Server Actions (mutações — src/server/actions/*)
   ├─ Route Handlers (leitura via SWR — src/app/api/dashboard/*, /api/agenda)
   └─ Service layer (src/server/services/* — única camada que chama prisma.*)
        ↓ Prisma Client
   PostgreSQL (Neon recomendado)
```

**Camada de serviço como ponto único de regra de negócio:** todo cálculo (precificação, limites de fila/agenda, CMV, ranking) vive em `src/server/services/`, nunca em Server Actions/componentes diretamente — mantém as regras testáveis por mock, sem precisar de banco real para rodar `vitest`.

---

## 4. Fluxos de dados principais

### Criar pedido → mover para fila de produção → agendar

```
[Formulário PedidoForm] → [Server Action criarPedidoAction]
  → [pedidoService.criarPedido()]
      → calcula valorAcrescimos/valorFinal/valorSinal (precificacaoService, puro)
      → cria Cliente + Pedido + PedidoSabor[] na fila de menor ordem

[Kanban: mover card] → [Server Action moverPedidoDeFilaAction]
  → [pedidoService.moverPedidoDeFila()]
      → se Fila destino tem disparaAgendamento=true:
          → [agendaService.agendarProducao()] em $transaction
              → conta Agendamento do dia < limiteBolosPorDia? cria : retorna erro "DIA_CHEIO"
      → só então atualiza Pedido.filaId
```

### CMV por sabor (tratamento de dado ausente)

```
[GET /api/dashboard/cmv?periodo=] → [cmvService.calcularCmvPorSabor()]
  → para cada pedido concluído (Fila.contaComoConcluido=true) no período:
      → para cada sabor do pedido:
          → [financeiroService.calcularCustoSabor()] — retorna number OU null
          → custo proporcional ao pesoKg do pedido
  → agrega por sabor: se qualquer custo do sabor no período é null → cmv=null, custoNaoCalculado=true
  → nunca soma parcialmente um valor incorreto
```

### Conversa com o Quasar → card automático → pedido de verdade → avanço de funil

```
[1ª mensagem de um contato novo] → [POST /api/internal/atendimentos/progresso]
  → [atendimentoService.registrarProgressoAtendimento()]
      → sem Pedido aberto pra esse contato? cria Atendimento na 1ª fila (ordem 0)
[mensagens seguintes] → mesmo endpoint, primeiraMensagem=false
  → avança o Atendimento pra fila.recebePedidoAutomatico (se ainda estiver na 1ª fila)

[dados completos] → [POST /api/internal/pedidos] (origem="automatico")
  → [pedidoService.criarPedido()]
      → cria Pedido na 1ª fila (igual pedido manual)
      → avancarPedidoAutomaticamente(): tenta mover pra fila.recebePedidoAutomatico,
        depois pra fila.disparaAgendamento (mesma trava de dia cheio da Story 3.3)
      → apagarAtendimentoDoCliente(): remove o Atendimento, Pedido passa a representar o card

[a qualquer momento] → ferramenta acionar_atendimento_humano do Quasar
  → [GET /api/internal/cartoes/aberto?contato=] — resolve se é Pedido ou Atendimento em aberto
  → [POST /api/internal/cartoes/{tipo}/{id}/mover] — move pra fila.disparaAtendimentoHumano

[foto de comprovante Pix] → ferramenta confirmar_pagamento_sinal do Quasar
  → [POST /api/internal/pedidos/confirmar-sinal] → marcarComprovanteParaValidar()
      → NUNCA marca statusSinal=PAGO diretamente — só sinaliza pro modal da Lane decidir
```

### Marcar desistência → Mel classifica o motivo → card sai do Kanban (desde 2026-08-08)

Único fluxo em que a **direção da integração se inverte** — este sistema chama o Quasar, não o contrário:

```
[Botão "Desistência" no card] → [Server Action marcarDesistenciaPedidoAction/marcarDesistenciaAtendimentoAction]
  → [pedidoService.marcarDesistenciaPedido() / atendimentoService.marcarDesistenciaAtendimento()]
      → [quasarService.classificarDesistencia(contato)]
          → POST {QUASAR_URL}/api/v1/quasar/classificar-desistencia (X-Internal-Key)
          → Quasar busca as últimas mensagens reais da conversa (gerenciar_memoria) e classifica
          → falha/timeout/sem histórico → INDEFINIDO (nunca trava a Lane)
      → Pedido/Atendimento.desistencia=true (permanente), desistenciaMotivo/desistenciaEm preenchidos
      → listarPedidosPorFila()/listarAtendimentosPorFila() já filtram desistencia:false — card some do Kanban

[crontab da VPS, diário] → POST /api/internal/desistencias/limpar (X-Internal-Key)
  → zera desistenciaMotivo/desistenciaEm de registros com desistenciaEm > 30 dias
      → desistencia continua true (card nunca volta) — Pedido/Atendimento em si nunca é apagado
```

---

## 5. Pontos de integração

| Integração | Direção | Formato | Autenticação | Notas |
|---|---|---|---|---|
| Browser ↔ Next.js | consumo interno | Server Actions + REST/JSON (Route Handlers) | NextAuth session cookie (JWT) | SWR nos componentes de dashboard/agenda |
| Next.js ↔ PostgreSQL | consumo interno | Prisma Client (TCP) | `DATABASE_URL` no `.env` | Validado com PostgreSQL 16 real via Docker local (container `lane-confeitaria-db`, porta 5437) |
| Órbita Quasar (agente de atendimento) | consumo externo → sistema | REST/JSON (`/api/internal/*`) | Header `X-Internal-Key` (não usa sessão NextAuth) | Quasar consulta filas/agenda/catálogo/cliente, cria/move pedido e atendimento, e lê fotos (bolo/comprovante Pix) durante uma conversa de WhatsApp — mesmo padrão de `authenticateInternal` já usado no `sistema-orbita-whitelabel` |
| Órbita Quasar (classificação de desistência) | sistema → Quasar (desde 2026-08-08, única integração nesta direção) | REST/JSON (`POST /api/v1/quasar/classificar-desistencia`) | Header `X-Internal-Key` (mesmo valor de `INTERNAL_API_KEY`, verificado do lado do Quasar contra `LANE_CONFEITARIA_INTERNAL_KEY`) | `quasarService.ts` — pede pro Quasar classificar o motivo (preço/prazo/indisponibilidade) da última conversa real de um contato, quando a Lane marca um card como desistência. `QUASAR_URL` no `.env` (`http://orbita_quasar:5003` em produção, nome do container na rede `orbita_shared`) |
| Evolution API (WhatsApp) | sistema → serviço externo | REST/JSON | Header `apikey` | Só usado pela tela Configurações → WhatsApp (`whatsappService.ts`), pra gerar QR code e checar status de conexão. O atendimento em si (receber/responder mensagem) é todo feito pelo Quasar, que fala com a Evolution API diretamente — este sistema nunca recebe webhook da Evolution API |

---

## 6. Fronteiras de segurança

- **Autenticação:** NextAuth v5, Credentials Provider, `bcrypt.compare` com hash "dummy" contra timing attack quando o e-mail não existe
- **Autorização de rota:** `src/proxy.ts` cobre `/`, `/dashboard`, `/crm`, `/agenda`, `/financeiro`, `/clientes`, `/configuracoes` — callback `authorized` em `src/auth.ts` redireciona para `/login` quando não há sessão (**bug corrigido**: a primeira versão não tinha esse callback e deixava passar sem sessão)
- **Autorização de API (usuária):** toda rota `GET /api/dashboard/*` e `GET /api/agenda` verifica `auth()` no próprio handler antes de consultar o banco
- **Autorização de API (agentes internos):** rotas `/api/internal/*` (consumidas pelo Quasar) não passam pelo `proxy.ts`/NextAuth — usam `autenticarChaveInterna` (`src/lib/internal-auth.ts`), comparando o header `X-Internal-Key` contra `INTERNAL_API_KEY` do `.env`. Sem essa variável configurada, todas retornam `503` por padrão (integração desligada, nunca aberta "de graça")
- **Dados sensíveis:** `senhaHash` nunca exposto em resposta de API; `DATABASE_URL`/`NEXTAUTH_SECRET`/`INTERNAL_API_KEY` apenas em `.env` (gitignored)
- **Sistema é single-tenant** — não há isolamento entre "contas" porque só existe uma usuária
- **Risco conhecido, não mitigado ainda:** rotas `/api/internal/*` não têm rate limiting — qualquer request com a chave certa passa sem limite de volume

---

## 7. Estratégia de escala

**Volume esperado:** MEI solo, até ~5 bolos/dia = no máximo ~150 pedidos/mês. Nenhuma decisão de arquitetura foi otimizada além desse volume.

**Decisão de plataforma original (@architect, 2026-07-30):** Vercel + Neon (Postgres gerenciado), em vez de VPS + Docker (padrão do `lanchonete-sistema`) — Lane não tem capacidade operacional para manter servidor; tier gratuito de ambos cobre o volume do negócio.

**Superada em 2026-08-02:** a integração real com o Quasar/Evolution API (que roda em Docker, rede compartilhada `orbita_shared`) e a decisão do usuário de consolidar vários sistemas (thieco, vilamill, academia-sandro, lanchonete-sistema, lane-confeitaria) numa única VPS Hostinger tornam Vercel+Neon menos natural do que originalmente pensado — não é mais "Lane mantém servidor sozinha", é a mesma VPS que já hospeda os agentes de IA compartilhados. Detalhe do processo de migração em `kernel-hq-arquitetura/12-backlog-painel-admin-cortex-quasar.md`. Nada no código prende a nenhuma das duas opções.

**Decidida em 2026-08-03/04:** VPS + Docker, não Vercel+Neon — em produção real desde então (`https://conflane.online`). Ver `docs/architecture/deploy-playbook.md` (dentro do repo `lane-confeitaria`) pro runbook operacional completo.

**O que exigiria reescrita:**
- Se o negócio crescer para múltiplas confeiteiras/funcionárias → sistema precisaria deixar de ser single-tenant (papéis de acesso, hoje inexistentes)
- Se o volume de pedidos crescer muito → queries de agregação do dashboard (hoje em memória via `reduce`/`Map`) precisariam migrar para `groupBy`/SQL agregado

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v0.1 | 2026-07-30 | PRD, arquitetura e 17 stories criados via pipeline AIOX completo (@pm → @architect → @sm) em modo autônomo |
| v1.0 | 2026-07-30 | Epic 1 — Fundação: setup Next.js 16 + Prisma 7 + NextAuth v5, design system com tokens de marca, AppShell responsivo |
| v1.1 | 2026-07-30 | **Correção de segurança:** proxy sem callback `authorized` não bloqueava rota sem sessão — corrigido e revalidado via smoke test |
| v1.2 | 2026-07-30 | Epic 2 — CRM: filas configuráveis (limite de 7 não exposto), catálogo real (44 sabores + 12 docinhos), kanban de pedidos, precificação com sinal automático e regra de cancelamento 24h |
| v1.3 | 2026-07-30 | Epic 3 — Agenda: limite diário configurável, calendário de ocupação, bloqueio transacional contra overbooking, flag `Fila.disparaAgendamento` para integração CRM→Agenda |
| v1.4 | 2026-07-30 | Epic 4 — Financeiro: despesas, insumos/receitas, indicadores financeiros com gráfico de fluxo de caixa, CMV por sabor com tratamento de "custo não calculado"; flag `Fila.contaComoConcluido` para definir "pedido concluído" |
| v1.5 | 2026-07-30 | Epic 5 — Dashboard: metas com destaque dourado, calculadora de projeção (sem persistência), clientes recorrentes, ranking por faixa de peso |
| v1.6 | 2026-07-30 | **Correção de bug:** `faixaDePeso` sem limite inferior classificava bolo de 1kg como "5kg" — corrigido com intervalo de ±2.5kg por faixa |
| v1.7 | 2026-07-30 | **Validação end-to-end contra banco real:** PostgreSQL 16 via Docker local, `prisma migrate dev` aplicada, seed populou 44 sabores + 12 docinhos, login NextAuth completo (CSRF) e escrita real testados via `curl` |
| v1.8 | 2026-07-30 | **Integração Órbita Quasar:** API interna `/api/internal/*` (filas, agenda, catálogo, clientes, criar/mover pedido) autenticada por `X-Internal-Key`; **correção de pré-requisito:** `clienteService.buscarOuCriarCliente` deduplica cliente por `contato`, sem o que "clientes recorrentes" nunca funcionava de verdade |
| v2.0 | 2026-08-02 | **Modelo `Atendimento`:** card no Kanban nasce na 1ª mensagem do cliente, antes de qualquer dado do bolo existir; some quando um `Pedido` de verdade é criado pro mesmo cliente |
| v2.1 | 2026-08-02 | **Avanço automático de funil:** flags `Fila.recebePedidoAutomatico`/`disparaAtendimentoHumano`; `criarPedido` (origem automática) encadeia Novo Cliente → Em negociação → Agendado sozinho; **correção real:** `moverPedidoDeFila` passou a liberar o `Agendamento` ao sair de uma fila com `disparaAgendamento=true`, o que antes deixava vaga de produção reservada indefinidamente |
| v2.2 | 2026-08-02 | **Confirmação de pagamento nunca automática:** `Pedido.comprovanteParaValidar`/`resumoComprovante` — a IA só sinaliza, a Lane sempre aprova/rejeita manualmente via modal (`PedidoDetalheModal`), que também expôs pela 1ª vez o botão de "dar baixa" manual (`marcarStatusPagamento`, existente desde v1.x sem UI) |
| v2.3 | 2026-08-02 | **Conexão WhatsApp real:** tela `/configuracoes/whatsapp` (QR code + status via Evolution API), `whatsappService.ts` novo, instância `lane_confeitaria` criada na Evolution API compartilhada — webhook pro Quasar planejado, mas **não chegou a ser registrado de fato nessa sessão** (`/webhook/find/lane_confeitaria` retornava `null` até v2.4) |
| v2.4 | 2026-08-03/04 | **Deploy real em produção (VPS):** `docker-compose.yml` + `Dockerfile` multi-stage, nginx+certbot em `conflane.online`. 3 bugs de infra corrigidos no dia seguinte ao primeiro deploy — `trustHost: true` (Auth.js rejeitava `Host` atrás do reverse proxy), header `Connection: upgrade` hardcoded no nginx (quebrava Server Actions), `HOSTNAME=0.0.0.0` explícito no container `app` (Docker injeta `HOSTNAME=<container id>`, e sem override o Next.js standalone não fazia bind em todas as interfaces — container ficava inacessível para outros containers da rede `orbita_shared`, incluindo o Quasar). **Webhook do Evolution API pra `lane_confeitaria` registrado de verdade** (`POST /webhook/set/lane_confeitaria`, apontando pro Quasar) — Mel respondendo ponta a ponta no WhatsApp real pela primeira vez. Detalhe completo em `docs/architecture/deploy-playbook.md` e no Playbook DevOps (`kernel-hq-arquitetura`) |
| v2.5 | 2026-08-04 | **Bug de produção corrigido — schema drift:** `Pedido.comprovanteParaValidar`/`resumoComprovante` (adicionados ao `schema.prisma` na v2.2) nunca tiveram migration gerada — o Prisma Client de produção esperava as colunas, o Postgres real não tinha, e todo endpoint que tocava a tabela `pedidos` (sem `select` explícito) quebrava com 500 opaco (`/crm`, `/api/dashboard/ranking-peso`, `criarPedidoAction`). Corrigido com a migration retroativa `20260804050000_pedido_comprovante_validacao`; ver detalhe da causa e do processo de correção em `registro-de-decisoes-lane-confeitaria.md`. **Funil de produção definido e replicado:** 5 filas nomeadas (Novo Cliente → Em negociação → Atendimento humanizado → Agendado → Pago) com os 4 flags de automação mapeados, aplicadas em produção via script idempotente (`scripts/seed-filas-funil.ts`). **`Despesa.recorrente`** (boolean, só marcação visual — sem lançamento automático) com migration `20260804060000_despesa_recorrente`. **Botão de logout** (Server Action `signOut()` no header do `AppShell`). **Ícone de app (PWA):** `apple-icon.tsx`, `manifest.ts` com ícones 192/512 (safe-zone maskable), `favicon.ico` trocado pelo padrão do bolo (era o triângulo default do `create-next-app`) — "Adicionar à tela de início" agora abre em modo standalone com o ícone certo, iOS e Android |
| v2.6 | 2026-08-05 | **Nova aba "Projeção de ganho" (`/projecao`), fora do dashboard:** substitui a calculadora simples que vivia lá (`CalculadoraProjecao.tsx` antigo, removido, e junto a API `/api/dashboard/sabores-projecao` que só ela consumia). Simulador de um cenário por vez — bolo (sabor, peso, quantidade, topper, glitter) ou docinho (item, quantidade de centos) — aplicando a taxa de uma `FormaPagamento` cadastrada sobre o faturamento bruto pra mostrar o valor líquido. **Entidade nova `FormaPagamento`** (nome + taxa %, tela em Configurações → Formas de pagamento), usada **só** pela calculadora — nenhuma tabela real (`Pedido`, `Despesa`) referencia essa taxa. Docinho mostra só faturamento, nunca lucro (sem `ReceitaInsumo` associável a `ItemDocinho` ainda). Decisão explícita do usuário: simulador combinação-por-combinação, não uma matriz exaustiva de todos os cenários possíveis de uma vez |
| v2.7 | 2026-08-08 | **Card "Desistência": motivo classificado pela Mel, não pela Lane.** Botão em `PedidoCard`/`AtendimentoCard` (cor âmbar — versão inicial em texto cinza-claro ficava quase invisível, corrigida após feedback). Ao confirmar, chama o Quasar (`quasarService.classificarDesistencia`, **primeira integração nesta direção** — sistema chamando o Quasar, não o contrário) pra classificar o motivo a partir da conversa real; nunca escolhido manualmente. `desistencia=true` some do Kanban pra sempre (`Pedido`/`Atendimento` nunca são apagados); `desistenciaMotivo`/`desistenciaEm` ficam visíveis na aba Clientes por 30 dias, zerados depois por `POST /api/internal/desistencias/limpar`, disparado por `crontab` na VPS — **sem Vercel Cron neste deploy self-hosted**. **Dois incidentes no deploy, ambos corrigidos na hora:** sessão concorrente sobrescreveu `main.py`/`database.py` do Quasar no disco com conteúdo desatualizado (git ficou intacto, restaurado com `git checkout`); e `docker compose run --rm migrate` reaproveitou imagem em cache por rodar antes do `--build`, reportando "sem migration pendente" enquanto a coluna nova faltava em produção — `/crm` deu 500 por alguns minutos. Detalhe completo, incluindo as duas lições de deploy, em `registro-de-decisoes-lane-confeitaria.md` |

---

## Links relacionados

[[prd-lane-confeitaria]] — problema, objetivo e escopo que esta arquitetura implementa
[[modelo-de-dados-lane-confeitaria]] — schema Prisma detalhado por entidade
[[indice-lane-confeitaria]] — mapa completo dos artefatos do sistema
