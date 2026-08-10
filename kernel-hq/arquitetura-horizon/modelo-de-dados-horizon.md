---
status: stable
domain: horizon
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Modelo de Dados — Agente Órbita Horizon

> Referência: [[prd-horizon]] | [[arquitetura-horizon]]

---

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| tenants_config | A plataforma EAD (cliente) que contratou o agente | Define o contexto institucional (FAQ), os links de acesso e as flags de comportamento que moldam o agente para cada plataforma |
| alunos_base | O aluno cadastrado na plataforma | Permite que o agente valide identidade antes de responder — apenas alunos com e-mail na base recebem atendimento quando `flag_validar_aluno = 1` |
| historico_conversas | As mensagens trocadas em uma sessão | Fornece contexto contínuo à IA — sem histórico, o aluno precisa repetir o problema a cada mensagem |

---

## Atributos por entidade

### tenants_config

| Atributo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| tenant_id | TEXT | sim (PK) | Identificador único da plataforma — slug legível (ex: `tenant_teste_01`) |
| nome_empresa | TEXT | não | Nome da empresa usado no system prompt para personalização da IA |
| faq_contexto | TEXT | não | Texto livre com links de acesso, regras da plataforma, fluxos de suporte — injetado diretamente no system prompt do Claude |
| flag_validar_aluno | BOOLEAN | sim (default 0) | Ativa validação de e-mail na `alunos_base` antes de responder. 1 = exige aluno cadastrado; 0 = "Horizon Puro" sem validação |
| flag_permitir_transbordo | BOOLEAN | sim (default 1) | Ativa instrução ao Claude para emitir `[ACIONAR_TRANSBORDO]` quando aluno exige atendimento humano |

### alunos_base

| Atributo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | INTEGER | sim (PK, auto) | Identificador único auto-incrementado |
| tenant_id | TEXT | sim (FK) | Vínculo com `tenants_config` — garante isolamento entre plataformas |
| nome | TEXT | não | Nome do aluno — usado pelo Claude para personalizar a resposta ("Olá, [nome]!") |
| email | TEXT | não | E-mail de cadastro do aluno — chave de autenticação. Comparação case-insensitive com strip |
| status_assinatura | TEXT | sim (default 'ATIVA') | Status da matrícula do aluno. Informado ao Claude no contexto — não bloqueia autenticação por si só |

### historico_conversas

| Atributo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | INTEGER | sim (PK, auto) | Identificador único auto-incrementado |
| session_id | TEXT | sim | Identificador único da sessão — pode ser número de WhatsApp, ID de chat ou qualquer string estável |
| tenant_id | TEXT | sim | Vínculo com o tenant — permite filtrar histórico por plataforma |
| role | TEXT | sim | `user` (mensagem do aluno) ou `assistant` (resposta da IA) |
| content | TEXT | sim | Conteúdo completo da mensagem |
| timestamp | DATETIME | sim (auto) | Gerado automaticamente — base para ordenação e limite de contexto |

---

## Relacionamentos

| De | Para | Tipo | Regra |
|---|---|---|---|
| alunos_base | tenants_config | N:1 | FK `tenant_id` — aluno pertence a uma plataforma |
| historico_conversas | tenants_config | N:1 (lógico) | `tenant_id` presente mas sem FK declarada — permite histórico de sessões sem aluno autenticado (Horizon Puro) |

---

## Feature Flags — Comportamento por tenant

| Flag | Valor | Efeito |
|---|---|---|
| `flag_validar_aluno` | 0 | Horizon Puro — responde qualquer mensagem sem validação. `nome_usuario` fixo como "Interlocutor" |
| `flag_validar_aluno` | 1 | Valida e-mail em `alunos_base`. Se não encontrado: rejeição imediata sem chamar a IA. Se encontrado: enriquece `faq_contexto` com nome e status do aluno |
| `flag_permitir_transbordo` | 0 | Sem instrução de transbordo no system prompt. Claude nunca emite `[ACIONAR_TRANSBORDO]` |
| `flag_permitir_transbordo` | 1 | System prompt instrui o Claude a emitir `[ACIONAR_TRANSBORDO]` quando aluno manifesta irritação profunda ou demanda humano explicitamente |

---

## Tag de ação (output do Claude)

Tag inserida pelo Claude na resposta, detectada pelo sistema e removida antes de retornar ao canal:

| Tag | Significado | Quem consome | O que acontece |
|---|---|---|---|
| `[ACIONAR_TRANSBORDO]` | Aluno exige atendimento humano | Canal externo | `acao: GATILHO_HUMANO_DETECTADO` + aviso ao aluno + stub de CRM logado no console |

> Diferença do Pulsar: Horizon tem apenas 1 tag de ação (transbordo) e não usa bloco `##META##`. O Horizon não faz qualificação de leads nem extração de metadados em background.

---

## Mapeamento CSV → alunos_base

Colunas do CSV da TheMembers mapeadas na importação:

| Coluna CSV | Campo banco | Regra |
|---|---|---|
| `E-mail Admin` | `email` | Obrigatório — linha pulada se NaN |
| `Contrato - Contato` | `nome` | Preferencial — fallback para `Nome da plataforma` se vazio/NaN |
| `Nome da plataforma` | `nome` (fallback) | Usado quando `Contrato - Contato` está ausente |
| — | `tenant_id` | Fixo como `tenant_teste_01` na importação de demonstração |
| — | `status_assinatura` | DEFAULT `'ATIVA'` — não mapeado do CSV |

---

## Propriedade e acesso

| Entidade | Quem cria | Quem lê | Quem atualiza |
|---|---|---|---|
| tenants_config | integrador (via `INSERT OR REPLACE`) | Horizon internamente | integrador |
| alunos_base | integrador (via import CSV) | Horizon internamente na autenticação | integrador (nova importação) |
| historico_conversas | Horizon automaticamente | Horizon (últimas 6 para contexto) | nunca — append only |

---

## Ciclo de retenção

| Entidade | Retenção | Observação |
|---|---|---|
| tenants_config | permanente enquanto tenant ativo | base de configuração do agente |
| alunos_base | permanente até reimportação | reimportação de CSV recria registros via INSERT — sem deduplicação automática |
| historico_conversas | sem política definida (backlog F3) | `DELETE /historico/{session_id}` planejado para limpeza de sessões antigas |
