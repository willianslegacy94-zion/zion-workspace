---
status: experimental
domain: brainiac
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# PRD — Kernel Brainiac

## 1. Contexto

O **Kernel** (produto SaaS multi-tenant de caixa/gestão, antes chamado
`orbita-whitelabel`) precisa de dois canais de WhatsApp para funcionar como produto: um
para falar com o **cliente final** (agendamento/atendimento) e outro para falar com o
**gestor** (notificações, relatórios, raio-X do negócio).

Até 2026-08-05, ambos eram servidos por agentes compartilhados com outros produtos: o
**Quasar** no lado do cliente e o **Cortex** no lado do gestor. Esses dois serviços também
atendem `sistema-thieco` e `lane-confeitaria` em produção, e carregam lógica que nada tem a
ver com o Kernel — dicionário fixo de tenants do thieco, endpoint da Holding de
mentoria/curso, banco SQLite local.

O **Brainiac** é o fork do Cortex feito para o Kernel: o lado gestor, e só o lado gestor.
O **Kalel** (fork do Quasar) é o par dele, no lado cliente.

> Rastreio: `Kernel-brainiac/main.py` linhas 1-9; `kernel/BACKLOG.md`, seção "Agentes
> próprios do Kernel: Brainiac (cérebro/disparos) e Kalel (atendimento)".

---

## 2. Problema

**Dor específica:** o Kernel é um produto vendido a terceiros, mas depende de dois
microserviços que pertencem conceitualmente a outros produtos.

**Como se manifesta:**
- Um bug ou deploy do Cortex motivado por `sistema-thieco` atinge todos os tenants Kernel.
- Onboarding de tenant novo do Kernel dependia de que o Cortex compartilhado estivesse no
  ar e correto.
- Chave de API única compartilhada: consumo de OpenRouter de um produto polui a fatura e o
  rate limit do outro.
- A infraestrutura futura planejada ("VPS nova só com Kernel + os 2 agentes") era
  impossível enquanto o Kernel dependesse de serviços que precisam ficar na VPS antiga.

**Por que ainda não foi resolvida:** o Cortex nasceu antes do Kernel existir como produto
autônomo. Separar exigia um fork completo de microserviço + infraestrutura nova — escopo
grande demais para caber junto com outras entregas (registrado como pendência explícita em
`kernel/BACKLOG.md` em 2026-08-04, executado em 2026-08-05).

---

## 3. Objetivo

Depois que o Brainiac estiver no ar:
- O Kernel tem canal de gestor próprio, sem nenhuma dependência do Cortex.
- Um tenant novo do Kernel funciona **sem mudança de código no agente** — o vínculo
  instância↔tenant é resolvido pela convenção `${slug}-admin` + `GET /internal/tenant-by-slug`.
- O gestor consegue puxar faturamento, produtos mais vendidos, serviços mais realizados e
  estoque parado perguntando em linguagem natural pelo WhatsApp.
- Todo custo de IA gerado pelo agente é atribuído ao tenant correto
  (`agente_custos.agente = 'brainiac'`).
- Falha de entrega no WhatsApp gera alerta ativo no Telegram, não um `print()` silencioso.

---

## 4. Usuário

**Quem:**
- **Admin do tenant (gestor):** único humano que interage. Pergunta pelo WhatsApp e recebe
  relatório. É também quem recebe as notificações automáticas disparadas pelo backend.
- **Kalel (máquina):** consome `GET /api/v1/brainiac/atendimento` antes de responder ao
  cliente final.
- **Backend do Kernel (máquina):** dispara `POST /api/v1/brainiac/notificar-admin`.
- **Willians (operador):** recebe os alertas de falha no Telegram e opera o container.

**Estado no uso:**
- Gestor: no celular, no meio do dia, querendo um número rápido — não vai abrir o painel.
- Kalel: em plena conversa, com orçamento de latência apertado (timeout de 5s na chamada).
- Willians: fora do sistema, reagindo a alerta.

**Contexto:** serviço headless. Sem interface visual, sem tela de administração. Toda a
interação humana acontece dentro do WhatsApp.

> Rastreio: docstrings de `atendimento_cliente`, `notificar_admin` e
> `webhook_evolution_admin`; `_alertar_telegram`.

---

## 5. Hipótese de solução

Um serviço FastAPI **sem banco de dados próprio** que:

1. Recebe a mensagem do gestor via webhook da Evolution API.
2. Descobre de qual tenant é a instância pelo próprio nome dela (`${slug}-admin` →
   `GET /internal/tenant-by-slug`), sem nenhum mapa hardcoded.
3. Valida no Kernel se aquele telefone é o admin daquele tenant — **antes de responder
   qualquer coisa**, inclusive o "não entendi".
4. Usa um modelo barato de IA, com `temperature 0.0`, apenas para traduzir a pergunta livre
   em `{tipo, unidade, periodo_dias}`.
5. Busca o conteúdo real em `GET /internal/relatorio-sob-demanda` — as mesmas consultas do
   relatório periódico.
6. Formata e devolve pela Evolution API.

**Por que faz sentido:** a inteligência de negócio (o que é faturamento, o que é estoque
parado, quem é admin) já existe e é testada no backend do Kernel. Duplicar isso no agente
criaria duas verdades. O Brainiac só faz o que o backend não sabe fazer: entender
linguagem natural e falar WhatsApp.

**Risco central:** o Brainiac depende de três serviços externos simultaneamente (Kernel,
OpenRouter, Evolution). Cada um deles fora do ar degrada uma capacidade diferente. O código
trata todos com `try/except` amplo e resposta graciosa — nenhuma falha externa derruba o
processo, mas também **não há retry automático em nenhum caminho**.

---

## 6. Escopo

**Dentro:**
- `GET /health` — healthcheck (usado pelo `HEALTHCHECK` do Dockerfile).
- `GET /api/v1/brainiac/atendimento` — repasse do contexto de cliente para o Kalel, sem IA.
- `POST /api/v1/brainiac/notificar-admin` — mensageiro puro: recebe texto pronto e entrega
  no WhatsApp do admin.
- `POST /webhook/evolution` — canal admin: interpreta pergunta livre e responde relatório.
- Normalização de DDI (`55`) antes do envio.
- Supressão de eco no self-chat do gestor.
- Alerta no Telegram com cooldown de 15 min por instância.
- Telemetria de custo de IA por tenant.

**Fora:**
- Qualquer conversa com o **cliente final** — isso é do Kalel
  (*"O Brainiac nunca fala com o cliente final"*, docstring de `atendimento_cliente`).
- Acesso direto ao Postgres do Kernel — todo dado vem por HTTP em `/internal/*`.
- Persistência própria de qualquer natureza (sem SQLite, sem `matriz_inteligencia`).
- Classificação de perfil/comportamento de cliente (`/processar` do Cortex) — removido no
  fork por ser produto da Holding, não do Kernel.
- Decisão sobre *o conteúdo* das notificações periódicas — quem gera o texto é o backend.
- Autenticação nas próprias rotas do Brainiac (ver [[arquitetura-brainiac]], seção
  Segurança).
- Retry automático de envio falho.

---

## 7. Métrica de sucesso

| Métrica | Referência | Meta |
|---|---|---|
| Tenants Kernel dependentes do Cortex | 100% hoje | 0% após o cutover (RD-010) |
| Mudança de código para onboarding de tenant novo | zero no Cortex atual (já resolvido por slug) | manter zero |
| Falha de entrega no WhatsApp detectada sem alguém perceber manualmente | incidente real de +1 semana (`thieco-mutinga`, 2026-08-05) | 0 — alerta Telegram em toda falha |
| Resposta a pergunta do admin não autorizada | — | 0 — `fail closed` por padrão |
| Custo de IA atribuído ao tenant correto | não instrumentado antes | 100% das chamadas com `usage` |

> Observação de honestidade: nenhuma dessas metas foi medida com tráfego real ainda — o
> serviço só rodou em teste local com chaves placeholder. Ver seção 10.

---

## 8. Requisitos de alto nível

**Funcionais:** ver [[requisitos-funcionais-brainiac]].

**Não funcionais (todos rastreados a valores literais no código):**
- Timeout de 5s para chamadas ao Kernel (`/internal/*`); 10s para Evolution; 15s para
  OpenRouter; 5s para Telegram.
- `temperature: 0.0` na classificação — mesma pergunta deve gerar a mesma rota de relatório.
- Nenhuma rota pode lançar exceção para o chamador: a Evolution API só espera um 200 rápido.
- Falha de alerta no Telegram é best-effort e nunca propaga (`except: pass`).
- Falha de telemetria de custo nunca afeta o atendimento do admin.
- Container roda como usuário não-root (`appuser`), com healthcheck a cada 30s.
- Porta publicada apenas em `127.0.0.1:5010` — não exposta à rede do host.

---

## 9. Divergência entre o nome e o papel real — achado registrado

O nome "Brainiac" (e o rótulo *"cérebro/disparos"* usado em `kernel/BACKLOG.md`) sugere um
papel analítico equivalente ao do **Cortex**, o "cérebro analítico central" já documentado
em [[indice-cortex]]. **O código não sustenta isso.**

Comparação factual entre `Kernel-brainiac/main.py` e o que [[prd-cortex]] descreve como
essência do Cortex:

| Elemento que define o Cortex como cérebro analítico | Existe no Brainiac? |
|---|---|
| `POST /api/v1/cortex/processar` — ingestão de eventos de plataforma | **Não** — removido no fork |
| Classificação de perfil de cliente via IA (`churn_risk`, `upsell_product`) | **Não** |
| Tabela `matriz_inteligencia` como fonte única de verdade | **Não** — sem banco |
| Acúmulo de LTV | **Não** |

O único uso de IA no Brainiac é `_classificar_pedido_relatorio`, que traduz *"como tá o
faturamento essa semana?"* em `{"tipo": "faturamento", "unidade": null, "periodo_dias": 7}`.
Isso é **roteamento de intenção**, não análise de negócio. O `churn_risk` que o Brainiac
devolve ao Kalel é calculado **no backend do Kernel** por regra determinística fixa
(`LIMITE_DIAS_CHURN = 45` em `kernel/backend/routes/internal.js`), sem nenhuma IA.

O título declarado pela própria aplicação é o mais preciso que existe hoje:

```python
app = FastAPI(title="Kernel Brainiac — Notificações & Raio-X do Gestor")
```

**Conclusão documental:** o Brainiac **não é redundante com o Cortex** — ele é o
*subconjunto mensageiro* do Cortex, isolado para o Kernel, com o núcleo analítico
deliberadamente removido. Cortex e Brainiac coexistem por desenho, atendendo produtos
diferentes.

**Não decidido — precisa de confirmação do Willians:** se o Brainiac deve eventualmente
reabsorver alguma capacidade analítica (o que justificaria o nome), ou se o nome é
puramente de marca e o papel permanece "mensageiro + raio-X". Ver
[[registro-de-decisoes-brainiac]], RD-002.

---

## 10. Estado real hoje (2026-08-10)

| Item | Estado |
|---|---|
| Código | Escrito e testado ponta a ponta localmente em 2026-08-05 |
| Container | Sobe saudável via `docker compose up -d --build` |
| Chaves OpenRouter | **Placeholder** — falha esperada com 401 |
| Chave Evolution | **Placeholder** — falha esperada com 404 |
| Repositório Git | Criado em 2026-08-10 (`kernel-brainiac`, privado, branch `main`) |
| Deploy em produção | **Não feito** — VPS nova ainda não decidida/criada |
| Cutover do backend do Kernel para o Brainiac | **Não feito** — `CORTEX_URL` ainda aponta para o Cortex |

Por isso o `status` deste conjunto de artefatos é `experimental`, não `stable`.

[[indice-brainiac]] · [[arquitetura-brainiac]] · [[requisitos-funcionais-brainiac]]
