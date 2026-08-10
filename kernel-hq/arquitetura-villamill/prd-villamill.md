---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-05-24
owner: willians
---

# PRD — Villa Mill Tamboré PDV & Management

## 1. Contexto

A Villa Mill Tamboré é um restaurante/bar que opera com atendimento em mesas, cardápio amplo (130+ itens) e equipe com múltiplos perfis de acesso. Antes do sistema, o controle de pedidos, estoque e financeiro era feito de forma fragmentada — sem visibilidade em tempo real do que estava acontecendo no salão, sem rastreio automático de consumo de insumos e sem relatório consolidado de resultado do dia.

A operação tem dois pontos críticos: o caixa precisa registrar pedidos e pagamentos com agilidade durante o serviço, e a gestão precisa fechar o dia com números confiáveis.

## 2. Problema

**Dor específica:** Ausência de controle operacional em tempo real — do pedido ao fechamento de caixa.

**Como se manifesta:**
- Operador não sabe quais mesas estão abertas, ocupadas ou aguardando fechamento sem ir fisicamente ao salão
- Pagamentos divididos entre formas diferentes (ex.: parte em dinheiro, parte em PIX) não têm registro estruturado
- Consumo de insumos não é rastreado — estoque real diverge do físico
- Cancelamentos acontecem sem registro de motivo — impossível auditar
- Resultado financeiro do dia exige consolidação manual de pedidos + despesas

**Por que ainda não foi resolvida:** Sistemas de PDV genéricos são caros, não se adaptam à lógica específica do negócio (fichas técnicas, split payment, modo treinamento) e exigem hardware dedicado. A Villa Mill precisava de algo web, acessível de qualquer dispositivo na rede.

## 3. Objetivo

Após o sistema existir:
- O operador vê em tempo real (polling 3s) o estado de todas as 15 mesas sem sair do caixa
- Pagamentos são registrados no momento do fechamento — simples ou divididos entre formas
- Cada produto vendido deduz automaticamente os insumos da ficha técnica do estoque
- Cancelamentos ficam auditados com motivo e responsável
- A gestão fecha o dia com relatório de faturamento por forma de pagamento, ticket médio, despesas e cancelamentos

## 4. Usuário

**Quem:**
- **Admin (Willians):** gestor total — acessa todos os módulos, relatórios, configurações
- **Caixa (Emilly, Melissa):** operador do salão — registra pedidos e fechamentos, acessa mesas/cardápio/estoque
- **Treinamento:** perfil simulado — executa todas as ações sem persistência real no banco

**Estado no uso:**
- Caixa: operacional e sob pressão — quer registrar rápido, com o mínimo de toques, durante o movimento
- Admin: analítico — quer entender o resultado do dia, conferir estoque crítico, monitorar cancelamentos

**Contexto:** acessado via browser (tablet ou computador) na própria operação do restaurante, durante todo o horário de funcionamento.

## 5. Hipótese de solução

Um PDV web interno, com atualização em tempo real via polling, que gerencia o ciclo completo de uma mesa (abertura → pedido → pagamento → fechamento → dedução de estoque) e oferece visão financeira consolidada para gestão.

**Por que faz sentido:** o negócio já tem operação em andamento. A solução não precisa criar novos hábitos — precisa digitalizar o fluxo existente com menos atrito do que o processo manual.

**Risco central:** a lógica de fechamento de pedido (dedução de estoque via ficha técnica + liberação de mesa + split payment) é o ponto de maior complexidade. Qualquer falha aqui trava a operação em serviço.

## 6. Escopo

**Dentro:**
- Gestão de mesas com status em tempo real (Livre / Ocupada / Conta)
- Registro de pedidos com adição e remoção de itens
- Fechamento com pagamento simples ou dividido (split payment)
- Desconto por pedido
- Dedução automática de estoque via fichas técnicas
- Cancelamento com motivo e log de auditoria
- CRUD de cardápio (produtos, preços, custo, categoria)
- Gestão de fichas técnicas (ingredientes por produto)
- CRUD de insumos com alerta de estoque mínimo
- Registro de despesas por categoria
- Relatório financeiro diário com filtro de período
- Autenticação com perfis diferenciados (Admin, Caixa)
- Modo treinamento (simulação sem persistência)
- Dashboard com estatísticas do dia

**Fora:**
- Agendamento de reservas
- Integração com maquininha de cartão (formas de pagamento são registradas manualmente)
- Cardápio digital para o cliente escanear
- Integração com delivery (iFood, Rappi)
- Relatório mensal consolidado e exportação (pendente — não implementado ainda)
- Controle de usuários pelo painel Admin (pendente)
- Backup automatizado do banco (pendente)

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Tempo de fechamento de uma mesa | ~5 min (manual) | < 2 minutos |
| Divergência entre estoque físico e sistema | recorrente | < 5% por semana |
| Visibilidade das mesas em tempo real | inexistente | atualização a cada 3 segundos |
| Relatório do dia | consolidação manual | gerado em < 5 segundos |
| Cancelamentos com motivo registrado | 0% | 100% |

## 8. Requisitos de alto nível

**Funcionais:**
- Autenticação com perfis (Admin, Caixa, Treinamento) e redirecionamento por role
- Ciclo completo de mesa: abertura → pedido → fechamento → liberação
- Split payment (múltiplas formas de pagamento por pedido)
- Dedução automática de estoque via fichas técnicas no fechamento
- Relatório financeiro com pedidos, despesas, cancelamentos e breakdown por forma de pagamento
- CRUD completo de cardápio, insumos e despesas

**Não funcionais:**
- Interface atualiza em tempo real via polling (SWR a cada 3s) sem recarregar a página
- Resposta < 2 segundos para operações principais
- Sistema deve funcionar em tablet e computador via browser, sem app instalado
- Modo treinamento não persiste dados reais no banco
- Cancelamentos ficam permanentemente auditados — não podem ser apagados
