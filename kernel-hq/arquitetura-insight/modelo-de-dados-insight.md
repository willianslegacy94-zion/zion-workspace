---
status: archived
domain: orbita-insight
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Modelo de Dados — Órbita Insight

> Referência: [[prd-insight]] | [[arquitetura-insight]]

---

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| LogInsight | Um insight gerado para um aluno de um produtor | Auditoria de tudo que foi produzido, base para análise de padrões futuros e rastreio de status de envio |

---

## Atributos — tabela `logs_insights`

| Atributo | Tipo SQLite | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | sim | sim | identificador único auto-incrementado |
| produtor_whatsapp | TEXT | sim | não | número do infoprodutor que receberá o alerta — formato livre no MVP |
| email_aluno | TEXT | sim | não | e-mail do aluno na plataforma — identificador único do aluno |
| nome_aluno | TEXT | sim | não | nome do aluno para personalização do insight |
| produto | TEXT | sim | não | nome do curso ou infoproduto associado ao aluno |
| insight_gerado | TEXT | sim | não | texto completo do insight gerado pela IA — o output principal |
| status_envio | TEXT DEFAULT 'PENDENTE' | sim | não | ciclo de vida do insight: `PENDENTE` → `ENVIADO` → `ERRO` |
| timestamp | DATETIME DEFAULT CURRENT_TIMESTAMP | sim | sim | momento da geração — gerado automaticamente pelo SQLite |

---

## Estados do `status_envio`

```
PENDENTE  →  ENVIADO   (integrador confirma entrega ao WhatsApp)
PENDENTE  →  ERRO      (falha na entrega reportada pelo integrador)
```

> No MVP, a transição de `PENDENTE` para `ENVIADO` ou `ERRO` é responsabilidade do integrador externo via UPDATE direto no banco ou endpoint futuro.

---

## Inputs do payload (não persistidos como entidade separada)

Os dados abaixo chegam via `PayloadAnalise` no POST e são usados para gerar o insight — parte deles é persistida em `logs_insights`, parte é usada apenas no prompt e descartada.

| Campo do payload | Persistido? | Usado em |
|---|---|---|
| `produtor_whatsapp` | sim (`produtor_whatsapp`) | log + response |
| `nome_aluno` | sim (`nome_aluno`) | log + prompt |
| `email_aluno` | sim (`email_aluno`) | log + prompt |
| `nome_produto` | sim (`produto`) | log + prompt |
| `valor_pago` | não | prompt (contexto financeiro do aluno) |
| `dias_desde_a_compra` | não | prompt + classificação de regra |
| `progresso_aulas` | não | prompt + classificação de regra |

---

## Decisões de modelagem

| Decisão | Motivo |
|---|---|
| Tabela única `logs_insights` | Volume de MVP não justifica normalização; todo o contexto relevante cabe em uma linha |
| `status_envio` como TEXT e não ENUM | SQLite não suporta ENUM nativo; constraint de valores válidos é responsabilidade da aplicação |
| `valor_pago` e métricas de progresso não persistidos | São inputs de análise pontual — o output (insight) é o que tem valor histórico |
| `timestamp` gerado pelo SQLite | Garante consistência independente do timezone do servidor Python |
