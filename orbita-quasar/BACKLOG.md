# Orbita Quasar — Backlog

## Estado Atual

Órbita Quasar é o motor de **agendamento conversacional** — usa Claude 3.5
Sonnet com *function calling* (`POST /api/v1/quasar/chat`) pra oferecer um
concierge que checa disponibilidade e confirma reunião/mentoria em linguagem
natural, sem fluxo de formulário. Duas ferramentas definidas em `main.py`
(`TOOLS_DEFINITION`), que o próprio Claude decide acionar:

- `checar_disponibilidade_agenda(data_com_hora)` — só recebe data+hora
- `confirmar_agendamento_call(data_com_hora)` — junto com `nome_cliente`/`email` que já vêm no payload da requisição

Hoje as duas apontam pra `tools/calendar_mock.py` — uma lista em memória
hardcoded (`AGENDA_OCUPADA = ["2026-06-25 14:00", "2026-06-25 15:00"]`), sem
nenhuma conexão com dado real. O único tenant cadastrado
(`tenant_quasar_vip`) é fictício ("Scale Up Mentorias", mentoria de alto
ticket) — nada da barbearia ainda.

---

## Integração — Agendamento da Barbearia Thieco Leandro (sistema-thieco)

**Este é o agente certo pro papel que a TASK-23 do sistema-thieco previu**
desde o início: "motor de agendamento nativo... integrado a um sistema de
agendamento para o cliente através do whatsapp com um agente integrado". Não
confundir com a integração do Horizon/Cortex (`orbita-horizon/BACKLOG.md`
item F8, `orbita-cortex/BACKLOG.md`) — aquela é sobre **disparo outbound**
periódico (lembrete de agendamento, relatório de faturamento). O Quasar aqui
é **inbound conversacional**: cliente manda mensagem, IA consulta e confirma
horário real na hora, dentro da própria conversa. Os dois papéis são
complementares e podem coexistir sem conflito.

O sistema-thieco já expõe 3 endpoints **públicos** (sem autenticação — mais
simples que a integração do Horizon/Cortex, que precisa de API key admin)
prontos pro Quasar consumir direto:

- `GET /agendamentos/servicos?unidade=X` — lista de serviços com preço e
  duração (`id, nome, preco_venda, duracao_minutos`).
- `GET /agendamentos/disponibilidade?unidade=X&catalogo_id=Y&data=YYYY-MM-DD&profissional_id=Z(opcional)`
  — retorna os horários realmente livres naquele dia, considerando jornada da
  unidade e agendamentos já marcados de cada barbeiro. Se `profissional_id`
  não for informado, retorna a união de todos os barbeiros ativos ("qualquer
  barbeiro disponível").
- `POST /agendamentos/publico` — cria o agendamento de verdade
  (`unidade, catalogo_id, data, hora_inicio, profissional_id?, cliente_nome,
  cliente_contato`). Anti-overbooking em duas camadas (checagem de conflito +
  `EXCLUDE` constraint no banco) — nunca deixa dar dois agendamentos pro
  mesmo barbeiro no mesmo horário, mesmo em corrida.

### O que falta pra ligar de verdade

1. **Trocar `tools/calendar_mock.py` por chamadas HTTP reais** pros 3
   endpoints acima (`requests.get`/`requests.post` direto, já que não tem
   autenticação no caminho).

2. **Ampliar o schema da tool `checar_disponibilidade_agenda`** — hoje só
   recebe `data_com_hora`. Falta `unidade` e `catalogo_id` (ou nome do
   serviço, resolvido antes via `/agendamentos/servicos`): sem isso não dá
   pra calcular disponibilidade real, porque cada serviço tem duração
   diferente e cada unidade tem jornada de funcionamento diferente. Sugestão
   de schema novo:
   ```json
   {
     "name": "checar_disponibilidade_agenda",
     "parameters": {
       "unidade": "mutinga | tambore",
       "servico": "nome do serviço (ex: Corte, Combo - Corte + Barba)",
       "data": "YYYY-MM-DD",
       "profissional": "nome do barbeiro, opcional — se não informado, qualquer um disponível"
     }
   }
   ```

3. **`confirmar_agendamento_call` usa `email`, sistema-thieco espera
   `cliente_contato` (telefone)** — trocar o parâmetro. Faz mais sentido usar
   o próprio `session_id` da conversa (que já é o número de WhatsApp, [confirmado
   no BACKLOG.md do Horizon]) como `cliente_contato` automaticamente, sem
   precisar que o cliente digite o telefone de novo.

4. **Cadastrar o(s) tenant(s) da barbearia** com FAQ real — mesmo conteúdo do
   PDF "Onboarding Zion Ops – Barbearia Thieco Leandro" que já alimentou o
   seed de `jornada_unidade` e `catalogo.duracao_minutos` no sistema-thieco
   (endereços, horário Ter-Qui 9h-20h/Sex-Sáb 9h-19h, equipe por unidade,
   tabela de preços/duração completa, regras de atendimento — tolerância de
   atraso, forma de pagamento aceita, o que o robô nunca deve fazer).
   **Sugestão: 2 tenant_id separados** (`tenant_thieco_mutinga` /
   `tenant_thieco_tambore`), cada um com seu próprio FAQ/preço/horário — evita
   o agente ter que perguntar ou, pior, confundir a unidade no meio da
   conversa (o FAQ original já é explícito: "NUNCA citar preço de uma unidade
   pro cliente da outra").

5. **`OPENROUTER_API_KEY` ainda é placeholder** no `.env` local do Quasar
   (mesmo bloqueio já registrado no backlog do Horizon, item B1 — pode ser a
   mesma chave se o modelo usado for o mesmo).

6. **Gateway de WhatsApp** — `main.py` só expõe um endpoint REST genérico
   (`session_id` + `mensagem` já extraídos); não tem webhook de entrada nem
   envio de saída de WhatsApp de verdade. Precisa de WPPConnect/Z-API/
   Twilio/Meta Cloud API conectado antes de virar um bot real — mesma lacuna
   que Horizon e Cortex têm hoje, os 3 agentes da Zion Ops compartilham esse
   pré-requisito.

**Status:** mapeado, nada implementado ainda — aguardando decisão de
prioridade do Willians antes de mexer em código aqui.
