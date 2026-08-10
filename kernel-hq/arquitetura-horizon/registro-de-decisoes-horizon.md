---
status: stable
domain: horizon
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Registro de Decisões — Agente Órbita Horizon

> Referência: [[prd-horizon]] | [[requisitos-funcionais-horizon]] | [[arquitetura-horizon]]

Memória viva do agente. Registra o que mudou, por que mudou e o que isso significa.
Entradas em ordem cronológica crescente — as mais recentes no final.

---

## 2026-06-24 — Criação inicial do agente Órbita Horizon

**Motivo:** Necessidade de um motor de suporte IA para plataformas EAD (infoprodutos, cursos online) com validação de aluno por e-mail. Caso de uso inicial: Zion Academy na TheMembers.
**Stack escolhida:** Python + FastAPI + SQLite + OpenRouter (Claude 3 Haiku) + requests + pandas.
**Schema inicial:** 3 tabelas — `tenants_config`, `alunos_base`, `historico_conversas`.
**Status:** aplicado
**Artefatos criados:** `main.py`, `database.py`, `services/openrouter.py`, `requirements.txt`, banco inicializado com CSV importado.

---

## 2026-06-24 — Escolha de Claude 3 Haiku em vez de Claude 3.5 Sonnet

**Motivo:** O caso de uso do Horizon é suporte de nível 1 para plataforma EAD — respostas curtas, FAQ estruturado, links de acesso. O Haiku é mais rápido (< 1s) e mais barato que o Sonnet. A diferença de raciocínio do Sonnet não agrega valor para esse caso de uso.
**Impacto:** `model: "anthropic/claude-3-haiku"` em `services/openrouter.py`. `temperature: 0.3` (vs `0.2` no Pulsar) para respostas de suporte mais naturais.
**Status:** aplicado
**Contraste:** O Pulsar usa Sonnet porque faz raciocínio consultivo (qualificação de leads, contexto de vendas). O Horizon usa Haiku porque faz FAQ operacional.
**Artefatos:** `services/openrouter.py`

---

## 2026-06-24 — Autenticação de aluno como gate antes da IA

**Motivo:** O diferencial do Horizon vs. chatbots genéricos é saber com quem está falando. Validar o e-mail antes de qualquer chamada ao OpenRouter garante que apenas alunos ativos recebem resposta — e elimina custo de IA para rejeições.
**Impacto:** `autenticar_aluno_base()` é chamada antes de `gerenciar_memoria_local()` e `requisitar_claude_horizon()`. Rejeição retorna resposta padrão sem chamar o OpenRouter.
**Status:** aplicado
**Artefatos:** `main.py`

---

## 2026-06-24 — Histórico limitado a 6 mensagens (vs 8 no Pulsar)

**Motivo:** Dúvidas de suporte EAD são resolvidas em 1-3 turnos. 6 mensagens (3 turnos) cobre o fluxo completo de diagnóstico e resolução sem inflar o context window do Haiku (que tem janela menor que o Sonnet).
**Impacto:** `LIMIT 6` em `gerenciar_memoria_local(recuperar=True)`.
**Status:** aplicado
**Artefatos:** `main.py`

---

## 2026-06-24 — Importação de CSV via pandas (TheMembers)

**Motivo:** A base de alunos da Zion Academy vive na TheMembers e é exportada como CSV. Usar pandas para leitura padroniza o tratamento de NaN e mapeamento de colunas sem código de parsing manual.
**Impacto:** `pandas` adicionado ao `requirements.txt`. `popular_ambiente_teste()` lê as colunas específicas do export da TheMembers (`E-mail Admin`, `Contrato - Contato`, `Nome da plataforma`).
**Limitação:** Import de amostra limitado a `df.head(15)` para ambiente de teste — ajustar para `df` completo em produção.
**Status:** aplicado
**Artefatos:** `database.py`, `requirements.txt`

---

## 2026-06-24 — Sem camada ativa (disparos) na v1.0

**Motivo:** O Horizon foi concebido como agente de suporte receptivo — aluno envia mensagem, agente responde. Disparos proativos (cobrança, boas-vindas) são escopo do Pulsar. Manter o Horizon focado evita acoplamento de responsabilidades entre os dois agentes.
**Impacto:** Sem endpoint `POST /api/v1/disparos/webhook`. Sem templates de disparo. Sem chamada ao OpenRouter fora do fluxo receptivo.
**Status:** decisão de escopo — pode ser revisada se surgir necessidade de disparo EAD (ex: lembrete de aula, alerta de vencimento de assinatura)
**Artefatos:** N/A — decisão de não implementar

---

## 2026-06-24 — Sem qualificação de leads / bloco ##META##

**Motivo:** O usuário do Horizon é um aluno autenticado, não um lead a qualificar. O objetivo é resolver a dúvida de acesso, não mapear perfil de compra. Remover o `##META##` simplifica o system prompt, elimina o parse de metadados e reduz tokens enviados ao Haiku.
**Impacto:** System prompt sem instrução de `##META##`. Sem tabela `leads_dados`. Sem `parse()` de metadados. Response sem campo `qualificacao`.
**Status:** decisão de escopo — deliberado
**Contraste:** O Pulsar qualifica leads em background porque opera com prospects em contexto de vendas.
**Artefatos:** N/A — decisão de não implementar

---

## 2026-06-24 — Autenticação Bearer Token ausente na v1.0

**Motivo:** Ambiente inicial de desenvolvimento local (`127.0.0.1:5000`). Adicionar auth antes de validar o fluxo completo seria fricção desnecessária. O endpoint não está exposto à internet neste estágio.
**Impacto:** Qualquer requisição com `tenant_id` válido é aceita. Risco aceito para desenvolvimento local.
**Próximo passo obrigatório:** Implementar Bearer Token antes de expor o endpoint a qualquer canal externo real (backlog F2).
**Status:** pendente — crítico antes de ir a produção
**Artefatos:** backlog F2 em `BACKLOG.md`

---

## 2026-06-24 — Pipeline validado com CSV real (Zion Academy / TheMembers)

**Motivo:** Validação do fluxo completo com dados reais antes de inserir chave OpenRouter válida.
**Resultado:**
- ✅ Servidor subiu em `127.0.0.1:5000`
- ✅ Banco inicializado com 15 alunos do CSV
- ✅ E-mail `emagrecentroanapolis@gmail.com` autenticado (Andréa Rodrigues)
- ✅ Histórico gravado no SQLite com `session_id: 11948455946`
- ✅ Prompt montado e chamada disparada ao OpenRouter
- ✅ Graceful fallback funcionando — erro tratado sem crash
- ⏳ Resposta real bloqueada pela chave placeholder — pendente B1 do backlog
**Status:** pipeline validado — aguardando chave OpenRouter real para teste de resposta completo
**Artefatos:** `BACKLOG.md` — e-mails de teste mapeados e checklist completo
