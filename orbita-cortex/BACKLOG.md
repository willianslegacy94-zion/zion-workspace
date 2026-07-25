# Orbita Cortex — Backlog

## Estado Atual

O Cortex hoje é um microsserviço FastAPI genérico de inteligência de leads pra
agência (`POST /api/v1/cortex/processar`): recebe dados comportamentais de um
aluno/cliente de qualquer tenant, classifica risco de churn e recomendação de
upsell via Claude 3.5 Sonnet (OpenRouter), grava numa matriz SQLite
(`matriz_inteligencia`) e devolve o resultado. **Não tem nada relacionado à
Barbearia Thieco Leandro ainda**, nem scheduler, nem capacidade de enviar
mensagem de WhatsApp — é puramente um endpoint de classificação sob demanda.

---

## Integração — Notificações da Barbearia Thieco Leandro (sistema-thieco)

**Contexto:** o `sistema-thieco` (motor de agendamento + configurações de
notificação) enfileira mensagens prontas numa fila interna — tabela
`notificacoes`, `canal='whatsapp'`, `enviado_whatsapp=false`. Duas origens
diferentes alimentam essa mesma fila:

1. **Lembrete de agendamento** (`tipo='lembrete_agendamento'`) — TASK-23,
   dispara ~15min antes de cada atendimento confirmado, com link de
   confirmação de presença. Mensagem transacional, tempo curto.
2. **Notificações periódicas configuráveis** (tela Configurações → aba
   Notificações) — 4 tipos, cada um ligado/desligado e agendado
   independentemente por unidade (Mutinga/Tamboré):
   - `tipo='faturamento'` — resumo de faturamento do período
   - `tipo='produtos_mais_vendidos'` — ranking de produtos vendidos no período
   - `tipo='servicos_mais_realizados'` — ranking de serviços realizados no período
   - `tipo='estoque_parado'` — produtos com estoque > 0 parados há N dias desde o cadastro
   Cada uma dispara num **horário fixo configurado** (ex: 20h) respeitando a
   periodicidade escolhida (diário/semanal/quinzenal/personalizado).

O Cortex é candidato a assumir o **envio de verdade** dessas mensagens pro
telefone do admin (`telefone_destino`, já vem preenchido no payload de cada
item da fila). Falta, no lado do Cortex:

1. **Um worker/scheduler** (não existe hoje — `main.py` só responde requisição
   síncrona, não tem nenhum loop periódico) que chama
   `GET /notificacoes/whatsapp/pendentes` no sistema-thieco de tempos em
   tempos (autenticação hoje é token admin do próprio sistema; precisa decidir
   um mecanismo serviço-a-serviço — API key dedicada — antes de ligar isso de
   verdade).
2. **Gateway de envio de WhatsApp** — não existe implementado em lugar nenhum
   deste repo (nem aqui nem no Horizon). Precisa de WPPConnect/Z-API/Twilio/
   Meta Cloud API ou similar antes desta integração fazer sentido na prática.
3. Após enviar, chamar `PATCH /notificacoes/whatsapp/:id/enviado` no
   sistema-thieco pra marcar como enviado (evita reenvio).

**Payload de cada item da fila** (`GET /notificacoes/whatsapp/pendentes`),
exemplo de notificação periódica:
```json
{
  "id": 42,
  "unidade": "mutinga",
  "tipo": "faturamento",
  "titulo": "Faturamento — últimos 7 dia(s)",
  "mensagem": "Faturamento de mutinga nos últimos 7 dia(s): R$ 3.240,00 em 48 atendimento(s).",
  "meta": {
    "unidade": "mutinga",
    "periodo_dias": 7,
    "total_faturado": 3240.00,
    "atendimentos": 48,
    "telefone_destino": "11999998888"
  }
}
```
`meta.telefone_destino` é pra onde a mensagem deve ir — vem de
`configuracoes_notificacoes.telefone_destino`, configurado na tela do sistema-
thieco pelo admin. `mensagem` já é o texto pronto pra mandar; `meta` traz os
dados estruturados caso o Cortex queira formatar diferente (ex: card rico em
vez de texto puro).

**Nota:** essa integração é sobre **relatórios/lembretes periódicos** que o
sistema já enfileira, não sobre inteligência analítica nova do Cortex — o
Cortex aqui atua só como o "braço de envio" de WhatsApp. Se no futuro fizer
sentido o Cortex também *analisar* esses dados (ex: sugerir promoção pro
produto parado, prever queda de faturamento), isso é uma segunda camada,
separada da entrega básica de disparo.

**Ver também:** integração equivalente documentada em
`orbita-horizon/BACKLOG.md` (item F8) — mesma fila, mesma lacuna de scheduler +
gateway de WhatsApp. Se um dos dois (Horizon ou Cortex) resolver essa lacuna
primeiro, o outro pode reaproveitar a mesma solução em vez de duplicar
esforço — vale decidir qual dos dois assume esse papel antes de implementar
os dois em paralelo.
