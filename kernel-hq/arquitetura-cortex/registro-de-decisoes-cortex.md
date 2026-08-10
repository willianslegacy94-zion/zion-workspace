---
status: stable
domain: cortex
source: claude
created: 2026-06-25
updated: 2026-08-05
owner: willians
---

# Registro de Decisões — Órbita Cortex

Histórico cronológico de decisões técnicas e de negócio que moldaram o Cortex.
Atualizar sempre que uma decisão com impacto sistêmico for tomada.

---

## RD-001 — Criação do Cortex como camada separada
**Data:** 2026-06-25
**Contexto:** Horizon, Pulsar e Quasar operavam em silos sem inteligência compartilhada sobre o cliente.
**Decisão:** Criar o Órbita Cortex como serviço analítico central com autoridade exclusiva sobre classificação de clientes.
**Alternativas descartadas:** Adicionar lógica analítica dentro de cada agente — rejeitado por duplicação e risco de inconsistência.
**Impacto:** Todos os agentes passam a consultar uma única fonte de verdade antes de agir.

---

## RD-002 — SQLite como banco compartilhado
**Data:** 2026-06-25
**Contexto:** Agentes precisam acessar os flags do Cortex sem overhead de rede.
**Decisão:** Usar SQLite local (`orbita_cortex.db`) acessado por leitura direta de arquivo.
**Alternativas descartadas:** PostgreSQL (dependência de servidor), API de consulta (latência adicional).
**Impacto:** Zero dependência de infraestrutura externa na v1.0. Migração para PostgreSQL entra no backlog quando a Holding operar em servidores separados.

---

## RD-003 — Claude 3.5 Sonnet com temperature 0.0
**Data:** 2026-06-25
**Contexto:** Classificações analíticas exigem determinismo — o mesmo perfil deve sempre gerar o mesmo flag.
**Decisão:** `temperature: 0.0` com Claude 3.5 Sonnet via OpenRouter.
**Alternativas descartadas:** Claude 3 Haiku — menor custo, mas raciocínio insuficiente para regras compostas de classificação; temperature > 0 — variação não-determinística nas flags.
**Impacto:** Maior custo por chamada vs. Haiku, mas classificações confiáveis e reproduzíveis.

---

## RD-004 — Remoção do pandas do requirements.txt
**Data:** 2026-06-25
**Contexto:** `pandas==2.2.1` falhou na instalação no Python 3.14 por ausência de compilador C no Windows. O pandas não era importado em nenhum arquivo do projeto.
**Decisão:** Remover do `requirements.txt`. O Cortex não processa CSVs — isso é responsabilidade do Horizon.
**Impacto:** requirements.txt mais enxuto: 4 dependências apenas (fastapi, uvicorn, requests, python-dotenv).

---

## RD-005 — `.env` global na raiz do workspace
**Data:** 2026-06-25
**Contexto:** O `OPENROUTER_API_KEY` é compartilhado por todos os agentes da Holding.
**Decisão:** Carregar o `.env` de `parents[1]/.env` (raiz do workspace `orbita-workspace/`), não do diretório do projeto.
**Impacto:** Uma única chave de API centralizada. Agentes não precisam de `.env` próprios para a mesma chave.

---

## RD-006 — Sem autenticação Bearer na v1.0
**Data:** 2026-06-25
**Contexto:** API exposta localmente em `127.0.0.1:5000` — sem risco de exposição externa imediata.
**Decisão:** v1.0 sem autenticação. Bearer Token entra como F2 no backlog antes da exposição pública.
**Impacto:** Desenvolvimento mais rápido. Risco aceito para o ambiente local de desenvolvimento.

---

## RD-007 — Dois flags operacionais (não mais)
**Data:** 2026-06-25
**Contexto:** Discussão sobre adicionar segmentação de público, NPS estimado e outros flags.
**Decisão:** Manter exatamente dois flags na v1.0: `churn_risk` (booleano) e `recomendacao_upsell` (string). Flags adicionais entram em v1.2 após validação dos dois primeiros.
**Princípio:** Simplicidade primeiro — dois flags são suficientes para coordenar o comportamento dos três agentes atuais.
**Impacto:** Schema mínimo, prompt de classificação simples e determinístico.

---

## RD-008 — Alerta Telegram em falha de envio via Evolution API
**Data:** 2026-08-05
**Contexto:** `notificar_admin` (`POST /api/v1/cortex/notificar-admin`) e o webhook de relatório sob demanda (`webhook_evolution_admin`) sempre trataram falha de envio como "nunca lança" — erro virava só um `print()` no log do container, sem alertar ninguém. Isso ficou evidente num incidente real: `thieco-mutinga` passou mais de uma semana com a instância Evolution desconectada sem que ninguém notasse (ver [[Playbook DevOps - Comandos Docker e Bancos]], entrada 2026-08-05).
**Decisão:** Adicionar `_alertar_telegram()` em `main.py` — dispara mensagem pro bot `@orbita_alertas_bot` (via `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` no `.env` compartilhado) sempre que o POST pro Evolution API (`/message/sendText`) falhar, seja por `resp.status_code` de erro ou exceção. Chamado em `notificar_admin()` e em `webhook_evolution_admin()` (resposta de relatório sob demanda).
**Alternativas descartadas:** e-mail via SMTP — nenhuma credencial SMTP configurada em nenhum `.env` do ecossistema, mais fricção de setup. Alertar pelo próprio WhatsApp/Evolution — descartado por ser circular (é exatamente o canal que está falhando).
**Detalhe de implementação:** cooldown de 15min por `instancia` (dict em memória `_ULTIMO_ALERTA_TELEGRAM`) — sem isso, uma instância fora do ar por horas gerava um alerta por mensagem/tentativa, inviabilizando o canal.
**Impacto:** Continua sem retry automático — o alerta só avisa Willians pra agir manualmente (ver troubleshooting de instância travada no Playbook DevOps). Retry automático fica como possível item futuro, não implementado ainda.

[[integracoes-cortex]]
