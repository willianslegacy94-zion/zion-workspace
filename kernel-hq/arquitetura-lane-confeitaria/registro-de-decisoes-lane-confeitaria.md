---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-08
owner: willians
---

# Registro de Decisões — Lane Confeitaria

Decisões cronológicas com o que mudou, por que, e o impacto. Fonte primária: Dev Agent Record de cada story em `lane-confeitaria/docs/stories/`.

---

## 2026-07-30 — Kickoff e captura de contexto de marca

Cliente forneceu, em conversa direta, o nome do negócio (Confeitaria Artesanal da Lane) e 5 imagens reais de material de divulgação (cardápio de ~40 sabores, menu de docinhos por cento, regras de pedido, logo). Todo esse conteúdo foi transcrito literalmente em `docs/brand/brand-context.md` antes de qualquer decisão de produto, para servir de fonte única de verdade e evitar invenção de dado (Artigo IV da Constitution AIOX).

**Impacto:** todo FR do PRD e todo dado de seed do sistema rastreia a este documento — nenhum preço, sabor ou regra foi inventado.

---

## 2026-07-30 — PRD: 5 epics, 18 FRs, 5 NFRs

`@pm` (modo YOLO, a pedido do cliente) produziu o PRD completo em uma sessão: Goals, Requirements, UI Goals, Technical Assumptions, 5 Epics com 17 stories detalhadas, Checklist Report e Next Steps.

**Decisão relevante:** quatro premissas ficaram marcadas como "em aberto" em vez de decididas por conta própria — multiusuário (assumido single-tenant), notificações (fora do MVP), preço por sabor (cadastro manual) e custos de insumo (cadastro manual). Nenhuma foi resolvida com um valor inventado.

---

## 2026-07-30 — Arquitetura: Vercel+Neon, schema completo, flags de fila

`@architect` resolveu as pendências técnicas delegadas pelo PRD:
- **Ambiente de deploy:** Vercel + Neon (Postgres gerenciado), não VPS+Docker como o `lanchonete-sistema` — Lane não tem capacidade operacional para manter servidor
- **Schema completo** desenhado para todos os 5 epics
- **Limite de filas sem expor erro técnico:** resolvido na camada de UI (botão condicional), com defesa em profundidade no Service

**Impacto:** essas decisões guiaram toda a implementação subsequente sem retrabalho.

---

## 2026-07-30 — Epic 1: Fundação, Autenticação e Design System

Setup do projeto (Next.js 16 + Prisma 7 + NextAuth v5 + Tailwind v4), tokens de marca aplicados, AppShell responsivo.

**Duas descobertas técnicas não previstas na arquitetura original**, ambas breaking changes de versões novas:
- Next.js 16 renomeou `middleware.ts` para `src/proxy.ts` (export `proxy`, não `default`)
- Prisma 7 exige `prisma.config.ts` para a URL de conexão — não aceita mais `url` no `datasource` do schema

**Bug de segurança encontrado e corrigido no mesmo dia:** a primeira versão de `src/auth.ts` não tinha o callback `authorized`. Sem ele, o proxy anexava a sessão ao request mas **não bloqueava** rota sem login — confirmado via `curl` manual acessando `/dashboard` sem sessão e recebendo acesso permitido. Corrigido adicionando o callback, revalidado com sucesso.

---

## 2026-07-30 — Epic 2: CRM (Filas, Catálogo, Kanban, Precificação)

Funil kanban com filas configuráveis (limite de 7 nunca exposto), catálogo real de 44 sabores + 12 itens de docinho (extraídos literalmente do brand-context), cadastro de pedido com até 2 sabores, precificação automática (sinal 50%, acréscimos configuráveis) e regra de cancelamento com retenção de sinal a menos de 24h da entrega.

**Decisão de escopo consciente:** `criarPedido` sempre cria um `Cliente` novo, sem busca/deduplicação de cliente existente — o PRD não pediu autocomplete de cliente, e inventar essa UI não foi considerado necessário para o MVP.

**Ajuste retroativo:** `filaService.excluirFila`, que na Story 2.1 não checava pedidos associados (porque `Pedido` ainda não existia no schema), foi corrigido assim que `Pedido` foi criado na Story 2.3 — exclusão de fila com pedidos passou a ser bloqueada.

---

## 2026-07-30 — Epic 3: Agenda de Produção

Limite diário configurável (padrão 5), calendário de ocupação com destaque de dia cheio, bloqueio transacional contra overbooking.

**Decisão técnica que preencheu uma lacuna do PRD:** como as filas do CRM têm nome livre, não existe forma automática de saber qual fila representa "produção confirmada". Resolvido com `Fila.disparaAgendamento` — flag configurável pela usuária, não um nome de fila assumido. Mesmo padrão reaproveitado depois para "pedido concluído" (`Fila.contaComoConcluido`, Epic 4).

---

## 2026-07-30 — Epic 4: Financeiro e CMV

Despesas, insumos com custo, receita por sabor, indicadores financeiros (receita/despesas/lucro/fluxo de caixa em gráfico), CMV por sabor.

**Decisão relevante:** `calcularCustoSabor` retorna `null` (nunca `0`) quando não há insumo cadastrado, propagado até a UI como badge "custo não calculado" — decisão para nunca sugerir uma margem de lucro falsa por ausência de dado.

**Item registrado como incompleto:** seletor de período no dashboard financeiro ainda não tem UI própria (endpoint aceita `periodo`, mas o componente usa o mês atual fixo) — sinalizado explicitamente no Dev Agent Record da Story 4.2 como pendência, não escondido.

---

## 2026-07-30 — Epic 5: Metas, Projeção, Recorrência, Ranking

Quadro de meta com destaque dourado ao atingir 100%, calculadora de projeção sem persistência, identificação de clientes recorrentes, ranking de bolos por faixa de peso.

**Bug encontrado e corrigido durante os testes:** a primeira versão de `faixaDePeso` não tinha limite inferior (`peso <= 7.5 → "5kg"`), classificando um bolo de 1kg como "5kg". Corrigido com faixas de ±2.5kg ao redor de cada peso de referência (5/10/15kg), com teste de regressão adicionado (`faixaDePeso(1)` → `"outros"`).

**Decisão de escopo consciente:** a Calculadora de Projeção não persiste simulações em uma tabela nova — o PRD permitia "salvar/descartar" simulação, interpretado como "manter na lista visível durante a sessão" em vez de criar uma tabela de histórico não especificada em detalhe pela arquitetura original.

---

## 2026-07-30 — Validação final do MVP

Build de produção limpo (24 rotas), lint limpo, 30 testes unitários passando (cobrindo limite de filas, limite de agenda com condição de corrida, precificação/sinal/cancelamento 24h, CMV com dado ausente, faixas de peso, clientes recorrentes).

**Limitação registrada explicitamente:** nenhum PostgreSQL real foi conectado neste ambiente — `prisma migrate dev` e `npm run db:seed` não foram executados contra um banco de verdade. Toda validação de regra de negócio veio de testes unitários com mock do Prisma Client, não de uso real do banco.

---

## 2026-07-30 — Criação da documentação de governança

Pasta com os 9 artefatos de governança (system-creation, PRD, requisitos funcionais, arquitetura, modelo de dados, design system, UI kit, UX flows, este registro) criada, traduzindo o conteúdo já produzido em `lane-confeitaria/docs/` para o padrão de governança do `kernel-hq`, seguindo o modelo de `arquitetura-jocley-lanchonete`.

**Correção de localização:** a pasta foi criada inicialmente dentro de `00-governance-systems/` (a pedido explícito do usuário na ocasião), mas essa não é a convenção do ecossistema — `00-governance/folder-purpose.md` define `00-governance-systems` como contendo apenas o threshold e os templates de criação de sistema, não as pastas de sistema em si. Movida para `kernel-hq/arquitetura-lane-confeitaria/`, mesmo nível de `arquitetura-thieco`, `arquitetura-villamill` etc., conforme `00-governance/system-rules.md` (folder-structure).

---

## 2026-07-30 — Validação end-to-end contra banco PostgreSQL real

A pedido do usuário, subimos um container Docker (`lane-confeitaria-db`, `postgres:16`, porta 5437) e conectamos o sistema pela primeira vez a um banco de verdade — resolvendo a limitação registrada na entrada "Validação final do MVP" acima.

**O que foi validado:**
- `prisma migrate dev --name init` aplicada com sucesso — schema completo criado sem erro
- `npm run db:seed` populou 44 sabores de bolo + 12 itens de docinho reais + usuário inicial + configuração padrão
- Login real via NextAuth (fluxo completo: `GET /api/auth/csrf` → `POST /api/auth/callback/credentials` com token CSRF) testado via `curl` — sessão JWT criada corretamente
- Navegação autenticada real: `/` redireciona para `/dashboard` (sessão válida), Dashboard renderiza "Bem-vinda, Lane!", CRM renderiza o estado vazio correto
- Escrita real: criação de uma `Fila` via script direto (`prisma.fila.create`) refletiu imediatamente na tela `/crm` real — confirma o caminho completo Server Component → Prisma → PostgreSQL

**Bug de ambiente encontrado e corrigido:** `NEXTAUTH_URL` no `.env` apontava para a porta 3000, mas o dev server subiu na porta 3002 (3000 já ocupada por outro projeto do mesmo workspace, `villamill-app`). NextAuth v5 rejeitava o POST de login com erro `MissingCSRF` por causa dessa divergência de host/porta. Corrigido ajustando `NEXTAUTH_URL` para a porta real — mesma classe de bug já registrada no Jocley Lanchonete ("Correção de bug: redirect pós-login para a porta errada"), ambiente compartilhado por múltiplos projetos do workspace continua sendo fonte recorrente desse tipo de erro.

**Ainda não validado:** interação visual real num browser (mobile ou desktop) pela Lane — toda a validação até aqui foi via requisições HTTP diretas (`curl`), não uso humano da interface.

---

## 2026-07-30 — Integração com Órbita Quasar: API interna + correção da recorrência

Criada uma API interna (`/api/internal/*`) autenticada por `X-Internal-Key`, separada do login da Lane, pra o Quasar (agente de atendimento via WhatsApp) consultar e agir no sistema durante uma conversa: `GET /internal/filas`, `GET /internal/agenda`, `GET /internal/catalogo`, `GET /internal/clientes`, `POST /internal/pedidos`, `POST /internal/pedidos/{id}/mover`.

**Decisão de modelo:** o Quasar cria o pedido de verdade (reaproveitando `pedidoService.criarPedido`), não um "lead" à parte — cai na primeira fila do kanban como qualquer pedido manual, e a Lane segue a negociação movendo o card. Considerou-se um modelo de "lead" separado (mais seguro, sem risco de comprometer agenda sem revisão humana) vs. pedido direto (mais rápido pro cliente, exige mais confiança no agente); optou-se por pedido direto reaproveitando o Service existente, já que `moverPedidoDeFila` já bloqueia automaticamente contra overbooking (Story 3.3) — a mesma trava que protege a Lane manualmente protege o Quasar também, sem precisar de um fluxo de aprovação extra.

**Bug real de pré-requisito encontrado e corrigido nesta sessão:** ao investigar "de onde vem a informação de clientes recorrentes" (pergunta direta do usuário), achamos que `pedidoService.criarPedido` sempre fazia `prisma.cliente.create`, sem nunca buscar um `Cliente` existente pelo `contato`. Resultado: a mesma pessoa comprando várias vezes gerava um `Cliente` novo a cada pedido, e "recorrente" (mais de 1 pedido no mesmo `Cliente`) nunca disparava — o dado-fonte nunca existia, não era bug de exibição. Corrigido com `clienteService.buscarOuCriarCliente(nome, contato)`, usado agora tanto pela tela manual quanto pela rota interna do Quasar. Sem essa correção, a integração com o Quasar teria o mesmo problema amplificado (toda conversa nova criaria cliente novo).

**Validado ponta a ponta contra banco real:**
- `401` sem header `X-Internal-Key` e com chave errada; `200` com a chave certa
- Criação de 2 pedidos com o mesmo `contato` → confirmado no banco que existe **1 único** `Cliente` com 2 `Pedido`s vinculados (dedup funcionando de fato, não só no teste unitário)
- `POST /internal/pedidos/{id}/mover` pra uma fila com `disparaAgendamento=true` → `Agendamento` real criado, visível na chamada seguinte de `GET /internal/agenda`

**Segurança:** sem `INTERNAL_API_KEY` no `.env`, todas as rotas respondem `503` (integração desligada por padrão) — nunca `200` "de graça" por falta de configuração. Mesmo padrão de `authenticateInternal`/`X-Internal-Key` já usado no `sistema-orbita-whitelabel` pra Cortex/Quasar, documentado em `00-governance/folder-purpose.md`.

**Ainda não feito:** o Quasar em si (prompt, function calling, deploy) não foi configurado nesta sessão — só o lado do Lane Confeitaria (as rotas que o Quasar vai chamar). Falta também: rate limiting nas rotas internas (hoje qualquer request com a chave certa passa sem limite) e log de auditoria de quem (qual agente/instância) criou cada pedido via API interna.

---

## 2026-07-30 — Quasar configurado com o Lane Confeitaria (persona "Mel"), 2 bloqueios externos encontrados

Lado do Quasar (`orbita-quasar/`, fora deste sistema) configurado com um tenant novo (`lane_confeitaria`, produto `lane`), 4 ferramentas dedicadas (catálogo, agenda, cliente por contato, registrar pedido) chamando a API interna deste sistema, e a persona "Mel" — nunca se identifica como robô/IA, frase fixa de transbordo "Vou confirmar com a Lane e já retorno". Detalhe completo em `kernel-hq/arquitetura-quasar/registro-de-decisoes-quasar.md`.

**Bug real encontrado durante a validação (deste sistema, não do Quasar):** logo depois de adicionar `valorFinal`/`valorSinal` na resposta de `POST /internal/pedidos`, o `curl` de teste continuou recebendo só `{"pedidoId": "..."}` — o dev server (Turbopack) estava servindo uma versão em cache da rota, de antes da edição. Resolvido matando o processo, apagando `.next/cache` e subindo `npm run dev` de novo. Mesma classe de problema já registrada no Playbook DevOps ("watcher do Next não pega mudança de config a quente") — aqui aconteceu numa edição comum de arquivo, não só em config especial, então vale desconfiar disso sempre que uma mudança de API não aparecer na resposta.

**Dois bloqueios externos identificados, nenhum resolvido (fora do meu controle — exigem ação do usuário):**
1. `OPENROUTER_API_KEY` vazia em `orbita-workspace/.env` — sem ela nenhum tenant do Quasar recebe resposta real da IA (401, cai no fallback genérico). Não é específico do Lane.
2. Rede: container do Quasar (Docker Desktop) não alcança `localhost:3002` deste sistema via `host.docker.internal`, apesar do Windows alcançar (WSL2 encaminha só pra `127.0.0.1` do Windows, não pras interfaces que o Docker Desktop usa). Correção pendente exige `netsh interface portproxy` num PowerShell como Administrador.

**Validado apesar dos bloqueios:** as 4 ferramentas do Quasar rodadas localmente em Python (fora do container, mesma rede do dev server) contra a API real deste sistema — leitura (catálogo, agenda, cliente) e escrita (`registrar_pedido`, retornando valor final e sinal corretos: R$280 final / R$140 de sinal num teste real). Dados de teste removidos depois.

---

## 2026-07-31 — Repositório Git próprio criado e publicado no GitHub

Mesmo padrão do Villa Mill/Depósito Lobo/Jocley Grill: o sistema vivia como pasta solta dentro do `orbita-workspace`, sem versionamento nenhum, até esta data.

**Preparação local (qualquer agente pode fazer, per `agent-authority.md`):** `git init`, branch `main` direto (sem passar por `master`). Dois ajustes no `.gitignore` padrão do `create-next-app` antes do commit: `.env*` estava excluindo também o `.env.example` (deveria ser versionado, é só um template) — corrigido com `!.env.example`; e `/src/generated/prisma` (Prisma Client gerado) tinha entrado no primeiro commit por engano — removido num segundo commit, mesmo padrão já usado no `academia-sandro`.

**Decisão consciente:** a pasta NÃO foi adicionada ao `.gitignore` da raiz do `orbita-workspace` (monorepo), apesar do risco documentado no Playbook DevOps (incidente real com o `orbita-lobo`, onde um merge na raiz apagou 31 arquivos de um repo aninhado sem isolamento). Motivo: nenhum dos sistemas irmãos que já viraram repositório próprio (`lanchonete-sistema`, `sistema-thieco`, `vilamill-sistema`) está gitignorado na raiz — segui o padrão real já em uso em vez de aplicar uma regra mais rígida que não é seguida em nenhum outro caso.

**Push feito por `@devops` (Gage)**, conforme exclusividade de `agent-authority.md` — não pelo agente que preparou o commit. Quality gates rodados antes do push: lint ✅, 38 testes unitários ✅, build de produção ✅ (incluindo confirmar que `npx prisma generate` recria o client do zero a partir do schema versionado, validando que remover `/src/generated/prisma` do git não quebra um clone novo). CodeRabbit **não disponível neste ambiente** (`coderabbit` não instalado) — gate pulado com essa lacuna documentada, não escondida.

**Descoberta técnica:** o bloqueio de `git push`/`gh pr create`/`gh pr merge` pra agentes que não sejam `@devops` não é só uma regra de documentação (`agent-authority.md`) — existe um hook real do Claude Code (`​.claude/hooks/enforce-git-push-authority.cjs`, PreToolUse) que intercepta o comando e bloqueia se não achar `AIOX_ACTIVE_AGENT=devops` (ou aliases: `@devops`, `github-devops`, `@github-devops`, `aiox-devops`, `@aiox-devops`) **na própria string do comando** — `export` separado antes não funciona, precisa ser inline (`AIOX_ACTIVE_AGENT=devops git push origin main`). Documentado em detalhe no Playbook DevOps.

**Repositório:** `https://github.com/willianslegacy94-zion/lane-confeitaria` — privado (regras de negócio reais de uma cliente).

---

## 2026-08-02 — Ambiente de dev corrigido: node_modules/Prisma Client misturados entre WSL e Windows nativo

Sessão de teste local revelou que o projeto tinha sido rodado tanto por um processo Linux (sandbox de execução) quanto pelo `npm run dev` real da Lane no Windows nativo — mesma pasta, dois sistemas operacionais diferentes acessando o mesmo `node_modules`/`.next`/Prisma Client gerado.

**Sintomas encontrados, em cadeia:** `next` não reconhecido no PowerShell (shims `.bin` gerados em formato Unix, sem `.cmd`/`.ps1`); depois de reinstalar, panic do Turbopack ("Next.js package not found") por cache misto; depois, `PrismaClientValidationError` com campo novo do schema "desconhecido" mesmo após `prisma migrate dev` — Prisma Client (`src/generated/prisma`, `output` customizado no `generator client`) não regenerava junto com a migration nesse ambiente, exigindo `npx prisma generate` manual toda vez.

**Impacto:** qualquer alteração de schema feita por um agente rodando fora do ambiente real da Lane (Windows nativo) arrisca corromper `node_modules`/cache — decisão prática adotada na sessão: mudanças de schema/dependência só devem ser executadas (`npm install`, `prisma migrate dev`, `prisma generate`) no terminal real da Lane, nunca por script auxiliar rodando em outro SO.

**Também descoberto:** porta 3002 (definida no `.env` original) colidia com outro processo Node (`dist/main`, provavelmente de outro projeto do workspace) já ocupando a porta no Windows real. `NEXTAUTH_URL`/porta do dev server migrados para 3010.

---

## 2026-08-02 — Quasar testado ponta a ponta pela primeira vez contra dados reais, com chave de IA configurada

Diferente da sessão anterior (2026-07-30, onde as ferramentas do Quasar foram validadas rodando Python isolado, sem `OPENROUTER_API_KEY` configurada — toda resposta caía no fallback genérico), nesta sessão `OPENROUTER_API_KEY` foi preenchida em `orbita-workspace/.env` e o fluxo completo (`/api/v1/quasar/chat` → Claude/GPT com tool-calling → ferramentas reais deste sistema) rodou de ponta a ponta pela primeira vez.

**Bug real e sério encontrado no Quasar (não neste sistema, mas com impacto direto na integração):** a 2ª chamada ao modelo (depois de executar `consultar_catalogo_bolos`/`consultar_disponibilidade_agenda`) não reenviava a lista de ferramentas (`tools`) — o modelo ficava fisicamente impedido de chamar `registrar_pedido` depois de checar catálogo/agenda numa mesma rodada de conversa, porque a API não oferecia mais essa opção na rechamada. Resultado observado repetidamente: a IA dizia "vou registrar o pedido agora" e nunca chamava a ferramenta de verdade. Corrigido no lado do Quasar com um loop de tool-calling propriamente dito (até 5 rodadas, reenviando `tools`/`tool_choice` a cada chamada). Detalhe completo em `kernel-hq/arquitetura-quasar/registro-de-decisoes-quasar.md`.

**Validado depois da correção:** conversa completa (sabor, massa, peso, data, forma de pagamento) terminando em `registrar_pedido` real, com valor final/sinal retornados corretamente pela ferramenta.

---

## 2026-08-02 — Novo modelo `Atendimento`: o card nasce na 1ª mensagem, antes de qualquer dado do bolo existir

Pedido original do usuário: o card no Kanban deveria aparecer assim que a Mel atendesse alguém, independente de o pedido ter sido fechado ou não — mas `Pedido` exige `massa`/`pesoKg`/`dataEntrega`/`valorBase` como campos obrigatórios (`NOT NULL`), nenhum dos quais existe na primeira mensagem de uma conversa nova.

**Duas opções avaliadas:** (a) tornar os campos do `Pedido` opcionais/nullable — rejeitada, mexeria no coração do sistema (financeiro, agenda, CMV, o próprio Kanban já assumem esses campos sempre preenchidos); (b) modelo novo e leve (`Atendimento`) representando a conversa antes de virar pedido de verdade — escolhida.

**Decisão:** `Atendimento` guarda só `cliente`+`fila` (sem nenhum dado do bolo). Nasce na fila inicial (`ordem 0`) na 1ª mensagem de um contato novo, sem depender de a IA lembrar de chamar uma ferramenta pra isso — é uma chamada automática (`registrarProgressoAtendimento`) feita pelo próprio Quasar a cada mensagem recebida (`primeiraMensagem: boolean`), não uma tool-call opcional do modelo. Quando `registrar_pedido` cria o `Pedido` de verdade pro mesmo cliente, o `Atendimento` correspondente é apagado (`apagarAtendimentoDoCliente`) — o Pedido passa a representar aquele cliente no board, sem duplicar card.

**Impacto na UI:** `KanbanBoard` passou a renderizar dois tipos de card na mesma coluna (`PedidoCard` e `AtendimentoCard`, este último sem valor/sabor, só "em conversa" + contato).

---

## 2026-08-02 — Avanço automático de fila (Em negociação → Agendado) e liberação automática de agenda

Pedido do usuário: conforme a conversa avança, o card deve se mover sozinho pelo funil — "Em negociação" quando o cliente já está descrevendo o que quer, "Agendado" quando data e preço estão definidos, "Atendimento Humanizado" quando a IA precisa de confirmação da Lane.

**Dois novos flags configuráveis em `Fila`** (mesmo padrão já usado por `disparaAgendamento`/`contaComoConcluido` — filas têm nome livre, nenhuma automação assume nome fixo):
- `recebePedidoAutomatico` — fila pra onde o `Atendimento` avança a partir da 2ª mensagem, e pra onde o `Pedido` (recém-criado na fila inicial) é empurrado automaticamente logo após `criarPedido`, quando a origem é o canal automatizado (`origem: "automatico"`, novo parâmetro de `criarPedido`).
- `disparaAtendimentoHumano` — fila destino quando o Quasar aciona a ferramenta `acionar_atendimento_humano` — reaproveita a mesma resolução por flag (`GET /api/internal/filas`) já usada pelas outras integrações, nunca hardcoda UUID/nome de fila do lado do agente.

**Encadeamento automático real:** depois de criar o pedido (origem automática), o sistema tenta mover pra fila "recebe da IA" e, na sequência, pra fila com `disparaAgendamento=true` — reaproveitando `moverPedidoDeFila` (que já bloqueia contra dia cheio, Story 3.3) em vez de duplicar a lógica. Se qualquer etapa falhar (fila não configurada, dia cheio), o pedido simplesmente para na última fila alcançada — nunca lança erro pro fluxo de criação.

**Bug real descoberto durante o teste:** `moverPedidoDeFila` só criava o `Agendamento` ao ENTRAR numa fila com `disparaAgendamento=true`, mas nunca liberava a vaga ao SAIR dela — um pedido movido de "Agendado" de volta pra outra fila (ex.: Lane invalidando um sinal) deixava a vaga de produção reservada pra sempre, contando contra o limite diário sem nenhum pedido confirmado de verdade ocupando-a. Corrigido com `agendaService.liberarAgendamento`, chamado automaticamente quando a fila de origem tinha o flag e a de destino não tem. Validado contra banco real: mover pra "Agendado" cria `Agendamento`, mover pra qualquer outra fila sem o flag apaga o registro.

---

## 2026-08-02 — Visão computacional: Mel lê foto de bolo de referência e comprovante de Pix

Pedido do usuário, motivado por uma limitação real encontrada: o `webhook_evolution` do Quasar ignorava silenciosamente qualquer mensagem que não fosse texto puro (`imageMessage` nem era checado) — uma cliente mandando foto de referência de bolo (fluxo real e comum, confirmado nas próprias conversas reais da Lane usadas pra calibrar o tom) simplesmente não recebia resposta nenhuma.

**Implementado (lado do Quasar, com endpoint novo neste sistema pro teste):**
- Busca da mídia real via Evolution API (`/chat/getBase64FromMediaMessage/{instance}` — WhatsApp criptografa mídia ponta-a-ponta, o webhook só traz metadados) e envio como bloco multimodal (`image_url` com data URI base64) na chamada ao modelo.
- `PayloadConversa` (endpoint `/api/v1/quasar/chat`) ganhou campo opcional `imagem_url`, permitindo testar o fluxo de visão sem depender do WhatsApp real.

**Validado com fotos reais:** identificação correta de um bolo temático (decoração, cores, texto do topper) e leitura de comprovante de Pix real (valor, data, remetente, destinatário) — inclusive um caso negativo (comprovante com destinatário diferente da Lane), corretamente **não confirmado** pela IA.

---

## 2026-08-02 — Confirmação de pagamento por foto NUNCA marca "pago" direto — sempre passa por validação da Lane

Decisão explícita do usuário depois de ver a Mel confirmando sinal automaticamente a partir da leitura do comprovante: conferência visual de uma IA pode ser enganada (comprovante editado/falso) — nunca deveria dar baixa de pagamento sozinha.

**Dois campos novos em `Pedido`:** `comprovanteParaValidar` (boolean) e `resumoComprovante` (texto — o que a Mel viu na imagem). A ferramenta `confirmar_pagamento_sinal` do Quasar passou a **só sinalizar** esses campos (via `POST /api/internal/pedidos/confirmar-sinal`), nunca escrever `statusSinal=PAGO` diretamente — isso ficou restrito a uma ação manual da Lane.

**UI nova:** `PedidoCard` ganhou badge "🔍 validar comprovante" quando o flag está ativo, e clicar em qualquer card de pedido abre um modal (`PedidoDetalheModal`) com: aprovar/rejeitar o comprovante sinalizado, e botões de "dar baixa" manual (sinal e saldo total) independentes de ter vindo da IA — expõe, pela primeira vez com UI de verdade, o `marcarStatusPagamento` que já existia como Service desde a sessão de 2026-07-30 sem nenhum botão que o chamasse (item que estava registrado como pendência no índice de governança).

---

## 2026-08-02 — Calibração de tom da Mel com conversas reais da Lane, e regra de "mistura" com o registro do cliente

Usuário forneceu prints reais de conversas da Lane no WhatsApp (incluindo a IA padrão do próprio WhatsApp Business, que o usuário explicitamente NÃO quer copiar) para calibrar como a Mel deveria soar. Descobertas do material real: Lane escreve em frases curtas e diretas ("Perfeito 👍", "Consigo sim", "Gostaria de fechar?"), bem diferente do tom formal/estruturado da IA padrão do WhatsApp Business.

**Decisão:** persona da Mel (lado do Quasar, `FAQ_LANE_CONFEITARIA`) passou a ter uma seção explícita de calibragem de tom com exemplos reais, e a instrução de "adaptação de linguagem" no prompt genérico foi redesenhada de "espelha o cliente, ou usa o tom padrão se não estiver claro" para uma mistura constante: a base (frases curtas, expressões da Lane) nunca desaparece, só a camada de formalidade/gíria por cima varia conforme o cliente.

---

## 2026-08-02 — WhatsApp real conectado via Evolution API, com tela de configuração própria

Nova rota `/api/internal/*` não foi necessária pra isso — em vez disso, `lane-confeitaria` ganhou uma integração direta e nova com a Evolution API (mesmo gateway compartilhado pela Holding, já usado pelo Quasar) pra permitir que a própria Lane conecte seu WhatsApp sem depender de nenhum agente de dev.

**Implementado:** `whatsappService.ts` (server-side, `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE_NAME` novos no `.env`), tela `/configuracoes/whatsapp` com QR code (`GET /instance/connect/{instance}`), status de conexão com polling client-side a cada 3s, e botão de desconectar. Instância `lane_confeitaria` criada na Evolution API compartilhada, com webhook apontando pro Quasar (`http://orbita_quasar:5003/webhook/evolution`, mesma rede Docker `orbita_shared`).

**Descoberta importante durante o teste real:** ao conectar, a Evolution API baixa o histórico completo da conta (`recv N chats, M contacts, Z msgs`) e dispara `messages.upsert` pra mensagens antigas também, não só novas — risco real se conectado a um número pessoal de uso ativo (a Mel poderia processar/tentar responder conversas pessoais antigas ou de contatos não relacionados ao negócio). Recomendação registrada: usar sempre um número dedicado à confeitaria, nunca um número pessoal de uso diário.

**Também corrigido nesta integração:** `nome_cliente` nunca era passado no webhook do Quasar pra `gerar_resposta_quasar` (sempre caía no default genérico "Cliente") — corrigido pra usar o `pushName` do WhatsApp como palpite inicial, com instrução explícita na persona da Mel pra sempre confirmar o nome de verdade do cliente antes de registrar o pedido (o nome de exibição do WhatsApp pode ser apelido/nome de família).

---

## 2026-08-02 — Gap de produção identificado (não corrigido neste sistema): memória de conversa do Quasar não persiste

Durante os testes desta sessão, descobriu-se que `orbita_quasar.db` (SQLite, memória de conversa de **todos** os tenants do Quasar, não só deste sistema) está no `.dockerignore` e sem volume montado no `docker-compose.yml` do Quasar — toda vez que o container é reconstruído, o histórico de conversa inteiro é apagado (os `Pedido`/`Atendimento` reais, que ficam no Postgres deste sistema, não são afetados).

**Impacto neste sistema:** nenhum diretamente (dados de negócio ficam intactos), mas testes de "retomar conversa depois de X" ficaram inconsistentes durante a sessão por causa disso. **Registrado como item de backlog** em `kernel-hq-arquitetura/12-backlog-painel-admin-cortex-quasar.md` — precisa de volume Docker nomeado antes do deploy em produção (VPS), não é um problema deste sistema pra resolver.

---

## 2026-08-04 — Bug de produção: schema drift entre `schema.prisma` e migrations quebrou `/crm`, dashboard e criação de pedido

No dia seguinte à integração WhatsApp real (v2.2/v2.3, sessão de 2026-08-02), a usuária reportou `500 Internal Server Error` em `/crm` em produção. Investigação: `Pedido.comprovanteParaValidar`/`resumoComprovante` (campos adicionados ao `schema.prisma` na mesma sessão de 2026-08-02, pra suportar a confirmação de pagamento por foto da Mel) **nunca tiveram uma migration gerada** — as 3 migrations existentes em `prisma/migrations/` (`init`, `fila_gatilhos_automaticos`, `atendimento_leve`) não criam essas colunas na tabela `pedidos`.

**Por que passou despercebido:** o ambiente que fez a mudança de schema não tinha acesso ao Postgres local (sandbox sem Docker), então `prisma migrate dev` nunca rodou de verdade pra gerar o arquivo SQL — só `prisma generate` (que só depende do `schema.prisma`, não do banco). O Prisma Client ficou coerente com o schema, mas o banco real (dev e produção) nunca recebeu a alteração.

**Efeito em cascata, não isolado num único endpoint:** como nenhuma query do Prisma nessas rotas usa `select` explícito (busca todas as colunas do model por padrão), qualquer rota que tocasse a tabela `pedidos` quebrava com `column "comprovanteParaValidar" does not exist` — mas em produção o Next.js omite a mensagem real e mostra só um digest genérico. Sintomas relatados em sequência, todos a mesma causa: `/crm` (500), `GET /api/dashboard/ranking-peso` (500), criar pedido pelo formulário manual (falha silenciosa — o Server Action lança antes do `resultado.success` ser avaliado, então a UI só parecia "não fazer nada").

**Correção:** migration retroativa `20260804050000_pedido_comprovante_validacao` (`ALTER TABLE pedidos ADD COLUMN...`), aplicada em produção via `docker compose run --rm migrate` — precisou de `docker compose build migrate` antes, porque o serviço `migrate` (`profiles: ["tools"]`) não é reconstruído automaticamente por `docker compose up -d --build`.

**Processo corrigido:** toda alteração de `schema.prisma` a partir de agora exige gerar/escrever a migration correspondente **no mesmo commit** — nunca só o schema. Detalhe operacional completo (comandos, diagnóstico) no Playbook DevOps (`kernel-hq-arquitetura/Playbook DevOps - Comandos Docker e Bancos.md`, seção Lane Confeitaria).

---

## 2026-08-04 — Funil de produção definido com nomes reais e replicado via script idempotente

Ambiente local já tinha 5 filas configuradas manualmente (Novo Cliente, Em negociação, Atendimento humanizado, Agendado, Pago) com os flags de automação corretos, mas produção só tinha o mínimo pra não travar a criação de pedido. Usuário pediu pra replicar a mesma configuração em produção.

**Mapeamento confirmado com o usuário** (checkbox por fila, ver tabela em `modelo-de-dados-lane-confeitaria.md`): "Novo Cliente" não leva nenhum flag (é a 1ª fila por `ordem`, destino automático de toda criação — não depende de marcação); "Em negociação" = `recebePedidoAutomatico` ("recebe da IA" na UI); "Atendimento humanizado" = `disparaAtendimentoHumano`; "Agendado" = `disparaAgendamento`; "Pago" = `contaComoConcluido`. Confirma exatamente os exemplos já citados nos comentários do código (`pedidoService.avancarPedidoAutomaticamente`, `atendimentoService.registrarProgressoAtendimento`) desde a sessão de 2026-08-02.

**Implementado:** `scripts/seed-filas-funil.ts`, script one-off (fora do `prisma db seed` regular) que busca cada fila por `nome` e cria ou atualiza (ordem + flags) — idempotente, seguro rodar mais de uma vez. Rodado em produção via `docker compose run --rm migrate npx tsx scripts/seed-filas-funil.ts` (a imagem `migrate` já tem `tsx` disponível, mesmo padrão do `db:seed`).

---

## 2026-08-04 — Despesa recorrente é só marcação; botão de logout; ícone de app (PWA)

Três pedidos pequenos da usuária na mesma sessão, sem impacto arquitetural entre si:

**Despesa recorrente:** perguntado explicitamente se "recorrente" deveria gerar lançamento automático todo mês (ex.: aluguel relançado sozinho) ou só uma marcação visual — usuária confirmou que é **só marcação** (`Despesa.recorrente`, boolean, badge "Recorrente" na lista). Sem job/cron associado; ver `modelo-de-dados-lane-confeitaria.md`.

**Logout:** não existia nenhuma forma de sair da conta pela UI — adicionado botão no header do `AppShell`, Server Action chamando `signOut({ redirectTo: "/login" })` do Auth.js.

**Ícone de app / PWA:** favicon.ico ainda era o triângulo default do `create-next-app` (nunca substituído desde a criação do projeto, mesmo já existindo um `icon.tsx` dinâmico com o emoji de bolo desde 2026-08-02). Trocado por um `.ico` real gerado a partir do mesmo PNG do `/icon`. Adicionado `apple-icon.tsx` (180x180, iOS) e `manifest.ts` com ícones 192/512 (com margem de segurança pra máscara "maskable" do Android) — "Adicionar à tela de início" agora usa o ícone certo e abre em modo standalone (sem barra de navegador), tanto iOS quanto Android. Sem logo vetorial real da marca ainda (item já registrado no índice de governança) — o emoji 🎂 continua sendo o substituto.

---

## 2026-08-05 — Calculadora de Projeção expandida: forma de pagamento, docinho, e o que ficou de fora

Pedido original: "diversificar" a calculadora de projeção que já existia no dashboard (só sabor de bolo + peso + quantidade) pra cobrir "todas as opções possíveis" — formas de pagamento com taxa, com/sem topper, com/sem glitter, docinho ou bolo, decoração, tudo combinável.

**Escopo fechado com o usuário antes de implementar** (4 perguntas, pra não inventar regra de negócio nem número financeiro):

1. **"Decoração" descartada** — não virou campo novo, o usuário confirmou que não precisa (só `acrescimoTopper`/`acrescimoGlitter`, que já existiam).
2. **Formas de pagamento com taxa: cadastro novo, sem dado pré-populado.** Não existia nenhum conceito de "taxa por forma de pagamento" no sistema (só `acrescimoCartao`, um valor fixo, sem relação com isso). Criada entidade `FormaPagamento` (nome + taxa%) com tela própria em Configurações — a usuária cadastra os valores reais depois, nada foi chutado.
3. **Docinho: só faturamento, sem lucro.** `ItemDocinho` não tem `ReceitaInsumo` (diferente de `SaborBolo`, que tem CMV via insumo) — não dava pra calcular lucro sem inventar custo. Usuário confirmou: por ora, mostrar só faturamento bruto/líquido pro docinho; CMV de docinho fica pra outra sessão, se um dia for pedido.
4. **Simulador de um cenário por vez, não matriz exaustiva.** Descartada a opção de gerar automaticamente todas as 2ⁿ combinações possíveis (sabor × topper × glitter × forma de pagamento × ...) — cresceria rápido demais pra ser útil visualmente. Mantido o mesmo padrão de interação que já existia (escolhe uma combinação, clica "Simular", entra numa lista comparável), só que agora com mais dimensões por simulação.

**Implementado:** nova aba "Projeção de ganho" (`/projecao`), fora do dashboard — a calculadora antiga (`components/dashboard/CalculadoraProjecao.tsx`) foi removida, não deixada como duplicata. `precificacaoService.aplicarTaxaPagamento()` nova (função pura, com teste) aplica a taxa % sobre o faturamento bruto. Nada disso te toca `Pedido`/`Despesa` reais — é só planejamento, mesma garantia que a calculadora antiga já tinha (AC2 da Story 5.2 original).

---

## 2026-08-07 — Bloqueio manual de número no WhatsApp (Quasar, fora deste repo)

Pedido pontual da Lane: um número específico nunca mais deve receber resposta da Mel. Implementado no lado do Quasar (`orbita-quasar/main.py`, `webhook_evolution`), não neste sistema — checagem por sufixo de telefone (`TELEFONES_BLOQUEADOS`) antes de qualquer chamada ao modelo, mesmo ponto onde já existia o filtro de mensagem de grupo.

**Descoberta relevante durante o trabalho:** `orbita-quasar/main.py`/`database.py` tinham dias de trabalho pendente de commit (categoria de transbordo, topo simples/3D, alerta Telegram, ferramenta `silenciar_fora_de_escopo`, telemetria de custo, leitura de PDF de comprovante). Tudo foi commitado junto com o bloqueio, **exceto** a leitura de PDF (ainda incompleta, deixada de fora a pedido explícito do usuário). Detalhe operacional completo (incluindo o processo de separar só os trechos de PDF de um diff grande e misto) no Playbook DevOps (`kernel-hq-arquitetura`), seção Lane Confeitaria.

---

## 2026-08-07/08 — Card "Desistência": motivo classificado pela Mel, retenção de 30 dias na aba Clientes

Pedido da Lane: um jeito de marcar que um cliente desistiu (seja ainda em conversa — `Atendimento` — ou já com pedido registrado — `Pedido`), com o card saindo do Kanban, mas **o motivo não pode ser escolhido manualmente por ela** — precisa vir da própria Mel, analisando a conversa real.

**Decisões de escopo fechadas antes de implementar (3 perguntas):**
1. **Botão nos dois tipos de card** (Atendimento e Pedido), não só um.
2. **Classificação via chamada síncrona ao Quasar**, não a Mel decidindo sozinha durante a conversa — o botão continua sendo uma ação manual da Lane; só o *motivo* é automático. Isso inverteu, pela primeira vez neste sistema, a direção usual da integração: até aqui só o Quasar chamava `/api/internal/*` daqui; agora este sistema também chama um endpoint novo do Quasar (`POST /api/v1/quasar/classificar-desistencia`), protegido pela mesma `LANE_CONFEITARIA_INTERNAL_KEY` já usada na direção contrária.
3. **Depois de 30 dias, só a etiqueta some — o Pedido nunca é apagado.** Pergunta explícita feita ao usuário porque envolvia risco real de perda de dado: um Pedido marcado como desistência já pode ter sabor/valor/sinal registrados, e "apagar de verdade" poderia significar perder esse histórico financeiro. Confirmado: só `desistenciaMotivo`/`desistenciaEm` são zerados após 30 dias (o que já basta pra sumir da aba Clientes); `desistencia=true` continua pra sempre, mantendo o card fora do Kanban sem precisar apagar nada.

**Implementado:** enum `MotivoDesistencia` (`PRECO`/`PRAZO`/`INDISPONIBILIDADE`/`INDEFINIDO`) + campos `desistencia`/`desistenciaMotivo`/`desistenciaEm` em `Pedido` e `Atendimento` (migration `20260808000024_desistencia`); `listarPedidosPorFila`/`listarAtendimentosPorFila` passam a filtrar `desistencia: false`; nova rota `POST /api/internal/desistencias/limpar` (protegida por `X-Internal-Key`, chamada por `crontab` na VPS — **não há Vercel Cron neste deploy self-hosted**, ver `docs/architecture/deploy-playbook.md`); botão "Desistência" em `PedidoCard`/`AtendimentoCard`, cor âmbar depois de feedback do usuário (o link de texto cinza-claro original ficava quase invisível ao lado do dropdown "Mover para"); nova seção "Desistências recentes" na aba Clientes.

**Dois incidentes durante o deploy, ambos detectados e corrigidos na hora:**

- **Sessão concorrente sobrescreveu `main.py`/`database.py` do Quasar** — outra sessão de IA (mexendo no Theo/`sistema-thieco`, mesmo checkout compartilhado do monorepo `zion-workspace` onde o Quasar vive) reescreveu os dois arquivos no disco a partir de uma cópia desatualizada em contexto próprio, apagando (só no disco, o git ficou intacto) tudo que tinha sido commitado horas antes. Detectado comparando `git diff`/contagem de linhas do arquivo contra `HEAD` antes de continuar editando; corrigido com `git checkout -- <arquivo>`. Lição registrada no Playbook DevOps: sempre conferir `git status`/`git diff` antes de editar arquivos compartilhados entre produtos nesse monorepo, nunca confiar que o conteúdo em memória da sessão ainda bate com o disco.
- **Migration não aplicada em produção por imagem em cache** — repetição da causa-raiz já registrada abaixo (2026-08-04): o serviço `migrate` do `docker-compose.yml` não é reconstruído automaticamente por `docker compose up -d --build`. O redeploy rodou `migrate` **antes** do `--build`, sem rebuild explícito da imagem `migrate` — ela relatou "9 migrations found" (a 10ª nem existia na imagem em cache) e "No pending migrations to apply", enquanto a coluna `desistencia` de fato não existia no Postgres real. `/crm` deu 500 (`column pedidos.desistencia does not exist`) por alguns minutos, até o log ser conferido e corrigido com `docker compose build migrate && docker compose run --rm migrate`. **`docs/architecture/deploy-playbook.md` corrigido** pra deixar esse passo explícito no comando copiável, não só narrado — a entrada de 2026-08-04 abaixo já sabia da causa, só não estava refletida nos comandos do playbook do repo, e por isso o erro se repetiu.

---

## Links relacionados

[[prd-lane-confeitaria]] — problema, objetivo e escopo do sistema
[[requisitos-funcionais-lane-confeitaria]] — RFs/NFRs referenciados nas decisões acima
[[arquitetura-lane-confeitaria]] — decisões técnicas estruturais detalhadas
[[indice-lane-confeitaria]] — mapa completo dos artefatos do sistema
