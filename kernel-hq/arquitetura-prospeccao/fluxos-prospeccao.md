---
status: stable
domain: prospeccao
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Fluxos Operacionais — Kernel: Motor Ativo de Prospecção

> Referência: [[arquitetura-prospeccao]] | [[requisitos-funcionais-prospeccao]]

---

## Fluxo 1 — Carga Inicial da Base

**Executado uma vez** (ou novamente com novo CSV para acrescentar leads).

```
Willians coloca o CSV na pasta do projeto
        ↓
python database.py
        ↓
init_black_db() → cria tabela se não existir
        ↓
pd.read_csv() → lê cada linha
        ↓
Para cada linha:
  ├── email nulo? → ignorar linha
  ├── telefone nulo? → ignorar linha
  ├── email duplicado? → IntegrityError → ignorar linha
  └── INSERT leads_prospeccao (nome, email, telefone, status='PENDENTE')
        ↓
Print: "🎯 X leads carregados no Kernel"
```

**Resultado:** 1829 leads com `status_disparo = 'PENDENTE'` prontos para disparo.

---

## Fluxo 2 — Disparo em Lote

**Executado pelo operador** via Postman, browser ou automação.

```
GET /api/v1/black/disparar-lote?limite=5
        ↓
SELECT id, nome, telefone FROM leads_prospeccao
WHERE status_disparo = 'PENDENTE' LIMIT 5
        ↓
Para cada lead:
  ├── Interpolar {nome} na mensagem template
  ├── UPDATE status_disparo = 'ENVIADO'
  └── Adicionar à lista de retorno
        ↓
Retorno JSON:
{
  "status": "sucesso",
  "total_disparados": 5,
  "fila": [{ id, nome, telefone, mensagem_gerada }]
}
```

**Próxima etapa (integração futura):** a Evolution API recebe a `mensagem_gerada` e o `telefone` e envia via WhatsApp. Hoje o operador copia e envia manualmente ou integra via script.

---

## Fluxo 3 — Recebimento de Resposta e Classificação por IA

**Acionado automaticamente** pela Evolution API quando o lead responde no WhatsApp.

```
POST /api/v1/black/webhook-resposta
{ "telefone_remetente": "41 988389442", "texto_mensagem": "Sim, me interessa!" }
        ↓
SELECT id, nome, email FROM leads_prospeccao WHERE telefone = '41 988389442'
        ↓
┌── Lead não encontrado? → retornar { status: "desconhecido" } → FIM
│
└── Lead encontrado → encaminhar para IA
        ↓
analisar_interesse_lead("Sim, me interessa!")
        ↓
POST https://openrouter.ai/api/v1/chat/completions
  model: anthropic/claude-3.5-sonnet
  temperature: 0.0
  system: "Classifique em INTERESSADO / RECUSADO / NEUTRO"
  user: "Resposta do Lead: 'Sim, me interessa!'"
        ↓
┌── Exceção na API? → fallback: "NEUTRO"
│
└── Resposta: "INTERESSADO"
        ↓
[Ramo INTERESSADO]
  UPDATE status_disparo = 'INTERESSADO'
  → Ativar gancho de transbordo (Fluxo 4)
  → Retornar { status: "transbordo_ativado", classificacao: "INTERESSADO" }

[Ramo RECUSADO]
  UPDATE status_disparo = 'RECUSADO'
  → Retornar { status: "processado", classificacao: "RECUSADO", acao: "MANTER_EM_STDBY" }

[Ramo NEUTRO]
  UPDATE status_disparo = 'RESPONDIDO'
  → Retornar { status: "processado", classificacao: "NEUTRO", acao: "MANTER_EM_STDBY" }
```

---

## Fluxo 4 — Transbordo Comercial (INTERESSADO)

**Acionado automaticamente** dentro do Fluxo 3 quando classificação = INTERESSADO.

```
Classificação = "INTERESSADO"
        ↓
UPDATE leads_prospeccao SET status_disparo = 'INTERESSADO'
        ↓
[Hoje] print no console:
  "🔥 ALERTA KERNEL: Lead {nome} ({telefone}) demonstrou INTERESSE!"
        ↓
[Futuro — descomentar gancho] POST https://api.trello.com/1/cards
  idList: ID_DA_LISTA_VIP
  name: "🔥 LEAD INTERESSADO: {nome}"
  desc: "Telefone: {telefone}\nEmail: {email}\nResposta: {texto_mensagem}"
        ↓
Time comercial recebe card no Trello → entra em contato com o lead
```

**Gancho comentado em `main.py` linhas 49-57** — pronto para ativar com as credenciais do Trello.

---

## Critérios de classificação da IA

| Palavra retornada | Quando aplicar | Exemplo de resposta do lead |
|---|---|---|
| `INTERESSADO` | Aceitou reunião, pediu mais info, demonstrou abertura | "Pode me mandar mais detalhes", "Que horas você pode?" |
| `RECUSADO` | Pediu para não incomodar, negou explicitamente, foi hostil | "Não tenho interesse", "Me tire dessa lista", "Para de me ligar" |
| `NEUTRO` | Resposta automática, inconclusiva, fora de contexto | "Vou ver e te aviso", "Ok", "Oi", respostas de bot |

**Fallback:** se o Claude retornar texto diferente das 3 palavras esperadas (improvável com `temperature: 0.0`), o sistema trata como NEUTRO pelo strip() — a resposta sempre vira a palavra em maiúsculo sem espaços extras.
