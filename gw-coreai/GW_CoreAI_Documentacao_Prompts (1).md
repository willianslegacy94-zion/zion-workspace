# GW CoreAI — Documentação e Prompts de Desenvolvimento

## Objetivo

O GW CoreAI será um SaaS de gestão inteligente para negócios que trabalham com clientes, atendimento e/ou agendamento.

O produto não será limitado a um nicho. Poderá atender clínicas, consultórios, escritórios de advocacia, barbearias, salões, estética, profissionais autônomos e prestadores de serviços.

O mesmo sistema deverá atender várias empresas simultaneamente, mantendo os dados de cada empresa isolados.

### Módulos principais

- CRM
- Agenda
- Atendimento
- Automações
- Comunicação
- Financeiro
- Relatórios
- IA

### Posicionamento

> GW CoreAI — Gestão inteligente para negócios que atendem clientes.

---

# Prompt 1 — Arquitetura

```text
Você é um arquiteto de software sênior especializado em SaaS multi-tenant, CRM, automação, sistemas de agendamento e agentes de IA.

Quero construir um SaaS chamado GW CoreAI.

Contexto:
- O produto será desenvolvido por Gabriel e Willians.
- O objetivo é criar uma plataforma genérica de gestão para empresas que trabalham com clientes, atendimento e/ou agendamento.
- O sistema não pode ficar preso a um único nicho.
- Poderá ser utilizado por clínicas, consultórios, escritórios de advocacia, barbearias, salões, estética, profissionais autônomos, prestadores de serviços e outros negócios.
- O mesmo sistema deverá atender vários clientes/empresas simultaneamente.
- Cada empresa deve ter seus próprios usuários, clientes, profissionais, serviços, agenda, configurações, automações e dados.
- O produto terá CRM, agenda, automações, comunicação, financeiro, relatórios e recursos de IA.

Analise essa ideia como um arquiteto de software e projete a arquitetura técnica do GW CoreAI.

IMPORTANTE:
Não comece criando telas ou código.

Primeiro entregue uma especificação técnica contendo:
1. Visão geral da arquitetura
2. Arquitetura multi-tenant
3. Módulos do sistema
4. Entidades principais
5. Modelo de banco de dados
6. Relacionamentos entre entidades
7. Sistema de autenticação e autorização
8. Sistema de papéis/permissões
9. API
10. Sistema de eventos
11. Motor de automações
12. Integração com WhatsApp
13. Arquitetura do agente de IA
14. Sistema de notificações
15. Sistema de auditoria
16. Logs e observabilidade
17. Segurança
18. Privacidade e LGPD
19. Estratégia de escalabilidade
20. Estratégia de backup e recuperação
21. Estrutura de pastas do projeto
22. Tecnologias recomendadas e justificativa

Também identifique os principais riscos técnicos da arquitetura.

Não invente funcionalidades desnecessárias. Diferencie claramente o que pertence ao MVP e o que deve ficar para versões futuras.

O objetivo é construir uma arquitetura realmente utilizável em produção, e não apenas uma demonstração visual.
```

---

# Prompt 2 — Banco de dados

```text
Agora transforme a arquitetura definida anteriormente em uma especificação completa do banco de dados do GW CoreAI.

O banco precisa suportar múltiplas empresas utilizando o mesmo sistema.

Crie a modelagem para, no mínimo:
- tenants/empresas
- usuários
- papéis
- permissões
- clientes
- profissionais
- serviços
- unidades
- horários de funcionamento
- disponibilidade
- agendamentos
- status de agendamento
- conversas
- mensagens
- automações
- regras de automação
- notificações
- pagamentos
- transações financeiras
- planos
- assinaturas
- logs
- auditoria

Para cada tabela informe:
- nome
- finalidade
- campos
- tipo dos campos
- chave primária
- chaves estrangeiras
- índices
- constraints
- relacionamento com outras tabelas

Garanta isolamento entre tenants.

Explique como impedir que um usuário de uma empresa consiga acessar dados de outra empresa.

Depois gere o schema SQL completo para implementação.

Não gere dados fictícios desnecessários.

Priorize integridade, segurança, escalabilidade e facilidade de manutenção.
```

---

# Prompt 3 — Backend e API

```text
Agora construa a especificação técnica do backend do GW CoreAI com base na arquitetura e no banco definidos anteriormente.

Quero uma API preparada para produção.

Defina:
1. Estrutura do backend
2. Controllers
3. Services
4. Repositories
5. Middlewares
6. Autenticação
7. Autorização
8. Multi-tenancy
9. Validação de dados
10. Tratamento de erros
11. Logs
12. Auditoria
13. Rate limiting
14. Idempotência
15. Webhooks
16. Jobs assíncronos
17. Filas
18. Sistema de eventos

Crie os principais endpoints REST:
- /auth
- /tenants
- /users
- /customers
- /professionals
- /services
- /appointments
- /conversations
- /messages
- /automations
- /finance
- /reports
- /settings

Para cada endpoint informe:
- método HTTP
- rota
- autenticação necessária
- permissão necessária
- parâmetros
- body
- resposta
- códigos HTTP possíveis

Inclua exemplos de request e response.

Não implemente ainda a interface visual.

Quero primeiro uma API bem estruturada e segura.
```

---

# Prompt 4 — Motor de automação

```text
Agora projete o Automation Engine do GW CoreAI.

Não quero um sistema baseado apenas em palavras-chave.

O motor deve trabalhar com eventos, condições, ações e estados de conversa.

Crie uma arquitetura capaz de executar fluxos como:

EVENTO:
appointment.created

CONDIÇÃO:
appointment.start_at - now <= 24 horas

AÇÃO:
enviar lembrete ao cliente

Outro exemplo:

EVENTO:
conversation.started

CONDIÇÃO:
intenção = agendamento

AÇÃO:
consultar disponibilidade

Outro:

EVENTO:
appointment.completed

AÇÃO:
enviar mensagem de pós-atendimento

O motor deve suportar:
- gatilhos
- condições
- ações
- atrasos
- agendamento de ações futuras
- múltiplas etapas
- variáveis
- templates
- estados
- retries
- idempotência
- logs de execução
- falhas
- cancelamento
- ativação/desativação
- regras específicas por tenant

Crie também um modelo de dados para automações.

Depois explique como o sistema executaria uma automação do início ao fim.

Priorize arquitetura desacoplada e escalável.
```

---

# Prompt 5 — IA

```text
Agora projete o módulo de IA do GW CoreAI.

O objetivo é criar um agente capaz de atender clientes e executar ações reais dentro do sistema.

O agente deve conseguir:
- entender a intenção do cliente
- identificar informações importantes da mensagem
- consultar clientes
- consultar serviços
- consultar profissionais
- consultar disponibilidade
- criar agendamentos
- remarcar
- cancelar
- consultar informações da empresa
- encaminhar para um humano
- registrar informações no CRM

Exemplo:

Cliente:
"Oi, queria marcar uma avaliação sexta depois das 18h com a Ana."

O agente deve identificar:
intent = appointment_booking
service = avaliação
professional = Ana
date = sexta-feira
time_constraint = depois das 18h

Depois deve consultar a agenda e oferecer horários disponíveis.

IMPORTANTE:

A IA não deve ter acesso direto e irrestrito ao banco de dados.

Projete um sistema baseado em ferramentas/functions, com permissões explícitas.

Defina as ferramentas que o agente poderá utilizar:
get_customer
get_services
get_professionals
get_availability
create_appointment
reschedule_appointment
cancel_appointment
create_customer
handoff_to_human

Defina também:
- memória da conversa
- contexto
- limites do agente
- validação das ações
- confirmação antes de ações críticas
- logs
- tratamento de erros
- fallback
- handoff humano
- proteção contra prompt injection
- isolamento por tenant

Quero uma arquitetura de agente de IA realmente adequada para produção.
```

---

# Prompt 6 — Dashboard do SaaS

```text
Agora construa a interface web do GW CoreAI com base em toda a arquitetura definida anteriormente.

Não crie apenas uma landing page.

Quero o painel real do SaaS.

Estilo:
- premium
- moderno
- minimalista
- profissional
- SaaS B2B
- responsivo
- desktop e mobile
- interface clara
- sensação de produto consolidado

SIDEBAR:
Dashboard
Agenda
Clientes
Conversas
Automações
Serviços
Profissionais
Financeiro
Relatórios
Configurações

DASHBOARD:
- agendamentos de hoje
- faturamento
- novos clientes
- cancelamentos
- taxa de comparecimento
- conversas
- conversões
- próximos agendamentos
- atividades recentes

AGENDA:
- dia
- semana
- mês
- criação de agendamento
- edição
- cancelamento
- reagendamento
- filtros por profissional
- filtros por serviço
- disponibilidade

CRM:
- lista de clientes
- busca
- filtros
- histórico
- informações de contato
- histórico de agendamentos
- conversas
- observações
- tags

CONVERSAS:
- interface semelhante a inbox
- lista de conversas
- mensagens
- status
- atendimento por IA
- atendimento humano
- botão para assumir conversa

AUTOMAÇÕES:
- lista de automações
- ativar/desativar
- criar automação
- gatilho
- condição
- ação
- histórico de execução

FINANCEIRO:
- receitas
- despesas
- saldo
- transações
- filtros
- relatórios

CONFIGURAÇÕES:
- empresa
- usuários
- permissões
- serviços
- profissionais
- horários
- integrações
- WhatsApp
- IA
- notificações

Use componentes reutilizáveis.

Não coloque dados sensíveis reais.

Crie dados fictícios apenas para demonstrar a interface.

O design deve parecer um SaaS comercial real, não um template genérico.
```

---

# Prompt 7 — Landing Page

```text
Agora crie a landing page comercial do GW CoreAI.

IMPORTANTE:
O GW CoreAI NÃO deve ser apresentado como um sistema exclusivo para consultórios.

Posicionamento:
"Gestão inteligente para negócios que atendem clientes."

O produto pode ser utilizado por:
- clínicas
- consultórios
- escritórios de advocacia
- barbearias
- salões
- estética
- profissionais autônomos
- prestadores de serviços
- outros negócios baseados em atendimento e agendamento

HERO:
"Seu negócio mais organizado. Seu atendimento mais inteligente."

Subtítulo:
"Centralize clientes, agenda, atendimento, automações e gestão em uma única plataforma."

CTA:
"Começar agora"

Segundo CTA:
"Ver demonstração"

SEÇÕES:
1. Problemas que o GW CoreAI resolve
2. Plataforma completa
3. Agenda inteligente
4. CRM
5. Atendimento e conversas
6. Automação
7. IA
8. Financeiro
9. Relatórios
10. Integrações
11. Nichos atendidos
12. Preços
13. FAQ
14. CTA final

Não use depoimentos falsos.

Não invente números como "aumente 300% seu faturamento".

Se não houver clientes reais, não crie prova social falsa.

O site deve transmitir confiança sem fazer afirmações que não possam ser comprovadas.
```

---

# Prompt 8 — Auditoria de CTO

```text
Agora atue como CTO e faça uma auditoria técnica completa do GW CoreAI que você acabou de projetar.

Não quero elogios.

Procure problemas reais em:
- arquitetura
- segurança
- multi-tenancy
- banco de dados
- autenticação
- autorização
- API
- escalabilidade
- performance
- concorrência
- idempotência
- webhooks
- filas
- automações
- IA
- prompt injection
- LGPD
- custos de infraestrutura
- observabilidade
- backup
- recuperação de falhas
- manutenção
- UX
- acessibilidade

Classifique cada problema como:
CRÍTICO
ALTO
MÉDIO
BAIXO

Para cada problema informe:
1. Qual é o problema
2. Por que é um problema
3. Como pode acontecer na prática
4. Como corrigir
5. Se precisa ser corrigido no MVP ou pode esperar

Depois apresente uma arquitetura revisada.

Não gere código até finalizar essa auditoria.
```

---

# Ordem de execução

Use os prompts separadamente nesta ordem:

1. Arquitetura
2. Banco de dados
3. Backend/API
4. Automation Engine
5. IA
6. Dashboard
7. Landing Page
8. Auditoria CTO

## Regra

Não deixe o Claude começar pelo visual.

Primeiro arquitetura, banco, backend, automações e IA. Depois interface.

O manual de Recepção Digital existente pode ser usado como referência para um fluxo específico de atendimento, mas não deve ser tratado como a arquitetura definitiva do GW CoreAI.
