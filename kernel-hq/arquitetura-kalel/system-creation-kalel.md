---
status: experimental
domain: kalel
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# System Creation Threshold — Kernel Kalel

As 6 perguntas respondidas antes de abrir a pasta deste agente.
Todas as respostas abaixo saem do código real (`Kernel-Kalel/main.py`, `database.py`, `docker-compose.yml`) e da seção "Agentes próprios do Kernel: Brainiac e Kalel" do `kernel/BACKLOG.md` — nada foi inferido.

---

## 1. Qual problema específico este sistema resolve?

Os tenants do Kernel dependiam do **Quasar** compartilhado para atendimento por WhatsApp. O Quasar original também serve `sistema-thieco` (com SQLite local e FAQ hardcoded por unidade) e a `lane-confeitaria` (com `tools/lane_confeitaria.py`) — ou seja, o Kernel era um caso de uso dentro de um serviço de terceiros, com uma branch `_resolver_origem_cliente` específica de whitelabel enxertada nele.

O Kalel resolve: um agente de atendimento **exclusivo do Kernel**, sem nenhuma dependência de thieco/lane, cuja configuração de negócio vem 100% do backend do Kernel via `WHITELABEL_API_URL` + `INTERNAL_SERVICE_KEY`.

> Rastreio: cabeçalho de `main.py` (linhas 1-12) e `kernel/BACKLOG.md`, seção "⏳ Pendência — Agentes próprios do Kernel (2026-08-04)".

---

## 2. Quem é o usuário e qual é o caso de uso principal?

**Usuário final (indireto):** o cliente do tenant — quem manda mensagem no WhatsApp da barbearia/estabelecimento. Nunca faz login; é identificado por telefone (`key.remoteJid`).

**Usuário direto (operacional):** o tenant do Kernel, que configura persona, horário, endereço, preços e regras pela tela de Configurações do Kernel — o Kalel só lê.

**Caso de uso principal (`/webhook/evolution`):** cliente manda mensagem na instância Evolution `{tenant-slug}-{unidade-slug}` → o Kalel resolve tenant/unidade no backend do Kernel → monta o FAQ dinâmico daquela unidade → consulta o Brainiac pelo histórico real do cliente → responde via OpenRouter → devolve pelo WhatsApp.

---

## 3. Por que este sistema precisa existir — e não pode ser resolvido por um dos agentes já existentes?

O **Quasar** já faz isso, mas carrega código de dois outros produtos (thieco e lane) e é compartilhado em produção com eles. O BACKLOG registra a decisão de **fork, não rename in-place**: mexer no Quasar quebraria clientes em produção que dependem dele hoje.

O **Brainiac** (o outro agente do Kernel) é o cérebro/notificador: fala com o **admin** do tenant, não com o cliente final — a docstring de `GET /api/v1/brainiac/atendimento` diz explicitamente "O Brainiac nunca fala com o cliente final; quem consome esta rota é o Kalel".

Fronteira limpa: Brainiac = dado e notificação para o gestor; Kalel = conversa com o cliente.

---

## 4. Qual é a fronteira clara deste sistema — o que está dentro e o que está fora?

**Dentro:**
- Receber e responder mensagem de cliente por WhatsApp (`POST /webhook/evolution`)
- Receber e responder mensagem por HTTP direto (`POST /api/v1/kalel/chat`)
- Montar o system prompt a partir do pacote dinâmico da unidade (`_montar_faq`)
- Memória curta de conversa (últimas 10 mensagens da sessão, SQLite local)
- Ler imagem enviada pelo cliente (foto de referência) e mandar pro modelo com visão
- 3 ferramentas: transbordo para humano, confirmar agendamento, cancelar agendamento
- Reportar custo real de IA por chamada

**Fora:**
- **Criar** agendamento do zero — quem cria é o motor de agenda do Kernel (`/agendamentos/publico` ou o admin na Agenda). Comentário explícito em `main.py`, linhas 218-227.
- Guardar configuração de negócio (preço, horário, equipe) — tudo vem do Kernel a cada chamada
- Falar com o admin do tenant (é o Brainiac)
- Qualquer interface visual — serviço headless

---

## 5. Como este sistema se integra com o ecossistema existente sem criar dependência circular?

O Kalel é **consumidor puro** de dois serviços e produtor de nenhum:

```
Cliente (WhatsApp) → Evolution API → Kalel → Kernel backend (/internal/*)
                                        ↘  → Brainiac (/api/v1/brainiac/atendimento)
                                        ↘  → OpenRouter
Kalel → Evolution API → Cliente (resposta)
```

Nenhum desses serviços chama o Kalel de volta a não ser a Evolution API (webhook de entrada, que não é retorno de nada que o Kalel pediu). O Brainiac não conhece o Kalel; o Kernel não conhece o Kalel — ele só expõe `/internal/*` para "os agentes".

Dependência circular: nenhuma por design.

---

## 6. Qual é a métrica que define se este sistema foi bem-sucedido?

| Métrica | Evidência no código | Meta declarada |
|---|---|---|
| Tenant novo entra sem mudança de código | `_buscar_info_unidade` + `_resolver_origem_cliente` resolvem tudo por API | 100% — zero hardcode por cliente |
| Conversa nunca cai por falha de dependência | Brainiac, custo, transbordo e mídia são todos best-effort (`except` → segue) | 0 conversa derrubada |
| Cliente sempre recebe alguma resposta | `FALLBACK_RESPOSTA` em qualquer exceção do OpenRouter | 100% |
| Falha de envio no WhatsApp é percebida | `_alertar_telegram` com cooldown de 15min | 0 incidente silencioso |
| Custo de IA rastreável por tenant | `_reportar_custo_agente(..., agente="kalel")` | 100% das chamadas |

---

**Threshold:** APROVADO — fork criado em 2026-08-05, repositório git próprio em 2026-08-10.
**Status atual:** `experimental` — testado ponta a ponta localmente, mas `OPENROUTER_API_KEY` e `EVOLUTION_API_KEY` ainda são placeholder `TROQUE-AQUI` no `.env` e o deploy na VPS nova não existe. Ver [[registro-de-decisoes-kalel]].

[[indice-kalel]]
