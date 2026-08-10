---
status: archived
domain: horizon
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# PRD — Agente Órbita Horizon

## 1. Contexto

A Zion Ops atende criadores de infoprodutos e plataformas EAD que concentram sua base de alunos em ferramentas como TheMembers, Hotmart Club ou Eduzz. Essas plataformas geram volume constante de suporte repetitivo: dúvidas de login, acesso a conteúdo, certificados, senha esquecida. Atendimento humano para esse volume é operacionalmente inviável. O Órbita Horizon é o motor de suporte IA da Zion Ops para esse nicho: um agente conversacional multi-tenant que valida a identidade do aluno por e-mail antes de responder, garantindo que o contexto da conversa seja sempre sobre um usuário legítimo.

## 2. Problema

**Dor específica:** Plataformas EAD perdem tempo de equipe com suporte de nível 1 repetitivo, e chatbots genéricos não têm como saber se a pessoa que pergunta é aluna ativa ou não.

**Como se manifesta:**
- Aluno ativo não consegue fazer login e espera resposta humana por horas
- Equipe de CS responde as mesmas perguntas de acesso dezenas de vezes por semana
- Chatbots genéricos respondem para qualquer pessoa, inclusive quem não é aluno
- Sem histórico de contexto, cada mensagem requer que o aluno explique o problema do zero
- Plataformas com múltiplos produtos (tenants diferentes) precisam de agentes isolados

**Por que ainda não foi resolvida:** Chatbots genéricos não integram com a base de alunos da plataforma. Construir isso do zero exige desenvolvimento customizado que o criador não tem capacidade de entregar. Integração direta com Claude/GPT sem camada de orquestração não resolve autenticação de aluno.

## 3. Objetivo

Após o agente existir:
- Um aluno que envia mensagem recebe resposta imediata validada — apenas se tiver matrícula ativa
- Dúvidas padrão (login, senha, certificado) são resolvidas sem intervenção humana
- O agente detecta automaticamente quando o aluno exige suporte humano e sinaliza ao canal
- Um novo tenant (nova plataforma EAD) é configurado em minutos com FAQ e base de alunos próprios
- O histórico de cada conversa é preservado para contexto contínuo sem o aluno repetir o problema

## 4. Usuário

**Quem:**
- **Willians (integrador/dono):** configura tenants, importa base de alunos via CSV, consome a API
- **Sistemas externos dos tenants:** enviam mensagens via webhook (bot WhatsApp, chat da plataforma)
- **Aluno (usuário final):** interage via canal do tenant — espera resposta rápida e resolutiva

**Estado no uso:**
- Integrador: configuração inicial — quer simplicidade, CSV como input, zero infraestrutura extra
- Canal externo: operacional — espera resposta rápida com estrutura de ação (`acao` + `resposta_ia`)
- Aluno: quer resolver o problema de acesso sem fila de espera

**Contexto:** API REST consumida por bots de WhatsApp, widgets de chat ou automações n8n/Make. Não há interface visual própria — o frontend é sempre o canal do tenant.

## 5. Hipótese de solução

Um motor FastAPI multi-tenant com banco SQLite local, que:
1. Armazena configuração de cada plataforma (FAQ + feature flags)
2. Mantém base de alunos importada de CSV por tenant
3. Valida e-mail do aluno antes de qualquer resposta quando `flag_validar_aluno = 1`
4. Chama Claude 3 Haiku via OpenRouter com contexto enriquecido (FAQ + nome/status do aluno)
5. Detecta tag `[ACIONAR_TRANSBORDO]` e retorna ação estruturada ao canal

**Por que faz sentido:** O valor está na camada de autenticação + orquestração de contexto. Claude 3 Haiku já resolve o raciocínio de suporte de nível 1; Horizon resolve a validação de identidade, o isolamento de tenant, a persistência de histórico e o sinal de transbordo.

**Risco central:** A qualidade das respostas depende diretamente do `faq_contexto` configurado pelo tenant. FAQ incompleto = respostas incompletas. Responsabilidade do integrador manter o FAQ atualizado com links, regras e fluxos reais da plataforma.

## 6. Escopo

**Dentro:**
- Multi-tenant via `tenant_id` com feature flags independentes por tenant
- Autenticação de aluno por e-mail (`flag_validar_aluno`) — rejeição imediata se não encontrado
- Chat receptivo com histórico de contexto (últimas 6 mensagens = 3 turnos)
- Detecção de transbordo via tag `[ACIONAR_TRANSBORDO]` com retorno de ação estruturada
- Importação de base de alunos via CSV (`pandas` + `INSERT` no SQLite)
- Tenant de demonstração pré-cadastrado (`tenant_teste_01` — Zion Academy)
- Banco SQLite local — zero dependência de cloud para o banco

**Fora:**
- Disparos proativos / camada ativa (mensagens outbound — escopo do Pulsar)
- Qualificação de leads em background (escopo do Pulsar)
- Envio real de mensagens (Horizon gera o payload; o canal externo envia)
- Interface visual de configuração de tenants
- Autenticação Bearer Token da API (planejado em F2 do backlog)
- Integração direta com CRM para transbordo (planejado em F4 do backlog)
- Agendamento de disparos

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Tempo de resposta ao aluno | horas (humano) | < 3 segundos (IA) |
| Configuração de novo tenant + base | horas de desenvolvimento | < 10 minutos via POST + CSV |
| Respostas dentro do FAQ | inconsistente (humano) | > 90% para dúvidas de nível 1 |
| Falsos positivos (não-alunos respondidos) | possível com chatbot genérico | 0% — validação obrigatória por e-mail |
| Detecção de transbordo | manual | 100% automatizado quando `[ACIONAR_TRANSBORDO]` emitido |

## 8. Requisitos de alto nível

**Funcionais:**
- CRUD de tenants com `faq_contexto` e 2 feature flags
- Importação de base de alunos via CSV com mapeamento de colunas
- Endpoint de chat receptivo com validação de aluno + histórico + detecção de transbordo
- Resposta estruturada com campo `acao` indicando próximo passo ao canal (`MANTER_NA_IA` ou `GATILHO_HUMANO_DETECTADO`)

**Não funcionais:**
- Resposta da IA em < 12 segundos (timeout configurado no OpenRouter)
- SQLite como banco local — sem dependência de servidor externo
- `temperature: 0.3` no modelo para equilibrar precisão e naturalidade no suporte
- Graceful error: falha no OpenRouter retorna string amigável em PT-BR sem expor stack trace
- Histórico limitado a 6 mensagens para controle de tokens enviados ao modelo
