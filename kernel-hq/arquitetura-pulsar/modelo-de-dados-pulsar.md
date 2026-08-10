---
status: archived
domain: pulsar
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Modelo de Dados — Agente Órbita Pulsar

> Referência: [[prd-pulsar]] | [[arquitetura-pulsar]]

---

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| tenants_config | A empresa (PME) que contratou o agente | Define o contexto, as regras de negócio (FAQ) e as flags de automação que moldam o comportamento da IA para cada cliente |
| leads_dados | O cliente final que conversa com o agente | Persiste identidade, etapa da jornada e perfil de qualificação extraídos em background pela IA |
| historico_conversas | As mensagens trocadas em uma sessão | Fornece contexto contínuo à IA — sem histórico, cada mensagem é tratada como primeira interação |

---

## Atributos por entidade

### tenants_config

| Atributo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| tenant_id | TEXT | sim (PK) | Identificador único da empresa — slug legível (ex: `tenant_pme_pulsar`) |
| nome_empresa | TEXT | sim | Nome da empresa usado no system prompt para personalização |
| faq_contexto | TEXT | não | Texto livre com regras de negócio, preços, links e instruções — é injetado diretamente no system prompt do Claude |
| flag_enviar_documentos | BOOLEAN | sim (default 0) | Ativa instrução ao Claude para emitir `[ENVIAR_ARQUIVO_XYZ]` quando lead solicita documento previsto no FAQ |
| flag_qualificar_lead | BOOLEAN | sim (default 0) | Ativa instrução ao Claude para mapear faturamento e inserir `[PERFIL_UPSELL]` em background |
| flag_permitir_transbordo | BOOLEAN | sim (default 1) | Ativa instrução ao Claude para finalizar com `[ACIONAR_TRANSBORDO]` quando lead exige humano |

### leads_dados

| Atributo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | INTEGER | sim (PK, auto) | Identificador único auto-incrementado |
| tenant_id | TEXT | sim (FK) | Vínculo com `tenants_config` — garante isolamento entre tenants |
| session_id | TEXT | sim (UNIQUE) | Identificador da sessão/conversa — gerado pelo canal externo (ex: número de telefone, ID de chat) |
| nome | TEXT | não | Nome do lead quando informado pelo canal |
| email | TEXT | não | Email do lead quando informado |
| etapa_atual | TEXT | não | Módulo/serviço onde o lead demonstra estar travado — extraído pelo Claude via `##META##` |
| perfil_qualificacao | TEXT | não | Perfil classificatório do lead (ex: "Potencial Upsell", "Premium") — extraído pelo Claude |
| dados_adicionais | TEXT | não | JSON string com dados dinâmicos extraídos em background |

### historico_conversas

| Atributo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | INTEGER | sim (PK, auto) | Identificador único auto-incrementado |
| session_id | TEXT | sim | Vínculo com a sessão — não é FK para permitir histórico de disparos ativos (sem registro em leads_dados) |
| tenant_id | TEXT | sim | Vínculo com o tenant — permite filtrar histórico por empresa |
| role | TEXT | sim | `user` (mensagem do lead) ou `assistant` (resposta da IA ou disparo ativo) |
| content | TEXT | sim | Conteúdo completo da mensagem |
| timestamp | DATETIME | sim (auto) | Gerado automaticamente — base para ordenação e limite de contexto |

---

## Relacionamentos

| De | Para | Tipo | Regra |
|---|---|---|---|
| leads_dados | tenants_config | N:1 | FK `tenant_id` — lead pertence a um tenant |
| historico_conversas | leads_dados | N:1 (lógico) | Sem FK declarada — `session_id` é a chave de junção. Dispensado para suportar histórico de disparos ativos sem `session_id` em `leads_dados` |

---

## Feature Flags — Comportamento por tenant

| Flag | Valor | Efeito no system prompt |
|---|---|---|
| `flag_enviar_documentos` | 0 | Sem instrução de envio de arquivo |
| `flag_enviar_documentos` | 1 | Claude instrui a emitir `[ENVIAR_ARQUIVO_XYZ]` quando lead pede documento previsto no FAQ |
| `flag_qualificar_lead` | 0 | Sem instrução de qualificação |
| `flag_qualificar_lead` | 1 | Claude mapeia dores e faturamento; emite `[PERFIL_UPSELL]` para leads de alto ticket |
| `flag_permitir_transbordo` | 0 | Sem instrução de transbordo |
| `flag_permitir_transbordo` | 1 | Claude encerra com `[ACIONAR_TRANSBORDO]` quando lead exige humano |

---

## Tags de automação (output do Claude)

Tags inseridas pelo Claude na resposta, parseadas pelo sistema e removidas antes de retornar ao canal:

| Tag | Significado | Quem consome |
|---|---|---|
| `[ENVIAR_ARQUIVO_XYZ]` | Modelo de documento solicitado pelo lead | Canal externo — dispara envio de arquivo |
| `[PERFIL_UPSELL]` | Lead tem perfil de alto ticket | Sistema interno — pode acionar fluxo de vendas |
| `[ACIONAR_TRANSBORDO]` | Lead exige atendimento humano | Canal externo — transfere para operador |
| `##META##{"etapa": "X", "perfil": "Y"}` | Metadados de qualificação | Pulsar — atualiza `leads_dados` silenciosamente, não exposto ao lead |

---

## Propriedade e acesso

| Entidade | Quem cria | Quem lê | Quem atualiza |
|---|---|---|---|
| tenants_config | integrador (via `POST /tenants`) | Pulsar internamente | integrador (INSERT OR REPLACE) |
| leads_dados | Pulsar automaticamente no primeiro chat | Pulsar internamente | Pulsar via parse de ##META## |
| historico_conversas | Pulsar automaticamente | Pulsar (últimas 8 para contexto) | nunca — append only |

---

## Ciclo de retenção

| Entidade | Retenção | Nunca excluir |
|---|---|---|
| tenants_config | permanente enquanto tenant ativo | configuração base do agente |
| leads_dados | permanente | histórico de qualificação compõe inteligência acumulada |
| historico_conversas | permanente | contexto de conversas anteriores pode ser necessário para auditoria |
