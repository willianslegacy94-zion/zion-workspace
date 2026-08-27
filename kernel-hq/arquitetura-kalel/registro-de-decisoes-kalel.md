---
status: experimental
domain: kalel
source: claude
created: 2026-08-10
updated: 2026-08-27
owner: willians
---

# Registro de Decisões — Kernel Kalel

Histórico cronológico das decisões que moldaram o Kalel. Entradas novas sempre no **final** do arquivo (ver `system-rules`, seção "ordem-de-entradas-em-logs").

Todas as entradas abaixo foram reconstruídas a partir de evidência real: comentários e docstrings de `Kernel-Kalel/main.py` e `database.py`, `docker-compose.yml`, `.env`, histórico do git e a seção "Agentes próprios do Kernel: Brainiac e Kalel" de `kernel/BACKLOG.md`.

---

## RD-001 — Fork do Quasar, não rename in-place
**Data:** 2026-08-05
**Contexto:** o atendimento por WhatsApp dos tenants do Kernel rodava no Quasar, agente compartilhado com `sistema-thieco` e `lane-confeitaria`, ambos em produção. Evoluir o atendimento do Kernel significava mexer num serviço do qual outros clientes dependem.
**Decisão:** criar `Kernel-Kalel/` como fork do Quasar, exclusivo do Kernel. O Quasar original continua intacto.
**Alternativas descartadas:** renomear/adaptar o Quasar in-place — rejeitado por risco a clientes em produção.
**O que saiu no fork:** `tools/lane_confeitaria.py`, o parâmetro `produto`, o SQLite de config de tenant, o FAQ hardcoded por unidade (`FAQ_THIECO_MUTINGA`, `UNIDADES_INFO`) e `TOOLS_DEFINITION`/calendar_mock (o whitelabel nunca usava — `flag_agendamento_ia` sempre vinha 0).
**Impacto:** o decoupling do Quasar original (remover a branch whitelabel dele) fica pendente e **só deve acontecer depois** de Kalel/Brainiac rodarem estáveis com tráfego real.

---

## RD-002 — Zero configuração de negócio dentro do agente
**Data:** 2026-08-05
**Contexto:** o Quasar guardava config de tenant em SQLite local e FAQ hardcoded por unidade — cada cliente novo era uma alteração de código.
**Decisão:** o Kalel busca 100% do conteúdo de negócio no backend do Kernel (`GET /internal/unidade-atendimento`) a cada mensagem. `_montar_faq` monta o prompt só com os blocos que o admin realmente preencheu.
**Alternativas descartadas:** cache local do pacote de unidade — descartado por simplicidade; a chamada é barata perto dos 20s do LLM e evita invalidação de cache.
**Impacto:** tenant novo entra sem deploy; edição na tela de Configurações vale já na mensagem seguinte. Em contrapartida, o Kernel fora do ar deixa o Kalel sem poder atender (única dependência dura, `HTTPException 404`).

---

## RD-003 — Nome do agente é do tenant, não do produto
**Data:** 2026-08-05
**Contexto:** pedido do Willians registrado no BACKLOG — "o cliente vai falar o nome que deseja e eu posso alterar". Diferente do Brainiac, que é marca fixa do produto.
**Decisão:** `nome_assistente` vem de `unidades.atendimento_ia`; `NOME_PADRAO_AGENTE = "Kalel"` é só o fallback quando o tenant não configurou nada. A saudação inclusive instrui o modelo a trocar gênero/artigo se o nome pedir.
**Pendência conhecida:** não existe campo na tela de Configurações para editar `nome_assistente`/`tom_voz` — hoje só via `PUT /configuracoes/atendimento-ia` (API, sem UI). Gap registrado no `kernel/BACKLOG.md`.
**Impacto:** "Kalel" é nome de documentação e de infraestrutura, não necessariamente o nome que o cliente final vê.

---

## RD-004 — `.env` local por agente, com chave de IA independente
**Data:** 2026-08-05
**Contexto:** todos os agentes da Holding liam o `.env` compartilhado da raiz do workspace, com uma única `OPENROUTER_API_KEY`.
**Decisão:** cada agente do Kernel tem `.env` próprio na sua pasta (`load_dotenv(Path(__file__).resolve().parent / ".env")`), com chave OpenRouter própria. A `EVOLUTION_API_KEY` é compartilhada entre Kalel e Brainiac (uma instância Evolution dedicada ao Kernel).
**Impacto:** custo e limite de rate por agente ficam isolados e auditáveis.
**Estado em 2026-08-10:** `OPENROUTER_API_KEY` e `EVOLUTION_API_KEY` ainda são o placeholder `TROQUE-AQUI`. `INTERNAL_SERVICE_KEY` está preenchida. `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` estão vazios — o alerta é no-op hoje. **Preencher antes do deploy.**

---

## RD-005 — Porta 5013 e rede `orbita_shared`
**Data:** 2026-08-05
**Contexto:** o Kalel chama o Brainiac por HTTP; os dois precisam rodar simultaneamente. Portas 5000/5003/5010 já ocupadas por Cortex/Quasar/Brainiac.
**Decisão:** Kalel em 5013, publicado só em `127.0.0.1`, container `kernel_kalel`, nas redes `default` e `orbita_shared` (externa, compartilhada com o backend do Kernel e o Brainiac).
**Impacto:** nenhuma rota do Kalel é alcançável de fora da máquina hoje — o que também é a única barreira de segurança do webhook. Reavaliar ao publicar atrás de nginx na VPS nova.

---

## RD-006 — Memória curta em SQLite, ordenada por `id`
**Data:** 2026-08-05
**Contexto:** o agente precisa lembrar o que foi dito antes na mesma conversa, mas não é fonte de verdade de nada.
**Decisão:** tabela única `historico_conversas` em `kalel.db`, com leitura das 10 mensagens mais recentes por `ORDER BY id DESC LIMIT 10` (revertido em Python).
**Por que `id` e não `timestamp`:** `CURRENT_TIMESTAMP` do SQLite tem granularidade de 1 segundo — insuficiente para desempatar mensagens seguidas.
**Impacto:** sem volume Docker declarado, recriar o container apaga o histórico. Aceitável enquanto o histórico for só memória curta; virar requisito de auditoria muda a decisão. Ver [[modelo-de-dados-kalel]].

---

## RD-007 — Saudação calculada no código, apresentação só na primeira mensagem
**Data:** 2026-08-05 (refinado até 2026-08-10)
**Contexto:** o modelo não sabe a hora real; e nas primeiras versões o agente repetia "Bom dia" e a apresentação em toda mensagem da mesma conversa.
**Decisão:** `saudacao_por_horario()` calcula em `America/Sao_Paulo` (madrugada 0h-5h59 conta como "Boa noite", não "Bom dia"); o bloco de apresentação só entra quando `len(historico) <= 1`, com instrução explícita de não repetir saudação em nenhum outro ponto da mensagem.
**Impacto:** conversa deixa de soar robótica em turnos seguidos.

---

## RD-008 — Adaptação de linguagem com base fixa + camada variável
**Data:** 2026-08-05
**Contexto:** espelhar o cliente sem virar chatbot genérico.
**Decisão:** regra no system prompt — base imutável (frases curtas, direto ao ponto, o tom cadastrado pelo tenant) somada a uma camada que espelha o registro do cliente naquela conversa (gíria com gíria, formal com formal), sem sacrificar clareza nem as regras de negócio.
**Impacto:** o tom do tenant continua sendo a âncora; a adaptação é ajuste, não substituição.

---

## RD-009 — Alerta no Telegram em falha de envio pela Evolution API
**Data:** 2026-08-05 (padrão herdado do Cortex, ver [[registro-de-decisoes-cortex]] RD-008)
**Contexto:** falha de envio virava só `print()` no log do container. Num incidente real, uma instância ficou mais de uma semana desconectada sem ninguém perceber.
**Decisão:** `_alertar_telegram()` dispara quando o POST para a Evolution API não retorna 2xx, com cooldown de 15min por instância (dicionário em memória).
**Alternativas descartadas:** e-mail via SMTP (nenhuma credencial configurada no ecossistema); alertar pelo próprio WhatsApp (circular — é exatamente o canal que falhou).
**Impacto:** sem retry automático; o alerta só avisa o Willians para agir manualmente. Hoje ainda inativo (variáveis vazias).

---

## RD-010 — Visão: foto do cliente vira bloco multimodal
**Data:** 2026-08-05
**Contexto:** cliente manda foto de referência (corte, modelo) — o agente precisava enxergar, não só saber que "uma foto foi enviada".
**Decisão:** buscar o conteúdo real na Evolution API (`/chat/getBase64FromMediaMessage`, mídia do WhatsApp é E2E criptografada) e substituir a última mensagem do histórico em memória por `[{type: "text"}, {type: "image_url"}]` com data URI base64. O campo `imagem_url` do `PayloadConversa` existe para testar esse fluxo sem WhatsApp.
**Impacto:** exige modelo com visão em `OPENROUTER_MODEL`. A imagem não é gravada no banco — só o texto/legenda.

---

## RD-011 — Kalel não cria agendamento; só confirma e cancela (Lógica Anti-No-Show)
**Data:** 2026-08-10
**Contexto:** o piloto de agendamento autônomo herdado do Quasar (checar agenda e marcar do zero via Function Calling) nunca se aplicou ao Kernel — quem cria agendamento é o motor de agenda do backend (`/agendamentos/publico` ou o admin/profissional na tela de Agenda).
**Decisão:** adicionar duas ferramentas — `confirmar_agendamento` e `cancelar_agendamento` — que agem sobre um agendamento **que já existe**, via `/internal/agendamentos/confirmar` e `/cancelar`. Nenhum parâmetro: o backend acha o próximo agendamento futuro `pendente`/`confirmado` pelo telefone do próprio cliente, sem código nem link.
**Por que é a mesma coisa que o link público:** a transição de status é idêntica à de `/agendamentos/publico/confirmar`; o cancelamento libera o horário na hora porque a `EXCLUDE constraint` de sobreposição ignora `status = 'cancelado'`.
**Alternativas descartadas:** dar ao Kalel a capacidade de marcar horário — rejeitado por duplicar a autoridade do motor de agenda (disponibilidade, jornada, sobreposição, profissional).
**Impacto:** o agente age sobre a agenda real sem virar um segundo motor de agenda. Fronteira preservada.

---

## RD-012 — Repositório git próprio para o Kalel
**Data:** 2026-08-10
**Contexto:** o Kalel vivia como pasta solta dentro de `Kernel Workspace`, sem git.
**Decisão:** repositório próprio `github.com/willianslegacy94-zion/kernel-kalel` (privado, branch `main`), com `.gitignore` cobrindo `.env`, `*.db`, `__pycache__`, `.venv` e `.claude/` (memória de agente não pertence ao repo do sistema).
**Impacto:** o agente passa a ter histórico versionado independente do Kernel e do Brainiac — coerente com a decisão de deploy separado na VPS nova.

---

## RD-013 — Criação da pasta de arquitetura em `kernel-hq`
**Data:** 2026-08-10
**Contexto:** Kalel era o único agente do ecossistema sem artefatos de governança — mesma lacuna já identificada e corrigida no `arquitetura-academiasandro`.
**Decisão:** criar `kernel-hq/arquitetura-kalel/` com os 8 artefatos do padrão dos agentes headless da Holding (sem design-system/ui-kit/ux-flows). Sufixo `-kalel`, consistente com horizon/pulsar/quasar/cortex/insight, que não repetem o prefixo do produto.
**Divergências de contrato encontradas durante a documentação (não corrigidas — decisão do Willians):**
1. `_deve_enviar_imagem` lê `info["imagem_url"]`, campo que `GET /internal/unidade-atendimento` não devolve → `sendMedia` nunca dispara. Herança do Quasar.
2. A resposta `ATENDIMENTO_HUMANO_ATIVO` de `/api/v1/kalel/chat` depende de o núcleo retornar `None`, o que hoje não acontece deliberadamente em nenhum caminho.
3. `requests` síncrono dentro de handler `async` — bloqueia o event loop sob concorrência real. Sem impacto no volume atual.
**Pendência de governança:** o **Brainiac** ainda não tem `arquitetura-brainiac/` em `kernel-hq`.

---

## RD-014 — Kalel passa a negociar e criar agendamento, mas só quando o cliente pede um profissional específico por nome
**Data:** 2026-08-16
**Contexto:** a RD-011 (acima) tinha fixado a fronteira "Kalel não cria agendamento, só confirma/cancela" — o motor de agenda do backend seria a única autoridade a marcar horário. O Willians pediu pra revisitar isso em duas rodadas de refinamento na mesma sessão: primeiro pedindo que o Kalel negociasse dia/horário com o cliente e checasse a agenda do barbeiro pedido antes de mandar o link; depois, ao confirmar que "se o cliente confirmar, o Kalel pode agendar"; por fim, restringindo pra só entrar nesse fluxo quando o cliente pede um profissional **pelo nome** — sem preferência nomeada, o comportamento antigo (mandar o link) continua valendo.
**Decisão:** regra final, dois caminhos:
- **Com preferência nomeada** ("quero com o Fulano"): Kalel verifica disponibilidade do profissional pedido, negocia horário na conversa e, se o cliente confirmar, cria o agendamento direto — não manda link nenhum.
- **Sem preferência** ("qualquer um", ou não especificou): comportamento inalterado da RD-011 — nada de negociação, manda o link geral da unidade (que já mostra todos os barbeiros disponíveis).
**Impacto:**
- Novo endpoint `POST /internal/agendamentos/criar` no backend do Kernel — espelha a lógica de `POST /agendamentos/publico/:tenantSlug/criar` (mesma revalidação de disponibilidade antes de gravar), mas resolve o tenant por `tenant_id` (o Kalel já sabe qual é, não passa slug) em vez de slug de URL. `agendamentos.origem` ganhou o valor `'kalel'` no CHECK constraint.
- `GET /internal/unidade-atendimento` ganhou campos aditivos: `equipe_ids` (nome→id de cada profissional) e `precos[].id`/`precos[].duracao_minutos` — sem isso o Kalel não tinha como resolver "Fulano"/"corte simples" em ID real pra chamar os endpoints internos.
- `buscar_tenant()` ganhou um 4º valor de retorno (`info`), carregando esses dois campos — toda chamada existente teve que ser atualizada pra desempacotar 4 valores em vez de 3.
- Novas tools: `verificar_disponibilidade` (GET, expõe `calcularDisponibilidade` já existente no motor de agenda), `criar_agendamento` (POST no endpoint novo acima). Ambas com `profissional_nome` **obrigatório** no schema — reforça a regra "só quando o cliente pede por nome" no próprio contrato da tool, não só no prompt.
- `_resolver_servico`/`_resolver_profissional` (novos) — fuzzy match de nome digitado pelo cliente contra `info['precos']`/`info['equipe_ids']`.
**Por que não é uma contradição da RD-011:** a autoridade de disponibilidade/jornada/sobreposição continua 100% no backend (`calcularDisponibilidade`, mesma função usada pelo link público) — o Kalel não ganhou lógica própria de agenda, só passou a poder *chamar* a mesma lógica que o link público chama, restrito ao caso onde o cliente já decidiu com quem quer marcar. A fronteira "não duplicar o motor de agenda" (razão original da RD-011) segue preservada; o que mudou foi só quem pode acionar a criação num caso específico e mais restrito do que o link geral permitia.
**Status:** aplicado e testado — checagem de disponibilidade real pra data futura, criação de agendamento de teste via endpoint novo, conferência da linha no banco, limpeza do dado de teste.
**Artefatos atualizados:** ver `registro-de-decisoes-kernel` (entrada de 2026-08-16, lista de espera) pra `GET /internal/disponibilidade`, endpoint irmão usado pelo fluxo de lista de espera.

---

## RD-015 — Opt-out de WhatsApp ("responda PARAR") avaliado e recusado por ora
**Data:** 2026-08-16
**Contexto:** foi proposto um design de opt-out — aviso na primeira mensagem do Kalel ("pra parar de receber mensagens automáticas, responda PARAR"), detecção da resposta, e checagem de opt-out antes de qualquer envio automático (lembrete, aniversário, cliente sumido, promoção, lista de espera).
**Decisão:** recusado pelo Willians. Motivo: quer que as mensagens automáticas do Kalel/Brainiac pareçam parte do atendimento humano padrão da barbearia — um aviso explícito de opt-out sinalizaria automação, contrariando essa experiência pretendida.
**Impacto:** nenhum mecanismo de opt-out implementado. Não é recusa permanente — reavaliar se compliance (WhatsApp Business Policy e/ou LGPD) exigir um canal explícito no futuro. Ver `registro-de-decisoes-kernel` (entrada de 2026-08-16) pra o registro espelhado no lado do produto/Política de Privacidade.
**Rastreio:** decisão também salva na memória de longo prazo do Claude Code, pra não ser reproposta sem o Willians pedir de novo.

---

## RD-016 — Trava de "nunca responder em grupo" reforçada no núcleo, não só no webhook
**Data:** 2026-08-27
**Contexto:** Willians reforçou que o Kalel **nunca** pode responder em grupo de WhatsApp, em nenhum tenant, e que isso tem que ser hardcoded. A trava já existia, mas só no `/webhook/evolution` (`remoteJid.endswith("@g.us")` → ignora antes de chamar o modelo). A rota HTTP `/api/v1/kalel/chat`, que aceita `session_id`/`contato_cliente` livres (usada em testes e por qualquer chamador interno futuro), não tinha essa checagem.
**Decisão:** segunda trava no núcleo compartilhado, além da do webhook.
**Impacto:**
- Função nova `_e_grupo_whatsapp(*valores)` em `main.py` e chamada no topo de `gerar_resposta_kalel` (o núcleo que as duas entradas — webhook e rota HTTP — reusam). Se algum identificador parece grupo, retorna `None` — o mesmo sinal de "não responder" que os dois chamadores já tratam (`ATENDIMENTO_HUMANO_ATIVO` / nenhum envio).
- Detecta: `@g.us` em qualquer posição; JID de grupo legado `<dígitos>-<dígitos>`; JID moderno (prefixo `120363` ou string só de dígitos com mais de 15 — telefone E.164 tem no máx. 15). Olha só a cauda depois do último `:` (o `session_id` do webhook vem como `<instancia>:<contato>`).
- Sem config por tenant — regra fixa, igual às outras 3 regras hardcoded do Kalel (ver RD dessa doc e a memória de longo prazo).
**Status:** aplicado e em produção (commit `65831f4` no repo `kernel-kalel`, deploy via `git pull` + `docker compose up -d --build` no container `kernel_kalel`; smoke test: `POST /api/v1/kalel/chat` com `session_id`/`contato` de grupo → `resposta_ia: null`).
**Artefatos atualizados:** memória de longo prazo do Claude Code (`kalel-bot-regras-identidade-data`, regra 1 atualizada).

[[indice-kalel]] · [[prd-kalel]] · [[requisitos-funcionais-kalel]] · [[arquitetura-kalel]]
