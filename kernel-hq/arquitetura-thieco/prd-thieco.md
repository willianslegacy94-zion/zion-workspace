---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-05-24
owner: willians
---

# PRD — Sistema de Caixa Barbearia Thieco Leandro

## 1. Contexto

A Barbearia Thieco Leandro opera em duas unidades (Tambore e Mutinga) com múltiplos profissionais. Antes do sistema, o controle financeiro era manual: cadernos, planilhas isoladas e ausência de visibilidade consolidada por unidade ou por barbeiro. O dono (Thieco Leandro) não tinha como saber, em tempo real, quanto cada unidade faturou, quais formas de pagamento foram usadas ou qual era a comissão devida a cada profissional.

## 2. Problema

**Dor específica:** Falta de controle operacional e financeiro em tempo real das duas unidades.

**Como se manifesta:**
- Comissões calculadas manualmente ao final do dia, com risco de erro
- Sem visibilidade de serviços mais vendidos ou horários de pico
- Sem registro de origem de clientes ou perfil de recorrência
- Gastos não consolidados com receitas — DRE impossível sem trabalho manual
- Sem rastreio de produtos físicos vendidos vs. serviços prestados

**Por que ainda não foi resolvida:** Os sistemas genéricos de PDV não atendem à lógica de barbearia (comissão por serviço, combos, distinção de unidades, taxas por bandeira de cartão). Sistemas especializados têm custo mensal alto e não são customizáveis para a operação específica.

## 3. Objetivo

Após o sistema existir:
- O caixa do dia é registrado e consolidado em tempo real por qualquer operador
- Comissões são calculadas automaticamente no momento do registro da venda
- O dono e a gestão têm acesso a relatórios financeiros por unidade, profissional e período
- Vendas de serviço e produto são rastreadas separadamente com comissionamento diferenciado
- O valor líquido recebido já desconta as taxas PagBank automaticamente

## 4. Usuário

**Quem:**
- **Admin (Thieco / Willians):** dono e gestor, acessa tudo
- **Operador/Barbeiro (Igor, Kauã):** registra as próprias vendas e vê o próprio painel

**Estado no uso:**
- Admin: analítico — quer visualizar, entender e decidir
- Barbeiro: operacional — quer registrar rápido durante ou após o atendimento

**Contexto:** acessado via browser no celular ou computador, dentro da própria barbearia, durante o dia de operação ou no fechamento do caixa.

## 5. Hipótese de solução

Um sistema web interno, acessível por login, que centraliza o registro de vendas com cálculo automático de comissão e valor líquido, e oferece painel de controle por unidade e profissional.

**Por que faz sentido:** o negócio já tem operação madura (8.580 vendas históricas registradas). A solução não precisa criar hábito — precisa substituir o processo manual existente por algo mais rápido e confiável.

**Risco central:** o sistema precisa refletir fielmente as regras de negócio (distinção de unidades, taxas por bandeira, comissionamento diferenciado por tipo de item). Qualquer discrepância entre o cálculo do sistema e o cálculo manual gera desconfiança.

## 6. Escopo

**Dentro:**
- Registro de vendas (serviço e produto) por unidade e profissional
- Cálculo automático de comissão (40% serviço, 10% produto) e valor líquido (taxas PagBank)
- Controle de gastos por unidade e categoria
- Painel do barbeiro (visão das próprias vendas e comissões)
- Relatórios financeiros: faturamento por período, por profissional, DRE simplificado
- Gestão de profissionais (CRUD, percentual de comissão, ativação/desativação)
- Catálogo de serviços e produtos com controle de estoque básico
- Combos pré-pagos por cliente
- Módulo de metas por unidade e por profissional
- Registro de clientes com histórico básico
- Gestão de time: feedbacks (PDCA) e sugestões

**Fora:**
- Agendamento de horários (escopo futuro)
- Integração direta com PagBank API (taxas são calculadas por regra, não por integração)
- App mobile nativo
- Multi-tenant (outros negócios fora da Barbearia Thieco Leandro)

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Tempo de registro de uma venda | ~3 min (manual) | < 60 segundos |
| Erro no cálculo de comissão ao final do dia | recorrente | zero |
| Visibilidade do faturamento do dia | fim do dia (manual) | em tempo real |
| Relatório mensal consolidado | horas de trabalho manual | gerado em < 5 segundos |
| Adoção pelos barbeiros | 0% (sem sistema) | 100% das vendas registradas no sistema |

## 8. Requisitos de alto nível

**Funcionais:**
- Autenticação com perfis diferenciados (admin e operador/barbeiro)
- Registro de venda com: unidade, profissional, serviço/produto, valor, desconto, forma de pagamento, tipo de cliente, origem
- Cálculo automático de comissão e valor líquido no momento do registro
- CRUD de profissionais, catálogo, gastos, combos, clientes, metas
- Relatórios financeiros agregados por período, unidade e profissional

**Não funcionais:**
- Disponível via browser sem instalação
- Resposta < 2 segundos para operações principais
- Autenticação JWT com expiração
- Banco de dados não pode ser zerado acidentalmente — operações destrutivas requerem confirmação explícita
- Dados históricos de 2024-2026 (8.580 vendas) preservados e consultáveis
