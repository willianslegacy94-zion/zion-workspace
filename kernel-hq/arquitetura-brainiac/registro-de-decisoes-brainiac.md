---
status: experimental
domain: brainiac
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Registro de Decisões — Kernel Brainiac

Histórico cronológico de decisões técnicas e de negócio que moldaram o Brainiac.
Entradas em ordem crescente — a mais recente sempre no final.

Todas as decisões abaixo foram **reconstruídas a partir de evidência** (comentários e
docstrings de `Kernel-brainiac/main.py`, `docker-compose.yml`, `.env`, `Dockerfile` e da
seção "Agentes próprios do Kernel: Brainiac e Kalel" de `kernel/BACKLOG.md`), não a partir
de memória de conversa. Onde a evidência não permite concluir a motivação, está marcado
como pendente de confirmação.

---

## RD-001 — Fork do Cortex, não rename in-place
**Data:** 2026-08-05
**Contexto:** o Kernel precisava de agente próprio, mas `sistema-thieco` e
`lane-confeitaria` dependem do Cortex em produção.
**Decisão:** copiar `orbita-cortex/` para uma pasta nova (`Kernel-brainiac/`) e simplificar
a cópia. Os originais continuam existindo intactos.
**Alternativas descartadas:** renomear/editar o Cortex in-place — rejeitado por quebrar
tenants em produção.
**Impacto:** dois serviços com código sobreposto convivendo por tempo indeterminado. O
decoupling do Cortex original (remover a branch whitelabel dele) fica condicionado a
Brainiac/Kalel rodarem estáveis com tráfego real — explicitamente **não antes**.
**Rastreio:** `main.py` linhas 1-9; `kernel/BACKLOG.md`, "Plano de execução original",
passos 1 e 6.

---

## RD-002 — Sem persistência própria: nada de SQLite
**Data:** 2026-08-05
**Contexto:** o Cortex mantinha `orbita_cortex.db` com a tabela `matriz_inteligencia`, além
de um dicionário fixo de tenants do thieco.
**Decisão:** o Brainiac não tem banco. *"Tudo que o Brainiac sabe vem do próprio backend do
Kernel via `WHITELABEL_API_URL`/`INTERNAL_SERVICE_KEY`."*
**Consequência direta:** o núcleo analítico do Cortex (`POST /processar`, classificação de
perfil, acúmulo de LTV) **não foi portado** — o Brainiac herdou a metade mensageiro do
Cortex, não a metade cérebro.
**Impacto:** uma verdade só, sem migration nem backup próprios; em troca, indisponibilidade
do Kernel degrada todas as capacidades do agente imediatamente.
**Ponto em aberto — perguntar ao Willians:** o nome "Brainiac" e o rótulo "cérebro" do
BACKLOG sugerem um papel analítico que o código não exerce. É só marca, ou existe intenção
futura de reabsorver capacidade analítica? Ver [[prd-brainiac]] seção 9.
**Rastreio:** `main.py` linhas 3-9; `kernel/BACKLOG.md`, "Simplificações que saíram do
fork"; ausência de `database*.py` e de dependência de banco em `requirements.txt`.

---

## RD-003 — Remoção do endpoint da Holding (`/processar`)
**Data:** 2026-08-05
**Contexto:** `processar_inteligencia_agencia` (`POST /api/v1/cortex/processar`) serve o
produto de mentoria/curso da Holding, sem relação com o Kernel.
**Decisão:** não portar para o Brainiac.
**Impacto:** o Brainiac é exclusivo do Kernel — não atende a Holding nem thieco/lane. Quem
precisar daquele endpoint continua usando o Cortex.
**Rastreio:** `main.py` linhas 4-7; `kernel/BACKLOG.md`, plano de execução, passo 2.

---

## RD-004 — `.env` local e chave de IA independente por agente
**Data:** 2026-08-05
**Contexto:** o Cortex lia o `.env` compartilhado da raiz do workspace, com uma única
`OPENROUTER_API_KEY` para todos os agentes.
**Decisão:** cada agente novo tem `.env` próprio na sua pasta
(`load_dotenv(Path(__file__).resolve().parent / ".env")`) e chave OpenRouter própria. A
chave da Evolution é compartilhada entre Brainiac e Kalel (uma instância Evolution só,
dedicada ao Kernel, diferente da usada por thieco/lane).
**Impacto:** custo e rate limit isolados por agente; em troca, mais chaves para rotacionar.
**Estado:** chaves ainda são placeholder — pendência aberta.
**Rastreio:** `main.py` linha 19; comentários do `.env`; `docker-compose.yml` (`env_file: .env`
com comentário explícito); `kernel/BACKLOG.md`, "Chaves independentes, como pedido".

---

## RD-005 — Zero configuração por cliente: tenant resolvido pelo nome da instância
**Data:** 2026-08-05 (herdado do Cortex e mantido como único caminho)
**Contexto:** o Cortex tinha `TENANT_POR_INSTANCIA_ADMIN` hardcoded para o thieco.
**Decisão:** o Brainiac resolve tudo por convenção — instância `${slug}-admin`, slug
extraído por strip do sufixo, `tenant_id` obtido em `GET /internal/tenant-by-slug`. Idem
para `notificar-admin`, que recebe o **nome da instância** direto no payload, não o
`tenant_id`.
**Impacto:** onboarding de tenant novo é zero-deploy do lado do agente.
**Dependência criada:** a convenção de nome de instância vira contrato. Se o Kernel mudar o
sufixo `-admin`, o Brainiac para de resolver qualquer tenant.
**Rastreio:** `_resolver_tenant_admin`; comentário de `PayloadNotificarAdmin`;
`kernel/backend/routes/internal.js`, comentário de `/tenant-by-slug`.

---

## RD-006 — Autorização fail closed, inclusive no "não entendi"
**Data:** 2026-08-05 (comportamento herdado do Cortex)
**Contexto:** no piloto original houve loop infinito entre dois bots — uma resposta do
agente conversacional recusando assunto fora de escopo caía no canal admin, virava "não
entendi" e voltava.
**Decisão:** `_telefone_e_admin_autorizado` é chamada **antes de qualquer resposta**,
inclusive a mensagem de ajuda. Falha de rede retorna `False` (nega por padrão). Segunda
camada: HTTP 403 do `/relatorio-sob-demanda` também encerra sem responder.
**Alternativa descartada:** checar autorização só antes de gerar relatório — foi
exatamente o que causou o loop.
**Impacto:** durante indisponibilidade do Kernel, o gestor não recebe nem mensagem de erro
— silêncio é o comportamento correto aqui.
**Rastreio:** `_telefone_e_admin_autorizado` e comentário em `webhook_evolution_admin`;
comentário equivalente em `kernel/backend/routes/internal.js`.

---

## RD-007 — Supressão de eco por id de mensagem, não por `fromMe`
**Data:** 2026-08-05
**Contexto:** o canal admin é pareado no número pessoal do gestor. Quando ele escreve para
si mesmo (self-chat), o evento chega com `fromMe = true` — a mesma marca de uma mensagem
enviada pela nossa própria API.
**Decisão:** guardar o `key.id` de tudo que o Brainiac envia
(`IDS_ENVIADOS_PELO_BRAINIAC`). Evento `fromMe` com id conhecido é eco (ignora e descarta o
id); `fromMe` com id desconhecido é pergunta real do gestor.
**Alternativa descartada:** ignorar todo `fromMe = true` — quebraria o self-chat, que é o
modo de uso real.
**Detalhe de implementação:** cap simples de 200 ids com `.clear()` em bloco.
**Limitação conhecida (PA-02/PA-03):** não é LRU e não sobrevive a restart. Sob volume
alto, ou logo após um restart, um eco pode voltar a ser tratado como pergunta.
**Rastreio:** `IDS_ENVIADOS_PELO_BRAINIAC`, `_registrar_envio_proprio`, bloco `fromMe` em
`webhook_evolution_admin`.

---

## RD-008 — Modelo barato com `temperature 0.0` para classificar o pedido
**Data:** 2026-08-05
**Contexto:** a única tarefa de IA do Brainiac é traduzir a pergunta do gestor em
`{tipo, unidade, periodo_dias}`.
**Decisão:** usar `OPENROUTER_MODEL` configurável (default no código:
`openai/gpt-5.6-luna`), com `temperature: 0.0`. Comentário literal: *"não precisa do modelo
mais caro que o Kalel usa pra atendimento de cliente"*.
**Regra de não-invenção embutida no prompt:** o modelo é instruído a **nunca inferir ou
adivinhar uma unidade que não foi dita explicitamente** — na dúvida, `null`, e o relatório
sai de todas as unidades.
**Validação pós-modelo:** `tipo` fora do domínio vira `None`; `periodo_dias` não numérico
vira `1`; `unidade` não é validada localmente porque unidades são dinâmicas por tenant e o
backend já ignora slug inexistente.
**Impacto:** custo baixo por pergunta e roteamento determinístico. Alucinação de tipo é
neutralizada pela validação, não pelo modelo.
**Rastreio:** `OPENROUTER_MODEL` (linhas 28-31), `_classificar_pedido_relatorio`.

---

## RD-009 — Alerta no Telegram com cooldown, herdado do Cortex
**Data:** 2026-08-05
**Contexto:** falha de envio via Evolution sempre foi tratada como "nunca lança" — erro
virava só um `print()` no log do container. Incidente real: `thieco-mutinga` passou mais de
uma semana com a instância desconectada sem ninguém notar.
**Decisão:** portar `_alertar_telegram()` para o Brainiac, com cooldown de 15 min por
instância (`_ULTIMO_ALERTA_TELEGRAM`), acionado nos 4 pontos de falha de envio.
**Alternativas descartadas (no Cortex, aplicáveis aqui):** e-mail via SMTP (sem credencial
configurada em nenhum `.env` do ecossistema); alertar pelo próprio WhatsApp (circular — é o
canal que está falhando).
**Impacto:** continua **sem retry automático** — o alerta só avisa Willians para agir
manualmente.
**Rastreio:** `_alertar_telegram`, `_COOLDOWN_ALERTA_SEGUNDOS = 900`;
[[registro-de-decisoes-cortex]] RD-008.

---

## RD-010 — Cutover do backend do Kernel ainda não feito (decisão pendente)
**Data:** 2026-08-05 (constatado), revisado 2026-08-10
**Contexto:** o Brainiac está implementado e testado, mas o backend do Kernel continua
apontando para o Cortex:
- `kernel/backend/routes/notificacoes.js` → `POST ${CORTEX_URL}/api/v1/cortex/notificar-admin`
- `kernel/backend/services/whatsappService.js` → canal `admin` resolve para `CORTEX_URL`
- `kernel/.env` / `kernel/docker-compose.yml` → `CORTEX_URL=http://orbita_cortex:5000`
- **Não existe `BRAINIAC_URL` em nenhum arquivo do backend do Kernel**

**Situação:** `POST /api/v1/brainiac/notificar-admin` existe, funciona e **não tem
chamador**. O webhook das instâncias `${slug}-admin` na Evolution API também segue
apontando para o Cortex.
**Decisão registrada:** nenhuma ainda — o cutover depende de chaves reais e da definição da
VPS nova.
**Ordem sugerida no BACKLOG (referência, não executada):** subir Kernel (backend+frontend)
primeiro na VPS nova, depois Brainiac/Kalel apontando para ele via `WHITELABEL_API_URL`
interno na mesma rede de containers.
**Impacto se não for feito:** o Brainiac permanece código morto em produção e o Kernel
continua acoplado ao Cortex, mantendo aberto todo o problema descrito em [[prd-brainiac]]
seção 2.
**Rastreio:** `kernel/backend/routes/notificacoes.js:64`,
`kernel/backend/services/whatsappService.js:103`, `kernel/.env:108`,
`kernel/docker-compose.yml:117`; `kernel/BACKLOG.md`, "O que ainda falta".

---

## RD-011 — Sem branding "Orbita" em arquivos novos
**Data:** 2026-08-05
**Contexto:** pedido explícito do Willians — *"não teremos mais orbita"*.
**Decisão:** nenhum arquivo novo do Brainiac usa "Orbita" em nome de app, título, container
ou log (`kernel_brainiac`, `"Kernel Brainiac — Notificações & Raio-X do Gestor"`,
`🧠 BRAINIAC ->`).
**Exceções conscientes:** onde "orbita" ainda aparece — nome do container do backend
(`orbita-test_api`), nome da rede Docker (`orbita_shared`), nome da variável
`WHITELABEL_API_URL` — é infraestrutura/recurso já existente que o Brainiac precisa
referenciar para funcionar hoje. Quando forem renomeados, atualizar o `.env` e os
comentários do `docker-compose.yml` dos dois agentes.
**Rastreio:** `kernel/BACKLOG.md`, "Sem branding 'Orbita' nos arquivos novos";
`docker-compose.yml` do Brainiac.

---

## RD-012 — Repositório Git próprio
**Data:** 2026-08-10
**Contexto:** antes disso o Brainiac vivia como pasta solta dentro do `Kernel Workspace`,
sem versionamento próprio.
**Decisão:** publicar como repositório privado próprio —
`willianslegacy94-zion/kernel-brainiac`, branch `main` desde o início. Dois commits:
commit inicial e `chore: ignora .claude/`.
**Impacto:** `.gitignore` criado protege o `.env` real (que já existia preenchido em
2026-08-10). Deploy futuro pode ser feito por clone/pull em vez de cópia manual de pasta —
diferente do fluxo atual de Cortex/Quasar na VPS.
**Rastreio:** `git log` e `git remote -v` em `Kernel-brainiac/`; informação de criação do
repositório fornecida pelo Willians em 2026-08-10.

---

## Decisões em aberto — precisam do Willians

| # | Questão | Por que importa |
|---|---|---|
| 1 | Autenticar as rotas de entrada do Brainiac antes do deploy público? | Hoje quem alcança a porta 5010 dispara WhatsApp arbitrário via `notificar-admin` (PA-01). A `INTERNAL_SERVICE_KEY` já existe nos dois lados — custo de adoção é baixo |
| 2 | "Brainiac" é só marca, ou o agente deve reabsorver capacidade analítica? | Define se o nome e o rótulo "cérebro" ficam permanentemente divergentes do código (RD-002) |
| 3 | Alerta Telegram evolui para retry automático? | Hoje mensagem perdida é perdida; o alerta só avisa (RD-009) |
| 4 | Quando fazer o cutover `CORTEX_URL` → `BRAINIAC_URL`? | Enquanto não acontecer, o Brainiac não serve ninguém (RD-010) |
| 5 | Kalel bundled no Módulo Base ou módulo destacável? | Pergunta em aberto no `kernel/BACKLOG.md` que afeta o par Brainiac/Kalel na tela de onboarding |

[[indice-brainiac]] · [[prd-brainiac]] · [[requisitos-funcionais-brainiac]] · [[arquitetura-brainiac]]
