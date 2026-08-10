---
status: stable
domain: prospeccao
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Arquitetura Técnica — Kernel: Motor Ativo de Prospecção

> Referência: [[prd-prospeccao]] | [[requisitos-funcionais-prospeccao]]

---

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Runtime | Python 3.14 | Já instalado no ambiente Windows; ecossistema de dados robusto (pandas, sqlite3) | Performance CPU-intensiva seria melhor com Go/Rust |
| Framework web | FastAPI 0.110 | Tipagem nativa com Pydantic, validação automática de payload, Swagger embutido sem configuração | Não tem suporte nativo a WebSockets (irrelevante aqui) |
| Banco de dados | SQLite (arquivo local) | Zero configuração de servidor; arquivo único portável; suficiente para 1829 leads em operação single-user | Sem suporte a múltiplas gravações concorrentes — bloqueante se múltiplos webhooks chegarem simultaneamente |
| IA de classificação | Claude 3.5 Sonnet via OpenRouter | Modelo com compreensão contextual alta para classificar intenção em linguagem natural; OpenRouter como proxy elimina dependency de conta Anthropic direta | Latência de API externa (~2-5s) — inaceitável para casos que exigem resposta em tempo real < 1s |
| HTTP client | requests 2.31 | Simples, síncrono, suficiente para chamadas únicas à API; sem necessidade de async aqui | Bloqueante — em alta concorrência, usar httpx com async |
| Carga de dados | pandas (CSV reader) | Leitura de planilha com filtros e tratamento de nulos em poucas linhas | Dependência pesada para uso único — `csv` nativo seria suficiente, mas pandas já é familiar |
| Servidor ASGI | Uvicorn 0.28 | Servidor ASGI de referência para FastAPI; reload automático em desenvolvimento | Não configurado para produção (sem workers múltiplos, sem HTTPS) |
| Config | python-dotenv | Padrão de mercado para isolamento de credenciais; `.env` na raiz do workspace reutilizável entre projetos | — |

---

## 2. Camadas do sistema

```
[Caller externo — Postman / Evolution API / Browser]
              ↓  ↑  (HTTP/REST via JSON)
[FastAPI + Uvicorn — porta 5000]
              ↓  ↑
[Lógica de negócio — main.py]
       ↓              ↓
[SQLite local]   [OpenRouter API]
  database.py    services/openrouter.py
                       ↓
               [Claude 3.5 Sonnet]
```

**FastAPI:** camada de entrada. Valida payload via Pydantic, roteia para handlers. Sem autenticação (sistema interno local).

**main.py:** lógica de negócio. Gerencia conexão com SQLite, orquestra geração de mensagem, chama classificação por IA, decide transições de estado e ativa gancho de transbordo.

**database.py:** responsável exclusivo pelo DDL e pela importação da base de leads via CSV. Cria a tabela `leads_prospeccao` se não existir.

**services/openrouter.py:** cliente isolado para a API do OpenRouter. Sem estado — recebe texto, devolve classificação. Encapsula toda a lógica de prompt e fallback.

---

## 3. Fluxo de dados

### Disparo em lote

```
GET /disparar-lote?limite=N
  → SELECT leads WHERE status='PENDENTE' LIMIT N
  → Para cada lead: gerar mensagem personalizada com {nome}
  → UPDATE status='ENVIADO'
  → Retornar JSON com fila gerada
```

### Recebimento de resposta (webhook)

```
POST /webhook-resposta {telefone_remetente, texto_mensagem}
  → SELECT lead WHERE telefone = telefone_remetente
  → [Lead não encontrado] → retornar status: desconhecido
  → analisar_interesse_lead(texto_mensagem)
      → POST openrouter.ai/chat/completions
      → Claude 3.5 Sonnet → INTERESSADO | RECUSADO | NEUTRO
      → [Exceção] → fallback NEUTRO
  → [INTERESSADO] → UPDATE status='INTERESSADO' + ativar gancho Trello
  → [RECUSADO]    → UPDATE status='RECUSADO'
  → [NEUTRO]      → UPDATE status='RESPONDIDO'
  → Retornar JSON com classificação e ação tomada
```

---

## 4. Pontos de integração

| Integração | Direção | Formato | Autenticação | Status |
|---|---|---|---|---|
| Caller → FastAPI | entrada | REST/JSON | nenhuma (interno) | Ativo |
| FastAPI → OpenRouter | saída | REST/JSON | Bearer token no header | Ativo (via .env) |
| Evolution API → FastAPI | entrada (webhook) | REST/JSON | nenhuma | Pronto para receber |
| FastAPI → Trello | saída | REST/JSON com query params | API Key + Token | Comentado (gancho pronto) |

> Evolution API é o próximo passo de integração: ela envia os disparos reais de WhatsApp e chama o webhook quando o lead responde.

---

## 5. Fronteiras de segurança

- **Chave da API:** `OPENROUTER_API_KEY` nunca no código — carregada via `.env` dois níveis acima (`parents[1]`)
- **Banco:** arquivo local SQLite — não exposto em rede, sem porta aberta
- **Endpoints:** sem autenticação por ser sistema interno local (porta 127.0.0.1, não 0.0.0.0)
- **Fallback de IA:** exceção na chamada ao OpenRouter nunca quebra o webhook — retorna NEUTRO silenciosamente
- **Dados sensíveis:** telefones e emails de leads no banco local — não trafegam em log, apenas confirmação de existência

---

## 6. Estratégia de escala

**Limitação atual:**
- SQLite é single-writer — múltiplas requisições POST simultâneas no webhook podem gerar lock
- OpenRouter tem latência de 2-5s por chamada — em volume alto, o endpoint trava

**Suficiente para o cenário atual:**
- 1829 leads processados sequencialmente em lotes controlados
- Webhooks chegam com espaçamento natural de respostas humanas (não simultâneos)
- Operação single-user sem concorrência real

**O que muda se escalar:**
- > 500 respostas simultâneas → migrar SQLite para PostgreSQL + usar httpx async para OpenRouter
- > 10.000 leads → adicionar fila (Redis/Celery) para processamento assíncrono dos webhooks
- Multi-tenant (outros clientes Órbita) → banco por cliente ou schema separado + autenticação nos endpoints

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | 2026-06-25 | Criação inicial — Python + FastAPI + SQLite + OpenRouter (Claude 3.5 Sonnet) |
