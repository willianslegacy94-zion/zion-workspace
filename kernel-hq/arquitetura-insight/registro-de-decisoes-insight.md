---
status: stable
domain: orbita-insight
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Registro de Decisões — Órbita Insight

> Referência: [[prd-insight]] | [[requisitos-funcionais-insight]] | [[arquitetura-insight]]

Memória viva do sistema. Registra o que mudou, por que mudou e o que isso significa.
Entradas em ordem cronológica crescente — as mais recentes no final.

---

## 2026-06-25 — Criação inicial do sistema

**Motivo:** Infoprodutores não têm visibilidade comportamental dos alunos. Churn, upsell e reengajamento acontecem sem alerta. O Órbita Insight nasce para transformar dados brutos de consumo em inteligência acionável via WhatsApp.
**Impacto:** Criação das 3 entidades centrais do sistema: `main.py` (API), `database_insight.py` (banco), `requirements.txt` (dependências). Stack definida: FastAPI + Python 3.14 + SQLite + OpenRouter (Claude 3.5 Sonnet).
**Status:** aplicado
**Artefatos atualizados:** arquitetura-insight, modelo-de-dados-insight
**Observação:** MVP local, single-tenant, sem autenticação. API funcional em `127.0.0.1:5000`.

---

## 2026-06-25 — Remoção do pandas das dependências

**Motivo:** `pandas==2.2.1` não possui wheel pré-compilado para Python 3.14 e falhou na instalação por ausência de compilador C no ambiente Windows. A biblioteca não era usada em nenhum módulo do sistema.
**Impacto:** `requirements.txt` reduzido de 5 para 4 dependências. Nenhuma funcionalidade removida.
**Status:** aplicado
**Artefatos atualizados:** requirements.txt
**Observação:** Se análise de dados tabular for necessária no futuro, avaliar `polars` como alternativa com wheels disponíveis para Python 3.14.
