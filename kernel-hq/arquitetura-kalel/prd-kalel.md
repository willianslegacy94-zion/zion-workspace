---
status: experimental
domain: kalel
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# PRD — Kernel Kalel

## 1. Contexto

O Kernel (produto SaaS multi-tenant de caixa/gestão, documentado em [[indice-kernel]]) precisa de atendimento por WhatsApp para os clientes finais de cada tenant. Até 2026-08-05 isso era feito pelo **Quasar**, um agente da Holding compartilhado com `sistema-thieco` e `lane-confeitaria` — o Kernel era uma branch dentro do serviço de outro produto.

O **Kalel** é o fork exclusivo do Kernel: mesma stack, mesma ideia de concierge conversacional, mas sem nenhuma linha específica de thieco ou lane. Todo o conteúdo de negócio (persona, horário, endereço, equipe, preços, regras, mensagem de transbordo) vem em tempo real do backend do Kernel — o agente não guarda configuração de tenant nenhuma.

O nome "Kalel" é apenas o **padrão**: `NOME_PADRAO_AGENTE = "Kalel"` só entra quando o tenant não configurou `unidades.atendimento_ia.nome_assistente`.

## 2. Problema

**Dor específica:** o atendimento por IA dos tenants do Kernel vivia dentro de um serviço de terceiros, acoplado a dois produtos que não são o Kernel.

**Como se manifesta:**
- Qualquer evolução do atendimento do Kernel exigia mexer num serviço em produção para thieco/lane
- O Quasar carregava `tools/lane_confeitaria.py`, SQLite de config de tenant e FAQ hardcoded por unidade — nada disso útil ao Kernel
- Chave de OpenRouter compartilhada entre todos os agentes: custo e limite de um produto afetavam o outro
- Sem separação, não dá para colocar "só Kernel + seus 2 agentes" na VPS nova

**Por que ainda não foi resolvida:** o Quasar está em produção atendendo thieco e lane. `kernel/BACKLOG.md` registra a decisão explícita de **fork, não rename in-place** — o decoupling do Quasar original só acontece depois que Kalel e Brainiac rodarem estáveis com tráfego real.

## 3. Objetivo

Depois do Kalel existir:
- Um tenant novo do Kernel tem atendimento por WhatsApp sem **nenhuma** mudança de código no agente — basta preencher os campos de Configurações do tenant
- O agente responde com o nome, o tom de voz e os preços reais daquele tenant
- Cliente que quer confirmar ou desmarcar o horário resolve na própria conversa, sem link nem código
- Cliente que precisa de gente é passado para um humano com o motivo resumido
- O custo de IA de cada tenant é rastreável linha a linha em `agente_custos`
- Quasar e Cortex podem, no futuro, voltar a ser só de thieco+lane

## 4. Usuário

**Quem:**
- **Cliente final do tenant (usuário da conversa):** manda mensagem no WhatsApp do estabelecimento. Identificado por telefone (`key.remoteJid`), nunca por login. Nome vem do `pushName` do WhatsApp.
- **Admin do tenant (usuário do conteúdo):** define persona, horário, endereço, Instagram, link de agendamento, regras e mensagem de transbordo — o Kalel só consome.
- **Willians (operador do ecossistema):** recebe alerta no Telegram quando um envio pela Evolution API falha; audita custo de IA por tenant.

**Estado no uso:** cliente está no WhatsApp, provavelmente em movimento, esperando resposta curta e imediata. Por isso: parágrafos curtos, uma saudação só na primeira mensagem, e fallback imediato ("Olá! Já te retorno em instantes, só um momento.") em qualquer falha.

**Contexto:** serviço headless. Duas portas de entrada — o webhook real da Evolution API e uma rota HTTP (`/api/v1/kalel/chat`) que existe para testar o mesmo núcleo sem depender do WhatsApp.

## 5. Hipótese de solução

Um serviço FastAPI que, a cada mensagem:
1. Resolve tenant e unidade a partir do nome da instância Evolution (`GET /internal/resolve-instancia`)
2. Busca o pacote de conteúdo daquela unidade (`GET /internal/unidade-atendimento`) e monta o FAQ só com os blocos que o admin preencheu
3. Enriquece com o histórico real do cliente via Brainiac (última visita, total de visitas, risco de afastamento)
4. Recupera as últimas 10 mensagens da sessão do SQLite local
5. Chama o modelo via OpenRouter com `temperature: 0.1` e 3 ferramentas disponíveis
6. Executa a ferramenta que o modelo pedir (transbordo / confirmar / cancelar) e devolve o resultado para ele redigir a resposta final
7. Reporta o custo e responde pelo WhatsApp

**Por que faz sentido:** a única coisa que o agente precisa saber sobre um tenant é o que o próprio tenant já cadastrou no Kernel. Tirar a configuração do agente e deixá-la no produto elimina a classe inteira de bug "cliente novo exige deploy".

**Risco central:** a qualidade da resposta depende do que o admin preencheu. `_montar_faq` só inclui blocos preenchidos — um tenant que não cadastrou preços simplesmente não terá tabela de preços no prompt (e a regra "NUNCA informe preços que não estejam nesta lista" passa a proteger contra invenção).

## 6. Escopo

**Dentro:**
- `POST /webhook/evolution` — conversa real por WhatsApp
- `POST /api/v1/kalel/chat` — mesma lógica por HTTP, para teste
- `GET /health` — healthcheck do container
- FAQ dinâmico por unidade, montado a cada mensagem
- Memória curta de conversa (10 últimas mensagens por `session_id`)
- Visão: foto enviada pelo cliente vira bloco multimodal (`image_url` em data URI base64)
- 3 ferramentas: `acionar_atendimento_humano`, `confirmar_agendamento`, `cancelar_agendamento`
- Telemetria de custo (`agente="kalel"`, `origem="kalel_chat"`)
- Alerta no Telegram em falha de envio, com cooldown de 15min por instância

**Fora:**
- **Criar** agendamento novo — o motor de agenda é do Kernel; o Kalel só confirma/cancela um que já existe
- Falar com o admin do tenant (é o Brainiac)
- Guardar preço, horário ou equipe localmente
- Qualquer UI
- Pagamento/cobrança na conversa (cogitado em `kernel/BACKLOG.md`, não implementado)
- Aviso de opt-out na primeira mensagem (gap registrado no BACKLOG, ausente em `gerar_resposta_kalel`)

## 7. Métrica de sucesso

| Métrica | Evidência | Meta |
|---|---|---|
| Tenant novo sem mudança de código | resolução 100% por API | 100% |
| Conversa derrubada por dependência fora do ar | Brainiac, custo, mídia e transbordo são best-effort | 0 |
| Cliente sem resposta | `FALLBACK_RESPOSTA` em qualquer exceção | 0 |
| Falha de envio silenciosa | `_alertar_telegram` (hoje no-op: vars vazias) | 0 |
| Preço inventado pelo modelo | regra "NUNCA informe preços que não estejam nesta lista" | 0 |
| Saudação repetida na mesma conversa | bloco de apresentação só quando `len(historico) <= 1` | 0 |

## 8. Requisitos de alto nível

**Funcionais:** ver [[requisitos-funcionais-kalel]] — 5 módulos, 21 RFs.

**Não funcionais:**
- `temperature: 0.1` — respostas conversacionais estáveis, mas não robóticas
- Timeout de 20s no OpenRouter; 5s no Kernel; 3s no Brainiac; 20s na busca de mídia
- Máximo de 5 rodadas de tool-calling por mensagem (proteção contra loop)
- Toda integração secundária é best-effort: falha vira `print()` no log, nunca exceção propagada
- `Content-Type: application/json; charset=utf-8` explícito na resposta HTTP (clientes como Invoke-RestMethod do PowerShell 5.1 corrompem acento sem isso)
- Container roda como usuário não-root (`appuser`), com healthcheck a cada 30s
- `.env` local à pasta, fora do git

[[indice-kalel]]
