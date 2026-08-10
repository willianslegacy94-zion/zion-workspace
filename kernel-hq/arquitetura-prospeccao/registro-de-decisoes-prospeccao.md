---
status: stable
domain: prospeccao
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Registro de Decisões — Kernel: Motor Ativo de Prospecção

> Referência: [[prd-prospeccao]] | [[arquitetura-prospeccao]]

Decisões cronológicas que moldaram o sistema. Cada entrada registra o contexto, a alternativa descartada e o impacto.

---

## D-01 — Python como runtime (não Node.js)

**Data:** 2026-06-25
**Decisão:** usar Python 3.14 como linguagem do robô de prospecção.
**Contexto:** o workspace já tem projetos Node.js (Thieco). A escolha de Python foi deliberada para separar responsabilidades — Node.js para sistemas web com UI, Python para automações e robôs de dados.
**Alternativa descartada:** Node.js + Express (mesmo stack do Thieco). Descartado porque o ecossistema Python tem vantagem em manipulação de dados (pandas), integração com IA (requests para APIs) e scripts de carga (CSV).
**Impacto:** novo ambiente Python no Windows, problema de compilação do pandas no Python 3.14. Resolvido com `--only-binary=:all:`.

---

## D-02 — SQLite como banco (não PostgreSQL)

**Data:** 2026-06-25
**Decisão:** usar SQLite via `sqlite3` nativo do Python.
**Contexto:** o sistema opera com 1829 leads em modo single-user. Não há concorrência real de escritas — disparos são em lote controlado e respostas chegam com espaçamento natural.
**Alternativa descartada:** PostgreSQL (mesmo banco do Thieco no Docker). Descartado porque adiciona dependência de servidor Docker apenas para 1829 registros — over-engineering para o escopo atual.
**Impacto:** zero configuração de servidor; arquivo `orbita_black.db` portável; limitação futura se webhooks chegarem simultaneamente em alto volume.

---

## D-03 — Claude 3.5 Sonnet via OpenRouter (não Anthropic direto)

**Data:** 2026-06-25
**Decisão:** usar OpenRouter como proxy para acessar Claude 3.5 Sonnet.
**Contexto:** OpenRouter permite acesso a múltiplos modelos com uma única chave de API e faturamento unificado. Evita necessidade de conta Anthropic separada e permite trocar de modelo sem mudar o código (apenas o campo `model` no payload).
**Alternativa descartada:** Anthropic API direta (`anthropic` SDK). Descartado para manter flexibilidade de trocar modelo futuramente sem reescrita.
**Impacto:** latência adicional do proxy (~200ms). Aceitável para classificação de resposta de lead (não é tempo real crítico).

---

## D-04 — temperature: 0.0 na classificação

**Data:** 2026-06-25
**Decisão:** fixar `temperature: 0.0` na chamada ao Claude para classificação de interesse.
**Contexto:** o sistema precisa de resposta determinística — a mesma resposta do lead deve sempre gerar a mesma classificação. Variação introduziria inconsistência de estado no banco.
**Alternativa descartada:** `temperature: 0.3` para "mais naturalidade". Descartado porque naturalidade não é o objetivo — classificação exata e repetível é.
**Impacto:** respostas sempre uma das três palavras exatas. Elimina necessidade de parsing complexo.

---

## D-05 — Fallback NEUTRO em exceção de IA

**Data:** 2026-06-25
**Decisão:** qualquer exceção na chamada ao OpenRouter retorna `"NEUTRO"` sem propagar erro.
**Contexto:** o webhook de resposta não pode falhar por causa de indisponibilidade da API de IA. Um lead classificado como NEUTRO permanece em RESPONDIDO e pode ser reavaliado manualmente — não é prejuízo irreversível.
**Alternativa descartada:** propagar a exceção e retornar HTTP 500. Descartado porque quebraria o webhook da Evolution API, que pode não ter retry automático.
**Impacto:** o sistema nunca derruba o webhook por falha de IA. Custo: leads que deveriam ser INTERESSADO podem ficar como RESPONDIDO em caso de falha. Mitigação: Trello card não é criado, mas o lead não é perdido — fica para re-análise.

---

## D-06 — Gancho Trello comentado (não removido)

**Data:** 2026-06-25
**Decisão:** manter o código de integração com Trello comentado em `main.py` linhas 49-57.
**Contexto:** a integração com Trello é o próximo passo natural mas requer credenciais (API Key e Token) que ainda não foram configuradas. Deixar comentado documenta a intenção e reduz o tempo de ativação para minutos.
**Alternativa descartada:** remover o código e implementar depois. Descartado porque o padrão exato de chamada à API do Trello estaria perdido e precisaria ser redesenhado.
**Impacto:** desenvolvedor vê imediatamente o que falta para ativar o transbordo real — apenas descomentar e preencher as credenciais.

---

## D-07 — .env na raiz do workspace (não na pasta do projeto)

**Data:** 2026-06-25
**Decisão:** `OPENROUTER_API_KEY` lida de `Path(__file__).resolve().parents[1] / ".env"` — dois níveis acima, na raiz do workspace.
**Contexto:** o workspace (`orbita-workspace/`) tem múltiplos projetos que podem reutilizar a mesma chave OpenRouter. Um único `.env` na raiz evita duplicação de credenciais entre projetos.
**Alternativa descartada:** `.env` dentro de `kernel-hq-prospeccao/`. Descartado para seguir o padrão de workspace unificado — a mesma chave serve para todos os robôs Órbita.
**Impacto:** ao rodar `python main.py` de dentro da pasta do projeto, o `.env` é encontrado corretamente via path absoluto.
