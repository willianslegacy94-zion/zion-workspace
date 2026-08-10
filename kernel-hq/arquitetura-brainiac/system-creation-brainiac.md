---
status: experimental
domain: brainiac
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# System Creation Threshold — Kernel Brainiac

As seis perguntas de [[system-creation-threshold]] respondidas antes de abrir a pasta
`arquitetura-brainiac`. Todas as respostas rastreiam para o código real de
`Kernel-brainiac/main.py`, `docker-compose.yml`, `.env` e para `kernel/BACKLOG.md`
(seção "Agentes próprios do Kernel: Brainiac (cérebro/disparos) e Kalel (atendimento)",
2026-08-04 / 2026-08-05).

---

## 1. Qual problema esse sistema resolve?

Os tenants do Kernel dependem hoje do **Cortex** — um serviço compartilhado com
`sistema-thieco` e `lane-confeitaria` em produção — para que notificação por WhatsApp,
relatório sob demanda do gestor e contexto de cliente funcionem.

Isso significa: o produto Kernel não tem agente próprio. Toda evolução do Cortex precisa
carregar simultaneamente a lógica de outros produtos (dicionário fixo de tenants do
thieco, endpoint `/api/v1/cortex/processar` da Holding de mentoria/curso), e qualquer
mudança no Cortex por causa do thieco pode afetar clientes do Kernel — e vice-versa.

> Rastreio: `kernel/BACKLOG.md` — *"dois agentes de IA próprios do Kernel, substituindo
> Cortex/Quasar (hoje compartilhados com sistema-thieco e lane-confeitaria em
> produção)"*; `main.py` linhas 1-9.

---

## 2. Para quem?

**Consumidor direto (máquina):**
- **Kalel** (`Kernel-Kalel/main.py`, `BRAINIAC_URL`, linha 113) — chama
  `GET /api/v1/brainiac/atendimento` para enriquecer a conversa com contexto real do
  cliente.
- **Backend do Kernel** (`kernel/backend/routes/notificacoes.js`) — deve chamar
  `POST /api/v1/brainiac/notificar-admin` para disparar notificação/relatório periódico.
  ⚠️ Hoje esse caller ainda aponta para o Cortex (ver [[registro-de-decisoes-brainiac]],
  RD-010).
- **Evolution API** — entrega mensagens do canal admin em `POST /webhook/evolution`.

**Usuário humano final:** o **admin do tenant** (dono/gestor do estabelecimento), que
pergunta pelo WhatsApp *"como está o faturamento hoje?"* e recebe o relatório formatado.

> Rastreio: docstring de `atendimento_cliente` (*"O Brainiac nunca fala com o cliente
> final; quem consome esta rota é o Kalel"*), `webhook_evolution_admin`,
> `_telefone_e_admin_autorizado`.

---

## 3. Qual é o output esperado?

Três outputs concretos, todos observáveis:

| Output | Rota | Forma |
|---|---|---|
| Contexto do cliente (última visita, total de visitas, `churn_risk`) | `GET /api/v1/brainiac/atendimento` | JSON para o Kalel |
| Mensagem de notificação/relatório entregue no WhatsApp do admin | `POST /api/v1/brainiac/notificar-admin` | Texto via Evolution API |
| Resposta a uma pergunta livre do admin sobre faturamento, produtos, serviços ou estoque parado | `POST /webhook/evolution` | Texto formatado via Evolution API |

O sistema funciona quando o admin pergunta em linguagem natural e recebe o número certo
do tenant certo, sem abrir o painel.

---

## 4. Quais inputs o sistema precisa para funcionar?

**Do mundo real:**
- Uma instância Evolution API nomeada `${slug-do-tenant}-admin`, conectada e pareada ao
  WhatsApp do gestor (`_resolver_tenant_admin` depende do sufixo `-admin`).
- Um usuário `role = 'admin'` ativo com telefone cadastrado no tenant (o Kernel valida em
  `GET /internal/admin-autorizado`).
- Dados de operação já registrados no Kernel (vendas, produtos, serviços, estoque) — o
  Brainiac não gera dado, só pergunta.

**De configuração (`.env` local à pasta):**
`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`,
`WHITELABEL_API_URL`, `INTERNAL_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`
(as duas últimas opcionais — sem elas `_alertar_telegram` vira no-op).

---

## 5. Qual é o primeiro artefato concreto?

Já existe: o **webhook de relatório sob demanda** (`POST /webhook/evolution`) — recebe a
pergunta do admin, resolve o tenant pelo nome da instância, valida autorização, classifica
o pedido via OpenRouter e devolve o relatório formatado pelo WhatsApp.

Testado ponta a ponta contra o backend real do Kernel em 2026-08-05 (`kernel/BACKLOG.md`,
seção "✅ Fork feito e testado localmente"): resolve tenant por slug, checa autorização e
chama OpenRouter; as duas chamadas externas falham exatamente como esperado com as chaves
placeholder (401 da OpenRouter, 404 da Evolution) **sem derrubar o serviço**.

---

## 6. Por que isso é um sistema e não uma pasta de apoio?

Porque é um **serviço deployável independente**, com ciclo de vida próprio:

- Container próprio (`kernel_brainiac`), porta própria (5010), `Dockerfile` e
  `docker-compose.yml` próprios.
- `.env` próprio, com chave OpenRouter **independente** da do Kalel e de qualquer outro
  agente (decisão explícita — ver [[registro-de-decisoes-brainiac]], RD-004).
- Repositório Git próprio desde 2026-08-10 (`kernel-brainiac`, privado).
- Fronteira de responsabilidade clara: é o único componente do Kernel que fala com o
  WhatsApp **do gestor** e o único que interpreta pergunta livre de admin.

Não é suporte ao backend do Kernel: o backend não sabe formatar relatório de WhatsApp nem
interpretar linguagem natural, e o Brainiac não sabe consultar Postgres — cada um tem uma
metade da capacidade.

---

## Ressalva registrada no threshold

O nome "Brainiac" e o rótulo herdado *"cérebro"* do `kernel/BACKLOG.md` **não descrevem o
comportamento real do código**. O que caracteriza o Cortex como cérebro analítico —
`POST /api/v1/cortex/processar`, a tabela `matriz_inteligencia`, a classificação de perfil
de cliente — **não existe no Brainiac**. O único uso de IA aqui é classificar *qual
relatório o admin pediu*.

Papel real, conforme o título declarado da própria aplicação FastAPI
(`"Kernel Brainiac — Notificações & Raio-X do Gestor"`): **mensageiro e roteador de
perguntas do gestor**. Ver [[prd-brainiac]], seção 9.

---

**Threshold:** APROVADO — pasta criada em 2026-08-10, com o código já existente e testado
localmente desde 2026-08-05.

[[indice-brainiac]]
