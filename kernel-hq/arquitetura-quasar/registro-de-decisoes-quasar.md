---
status: draft
domain: quasar
source: claude
created: 2026-06-25
updated: 2026-08-07
owner: willians
---

# Registro de Decisões — Órbita Quasar

Memória viva do engine. Cada entrada registra uma decisão de arquitetura ou produto:
o que foi decidido, por que e qual o impacto.

---

## FastAPI como framework de API

**Decisão:** FastAPI + Uvicorn em vez de Flask ou outro framework Python.

**Motivo:** Validação automática de payload via Pydantic (`PayloadConversa`), documentação Swagger embutida em `/docs`, performance assíncrona com Uvicorn. O modelo de dados da requisição é simples — FastAPI resolve sem boilerplate.

**Impacto:** `PayloadConversa` valida `tenant_id`, `session_id`, `mensagem`, `nome_cliente` e `email_cliente` automaticamente. Campos sem default (`tenant_id`, `session_id`, `mensagem`) geram HTTP 422 se ausentes.

---

## SQLite como banco de dados

**Decisão:** SQLite em vez de PostgreSQL ou outro banco externo.

**Motivo:** Zero configuração de infra para o MVP. Banco de dados como arquivo único (`orbita_quasar.db`) simplifica deploy e testes locais. Volume de tenants e sessões no MVP não justifica overhead de um banco servidor.

**Revisão:** Migrar para PostgreSQL quando: múltiplas instâncias do servidor precisarem acessar o mesmo banco simultaneamente, ou volume de escritas concorrentes gerar lock contention no SQLite.

---

## Memória de sessão via SQLite (não buffer em memória)

**Decisão:** Histórico de conversa gravado no SQLite, recuperado a cada requisição — em vez de manter estado em memória no processo.

**Motivo:** O endpoint é stateless entre requisições. Guardar histórico em variável de processo quebraria se o servidor reiniciar ou se houver múltiplas instâncias. SQLite garante persistência sem infraestrutura adicional.

**Impacto:** Cada requisição faz 2 escritas (user + assistant) e 1 leitura (`LIMIT 10`) no banco. Custo aceitável para o volume atual.

---

## Feature flags no banco de dados

**Decisão:** `flag_agendamento_ia` e `flag_fechamento_comercial` são colunas booleanas em `tenants_config` — não variáveis de ambiente nem config file.

**Motivo:** Cada tenant tem capacidades independentes. Flags no banco permitem ativar/desativar por tenant sem deploy ou reinicialização do servidor. `INSERT OR REPLACE` no seed garante idempotência.

**Impacto:** Mudança de capacidade de um tenant = `UPDATE tenants_config SET flag_x = 0 WHERE tenant_id = '...'`. Entra em vigor na próxima requisição daquele tenant.

---

## Calendário como mock em memória

**Decisão:** `AGENDA_OCUPADA` como lista Python em `tools/calendar_mock.py` — não integração real com Google Calendar.

**Motivo:** Valida o fluxo completo de Function Calling (2 chamadas ao LLM + execução de tool) sem dependência de API externa. Suficiente para provar o conceito e testar os cenários localmente.

**Custo aceito:** Agendamentos confirmados somem ao reiniciar o processo. Sem durabilidade real.

**Substituição:** Quando integração real for necessária, as funções `checar_disponibilidade_agenda` e `confirmar_agendamento_call` em `calendar_mock.py` são substituídas pelas chamadas à API real. A interface que o LLM enxerga (JSON Schema das tools) não muda.

---

## temperature diferenciada por tipo de chamada

**Decisão:** `temperature = 0.1` na 1ª chamada (decisão de tool), `temperature = 0.2` na 2ª (resposta ao cliente).

**Motivo:** A decisão de acionar uma tool e os argumentos que ela recebe precisam ser determinísticos — temperatura baixa reduz variação. A resposta final ao cliente pode ter mais variação para soar natural.

---

## Limite de 10 mensagens no histórico

**Decisão:** `LIMIT 10` na query de recuperação do histórico.

**Motivo:** Controla o tamanho do contexto enviado ao LLM e o custo de tokens por requisição. 10 mensagens cobrem uma conversa completa de agendamento (saudação → dúvida → verificação → confirmação) com margem.

**Revisão:** Aumentar se conversas longas demonstrarem perda de contexto relevante em produção.

<!-- novas decisões sempre abaixo desta linha -->

## 2026-07-30 — Novo tenant: Lane Confeitaria (`produto == "lane"`), persona "Mel"

**Decisão:** adicionado um terceiro `produto` (além de `thieco` e `whitelabel`): `lane`, pro tenant `lane_confeitaria` (single-tenant, MEI solo, sem múltiplas unidades). Config em `tenants_config` (SQLite local, mesmo padrão do Thieco) — `faq_contexto` vem de `FAQ_LANE_CONFEITARIA` (`database.py`), extraído literalmente de `docs/brand/brand-context.md` e `docs/prd/prd.md` do sistema Lane Confeitaria (sem invenção de regra/preço).

**Ferramentas dedicadas, não reaproveitadas de `TOOLS_DEFINITION`:** `TOOLS_DEFINITION` genérico é pra reunião/mentoria (data+hora única) — domínio incompatível com encomenda de bolo (sabor, peso, data de entrega, sinal). Criado `LANE_TOOLS_DEFINITION` com 4 ferramentas próprias (`consultar_catalogo_bolos`, `consultar_disponibilidade_agenda`, `consultar_cliente_por_contato`, `registrar_pedido`), implementadas em `tools/lane_confeitaria.py`, chamando a API interna real do Lane Confeitaria (`/api/internal/*`, autenticada por `X-Internal-Key` — ver `kernel-hq/arquitetura-lane-confeitaria`). `ferramentas_disponiveis` em `gerar_resposta_quasar` ganhou um branch `if produto == "lane":` antes do `else:` original — Thieco/whitelabel seguem exatamente como estavam.

**Persona "Mel":** a pedido do cliente, o assistente do Lane Confeitaria se chama Mel, nunca se identifica como robô/IA/assistente virtual (nem se perguntado diretamente), e a frase de transbordo é fixa: "Vou confirmar com a Lane e já retorno". Isso está em `FAQ_LANE_CONFEITARIA` (regra de comportamento) e no branch `if produto == "lane":` da saudação inicial em `gerar_resposta_quasar` (`main.py`) — a apresentação hardcoded do Theo/Thieco Leandro foi preservada intacta no `else:`, não alterada.

**Transbordo para humano ainda não implementado pro Lane:** `_acionar_atendimento_humano` recebeu um branch `elif produto == "lane":` que retorna aviso de "não implementado" em vez de chamar o endpoint do Thieco com dado errado (bug que existiria se o branch não fosse adicionado, já que `TOOL_TRANSBORDO` é sempre oferecido a todo tenant). Lane Confeitaria não tem rota `/internal/transbordo` — não fazia parte do escopo pedido pra API interna. Próximo passo, se for necessário: criar essa rota no Lane Confeitaria e implementar o branch de verdade.

**Rede local (Docker Desktop + WSL2) — problema real encontrado:** `host.docker.internal` do container não alcança `localhost:3002` do Lane Confeitaria rodando via `npm run dev` no WSL2, mesmo o Windows enxergando esse endereço (`200 OK` confirmado via PowerShell). Causa: o encaminhamento de porta do WSL2 para o Windows expõe só em `127.0.0.1` do Windows, não nas interfaces que o `host.docker.internal` do Docker Desktop realmente alcança (`192.168.65.254` → connection refused; a rota IPv6 de `host.docker.internal` dá "network unreachable"; o IP da distro WSL2 direto dá timeout — Docker Desktop isola a rede dos containers da distro específica). Correção pendente, não aplicada ainda: `netsh interface portproxy add v4tov4 listenport=3002 listenaddress=0.0.0.0 connectport=3002 connectaddress=<ip-da-distro-wsl2>` num PowerShell **como Administrador** no Windows — exige privilégio que a sessão de IA não tem. Até isso ser feito, as 4 ferramentas foram validadas **fora do container** (Python local, mesma rede do dev server) contra a API real do Lane Confeitaria — funcionaram, incluindo escrita real (`registrar_pedido`) com valor final/sinal corretos.

**Segundo bloqueiro pendente, também fora do meu controle:** `OPENROUTER_API_KEY` está vazia em `Kernel Workspace/.env` (raiz do workspace) — sem ela, `gerar_resposta_quasar` recebe 401 da OpenRouter e cai no `FALLBACK_RESPOSTA` genérico, pra **qualquer** tenant (não é específico do Lane). Uma conversa real ponta a ponta com a Mel só é possível depois de preencher essa chave.

**Impacto no Thieco, verificado com dado real (não só teoria):** rebuild do container (`docker compose up -d --build`) e consulta direta em `tenants_config` confirmaram `sistema_thieco` (mutinga e tambore) intactos, mesmas `flag_agendamento_ia=0` de antes — nenhuma linha foi sobrescrita, só uma nova (`lane_confeitaria`) foi adicionada ao lado.

---

## 2026-08-02 — Bug real e sério corrigido: loop de tool-calling de verdade (não mais 2 chamadas fixas)

**Contexto do bug:** o design original (documentado em `fluxos-conversacionais-quasar.md`, seção "Sequência de 2 chamadas") sempre assumiu **no máximo 1 rodada** de tool-calling por mensagem — 1ª chamada decide/chama tool, tool executa, 2ª chamada gera texto final, **sem `tools` no payload dessa 2ª chamada**. Isso nunca foi um problema pro domínio original (agendamento de mentoria: geralmente 1 tool basta), mas quebrava silenciosamente qualquer fluxo que precisasse de uma tool **depois** de ver o resultado de outra na mesma mensagem — exatamente o caso do Lane Confeitaria: checar catálogo+agenda (1ª rodada) e só DEPOIS, com o resultado em mãos, chamar `registrar_pedido` (precisaria de uma 2ª rodada de tool-calling, que a API nunca ofereceu).

**Sintoma observado repetidamente, com conversa real:** a IA dizia "vou registrar o pedido agora" e nunca chamava a ferramenta de fato — porque fisicamente não podia mais, a 2ª chamada já tinha sido feita sem `tools` no payload.

**Correção:** `gerar_resposta_quasar` (`main.py`) reescrito com um loop de até 5 rodadas — cada chamada ao OpenRouter reenvia `tools`/`tool_choice="auto"`, executa qualquer `tool_calls` retornado, e só encerra quando uma resposta vem sem `tool_calls` (`finish_reason` de texto puro). `executar_tool_call` foi extraído como função só uma vez (antes duplicava lógica dentro do bloco condicional).

**Impacto:** afeta **todos os tenants** (Thieco, whitelabel, Lane), não só o Lane — qualquer conversa que precisasse de 2+ ferramentas em sequência (não só em paralelo na mesma rodada) estava quebrada silenciosamente desde a criação do engine em junho. `fluxos-conversacionais-quasar.md` atualizado pra refletir o comportamento real (loop, não 2 chamadas fixas).

---

## 2026-08-02 — Ferramentas novas pro Lane: silêncio em atendimento humano, progresso automático de atendimento, visão e validação de pagamento

Quatro capacidades novas adicionadas a `tools/lane_confeitaria.py` e ao branch `produto == "lane"` de `main.py`, todas seguindo o princípio já estabelecido de nunca hardcodar dado de negócio do lado do agente (tudo resolvido em tempo de request via `/api/internal/*` do Lane Confeitaria):

- **`cliente_em_atendimento_humano` + silêncio automático:** antes de gerar qualquer resposta pro Lane, `gerar_resposta_quasar` consulta ao vivo se o cartão (Pedido ou Atendimento) desse contato já está na fila marcada como "atendimento humano" — se sim, retorna `None` sem chamar o LLM. Sem estado duplicado do lado do Quasar: assim que a Lane mover o card, a próxima mensagem já reflete isso e a Mel volta a responder sozinha. `/api/v1/quasar/chat` e `/webhook/evolution` tratam `None` como "não enviar nada" (`acao: "ATENDIMENTO_HUMANO_ATIVO"`).
- **`registrar_progresso_atendimento`:** chamada automática (não é tool-call opcional do LLM) a cada mensagem — cria o card leve (`Atendimento`) na 1ª mensagem de um contato novo e avança pra fila "recebe da IA" a partir da 2ª. Decisão de ser automática, não uma ferramenta que o modelo decide chamar: um evento estrutural (1ª vs. N-ésima mensagem) é mais confiável decidido em código do que esperado de uma decisão do LLM.
- **Visão computacional:** `imagem_url` (opcional) em `PayloadConversa` e no payload de `/webhook/evolution` — quando presente, a última mensagem do histórico enviado ao modelo vira um bloco multimodal (`image_url` + texto). Mídia real do WhatsApp buscada via `_extrair_imagem_mensagem` (endpoint `/chat/getBase64FromMediaMessage/{instance}` da Evolution API, já que mídia é criptografada ponta-a-ponta — o webhook só traz metadados).
- **`confirmar_pagamento_sinal`:** a pedido explícito do usuário, esta ferramenta **nunca** marca pagamento como confirmado — só sinaliza (`comprovanteParaValidar`, `resumoComprovante`) pra Lane validar manualmente. Decisão de segurança: conferência visual de IA sobre uma imagem pode ser enganada (comprovante editado), nunca deveria ser fonte de verdade financeira sozinha.

**Validado com dados reais:** silêncio confirmado (nenhuma resposta gravada em `historico_conversas` enquanto o card estava em atendimento humano), leitura de foto de bolo temático real e de comprovante Pix real (incluindo um caso de destinatário incorreto, corretamente não confirmado pela ferramenta).

---

## 2026-08-02 — Calibração de tom da Mel com conversas reais, e regra de "mistura" de registro

Usuário forneceu prints reais de conversas da Lane no WhatsApp (e da IA padrão do próprio WhatsApp Business, que o usuário explicitamente não quer replicar). `FAQ_LANE_CONFEITARIA` (`database.py`) ganhou uma seção de calibragem de tom com exemplos reais (frases curtas, "Perfeito 👍", "Gostaria de fechar?"). A instrução genérica de "adaptação de linguagem" no `system_prompt` (compartilhada por todos os tenants) foi redesenhada de "espelha o cliente, ou usa tom padrão se não estiver claro" para uma mistura constante — a base (jeito de falar do `faq_contexto`) nunca desaparece, só a camada de formalidade/gíria por cima varia.

---

## 2026-08-02 — Correção: `nome_cliente` nunca chegava no webhook real (sempre "Cliente")

Descoberto durante teste real: `webhook_evolution` nunca passava `nome_cliente` pra `gerar_resposta_quasar`, caindo sempre no default genérico `"Cliente"` — mesmo o WhatsApp real trazendo `pushName` no payload (`data.get("pushName")`, nunca lido). Corrigido: `pushName` agora é usado como palpite inicial de nome; `FAQ_LANE_CONFEITARIA` ganhou instrução explícita pra Mel sempre confirmar o nome de verdade do cliente na etapa de fechamento (nome de exibição do WhatsApp pode ser apelido/nome de família, não necessariamente o nome real).

---

## 2026-08-02 — Gap de produção descoberto: `orbita_quasar.db` não é persistido entre rebuilds

`orbita_quasar.db` (SQLite, memória de conversa de **todos** os tenants) está no `.dockerignore` e sem volume no `docker-compose.yml` — cada `docker compose up -d --build` recria o container do zero, apagando todo o histórico de conversa (de todos os tenants, não só Lane). Configuração/dado de negócio de cada sistema-tenant (Postgres deles) não é afetado — só a memória de conversa deste engine. **Não corrigido nesta sessão** (múltiplos rebuilds foram necessários pra iterar rápido nos testes); registrado como item de backlog em `kernel-hq-arquitetura/12-backlog-painel-admin-cortex-quasar.md` — precisa de volume Docker nomeado antes de qualquer deploy real em VPS.

---

## 2026-08-02 — WhatsApp real conectado pro Lane Confeitaria — 3º canal de instância mapeado

Instância `lane_confeitaria` criada na Evolution API compartilhada (mesmo gateway usado por Thieco), webhook configurado pra `http://orbita_quasar:5003/webhook/evolution` (rede Docker `orbita_shared`). `_resolver_origem_cliente` ganhou um branch direto pra `instancia == "lane_confeitaria"` (antes do fallback de prefixo `thieco-`/consulta ao whitelabel), evitando round-trip HTTP desnecessário nesse caso.

**Descoberta operacional importante (não é bug do Quasar, é risco de uso):** conectar um número pessoal de uso ativo faz a Evolution API sincronizar o histórico inteiro da conta (`recv N chats, M contacts` no log) e disparar `messages.upsert` também pra mensagens antigas — risco real de o Quasar tentar processar/responder conversa pessoal não relacionada ao tenant. Recomendação registrada: sempre conectar número dedicado ao negócio.

**Também corrigido nesta integração:** `_extrair_texto_mensagem` não reconhecia `imageMessage` nem sua legenda (`caption`) — qualquer mensagem só-com-foto era ignorada silenciosamente (`"mensagem sem texto (mídia, etc.)"`). Corrigido junto com a adição de visão computacional (ver entrada acima).

---

## 2026-08-05 — Recorrência do incidente de instância travada + causa raiz mais profunda + alerta Telegram

**Recorrência do risco já registrado em 2026-08-02** ("conectar número pessoal de uso ativo... recomendação: sempre conectar número dedicado ao negócio"): dessa vez o incidente foi maior — 5 das 6 instâncias Evolution API da VPS (`thieco-admin`, `academia-sandro-admin`, `jocley-grill`, `lane_confeitaria`, `thieco-mutinga`) ficaram travadas em `connectionStatus: "connecting"` com `disconnectionReasonCode: 401`, porque dois números pessoais/teste de Willians (`5511954079335`, `5511948455946`) estavam vinculados a múltiplas instâncias ao mesmo tempo — escanear um deles numa instância derruba a sessão que esse mesmo número tinha em outra.

**Causa raiz da instância travada (mais profunda do que "reconectar com QR novo"):** `logout`/`restart` via API e até `docker restart` no container `evolution_api` não resolveram sozinhos pra 3 das 5 instâncias. A credencial Baileys morta estava persistida na tabela `Session` do Postgres da Evolution (`sessionId` = FK pra `Instance.id`, coluna `creds`) — o Evolution reautentica sozinho no boot usando essa credencial inválida, sobrescrevendo qualquer correção manual em `Instance.connectionStatus`. Fix real: `DELETE FROM "Session"` pra essas instâncias + `UPDATE "Instance" SET "connectionStatus" = 'close'` + restart do container. Detalhe completo em [[Playbook DevOps - Comandos Docker e Bancos]] (entrada 2026-08-05) e na memória de sessão `evolution-api-vps`.

**Gap descoberto no Quasar durante o diagnóstico:** `_enviar_resposta_whatsapp()` (chamada por `webhook_evolution`) sempre foi "nunca lança" por design — falha no `POST /message/sendText` (ou `/sendMedia`) da Evolution API virava só um `print()`. Como `webhook_evolution` gera a resposta da IA **antes** de tentar enviar, uma instância fechada gastava a chamada de IA (custo real) e ainda assim deixava o cliente final sem resposta nenhuma, sem qualquer sinalização — nem retry, nem fallback, nem alerta.

**Decisão:** adicionar `_alertar_telegram()` em `main.py`, chamada em `_enviar_resposta_whatsapp()` quando `resp.ok` for falso. Notifica o bot `@orbita_alertas_bot` (`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` no `.env` compartilhado) com cooldown de 15min por `instancia`, pra não virar spam enquanto uma instância fica horas/dias fora do ar. Mesmo padrão replicado no Cortex (ver `registro-de-decisoes-cortex.md`, RD-008).

**Não corrigido nesta sessão (pendência real):** ainda não existe retry nem checagem prévia de `connectionStatus` antes de gerar a resposta da IA — o alerta só avisa Willians pra agir manualmente; o custo de IA gasto numa tentativa fadada a falhar continua sendo pago. Considerar como próximo passo se o volume de falhas justificar.

**Reforço da regra operacional:** nunca escanear número pessoal/teste numa instância de cliente em produção — 1 número dedicado real por instância, sempre.

---

## 2026-08-07 — Silêncio por tópico, preço real, e correção de tom pro Theo (produto="thieco")

Motivado por um relato de "Theo não responde" (causa raiz acabou sendo infra — `thieco_db` parado + `DB_HOST` ambíguo entre projetos na rede compartilhada, sem relação com o Quasar em si, ver `Playbook DevOps` e `registro-de-decisoes-thieco.md`), a sessão seguiu com várias melhorias reais no comportamento do Theo, todas em `main.py`/`database.py`:

- **`manter_silencio_mesmo_assunto`** — novo padrão de silêncio, diferente do já existente pra Lane (que silencia a conversa inteira via fila externa). Aqui é silêncio **por tópico**: reconhecido pelo próprio histórico da conversa (a mensagem fixa de transbordo da rodada anterior), sem fila nem estado novo do lado do Quasar. Detalhe de mecanismo em `comportamento-quasar.md` e `arquitetura-tecnica-quasar.md`.
- **`calcular_total_servicos`** — primeira tool do Quasar a substituir dado estático do `faq_contexto` por consulta ao vivo a um sistema-tenant real (`GET /agendamentos/servicos` do sistema-thieco), fora do fluxo de agendamento mock. Achou uma divergência real ao testar (tabela estática dizia Combo Corte+Barba R$79,00; catálogo real é R$80,00) — confirma o valor do padrão "nunca hardcode preço", já vindo do Lane.
- **Saudação com nome do cliente + correção de "primeiro nome só" em código:** a saudação inicial passou a incluir o nome (`"Boa tarde Aline! Aqui é o Theo..."`); um bug real observado depois (pushName "Thiago Leandro" usado por completo, e "Thiago, tudo bem?" repetido em quase toda resposta) levou a duas correções — nome cortado pro primeiro token **em código** (`nome_cliente.split()[0]`, não só via prompt) e regra de tom reescrita pra deixar explícito que nome/saudação aparecem uma vez só, não em toda mensagem.
- **Transbordo sem citar nome do responsável:** mensagem fixa de transbordo deixou de citar "Thieco"/"gerente" nominalmente, virou só "vou chamar o responsável".
- **Horário por unidade:** Mutinga e Tamboré compartilhavam o mesmo bloco de horário no `FAQ_THIECO_COMUM` (com o horário certo só pra Mutinga) — corrigido, cada unidade agora tem seu próprio bloco.

**Testado:** todos os itens reproduzidos ao vivo, local e na VPS de produção (`scp` manual — Quasar não tem git na VPS, ver `Playbook DevOps`), incluindo a conversa exata do print que motivou o fix de nome/repetição.

**Commits (`Kernel Workspace`):** `252957d`, `3c2ffa2`, `3b3454c`, `7800154`. Nenhum toca no branch `produto == "lane"` — trabalho pendente da Lane (topo 3D, PDF, Telegram, bloqueio de número) foi comitado separadamente (`f7ca3bf`, outra sessão) e não foi misturado com os commits do Theo, por pedido explícito do usuário.

**Artefatos atualizados:** `comportamento-quasar.md`, `arquitetura-tecnica-quasar.md`, `registro-de-decisoes-thieco.md`, `Playbook DevOps - Comandos Docker e Bancos.md`.
