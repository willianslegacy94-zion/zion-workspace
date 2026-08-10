---
status: draft
domain: kernelmei
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Requisitos Funcionais — KernelMei

RFs **extraídos do código implementado**, não de um PRD original (não existe PRD original — ver [[prd-kernelmei]]). Cada RF aponta o service/action que o realiza.

## Legenda de estado

| Símbolo | Significado |
|---|---|
| **OK** | service + Server Action + tela, utilizável fim a fim |
| **S/T** | **service pronto, sem tela** — a lógica existe e ninguém consegue acionar pela interface |
| **STUB** | implementado, mas devolve resposta degradada por dependência externa ausente |

---

## Módulo 1 — Plataforma e onboarding (`/admin`)

| RF | Requisito | Realizado por | Estado |
|---|---|---|---|
| RF-1.1 | SuperAdmin autentica com e-mail e senha, em sessão separada da de tenant (cookie próprio, 8h) | `autenticarSuperAdmin` + `admin-session.ts` | OK |
| RF-1.2 | SuperAdmin provisiona nova confeitaria informando slug, nome e a conta admin da usuária | `provisionTenant` | OK |
| RF-1.3 | Provisionamento cria, atomicamente, tenant + usuária + funil de 5 filas + configuração zerada | `provisionTenant` (`$transaction`) | OK |
| RF-1.4 | Slug é validado (minúsculas, números, hífen) e a senha exige 8+ caracteres | `provisionTenant`, regex `SLUG_VALIDO` | OK |
| RF-1.5 | Colisão de e-mail entre tenants é bloqueada, com sugestão de `admin@<slug>` na mensagem | `provisionTenant` | OK |
| RF-1.6 | SuperAdmin lista todos os tenants com contagem de usuárias e pedidos | `listarTenants` | OK |
| RF-1.7 | SuperAdmin ativa/desativa tenant (kill-switch), sem apagar dado | `alternarAtivoTenant` | OK |
| RF-1.8 | SuperAdmin lista todas as usuárias de todos os tenants | `listarUsuarios` | OK |
| RF-1.9 | SuperAdmin redefine senha de qualquer usuária; a nova senha é exibida uma única vez em texto puro e a antiga para de funcionar na hora | `redefinirSenhaUsuario` | OK |
| RF-1.10 | SuperAdmin consulta os 100 erros técnicos mais recentes de toda a plataforma | `listarErros` | OK |
| RF-1.11 | Não existe tela de criação de SuperAdmin — contas adicionais entram manualmente no banco | decisão registrada no `.env.example` | fora de escopo, deliberado |

---

## Módulo 2 — Autenticação e isolamento de tenant

| RF | Requisito | Realizado por | Estado |
|---|---|---|---|
| RF-2.1 | Usuária loga com e-mail e senha, sem escolher tenant — o tenant é resolvido pelo e-mail | `src/auth.ts` | OK |
| RF-2.2 | Login de tenant desativado é rejeitado | `authorize()`: `if (!usuario.tenant.ativo) return null` | OK |
| RF-2.3 | Tempo de resposta do login não revela se a conta existe | `DUMMY_HASH` + `bcrypt.compare` sempre executado | OK |
| RF-2.4 | Toda rota de negócio exige sessão; sem ela, redireciona pro login preservando `callbackUrl` | callback `authorized` + `src/proxy.ts` | OK |
| RF-2.5 | Toda leitura/escrita de negócio é automaticamente restrita ao tenant da sessão | `scopedPrisma` (14 modelos) + `requireDb()` | OK |
| RF-2.6 | Rotas `/admin/*` não passam pelo proxy de tenant e se protegem individualmente | `admin/page.tsx`, `obterSessaoAdmin()` | OK |
| RF-2.7 | Isolamento entre tenants é verificável por execução, não só por revisão de código | `scripts/verificar-isolamento.ts` | OK (script manual) |

---

## Módulo 3 — Configuração whitelabel

| RF | Requisito | Realizado por | Estado |
|---|---|---|---|
| RF-3.1 | Módulos `pedidos`, `catalogo` e `agenda` são núcleo e nenhum tenant consegue desligá-los | `CORE_FEATURES` aplicado por último em `resolveFeatures` | OK |
| RF-3.2 | Módulos `financeiro`, `dashboard`, `projecao` e `whatsappIA` são ligáveis por tenant | `FEATURES_OPCIONAIS` | OK (sem UI de edição no `/admin`) |
| RF-3.3 | O menu exibe apenas os módulos habilitados para o tenant | `AppShell`, filtro por `features[item.feature]` | OK |
| RF-3.4 | Cada tenant aplica cores próprias sem fork de código | `Tenant.branding` → `brandingParaCssVars` → `layout.tsx` | OK (sem UI de edição no `/admin`) |
| RF-3.5 | Tenant sem branding configurado cai no tema de fábrica, sem quebrar | fallback `var(--tenant-X, <default>)` no `globals.css` | OK |
| RF-3.6 | Mudança de features/branding só faz efeito no próximo login | snapshot no JWT — trade-off documentado em `features.ts` | OK, deliberado |
| RF-3.7 | Cada tenant define seus próprios valores de acréscimo (cartão, glitter, topo simples, topo 3D) | `atualizarAcrescimos` | **S/T** |
| RF-3.8 | Cada tenant define seu limite de bolos por dia | `atualizarLimiteBolosPorDia` | **S/T** |

> **RF-3.2 e RF-3.4 têm ressalva:** o mecanismo funciona, mas o painel `/admin` não expõe edição de `features` nem de `branding`. Hoje só dá para alterar direto no banco.

---

## Módulo 4 — CRM (funil de pedidos)

| RF | Requisito | Realizado por | Estado |
|---|---|---|---|
| RF-4.1 | Usuária visualiza pedidos em kanban, agrupados por fila e ordenados | `listarPedidosPorFila` + `KanbanBoard` | OK |
| RF-4.2 | Usuária cria, renomeia, reordena e exclui filas, com nome livre | `filaService` + `FilasManager` | OK |
| RF-4.3 | Exclusão de fila com pedidos associados é bloqueada | `excluirFila` | OK |
| RF-4.4 | Comportamento da fila vem de 4 flags configuráveis, nunca do nome | `definirFilaDeAgendamento`, `definirFilaConcluido`, `definirFilaDeRecebimentoAutomatico`, `definirFilaDeAtendimentoHumano` | OK |
| RF-4.5 | Usuária cadastra pedido com cliente, sabores, massa, peso, data de entrega e valor | `criarPedido` + `PedidoForm` | OK |
| RF-4.6 | Cliente é deduplicado por `(tenantId, contato)` em vez de sempre criar novo | `buscarOuCriarCliente` | OK — **melhoria sobre o lane**, que sempre criava cliente novo |
| RF-4.7 | Mover pedido pra fila com `disparaAgendamento` cria o agendamento na mesma transação, respeitando o limite diário | `moverPedidoDeFila` → `agendarProducao` | OK |
| RF-4.8 | Cancelamento retém o sinal se faltar menos de 24h pra entrega | `cancelarPedido` + `deveReterSinal` | OK |
| RF-4.9 | Usuária marca sinal e saldo como pagos | `marcarStatusPagamento` | OK |
| RF-4.10 | Comprovante recebido é marcado para validação, nunca aprovado automaticamente | `marcarComprovanteParaValidar` / `validarComprovante` | OK (service+action; sem origem que alimente) |
| RF-4.11 | Cards de `Atendimento` (contato sem dado de bolo) convivem com cards de `Pedido` | `listarAtendimentosPorFila` + `AtendimentoCard` | OK |
| RF-4.12 | Marcar desistência classifica o motivo e tira o card do fluxo ativo | `marcarDesistenciaPedido` / `marcarDesistenciaAtendimento` | **STUB** — ver Módulo 8 |

---

## Módulo 5 — Catálogo

| RF | Requisito | Realizado por | Estado |
|---|---|---|---|
| RF-5.1 | Usuária cadastra sabores de bolo, únicos por tenant | `criarSabor` + `CardapioManager` | OK |
| RF-5.2 | Usuária define preço por kg de cada sabor | `definirPrecoSabor` | OK |
| RF-5.3 | Sabor é desativado, nunca apagado (preserva histórico de pedido) | `desativarSabor` | OK |
| RF-5.4 | Usuária cadastra itens de docinho com preço por cento | `criarItemDocinho` | OK |
| RF-5.5 | Tenant novo nasce com catálogo **vazio** | nenhum seed de catálogo | OK, deliberado |

---

## Módulo 6 — Agenda de produção

| RF | Requisito | Realizado por | Estado |
|---|---|---|---|
| RF-6.1 | Agendamento respeita o limite diário do tenant, bloqueando overbooking | `agendarProducao` | OK (acionado via CRM) |
| RF-6.2 | Usuária consulta a ocupação do mês | `ocupacaoDoMes` | **S/T** |
| RF-6.3 | Usuária bloqueia/desbloqueia dia específico, com motivo | `bloquearDia` / `desbloquearDia` | **S/T** |
| RF-6.4 | Sistema sugere as próximas datas com vaga | `proximasDatasComVaga` | **S/T** |
| RF-6.5 | Pedido exige 3 dias de antecedência, sem contar domingo | `dataMinimaEntrega` | OK (regra fixa do produto) |
| RF-6.6 | Cancelar pedido libera a vaga na agenda | `liberarAgendamento` | OK |

---

## Módulo 7 — Financeiro, CMV e inteligência

**Módulo inteiro sem tela.** Todos os services e Server Actions existem; `/financeiro`, `/dashboard` e `/projecao` não têm `page.tsx`.

| RF | Requisito | Realizado por | Estado |
|---|---|---|---|
| RF-7.1 | Indicadores do período: receita, despesas, lucro | `calcularIndicadores` | **S/T** |
| RF-7.2 | Cadastro e listagem de despesas, com marcação de recorrente | `cadastrarDespesa` / `listarDespesas` | **S/T** |
| RF-7.3 | Cadastro de insumos com custo unitário e unidade | `cadastrarInsumo` | **S/T** |
| RF-7.4 | Montagem de receita: associar insumo a sabor com quantidade | `associarInsumoASabor` / `removerInsumoDoSabor` | **S/T** |
| RF-7.5 | CMV por sabor no período, com margem | `calcularCmvPorSabor` | **S/T** |
| RF-7.6 | Sabor com qualquer insumo sem custo aparece como "não calculado" — nunca como soma parcial | `calcularCustoSabor` retorna `null`; agregação propaga `custoNaoCalculado` | **S/T** |
| RF-7.7 | "Pedido concluído" é definido por flag de fila, não por nome | `listarPedidosConcluidos` | **S/T** |
| RF-7.8 | Meta de faturamento por período, com meta vigente | `definirMeta` / `obterMetaVigente` | **S/T** |
| RF-7.9 | Ranking de vendas por faixa de peso (5/10/15kg/outros) | `calcularRankingPorPeso` | **S/T** |
| RF-7.10 | Clientes recorrentes no período | `resumoClientesRecorrentes` | **S/T** |
| RF-7.11 | Formas de pagamento com taxa %, usadas só na projeção | `formaPagamentoService` + `aplicarTaxaPagamento` | **S/T** |
| RF-7.12 | Histórico de compras por cliente | `listarClientesComHistorico` | OK (`/clientes` existe) |
| RF-7.13 | Desistências recentes | `listarDesistenciasRecentes` | **S/T** |

---

## Módulo 8 — Integração com o Quasar (atendimento por IA)

| RF | Requisito | Realizado por | Estado |
|---|---|---|---|
| RF-8.1 | Ao marcar desistência, o motivo é classificado pela IA a partir da conversa real | `quasarService.classificarDesistencia` | **STUB** |
| RF-8.2 | Falha ou indisponibilidade do Quasar nunca trava a marcação de desistência | `try/catch` + timeout de 15s → `INDEFINIDO` | OK |
| RF-8.3 | Conversa de WhatsApp cria/avança card automaticamente no funil | — | **não portado** |
| RF-8.4 | Transbordo para atendimento humano move o cartão | — | **não portado** |
| RF-8.5 | Foto de comprovante marca o pedido para validação | `marcarComprovanteParaValidar` existe; sem rota que o acione | **parcial** |

**Sobre o RF-8.1** — o próprio `quasarService.ts` documenta a lacuna: o endpoint `/api/v1/quasar/classificar-desistencia` hoje só existe para o lane-confeitaria (instância fixa). Enquanto a resolução dinâmica de tenant não for construída do lado do Quasar (padrão `buscar_tenant_whitelabel`, já usado pelo Kernel de barbearia), a função **sempre devolve `INDEFINIDO`**. O comentário chama isso de "comportamento seguro — nunca trava a Lane marcando desistência, só não classifica de verdade ainda".

**Sobre RF-8.3/8.4** — no lane-confeitaria isso é servido por uma família de rotas `/api/internal/*`. No KernelMei a única rota de API existente é `/api/auth/[...nextauth]`.

---

## Módulo 9 — Observabilidade

| RF | Requisito | Realizado por | Estado |
|---|---|---|---|
| RF-9.1 | Todo erro de Server Component, Route Handler e Server Action é registrado sem instrumentação individual | `instrumentation.ts` (`onRequestError`) | OK |
| RF-9.2 | O log identifica, quando possível, tenant e usuária (de tenant ou SuperAdmin) | resolução best-effort no `instrumentation.ts` | OK |
| RF-9.3 | Falha ao gravar log nunca mascara o erro original | `registrarErro` engole a própria falha em `console.error` | OK |
| RF-9.4 | Log não roda no Edge (onde Prisma não funciona) | guard `NEXT_RUNTIME !== "nodejs"` | OK |

---

## Requisitos não funcionais

| RNF | Requisito | Evidência |
|---|---|---|
| RNF-1 | Isolamento de tenant garantido pela camada de acesso, não por disciplina de escrita de query | `scoped-prisma.ts` |
| RNF-2 | Service de negócio nunca importa o client cru; exceção única e documentada é `onboardingService` | assinatura `(db: ScopedPrisma, ...)` em 16 services |
| RNF-3 | Senhas em bcrypt custo 12, comparação em tempo constante | `auth.ts`, `onboardingService.ts` |
| RNF-4 | Valores monetários em `Decimal` no banco, com arredondamento explícito nas funções puras | `@db.Decimal(10,2)`, `arredondar()` |
| RNF-5 | Cookie de sessão admin `httpOnly` + `sameSite: lax` + `secure` em produção | `admin-session.ts` |
| RNF-6 | Container de runtime roda como usuário não-root | `Dockerfile`, stage `runner` (uid 1001) |
| RNF-7 | Serviços expostos só em loopback, atrás de proxy no host | `docker-compose.yml`: `127.0.0.1:3021`, `127.0.0.1:5438` |
| RNF-8 | Regra de negócio isolada em funções puras, testável sem banco | `precificacaoService`, `rankingService.faixaDePeso`, `agendaService.dataMinimaEntrega` |

> **RNF-8 é uma propriedade da arquitetura, não uma prática realizada:** o código é testável e **não há nenhum teste**. Ver [[arquitetura-kernelmei]], seção 9.

---

## Resumo do estado

| Estado | Quantidade |
|---|---|
| OK — utilizável fim a fim | 38 |
| S/T — service pronto, sem tela | 18 |
| STUB / não portado | 4 |

O sistema tem **fundação de plataforma completa** (onboarding, isolamento, autenticação, observabilidade) e **superfície de uso incompleta** (o CRM e o catálogo funcionam; agenda, financeiro, dashboard e projeção existem só no back-end).

---

## Links relacionados

[[indice-kernelmei]] — mapa completo dos artefatos do sistema
[[prd-kernelmei]] — contexto, escopo e o que ficou de fora
[[arquitetura-kernelmei]] — como cada camada realiza estes requisitos
[[modelo-de-dados-kernelmei]] — entidades e regras de cálculo
[[requisitos-funcionais-lane-confeitaria]] — RFs do sistema de origem
