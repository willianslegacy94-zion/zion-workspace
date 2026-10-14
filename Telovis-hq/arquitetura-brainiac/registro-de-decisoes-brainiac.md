---
status: experimental
domain: brainiac
source: claude
created: 2026-08-10
updated: 2026-10-14
owner: willians
---

# Registro de Decisões — Telovis Brainiac

Histórico cronológico de decisões técnicas e de negócio que moldaram o Brainiac.
Entradas em ordem crescente — a mais recente sempre no final.

Todas as decisões abaixo foram **reconstruídas a partir de evidência** (comentários e
docstrings de `telovis-brainiac/main.py`, `docker-compose.yml`, `.env`, `Dockerfile` e da
seção "Agentes próprios do Telovis Barber: Brainiac e Kalel" de `telovis-barber/BACKLOG.md`), não a partir
de memória de conversa. Onde a evidência não permite concluir a motivação, está marcado
como pendente de confirmação.

---

## RD-001 — Fork do Cortex, não rename in-place
**Data:** 2026-08-05
**Contexto:** o Telovis Barber precisava de agente próprio, mas `sistema-thieco` e
`lane-confeitaria` dependem do Cortex em produção.
**Decisão:** copiar `cortex/` para uma pasta nova (`telovis-brainiac/`) e simplificar
a cópia. Os originais continuam existindo intactos.
**Alternativas descartadas:** renomear/editar o Cortex in-place — rejeitado por quebrar
tenants em produção.
**Impacto:** dois serviços com código sobreposto convivendo por tempo indeterminado. O
decoupling do Cortex original (remover a branch whitelabel dele) fica condicionado a
Brainiac/Kalel rodarem estáveis com tráfego real — explicitamente **não antes**.
**Rastreio:** `main.py` linhas 1-9; `telovis-barber/BACKLOG.md`, "Plano de execução original",
passos 1 e 6.

---

## RD-002 — Sem persistência própria: nada de SQLite
**Data:** 2026-08-05
**Contexto:** o Cortex mantinha `orbita_cortex.db` com a tabela `matriz_inteligencia`, além
de um dicionário fixo de tenants do thieco.
**Decisão:** o Brainiac não tem banco. *"Tudo que o Brainiac sabe vem do próprio backend do
Telovis Barber via `WHITELABEL_API_URL`/`INTERNAL_SERVICE_KEY`."*
**Consequência direta:** o núcleo analítico do Cortex (`POST /processar`, classificação de
perfil, acúmulo de LTV) **não foi portado** — o Brainiac herdou a metade mensageiro do
Cortex, não a metade cérebro.
**Impacto:** uma verdade só, sem migration nem backup próprios; em troca, indisponibilidade
do Telovis Barber degrada todas as capacidades do agente imediatamente.
**Ponto em aberto — perguntar ao Willians:** o nome "Brainiac" e o rótulo "cérebro" do
BACKLOG sugerem um papel analítico que o código não exerce. É só marca, ou existe intenção
futura de reabsorver capacidade analítica? Ver [[prd-brainiac]] seção 9.
**Rastreio:** `main.py` linhas 3-9; `telovis-barber/BACKLOG.md`, "Simplificações que saíram do
fork"; ausência de `database*.py` e de dependência de banco em `requirements.txt`.

---

## RD-003 — Remoção do endpoint da Holding (`/processar`)
**Data:** 2026-08-05
**Contexto:** `processar_inteligencia_agencia` (`POST /api/v1/cortex/processar`) serve o
produto de mentoria/curso da Holding, sem relação com o Telovis Barber.
**Decisão:** não portar para o Brainiac.
**Impacto:** o Brainiac é exclusivo do Telovis Barber — não atende a Holding nem thieco/lane. Quem
precisar daquele endpoint continua usando o Cortex.
**Rastreio:** `main.py` linhas 4-7; `telovis-barber/BACKLOG.md`, plano de execução, passo 2.

---

## RD-004 — `.env` local e chave de IA independente por agente
**Data:** 2026-08-05
**Contexto:** o Cortex lia o `.env` compartilhado da raiz do workspace, com uma única
`OPENROUTER_API_KEY` para todos os agentes.
**Decisão:** cada agente novo tem `.env` próprio na sua pasta
(`load_dotenv(Path(__file__).resolve().parent / ".env")`) e chave OpenRouter própria. A
chave da Evolution é compartilhada entre Brainiac e Kalel (uma instância Evolution só,
dedicada ao Telovis Barber, diferente da usada por thieco/lane).
**Impacto:** custo e rate limit isolados por agente; em troca, mais chaves para rotacionar.
**Estado:** chaves ainda são placeholder — pendência aberta.
**Rastreio:** `main.py` linha 19; comentários do `.env`; `docker-compose.yml` (`env_file: .env`
com comentário explícito); `telovis-barber/BACKLOG.md`, "Chaves independentes, como pedido".

---

## RD-005 — Zero configuração por cliente: tenant resolvido pelo nome da instância
**Data:** 2026-08-05 (herdado do Cortex e mantido como único caminho)
**Contexto:** o Cortex tinha `TENANT_POR_INSTANCIA_ADMIN` hardcoded para o thieco.
**Decisão:** o Brainiac resolve tudo por convenção — instância `${slug}-admin`, slug
extraído por strip do sufixo, `tenant_id` obtido em `GET /internal/tenant-by-slug`. Idem
para `notificar-admin`, que recebe o **nome da instância** direto no payload, não o
`tenant_id`.
**Impacto:** onboarding de tenant novo é zero-deploy do lado do agente.
**Dependência criada:** a convenção de nome de instância vira contrato. Se o Telovis Barber mudar o
sufixo `-admin`, o Brainiac para de resolver qualquer tenant.
**Rastreio:** `_resolver_tenant_admin`; comentário de `PayloadNotificarAdmin`;
`telovis-barber/backend/routes/internal.js`, comentário de `/tenant-by-slug`.

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
**Impacto:** durante indisponibilidade do Telovis Barber, o gestor não recebe nem mensagem de erro
— silêncio é o comportamento correto aqui.
**Rastreio:** `_telefone_e_admin_autorizado` e comentário em `webhook_evolution_admin`;
comentário equivalente em `telovis-barber/backend/routes/internal.js`.

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

## RD-010 — Cutover do backend do Telovis Barber ainda não feito (decisão pendente)
**Data:** 2026-08-05 (constatado), revisado 2026-08-10
**Contexto:** o Brainiac está implementado e testado, mas o backend do Telovis Barber continua
apontando para o Cortex:
- `telovis-barber/backend/routes/notificacoes.js` → `POST ${CORTEX_URL}/api/v1/cortex/notificar-admin`
- `telovis-barber/backend/services/whatsappService.js` → canal `admin` resolve para `CORTEX_URL`
- `telovis-barber/.env` / `telovis-barber/docker-compose.yml` → `CORTEX_URL=http://orbita_cortex:5000`
- **Não existe `BRAINIAC_URL` em nenhum arquivo do backend do Telovis Barber**

**Situação:** `POST /api/v1/brainiac/notificar-admin` existe, funciona e **não tem
chamador**. O webhook das instâncias `${slug}-admin` na Evolution API também segue
apontando para o Cortex.
**Decisão registrada:** nenhuma ainda — o cutover depende de chaves reais e da definição da
VPS nova.
**Ordem sugerida no BACKLOG (referência, não executada):** subir Telovis Barber (backend+frontend)
primeiro na VPS nova, depois Brainiac/Kalel apontando para ele via `WHITELABEL_API_URL`
interno na mesma rede de containers.
**Impacto se não for feito:** o Brainiac permanece código morto em produção e o Telovis Barber
continua acoplado ao Cortex, mantendo aberto todo o problema descrito em [[prd-brainiac]]
seção 2.
**Rastreio:** `telovis-barber/backend/routes/notificacoes.js:64`,
`telovis-barber/backend/services/whatsappService.js:103`, `telovis-barber/.env:108`,
`telovis-barber/docker-compose.yml:117`; `telovis-barber/BACKLOG.md`, "O que ainda falta".

---

## RD-011 — Sem branding "Orbita" em arquivos novos
**Data:** 2026-08-05
**Contexto:** pedido explícito do Willians — *"não teremos mais orbita"*.
**Decisão:** nenhum arquivo novo do Brainiac usa "Orbita" em nome de app, título, container
ou log (`telovis_brainiac`, `"Telovis Brainiac — Notificações & Raio-X do Gestor"`,
`🧠 BRAINIAC ->`).
**Exceções conscientes:** onde "orbita" ainda aparece — nome do container do backend
(`orbita-test_api`), nome da rede Docker (`orbita_shared`), nome da variável
`WHITELABEL_API_URL` — é infraestrutura/recurso já existente que o Brainiac precisa
referenciar para funcionar hoje. Quando forem renomeados, atualizar o `.env` e os
comentários do `docker-compose.yml` dos dois agentes.
**Rastreio:** `telovis-barber/BACKLOG.md`, "Sem branding 'Orbita' nos arquivos novos";
`docker-compose.yml` do Brainiac.

---

## RD-012 — Repositório Git próprio
**Data:** 2026-08-10
**Contexto:** antes disso o Brainiac vivia como pasta solta dentro do `TeloVis Workspace`,
sem versionamento próprio.
**Decisão:** publicar como repositório privado próprio —
`willianslegacy94-zion/telovis-brainiac`, branch `main` desde o início. Dois commits:
commit inicial e `chore: ignora .claude/`.
**Impacto:** `.gitignore` criado protege o `.env` real (que já existia preenchido em
2026-08-10). Deploy futuro pode ser feito por clone/pull em vez de cópia manual de pasta —
diferente do fluxo atual de Cortex/Quasar na VPS.
**Rastreio:** `git log` e `git remote -v` em `telovis-brainiac/`; informação de criação do
repositório fornecida pelo Willians em 2026-08-10.

---

## RD-013 — Novo tipo de relatório sob demanda: ticket médio (DRE fica de fora)
**Data:** 2026-08-16
**Contexto:** o Brainiac já respondia faturamento/ranking/estoque parado sob demanda no WhatsApp do admin, mas não sabia responder "qual o ticket médio de hoje". Pedido do Willians incluía explicitamente deixar o DRE de fora — é relatório de dentro da plataforma, não deve virar mensagem de WhatsApp.
**Decisão:** adicionar `ticket_medio` como tipo de relatório, reaproveitando a mesma fórmula já usada em `/relatorios/fluxo-caixa` no backend do Telovis Barber (receita bruta ÷ atendimentos) — sem criar cálculo paralelo.
**Impacto:**
- `TIPOS_RELATORIO` (classificador de intenção do Brainiac) ganhou `ticket_medio`.
- `backend/routes/notificacoes.js` (Telovis Barber) — `GERADORES_POR_TIPO` ganhou `gerarNotifTicketMedio`, usado tanto no relatório sob demanda quanto no gatilho periódico automático.
- Nenhuma mudança no lado do DRE — permanece só acessível dentro do painel, por decisão explícita.
**Status:** aplicado e testado — pergunta real feita pro número do Brainiac em produção ("qual o ticket médio de hoje?"), resposta confirmada.
**Rastreio:** `telovis-barber/backend/routes/notificacoes.js` (`GERADORES_POR_TIPO`), `telovis-barber/backend/routes/relatorios.js` (`fluxo-caixa`, fonte da fórmula).

---

## Nota de rastreio — RD-010 (cutover Cortex→Brainiac), observação factual sem fechar a questão
**Data:** 2026-08-16
Conferido no código do backend do Telovis Barber: o commit `7d0a557` (2026-08-14, mensagem "fix: aponta notificar-admin pro Brainiac + adiciona runbook de deploy em produção") já está na `main`. Hoje `backend/routes/notificacoes.js` tem um comentário explícito dizendo que o nome da env `CORTEX_URL` foi mantido só por compatibilidade e que, em produção, ela aponta pro container do Brainiac — e o `fetch` de fato chama `${CORTEX_URL}/api/v1/brainiac/notificar-admin` (path do Brainiac, não do Cortex). Ao longo desta sessão o Brainiac respondeu perguntas reais no WhatsApp do admin (inclusive o teste da RD-013 acima), então o caminho de `notificar-admin` parece estar de fato cortado pro Brainiac.
Isso NÃO fecha a pergunta #4 da tabela abaixo por dois motivos: (1) não foi possível confirmar o valor real de `CORTEX_URL` no `.env` de produção nesta verificação (só o comentário no código e o comportamento observado); (2) `backend/services/whatsappService.js` mantém `CORTEX_URL`/`QUASAR_URL` como duas variáveis separadas, com um comentário ainda descrevendo "Órbita Cortex"/"Quasar" sem nenhuma menção ao cutover — e o `docker-compose.yml` do Telovis Barber ainda usa os nomes de container antigos como default (`orbita_cortex:5000`, `orbita_quasar:5003`). Ou seja: o caminho específico de notificação do admin (`notificar-admin`) parece cortado na prática, mas a variável/infraestrutura em geral ainda carrega nomenclatura e comentários do Cortex/Quasar antigo, sem confirmação de que TODO o roteamento do canal `admin` (não só esse endpoint) já está 100% no Brainiac.

---

## RD-014 — Chat executivo: pergunta livre do gestor respondida com dados reais
**Data:** 2026-10-09 (contexto estruturado e prompt de "sócio executivo" em 2026-10-12)
**Contexto:** no canal admin, toda mensagem que não era relatório nem meta caía no "não entendi". O gestor queria perguntar livremente ("como foi meu mês?", "onde estou perdendo dinheiro?").
**Decisão:** quando a mensagem não é relatório nem meta, o Brainiac pede ao backend do Telovis Barber um retrato pronto dos números (`GET /internal/brainiac-contexto`) e manda para o LLM com um prompt de consultor financeiro. O LLM só lê números já calculados pelo backend, com as mesmas contas das telas de relatório. Nunca há SQL livre nem acesso ao banco.
**Modelo separado:** o chat usa `BRAINIAC_CHAT_MODEL` (default `openai/gpt-4o-mini`, `temperature 0.3`, teto `BRAINIAC_CHAT_MAX_TOKENS` = 800), e não o `OPENROUTER_MODEL` do classificador (RD-008). A resposta aqui é texto para o gestor ler, não JSON.
**Anti-alucinação:** o prompt proíbe inventar números. O que não está nos dados é respondido com "Não tenho os dados referentes a esta métrica".
**Impacto:** RD-002 continua valendo, porque o Brainiac segue sem banco. Mas o agente passa a ter uma capacidade analítica de fato, o que responde em parte à decisão em aberto #2.
**Rastreio:** `telovis-brainiac/main.py` (`_system_prompt_chat`, `_perguntar_llm`, `_chat_executivo`), `telovis-barber/backend/services/brainiacContexto.js`. Commits `4c7d200`, `f94f63f` (Brainiac) e `aebd7c2` (backend).

---

## RD-015 — Carteira de tokens pré-paga por tenant, bloqueia no zero
**Data:** 2026-10-07 (decisão), 2026-10-09 (código)
**Contexto:** cada pergunta do chat executivo é uma chamada paga ao OpenRouter. Sem controle, um tenant poderia gerar custo ilimitado para a Holding.
**Decisão (do Willians):** saldo pré-pago de tokens por tenant. Saldo zerado **bloqueia** o chat. Isso é diferente do teto de conversas do Kalel, que não tem bloqueio.
- Sem carteira = tenant nunca contratou = chat desligado. O canal admin segue só com relatórios e metas.
- O primeiro crédito cria a carteira e liga o chat.
- O débito é o `usage.total_tokens` devolvido pelo OpenRouter. Ele grava o custo em `agente_custos` e debita a carteira **na mesma transação**, para o extrato e o painel de custo nunca divergirem.
- O saldo pode ficar levemente negativo, porque a última resposta é debitada inteira e o custo exato só é conhecido depois da chamada. O bloqueio vale a partir da pergunta seguinte.
**Rastreio:** `telovis-barber/backend/services/aiTokens.js`, `CREATE_AI_TOKENS` em `models.js`, `POST /internal/ai-tokens/debitar`. Commit `6dc02c0` (backend).

---

## RD-016 — Chat executivo também dentro do sistema web, e ativação pela tela do admin
**Data:** 2026-10-13
**Decisão:** a tela "Brainiac" do Telovis Barber (só admin) usa o mesmo chat do WhatsApp. O navegador fala só com o backend (`POST /brainiac/chat`, autenticado pelo JWT). O backend confere assinatura e carteira, monta os dados só com o `tenant_id` do token e chama `POST /api/v1/brainiac/chat-web`. O débito fica no backend, que tem o banco.
- Diferente do canal WhatsApp, o chat web manda o histórico da conversa (até 8 mensagens `user`/`assistant`, cortadas em 4.000 caracteres cada). O backend descarta qualquer `role` `system` vindo do navegador.
- `chat-web` é a **primeira rota do Brainiac com autenticação própria** (`X-Internal-Key`), porque gasta dinheiro. As demais continuam abertas (PA-01).
- A Holding ativa e recarrega a carteira na edição do tenant, no painel admin, com a permissão `financeiro` (`GET/POST /admin/tenants/:id/ai-tokens`). A tela mostra o saldo e os últimos movimentos.
**Rastreio:** `telovis-brainiac/main.py` (`chat_web`), `telovis-barber/backend/routes/brainiac.js`, `frontend/src/pages/Brainiac.jsx`, `frontend/src/pages/admin/AdminTenantForm.jsx` (`BrainiacTokens`). Commits `7c37511` (Brainiac), `44fd18c` e `b08b627` (Telovis Barber).

---

## RD-017 — Chave OpenRouter de produção trocada após 401 "User not found"
**Data:** 2026-10-14
**Contexto:** no primeiro teste real do chat web em produção (tenant Barbearia Gabriel), toda pergunta voltava "O Brainiac não conseguiu responder agora". O log do Brainiac mostrava `OpenRouter respondeu HTTP 401 ... 'User not found.'`: a chave em uso não pertencia mais a nenhuma conta válida. O resto da cadeia (backend → Brainiac, `INTERNAL_SERVICE_KEY`, rota `chat-web`, carteira com saldo) estava correto.
**Decisão:** gerar uma chave nova no OpenRouter e aplicá-la no `.env` do Brainiac local e da VPS, recriando o container (`docker compose up -d --force-recreate`; `restart` não relê o `.env`). Validado com `POST /api/v1/brainiac/chat-web` 200 nos dois ambientes.
- A chave do Kalel não foi tocada. Ela continua separada, conforme RD-004.
- O Willians optou por **não** rotacionar de novo a chave, mesmo ela tendo passado por um arquivo de texto temporário, que foi apagado.
**Lição operacional:** "não conseguiu responder" no chat = o Brainiac devolveu 502, ou seja, o OpenRouter falhou. "Está fora do ar" = o backend não alcançou o container. O roteiro de diagnóstico está no doc "Troca da chave OpenRouter — Brainiac".
**Rastreio:** `telovis-brainiac/.env` (fora do Git); `.env.bak*` adicionado ao `.gitignore` do Brainiac.

---

## Decisões em aberto — precisam do Willians

| # | Questão | Por que importa |
|---|---|---|
| 1 | Autenticar as rotas de entrada do Brainiac antes do deploy público? | Hoje quem alcança a porta 5010 dispara WhatsApp arbitrário via `notificar-admin` (PA-01). A `INTERNAL_SERVICE_KEY` já existe nos dois lados — custo de adoção é baixo. Desde 2026-10-13 a rota `chat-web` já usa esse esquema (RD-016), que serve de modelo para as demais |
| 2 | "Brainiac" é só marca, ou o agente deve reabsorver capacidade analítica? | Define se o nome e o rótulo "cérebro" ficam permanentemente divergentes do código (RD-002). Parcialmente respondida pelo chat executivo (RD-014): a análise existe, mas sobre números calculados pelo backend |
| 3 | Alerta Telegram evolui para retry automático? | Hoje mensagem perdida é perdida; o alerta só avisa (RD-009) |
| 4 | Quando fazer o cutover `CORTEX_URL` → `BRAINIAC_URL`? | **Parcialmente avançado em 2026-08-14** (commit `7d0a557`) — o endpoint `notificar-admin` já chama o path do Brainiac via a env `CORTEX_URL` renomeada só em comentário, não em código. `whatsappService.js` e `docker-compose.yml` ainda carregam nomenclatura/defaults do Cortex/Quasar antigo, sem confirmação de que o roteamento inteiro do canal `admin` já migrou de fato. Ver nota de rastreio acima (RD-010) |
| 5 | Kalel bundled no Módulo Base ou módulo destacável? | Pergunta em aberto no `telovis-barber/BACKLOG.md` que afeta o par Brainiac/Kalel na tela de onboarding |

[[indice-brainiac]] · [[prd-brainiac]] · [[requisitos-funcionais-brainiac]] · [[arquitetura-brainiac]]
