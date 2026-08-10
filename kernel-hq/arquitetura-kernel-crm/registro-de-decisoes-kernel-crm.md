---
status: stable
domain: kernel-crm
source: claude
created: 2026-07-22
updated: 2026-07-22
owner: willians
---

# Registro de Decisões — Kernel v2: CRM Conversacional Multi-Tenant

> Referência: [[prd-kernel-crm]] | [[arquitetura-kernel-crm]]

Decisões cronológicas que moldaram o sistema. Cada entrada registra o contexto, a alternativa descartada e o impacto.

---

## D-01 — Evoluir o protótipo Python existente, não criar projeto novo

**Data:** 2026-07-22
**Decisão:** evoluir `kernel-hq-prospeccao/` (Nível 0, já com 1829 leads reais) em vez de criar um sistema novo do zero.
**Contexto:** um protótipo conversacional foi validado nesta mesma sessão em Node.js (`sdr-crm/`) antes de mapear a arquitetura oficial da Órbita. Ao descobrir que já existia um sistema Python real com dado de produção parcial, a escolha de criar mais um projeto do zero foi descartada.
**Alternativa descartada:** criar `sdr-crm-py/` ou similar, isolado, e migrar/importar os 1829 leads depois. Descartado porque duplicaria a fonte de verdade e adiaria a migração real sem necessidade.
**Impacto:** os 1829 leads nunca saíram do arquivo `orbita_black.db` original — só o schema evoluiu.

---

## D-02 — Padrão de multi-tenant simples (tenant_id + tenants_config), não Postgres/RLS

**Data:** 2026-07-22
**Decisão:** replicar o padrão já usado por `orbita-pulsar` e `orbita-quasar` (`tenant_id` TEXT + tabela `tenants_config` com feature flags, tudo em SQLite).
**Contexto:** existe um padrão mais robusto disponível (template RLS do framework AIOX, `.aiox-core/product/templates/tmpl-rls-tenant.sql`, e já implementado de fato em `sistema-orbita-whitelabel` com Postgres/Supabase). Introduzir um terceiro padrão de multi-tenant no ecossistema fragmentaria a manutenção.
**Alternativa descartada:** Postgres + RLS nativo (padrão do AIOX/whitelabel). Descartado por consistência com os agentes-irmãos — nenhum deles usa Postgres hoje, e migrar só o Black criaria um outlier.
**Impacto:** sem isolamento real de segurança entre tenants (aceito como risco de fase de desenvolvimento, mesmo risco documentado por Pulsar/Quasar). Migrar pra Postgres/RLS fica como gatilho explícito para quando houver 2º tenant real pagante.

---

## D-03 — Incorporar qualificação + agendamento no Black, não delegar pra Pulsar/Quasar

**Data:** 2026-07-22
**Decisão:** o Black evoluído ganha o loop de tool-calling completo (qualificação conversacional + agendamento com persistência real) dentro dele mesmo.
**Contexto:** investigação do código real de Pulsar e Quasar mostrou que a "qualificação" do Pulsar é parsing de tag de texto (`##META##{...}` dentro da resposta do modelo, não tool-calling) e o "agendamento" do Quasar é uma lista Python em memória (zera a cada restart, sem persistência). Nenhum dos dois cobre de forma robusta o que o Black precisava.
**Alternativa descartada:** manter o Black restrito a disparo+classificação (Nível 0 puro) e integrar via chamada HTTP com Pulsar/Quasar para qualificação/agendamento. Descartado pelo tamanho do retrabalho necessário nos dois (corrigir o parsing de tag e adicionar persistência real) só para depois orquestrar 3 serviços.
**Impacto:** sobreposição conceitual conhecida e aceita entre Black e Pulsar/Quasar — decisão de aposentar ou não os outros dois fica para depois, não bloqueou esta evolução.

---

## D-04 — Portar painel e agente do protótipo Node, depois descontinuar o Node

**Data:** 2026-07-22
**Decisão:** copiar `sdr-crm/public/{index.html,style.css,app.js}` quase literalmente pra `kernel-hq-prospeccao/static/`, portar a lógica de `lib/claudeAgent.js` pra `services/llm_agent.py`, e parar de manter o projeto Node.
**Contexto:** o protótipo Node validou visualmente (kanban, cores semânticas, drag-and-drop, busca, chat de teste) e funcionalmente (tool-calling real com Anthropic e OpenRouter) o design antes de qualquer decisão de arquitetura oficial ser mapeada.
**Alternativa descartada:** manter os dois projetos em paralelo. Descartado porque duas implementações do mesmo produto em linguagens diferentes multiplicam manutenção sem benefício.
**Impacto:** processos Node (`server.js`) encerrados ao final desta sessão. O painel em Python é funcionalmente idêntico, só trocando a URL base (`tenant_id` como query/body extra).

---

## D-05 — `phone` não é `UNIQUE` (achado nos dados reais)

**Data:** 2026-07-22
**Decisão:** a coluna `leads.phone` não tem constraint `UNIQUE`; unicidade de negócio fica em `(tenant_id, email)`.
**Contexto:** inspeção do banco real antes da migração encontrou 30 grupos de telefone duplicado nos 1829 leads, com formatos inconsistentes. Um `UNIQUE` quebraria o `INSERT ... SELECT` da migração.
**Alternativa descartada:** limpar/deduplicar telefones antes de migrar. Descartado porque decidir qual registro é o "correto" em cada duplicata é uma decisão de negócio, não técnica — não deveria ser tomada silenciosamente durante uma migração de schema.
**Impacto:** `phone_normalized` (dígitos-only, prefixo `55`) foi criado como coluna auxiliar de lookup, não como chave de unicidade.

---

## D-06 — Gap de produto descoberto: nada existe para o que o Black efetivamente venderia

**Data:** 2026-07-22
**Decisão:** registrar formalmente que os dois produtos que dariam substância à qualificação feita pelo Black — **Produto A** (robô de atendimento a alunos via WhatsApp, respondendo dúvidas sobre o conteúdo específico das plataformas de curso) e **Produto B** (agente de inteligência de dados varrendo Kiwify, Hotmart, The Members, Astron Members) — **não existem em nenhum lugar do ecossistema hoje**, e a decisão consciente é **não implementá-los nesta sessão**.
**Contexto:** verificado em código (não só documentação): `orbita-horizon` tem a infraestrutura de conversa WhatsApp multi-tenant + validação de aluno por e-mail, mas o "conhecimento" é um texto de FAQ institucional escrito à mão — zero estrutura para conteúdo de curso. `orbita-insight` e `orbita-cortex` são ambos camada de decisão pura: recebem métricas já prontas via HTTP e devolvem texto/classificação — nenhum dos dois tem client, scraper, webhook receiver ou SDK para qualquer uma das 4 plataformas de infoproduto. Grep amplo no workspace não encontrou nenhuma integração real, só menções em documentação de arquitetura e na planilha de carteira de clientes (dado comercial, não técnico).
**Alternativa descartada:** começar a construir um dos dois produtos nesta sessão. Descartado explicitamente pelo usuário — "não vamos implementar nada agora... nos próximos dias criaremos os agentes."
**Impacto:** risco de negócio real e documentado — o Black consegue prospectar e qualificar de verdade, mas se um lead qualificar rápido e pedir a demonstração prometida ("conversarmos 5 minutos pra eu te mostrar como aplicar isso"), não há produto pronto pra mostrar. Horizon é o ponto de partida mais próximo para o Produto A (reaproveita toda a infra de conversa); Produto B exigiria construir a camada de coleta do zero — nenhuma peça reaproveitável foi encontrada.

---

## D-07 — `.env` no diretório do projeto (supera D-07 do PRD do Nível 0)

**Data:** 2026-07-22
**Decisão:** `OPENROUTER_API_KEY`/`ANTHROPIC_API_KEY` carregadas de `kernel-hq-prospeccao/.env` (mesmo diretório do projeto), não de um `.env` compartilhado na raiz do workspace.
**Contexto:** o PRD original ([[../arquitetura-prospeccao/registro-de-decisoes-prospeccao|D-07 do Nível 0]]) definia `.env` dois níveis acima, na raiz do workspace, para compartilhar a chave entre projetos. Nesta evolução, cada projeto Python do ecossistema (Horizon, Pulsar, Quasar, Cortex, Insight) já mantém seu próprio `.env` local — a chave real fornecida pelo usuário nesta sessão foi colocada diretamente no `.env` do próprio `kernel-hq-prospeccao/`.
**Alternativa descartada:** manter o padrão de `.env` compartilhado na raiz. Descartado por consistência com os demais projetos do ecossistema, que já não seguem esse padrão.
**Impacto:** cada projeto tem sua própria chave configurável de forma independente — troca de chave em um projeto não afeta os outros.

---

## D-08 — Distinção estrutural entre erro de rede e erro de API

**Data:** 2026-07-22
**Decisão:** `LLMNetworkError` (falha de rede/DNS/timeout → HTTP 503) e `LLMAPIError` (erro retornado pela API → HTTP 502) são exceções separadas, nunca capturadas juntas nos routers.
**Contexto:** no protótipo Node desta mesma sessão, um `ETIMEDOUT` de rede genuíno (falha momentânea de conectividade do ambiente) foi reportado ao usuário como se fosse "erro de chave inválida" — a mensagem genérica do endpoint sugeria isso explicitamente. Causou confusão real e precisou de investigação pra esclarecer.
**Alternativa descartada:** um `except Exception` genérico com mensagem única. Descartado porque foi exatamente esse padrão que gerou a confusão anterior.
**Impacto:** testado nesta sessão com os dois cenários reais — chave inválida retornou 502, host inexistente retornou 503. O chamador (painel ou WhatsApp) sempre sabe se deve reconfigurar credencial ou só tentar de novo.

---

## D-09 — Evolution API self-hosted via Docker, executada e validada contra tráfego real

**Data:** 2026-07-23
**Decisão:** subir o Evolution API v2.3.7 (Docker: API + Postgres + Redis dedicados, porta 8081) como o gateway de WhatsApp do Black, conforme a Opção A já decidida em `kernel-hq-arquitetura/08-modulo-de-inteligencia-artificial-e-agentes.md`. Instância `kernel-hq` criada, pareada por QR code e testada ponta a ponta.
**Contexto:** o usuário comprou um número virtual no **br.did** especificamente para esse fim. A decisão de usar Evolution API já existia como estratégia documentada, mas nunca tinha sido executada — não havia nenhuma instância rodando em lugar nenhum do workspace antes desta sessão. Testou-se primeiro com um número pessoal (desconectado ao final da sessão) para não arriscar o número comercial antes de confirmar que o parser do payload funcionava.
**Alternativa descartada:** nenhuma alternativa de infraestrutura foi considerada — a escolha do provedor (Evolution API) já estava decidida; o trabalho desta sessão foi puramente de execução (deploy, geração da `AUTHENTICATION_API_KEY`, criação de instância, configuração de webhook).
**Impacto:** o parser de `messages.upsert` em `services/whatsapp_evolution.py`, que estava explicitamente marcado no código como "não validado contra uma instância real", foi confirmado correto contra tráfego real — não precisou de ajuste. Fluxo completo validado múltiplas vezes: WhatsApp → webhook → cria/atualiza lead → agente responde com tool-calling → grava interação → responde de volta no WhatsApp, incluindo um funil completo até `stage: reuniao_marcada`. Pendência: reconectar a instância com o número do br.did (produção), não o número pessoal usado no teste.

---

## D-10 — Rastreamento de tokens por interação + prompt caching (Anthropic `cache_control`)

**Data:** 2026-07-23
**Decisão:** adicionar `prompt_tokens`/`completion_tokens` em `interactions` (migração idempotente em `database.py`) para custo real por resposta, e implementar prompt caching nos dois provedores (`services/llm_agent.py`) — cacheia system prompt + schema de tools (prefixo compartilhado entre todos os leads do mesmo tenant) e o histórico incremental de cada conversa.
**Contexto:** ao confirmar gasto no OpenRouter (~$0,10 na semana), uma conversa de teste de 9 respostas consumiu ~29.850 tokens — analisado e identificado que o custo alto vinha de reenviar system prompt + schema de tools completo + histórico inteiro em toda chamada, sem cache, um padrão que piora progressivamente conforme a conversa cresce e que se multiplica com múltiplos leads simultâneos.
**Alternativa descartada:** trocar de modelo (ex.: Haiku) como primeira resposta ao custo. Descartado como primeira ação — precisaria validação de qualidade antes de forçar um modelo mais barato; caching ataca a causa raiz (reenvio redundante) sem trade-off de qualidade, então veio primeiro.
**Impacto:** implementado nos dois paths (Anthropic nativo via `/v1/messages` e OpenRouter via formato OpenAI, que exige `cache_control` explícito por bloco de conteúdo — um `cache_control` genérico no topo do request não é suficiente e não chega até a Anthropic nesse formato). Validação do hit de cache em produção real ficou pendente — depende de uma nova conversa real após a reconexão do número do br.did (D-09). Análise de preço da OpenRouter feita junto: sem markup de token vs. Anthropic direto hoje, taxa real é só 5,5% na compra de créditos.
