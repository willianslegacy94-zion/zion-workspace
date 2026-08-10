---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-08
owner: willians
---

# Requisitos Funcionais — Lane Confeitaria

Tradução dos 18 FRs + 5 NFRs do PRD de produto (`lane-confeitaria/docs/prd/prd.md`) em módulos funcionais, com o estado real de implementação de cada um.

---

## Módulo 1 — Autenticação

#### Requisitos Funcionais

- RF-001: Login com e-mail e senha (NextAuth v5, Credentials Provider)
- RF-002: Todas as rotas de negócio exigem sessão autenticada
- RF-003: Usuário inicial criado via seed

#### Regras de negócio

- Sistema é single-tenant — um único usuário (a própria Lane), sem papéis/roles
- Senha armazenada com hash bcrypt; comparação usa hash "dummy" para mitigar timing attack quando o e-mail não existe

#### Status

Implementado. **Bug encontrado e corrigido durante o smoke test:** a primeira versão do `proxy.ts` (middleware) não bloqueava de fato rotas sem sessão — faltava o callback `authorized` em `auth.ts`. Corrigido e revalidado.

---

## Módulo 2 — CRM: Funil de Pedidos (Filas)

#### Requisitos Funcionais

- RF-004: Criar, renomear, excluir e reordenar filas com nome livre
- RF-005: Limite de 7 filas — ao atingir, o botão de criar simplesmente não aparece (nunca uma mensagem de "limite atingido")
- RF-006: Mover pedido entre filas (drag-and-drop no desktop, `<select>` como fallback universal)

#### Regras de negócio

- Limite de filas é lido de `ConfiguracaoSistema.limiteFilas` (default 7), nunca hardcoded
- Excluir fila com pedidos associados é bloqueado até que os pedidos sejam movidos

#### Status

Implementado.

---

## Módulo 3 — CRM: Pedido, Catálogo e Precificação

#### Requisitos Funcionais

- RF-007: Cadastro de pedido — cliente, contato, até 2 sabores, massa (branca/chocolate), peso, data de entrega, referência de modelo (texto/link), valor combinado
- RF-008: Catálogo pré-carregado de 44 sabores de bolo e 12 itens de docinho por cento (2 grupos de preço: R$150 e R$180)
- RF-009: Preço por sabor (`precoPorKg`) cadastrado manualmente — nenhum valor pré-preenchido
- RF-010: Acréscimos configuráveis (cartão, glitter, topper), cada um com valor próprio
- RF-011: Sinal calculado automaticamente como 50% do valor final
- RF-012: Cancelamento com retenção de sinal se a menos de 24h da data de entrega

#### Regras de negócio

- Pedido aceita 1 ou 2 sabores — nunca mais (regra real do cardápio da cliente)
- `valorFinal = valorBase + acréscimos marcados`; `valorSinal = valorFinal × 0.5`
- Cálculo de precificação isolado em funções puras (`precificacaoService.ts`), reaproveitadas pela Calculadora de Projeção (Módulo 6)

#### Status

Implementado.

---

## Módulo 4 — Agenda de Produção

#### Requisitos Funcionais

- RF-013: Calendário mensal com ocupação por dia (`N/limite`)
- RF-014: Limite diário de bolos configurável (`ConfiguracaoSistema.limiteBolosPorDia`, default 5)
- RF-015: Bloqueio transacional contra overbooking — dia no limite não aceita novo agendamento
- RF-016: Integração automática CRM → Agenda via flag `Fila.disparaAgendamento`

#### Regras de negócio

- Diferente do limite de filas (Módulo 2), o limite diário **é** comunicado visualmente à usuária (dia "cheio" destacado) — não é um limite escondido
- Contagem e criação do agendamento ocorrem na mesma transação Prisma (`$transaction`), evitando condição de corrida
- Não há convenção fixa de nome de fila para "produção confirmada" (filas são livres) — a usuária marca manualmente qual(is) fila(s) disparam agendamento

#### Status

Implementado.

---

## Módulo 5 — Financeiro e CMV

#### Requisitos Funcionais

- RF-017: Cadastro de despesas (categoria, descrição, valor, data)
- RF-018: Cadastro de insumos (nome, unidade, custo unitário) e associação a receita de sabor com quantidade
- RF-019: Indicadores financeiros por período — receita, despesas, lucro, fluxo de caixa (gráfico)
- RF-020: CMV por sabor — proporcional ao peso vendido, com tratamento explícito de "custo não calculado"

#### Regras de negócio

- "Pedido concluído" (usado em receita, CMV, clientes recorrentes e ranking) = pedido numa fila marcada com `Fila.contaComoConcluido` — mesmo padrão de flag configurável do Módulo 4, já que filas são livres
- CMV nunca aparece como R$0,00 quando não há insumo cadastrado — aparece como "custo não calculado" (distinção crítica para não induzir decisão errada)

#### Status

Implementado.

---

## Módulo 6 — Dashboard: Metas, Projeção, Recorrência e Ranking

#### Requisitos Funcionais

- RF-021: Meta de faturamento por período, com progresso visual e destaque dourado ao atingir 100%
- RF-022: Calculadora de projeção de ganhos — simulação local, sem persistir nada no banco
- RF-023: Identificação de clientes recorrentes (mais de 1 pedido concluído)
- RF-024: Ranking de bolos vendidos por faixa de peso (5kg/10kg/15kg/outros), com detalhamento por sabor

#### Regras de negócio

- Faixas de peso definidas como ±2.5kg ao redor de cada referência — decisão técnica documentada no código (não especificada pelo PRD original); pesos fora do intervalo caem em "outros", nunca descartados
- Calculadora reaproveita preço (`SaborBolo.precoPorKg`) e custo (`cmvService`) já existentes — nenhuma fonte de dado nova

#### Status

Implementado. **Bug encontrado e corrigido durante os testes:** a primeira versão de `faixaDePeso` não tinha limite inferior — um bolo de 1kg era classificado como "5kg". Corrigido com o intervalo de ±2.5kg e coberto por teste de regressão.

---

## Módulo 7 — Integração com Órbita Quasar (agente de atendimento)

#### Requisitos Funcionais

- RF-025: API interna (`/api/internal/*`), autenticada por `X-Internal-Key`, separada do login da Lane — pra agentes de IA (Quasar) consultarem e agirem no sistema
- RF-026: Consultar as filas do kanban existentes (`GET /internal/filas`), sem assumir nome fixo de nenhuma fila
- RF-027: Consultar disponibilidade de agenda por período (`GET /internal/agenda?dias=N`) — devolve ocupação/limite/vaga por dia, não só os dias livres
- RF-028: Consultar catálogo de sabores (com preço, quando definido) e docinhos (`GET /internal/catalogo`), pra falar de preço com o cliente
- RF-029: Consultar se um contato já é cliente e se é recorrente (`GET /internal/clientes?contato=`), antes de fechar um pedido novo
- RF-030: Criar pedido (`POST /internal/pedidos`) — mesmo fluxo da tela manual, cai na primeira fila do kanban
- RF-031: Mover pedido entre filas (`POST /internal/pedidos/{id}/mover`) — mesmo Service da tela manual, inclusive o bloqueio de agenda cheia (Story 3.3)

#### Regras de negócio

- **Correção de pré-requisito, não deste módulo:** antes desta integração, `pedidoService.criarPedido` criava um `Cliente` novo em **todo** pedido, mesmo de quem já tinha comprado antes — "clientes recorrentes" (Módulo 6) nunca disparava de verdade porque o dado-fonte nunca existia. Corrigido com `clienteService.buscarOuCriarCliente`, que reaproveita o `Cliente` existente pelo `contato` (telefone/WhatsApp, chave natural de identidade) antes de criar um novo. Essencial pra esta integração: o Quasar sempre tem o número de WhatsApp de quem está conversando.
- Sem `INTERNAL_API_KEY` configurada no `.env`, todas as rotas internas respondem `503` — a integração fica desligada por padrão, nunca aberta "de graça" por falta de configuração.
- O Quasar cria o **pedido de verdade** (não um rascunho/lead à parte) — ele cai na primeira fila do funil como qualquer pedido manual, e a Lane segue a negociação movendo o card normalmente. Decisão registrada em `registro-de-decisoes-lane-confeitaria.md`.
- Mesmo princípio já usado no `sistema-orbita-whitelabel` pro Quasar/Cortex: nenhum dado específico da Lane (nome de fila, sabor, preço) fica hardcoded do lado do agente — tudo é consultado em tempo de request pelas rotas acima.

#### Status

Implementado e validado ponta a ponta contra banco real: 401 sem chave/com chave errada, 200 com chave certa, criação de 2 pedidos com o mesmo contato resultando em 1 único `Cliente` (dedup confirmado direto no banco), e movimentação de pedido disparando agendamento real (visível na consulta de disponibilidade em seguida).

---

## Módulo 8 — Atendimento automático (Kanban dirigido por conversa) e visão computacional

#### Requisitos Funcionais

- RF-032: Card leve (`Atendimento`) nasce no Kanban assim que um contato novo fala com a Mel, antes de qualquer dado do bolo estar definido
- RF-033: `Atendimento` avança automaticamente da fila inicial pra fila marcada como "recebe da IA" a partir da 2ª mensagem da conversa
- RF-034: Pedido criado pelo canal automatizado (origem Quasar) encadeia automaticamente Novo Cliente → "recebe da IA" → fila de agendamento, reaproveitando a mesma trava de dia cheio da Agenda (Módulo 4)
- RF-035: Saída de uma fila de agendamento libera automaticamente a vaga de produção reservada (`Agendamento` apagado)
- RF-036: Card em aberto (Pedido ou Atendimento) move pra fila de "atendimento humano" quando o Quasar aciona a ferramenta correspondente
- RF-037: Mel (Quasar) analisa foto de referência de bolo (cor, formato, decoração) enviada pelo cliente
- RF-038: Mel analisa foto de comprovante de Pix (valor, data, destinatário) e sinaliza o pedido pra validação — nunca marca pagamento como confirmado sozinha
- RF-039: Card do pedido exibe indicador "validar comprovante" e abre modal (clique no card) com aprovar/rejeitar comprovante e marcação manual de sinal/saldo pago
- RF-043: Botão "Desistência" no card de `Pedido` **e** `Atendimento` — a Lane aciona manualmente, mas o motivo (preço/prazo/indisponibilidade) é classificado pela Mel a partir das últimas mensagens reais da conversa, nunca escolhido pela Lane
- RF-044: Card marcado como desistência sai do Kanban permanentemente (nunca volta sozinho), sem apagar o `Pedido`/`Atendimento` — sabor/valor/histórico financeiro continuam intactos no banco
- RF-045: Motivo e data da desistência ficam visíveis numa seção própria da aba Clientes por 30 dias; depois desse prazo, só a etiqueta some (limpeza automática via cron da VPS)

#### Regras de negócio

- `Pedido` exige `massa`/`pesoKg`/`dataEntrega`/`valorBase` (`NOT NULL`) — por isso o card inicial de uma conversa nova não pode ser um `Pedido` de verdade; `Atendimento` existe justamente pra representar esse estado intermediário sem forçar dado inventado nesses campos
- Quando um `Pedido` de verdade é criado pro mesmo cliente, o `Atendimento` correspondente é apagado — nunca coexistem os dois representando a mesma conversa
- Confirmação de pagamento por foto é **sempre** uma sinalização (`comprovanteParaValidar`), nunca uma escrita direta em `statusSinal` — decisão explícita para não confiar em conferência visual de IA (comprovante pode ser falsificado) como fonte de verdade financeira
- Filas envolvidas (`recebePedidoAutomatico`, `disparaAtendimentoHumano`) seguem o mesmo padrão de flag configurável do Módulo 4 — nome de fila é sempre livre, nunca assumido pelo código
- **Desistência (RF-043/044/045, desde 2026-08-08):** única funcionalidade do sistema em que este app chama o Quasar (`POST /api/v1/quasar/classificar-desistencia`), em vez do contrário — decisão explícita pra não deixar a Lane escolher o motivo manualmente numa lista, já que só a Mel tem acesso ao texto real da conversa. Falha de rede/timeout com o Quasar nunca trava a marcação — cai em `INDEFINIDO`. `desistencia=true` é permanente (nunca reaparece no Kanban); só `desistenciaMotivo`/`desistenciaEm` são zerados após 30 dias, e só esses dois campos — o `Pedido`/`Atendimento` em si nunca é apagado. Sem Vercel Cron (deploy self-hosted em Docker/VPS) — a limpeza dos 30 dias é `crontab` comum na VPS chamando a rota interna

#### Status

Implementado e validado ponta a ponta contra banco real e conversa real com o Quasar: card nascendo na 1ª mensagem, avanço automático até "Agendado", liberação de vaga ao sair de "Agendado", leitura de foto de bolo temático e de comprovante Pix real (incluindo um caso de destinatário incorreto, corretamente não confirmado). **Desistência (RF-043/044/045) validada em produção em 2026-08-08**, incluindo a correção de dois incidentes de deploy no processo (detalhe em `registro-de-decisoes-lane-confeitaria.md`).

---

## Módulo 9 — Conexão WhatsApp (Configurações)

#### Requisitos Funcionais

- RF-040: Tela própria (`/configuracoes/whatsapp`) exibe QR code pra conectar o número de WhatsApp da confeitaria
- RF-041: Status de conexão exibido em tempo (quase) real, com polling automático — some o QR code assim que conectado
- RF-042: Botão de desconectar

#### Regras de negócio

- Integração direta com a Evolution API (mesmo gateway compartilhado pela Holding, usado pelo Quasar) — `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE_NAME` no `.env` deste sistema
- Este sistema **não recebe** webhook de mensagem — quem fala com a Evolution API pra atendimento é sempre o Quasar; esta tela só existe pra gerar/mostrar o QR code de pareamento
- **Risco operacional identificado, não mitigado no código:** conectar um número pessoal de uso ativo expõe o histórico completo da conta ao processamento do agente (Evolution API sincroniza mensagens antigas ao parear) — recomendação registrada de sempre usar número dedicado ao negócio

#### Status

Implementado e validado com conexão real (QR code escaneado, mensagem real recebida e respondida pela Mel).

---

## Requisitos não funcionais

| ID | Requisito | Status |
|---|---|---|
| NFR-001 | Identidade visual da marca aplicada via tema Tailwind | Implementado |
| NFR-002 | Mobile-first | Implementado (nav lateral desktop / inferior mobile) |
| NFR-003 | Autenticação obrigatória (NextAuth v5) | Implementado |
| NFR-004 | Dados sensíveis restritos a usuário autenticado | Implementado (todas as rotas de API verificam sessão) |
| NFR-005 | Limites de sistema em banco, não hardcoded | Implementado (`ConfiguracaoSistema`) |

---

## Critérios de aceite gerais

- Build de produção limpo (`next build`) — validado, 24 rotas
- Lint limpo (`eslint`) — validado
- Testes unitários das regras de negócio críticas (precificação, limites, CMV, ranking) — 30 testes, todos passando
- Migration e seed executados com sucesso contra PostgreSQL real (Docker local); login e navegação autenticada validados via `curl` (fluxo NextAuth completo com CSRF); escrita real (criação de fila) confirmada refletindo na UI
- **Parcialmente validado em navegador real (2026-08-02):** o usuário acompanhou o Kanban (`/crm`) e a tela de WhatsApp (`/configuracoes/whatsapp`) ao vivo no navegador durante os testes de integração com o Quasar, incluindo conexão real de WhatsApp via QR code e mensagem real recebida/respondida. **Ainda não validado:** uso completo do sistema (todos os módulos) pela própria Lane, em dispositivo mobile

---

## Links relacionados

[[indice-lane-confeitaria]] — mapa completo dos artefatos do sistema
[[prd-lane-confeitaria]] — objetivo e escopo que estes RFs traduzem
