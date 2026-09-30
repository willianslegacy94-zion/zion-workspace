---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-07-29
owner: willians
---

# PRD — Jocley Grill

## 1. Contexto

A Jocley Grill vende bebidas, lanches e espetos de churrasco, com atendimento tanto em mesas quanto em balcão (retirada/consumo rápido). Antes do sistema, não havia controle digital de nenhuma parte da operação: cardápio, custo de produção (CMV), estoque, cozinha e financeiro eram geridos sem ferramenta dedicada.

O pedido original do cliente foi explícito em reaproveitar o que já funciona em dois sistemas irmãos do mesmo operador (vilamill-sistema e sistema-thieco) em vez de desenhar tudo do zero — layout claro de restaurante, dashboard financeiro, menu lateral agrupado e inteligência financeira já validados em produção.

## 2. Problema

**Dor específica:** Ausência total de PDV digital, cálculo de custo de cardápio e separação de acesso por função da equipe.

**Como se manifesta:**
- Não há visão de quais mesas estão ocupadas nem de comandas de balcão em aberto
- CMV (custo de mercadoria vendida) não é calculado — preço de venda é definido sem saber a margem real
- Estoque de insumos não é rastreado — não há alerta de insumo acabando
- Cozinha depende de comunicação verbal com quem atende
- Não há relatório de faturamento, ranking de pratos, pico de horário ou DRE
- Toda a equipe (dono, supervisor, atendente de mesa, caixa, cozinha) precisaria do mesmo nível de acesso ou de controle manual de permissão — risco de exposição de dado financeiro sensível para quem não deveria ver

**Por que ainda não foi resolvida:** Sistemas de PDV genéricos não têm o cálculo de CMV a partir de ficha técnica nem a granularidade de papéis que o negócio precisa (atendente de mesa só deveria ver cardápio e mesas; supervisor deveria gerenciar operação e equipe sem ver o financeiro estratégico do dono).

## 3. Objetivo

Após o sistema existir:
- Qualquer atendente com tablet/celular abre uma mesa, lança os itens do cardápio e fecha a comanda (imprime cupom, recebe o pagamento)
- O dono (Admin) enxerga o CMV de cada prato calculado automaticamente a partir da ficha técnica, sem precisar calcular na mão
- O estoque de insumos é deduzido sozinho no fechamento da comanda, e alerta quando algo está abaixo do mínimo
- A cozinha vê a fila de itens pendentes em tempo real (KDS) sem depender de aviso verbal
- O dono e o supervisor gerenciam a equipe (feedbacks, planos de ação, sugestões) e criam login de novos funcionários sem precisar de um desenvolvedor
- O dono acompanha o dia com dashboard financeiro (Receita Bruta, CMV, Despesas, Resultado) e a Inteligência Financeira (ranking de pratos, ranking de formas de pagamento, pico de horário, projeção de faturamento e break-even do mês, DRE exportável)

## 4. Usuário

**Quem:**
- **Admin (Jocley, dono):** acesso total — dashboard financeiro, Inteligência Financeira, CMV, Configurações (taxas + notificações), e tudo que os demais papéis também acessam
- **Supervisor:** gestão operacional e de equipe completa (Mesas, Balcão, Cozinha, Cardápio, Estoque, Lançamentos, Despesas, Gestão de Time, Usuários) — sem acesso ao dashboard financeiro, Inteligência Financeira, CMV nem Configurações, que ficam exclusivos do dono
- **Caixa:** opera o PDV em uma estação fixa — Mesas, Balcão, Cardápio (visualização) e Estoque (visualização)
- **Atendente:** opera no tablet/celular, andando entre as mesas — Cardápio (visualização), Mesas e Balcão; sem acesso a Estoque nem a nada administrativo
- **Cozinha:** login dedicado, acesso exclusivo ao KDS (`/cozinha`)

**Estado no uso:**
- Atendente/Caixa: operacional, sob pressão do movimento — quer lançar pedido e fechar comanda rápido, com o mínimo de telas
- Admin/Supervisor: analítico — quer entender resultado do dia, estoque crítico e desempenho da equipe
- Cozinha: focado na fila de preparo, sem distração de outras telas

**Contexto:** acessado via navegador (tablet ou computador) na própria operação da lanchonete, durante o horário de funcionamento.

## 5. Hipótese de solução

Um PDV web interno — nos moldes visuais e de fluxo do vilamill-sistema, com o menu lateral e a inteligência financeira nos moldes do sistema-thieco — que gerencia o ciclo completo de uma comanda (mesa ou balcão), calcula CMV automaticamente a partir da ficha técnica, e segrega o acesso por papel de forma que cada pessoa da equipe veja só o que precisa para o próprio trabalho.

**Por que faz sentido:** os dois sistemas de referência já provaram, em produção, que os padrões escolhidos funcionam para o mesmo tipo de operação (restaurante/bar e comércio de atendimento presencial). Reaproveitar o padrão reduz risco de reinventar algo que já foi testado.

**Risco central:** o cálculo de CMV depende inteiramente da ficha técnica estar corretamente montada (insumo × quantidade × custo unitário) — se a ficha técnica estiver incompleta ou desatualizada, o CMV mostrado no dashboard fica incorreto sem nenhum aviso visual disso.

## 6. Escopo

**Dentro:**
- PDV híbrido: Mesas (grid, como vilamill) + Balcão (comanda numerada, resetando todo dia)
- Cupom térmico 80mm via `window.print()` + CSS `@page`, escopado para não conflitar com a impressão A4 do DRE
- Split payment com forma de pagamento e bandeira de cartão opcional por linha
- Cardápio (CRUD de produtos) separado da aba CMV (cálculo automático de custo a partir de ficha técnica, markup, margem, preço sugerido)
- Estoque de insumos com alerta de nível mínimo e dedução automática no fechamento da comanda
- KDS de Cozinha (dark theme, urgência visual por tempo, poll 2s)
- Dashboard financeiro (Início) nos moldes do vilamill: Receita Bruta, CMV, Despesas, Resultado, Pedidos Fechados, Ticket Médio, Mesas Abertas, Receita por Forma de Pagamento, Receita Líquida
- Inteligência Financeira: ranking de formas de pagamento, ranking de pratos, pico de horário, DRE exportável (impressão A4), projeção de faturamento + break-even do mês corrente, ticket médio por caixa
- Despesas com recorrência (semanal/mensal/anual) e edição/exclusão com escolha de escopo (só esta ocorrência ou esta e futuras)
- Lançamentos (lista de comandas fechadas no período)
- Gestão de Time: Equipe, Feedbacks, Planos de Ação (PDCA), Sugestões, Timeline
- Configurações: só Notificações e Taxas por forma de pagamento (com suporte opcional a taxa por bandeira)
- 5 papéis de acesso (Admin, Supervisor, Caixa, Atendente, Cozinha) com RBAC reforçado tanto na navegação (middleware) quanto nas rotas de API de escrita sensíveis (cardápio, estoque, ficha técnica, usuários)
- Tela de Usuários para Admin/Supervisor criarem login da equipe sem deploy

**Fora:**
- Integração com maquininha de cartão (formas de pagamento e bandeira são registradas manualmente)
- Cardápio digital para o cliente escanear (QR code na mesa)
- Integração com delivery (iFood, Rappi)
- Disparo real de notificações configuradas (a tela de Configurações define o quê e quando, mas não há job/worker disparando as mensagens ainda)
- Deploy em produção (VPS) — sistema testado em ambiente de desenvolvimento local até este PRD
- Multi-unidade (mais de uma loja Jocley Grill)

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Tempo de fechamento de uma comanda (mesa ou balcão) | inexistente (sem sistema) | < 2 minutos, mesmo padrão do vilamill |
| CMV calculado automaticamente por prato | 0% (sem sistema) | 100% dos produtos com ficha técnica completa |
| Visibilidade da fila da cozinha em tempo real | inexistente | atualização a cada 2 segundos |
| Papéis de acesso segregados corretamente | inexistente | Atendente/Caixa nunca acessam telas administrativas; Supervisor nunca acessa financeiro estratégico — validado por teste automatizado de RBAC |
| Relatório financeiro do dia | inexistente | gerado instantaneamente ao abrir o Início |

## 8. Requisitos de alto nível

**Funcionais:**
- Autenticação com 5 perfis (Admin, Supervisor, Caixa, Atendente, Cozinha) e redirecionamento/bloqueio por role
- Ciclo completo de comanda: abertura (mesa ou balcão) → itens → fechamento com split payment (+ bandeira opcional) → cupom → dedução de estoque
- CMV calculado e recalculado automaticamente a partir da ficha técnica
- Dashboard financeiro e Inteligência Financeira completos
- CRUD de usuários com restrição de papel por quem está criando (Supervisor não cria Admin/Supervisor)

**Não funcionais:**
- Interface das telas operacionais (mesas, balcão, KDS) atualiza via SWR (polling 2–5s) sem recarregar a página
- RBAC de página (middleware) e de API (guard server-side em rotas de escrita sensíveis) — não depender só de esconder botão na UI
- Sistema deve funcionar em tablet e computador via navegador, sem app instalado
- Snapshot de preço/custo no momento da venda — mudança de preço no cardápio não altera vendas já lançadas
