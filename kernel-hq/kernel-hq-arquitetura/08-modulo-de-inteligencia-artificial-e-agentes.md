# 07 — Módulo de Inteligência Artificial e Agentes

## Provedor de Modelos: OpenRouter
O sistema utiliza o **OpenRouter** como camada abstrata de LLM, permitindo alternar entre modelos da Anthropic (Claude) e Meta (Llama) sem alterar a estrutura do código.

### 1. Arquitetura do Agente de Alertas (WhatsApp)
- **Gatilhos (Backend):** Ativado em `POST /vendas` (Metas), `POST /gastos` e rotas de fechamento cronometrado.
- **Modelo Utilizado:** `meta-llama/llama-3-8b-instruct` (Custo-benefício otimizado).
- **Objetivo:** Notificar o administrador sobre marcos financeiros e comportamento da equipe em tempo real.

### 2. Arquitetura do Agente de Atendimento (Suporte/CRM)
- **Integração:** Conectado via webhook ao hub de WhatsApp.
- **Acesso ao DB:** Permissão de leitura na tabela `catalogo` e `agendamentos` (horários livres) e escrita restrita a `POST /agendamentos` com status `'agendado'`.
- **Segurança:** O agente jamais possui acesso de escrita ou alteração nas tabelas financeiras de `vendas` ou `gastos`.


### Existem 3 caminhos, cada um com um trade-off diferente:

---
Opção A — Evolution API (recomendado para Brasil)
- Open source, self-hosted, gratuito
- Conecta via QR Code (WhatsApp Web protocol)
- Multi-instância nativa — perfeito para multi-tenant
- Muito usado por SaaS brasileiros
- Trade-off: não é API oficial Meta, pode ser bloqueado por TOS

Opção B — Twilio WhatsApp Sandbox
- Oficial, fácil de testar em minutos
- Webhook simples, sem instalação
- Trade-off: custa por mensagem, número fixo da Twilio em produção

Opção C — Meta Cloud API (WhatsApp Business)
- API oficial Meta, número próprio da empresa
- Requer aprovação do negócio + verificação
- Trade-off: processo burocrático, leva dias para aprovar


###### A Decisão Estratégica: Ir de Opção A (Evolution API)

Para o modelo de negócios da **Kernel**, a **Opção A (Evolution API)** é a única que viabiliza o faturamento recorrente saudável e a escalabilidade rápida dos clientes.

Veja a resposta ideal estruturada para você enviar para o Claude na IDE para ele começar a codar a integração do WhatsApp com base nisso:

> *"Claude, excelente análise de trade-offs. A nossa decisão estratégica para o Kernel será a **Opção A — Evolution API** por três motivos fundamentais:
> 
> 1. **Multi-Tenancy Comercial:** Conseguimos criar uma instância via API para cada cliente (tenant) instantaneamente, permitindo que cada pequeno negócio ou infoprodutor conecte seu próprio chip via QR Code sem burocracia.
>     
> 2. **Margem de Lucro:** Como ela é Open Source e self-hosted, eliminamos os custos por mensagem enviada (taxas da Meta/Twilio), mantendo o custo fixo de tokens (OpenRouter) e VPS.
>     
> 3. **Segurança Jurídica:** Nós já blindamos o nosso contrato de prestação de serviços com os clientes, deixando claro que os riscos de bloqueio ou banimento por algoritmos de terceiros (Meta) são de responsabilidade exclusiva deles pelo uso da ferramenta.
>     
> 
> Sabendo disso, foque em construir as funções de mensageria e conexão de webhooks baseando-se estritamente na documentação e payloads da **Evolution API v1/v2**."*
> 
> 
> ## 🗺️ A Visão Geral do Ecossistema Órbita

O seu projeto foi dividido em duas grandes frentes: a **Esteira Comercial/Atendimento** (dividida em 4 níveis de maturidade para a agência) e a **Esteira de Dados** (dividida entre o seu produto de mercado e o cérebro da agência).

## 🤖 Parte 1: A Esteira de Agentes Conversacionais (A Linha de Frente)

Estes agentes cuidam da comunicação direta via WhatsApp (conectados via Evolution API) e são ativados por **Feature Flags** (Chaves de Ativação) no banco de dados.

### 1. Kernel (Nível 0: Prospecção Ativa)

- **O que faz:** É o motor de crescimento. Ele lê a sua base de dados fria (como a planilha de 1.857 leads), gera abordagens personalizadas e inicia conversas ativas no WhatsApp.
    
- **A Relação dele:** Quando um lead responde demonstrando interesse, ele avisa o sistema e cria um alerta para transbordo (como um card no Trello). Ele entrega o lead "quente" para os próximos estágios.
    

### 2. Órbita Horizon (Nível 1: Suporte Receptivo & FAQ)

- **O que faz:** Atendimento receptivo básico 24/7. Ele responde às dúvidas frequentes sobre o negócio (FAQ) e fornece links importantes (como acesso à área de membros ou recuperação de senha).
    
- **A Relação dele:** Ele carrega o módulo **Zion Informacional**, validando o e-mail do usuário na base para confirmar se ele é um aluno ativo antes de liberar informações sensíveis.
    

### 3. Órbita Pulsar (Nível 2: Qualificação & Automação)

- **O que faz:** Ele une o receptivo com o ativo. Em background, ele analisa as respostas do cliente para extrair dados estratégicos (como faturamento, tamanho da empresa e dores principais) para criar um perfil de qualificação. Além disso, envia documentos/PDFs automaticamente se o cliente solicitar.
    
- **A Relação dele:** Ele possui um endpoint de webhook pronto para receber alertas de sistemas externos (ex: se um ERP avisar que uma fatura venceu, o Pulsar cria o texto de cobrança com o código Pix na hora).
    

### 4. Órbita Quasar (Nível 3: Concierge & Agendamento Autônomo)

- **O que faz:** É o nível de elite. Ele utiliza **Function Calling (Tool Use)**. O Claude 3.5 Sonnet aqui consegue decidir executar funções Python reais em tempo de execução.
    
- **A Relação dele:** Se o cliente VIP pedir para marcar uma mentoria, o Quasar para a conversa, executa a ferramenta de calendário, checa horários livres, faz a reserva e confirma com o cliente no WhatsApp de forma 100% autônoma.
    

## 🧠 Parte 2: A Esteira de Inteligência de Dados (O Back-End)

Aqui estão os cérebros analíticos que interpretam o comportamento dos clientes nas plataformas (Hotmart, Kiwify, etc.) para ditar o que a linha de frente deve fazer.

### 5. Órbita Insight (Seu Produto SaaS de Mercado)

- **O que faz:** Um agente independente vendido como software para infoprodutores. Ele recebe os webhooks de vendas e acessos, e gera relatórios preditivos formatados diretamente para o WhatsApp do produtor.
    
- **Utilização:** Alerta o produtor se um aluno está com alto risco de pedir reembolso (churn) ou se o aluno está engajado e pronto para receber uma oferta mais cara (upsell).
    

### 6. Órbita Cortex (O Cérebro Exclusivo da Agência)

- **O que faz:** Funciona exatamente como o Insight, mas em vez de apenas enviar relatórios para o celular de alguém, ele **salva essas flags operacionais dentro da sua matriz de inteligência de dados**.
    
- **Utilização:** Ele retroalimenta os robôs conversacionais. Se o Cortex detecta que um aluno parou de assistir às aulas, ele ativa uma flag de risco no banco. No milissegundo seguinte, o **Horizon** ou o **Pulsar** sabem que precisam abordar esse cliente com uma linguagem ultra-acolhedora para salvá-lo do cancelamento.
    

## 🔄 Como todos eles trabalham juntos na prática? (O Fluxo Perfeito)

Imagine a jornada de um cliente no seu ecossistema:

1. O **Kernel** prospecta um lead da sua planilha e ele compra o seu curso.
    
2. A Kiwify avisa o **Órbita Cortex**, que registra o cliente no banco de dados e ativa o **Pulsar** para mandar uma mensagem ativa de boas-vindas.
    
3. Passam-se 5 dias, o cliente esquece a senha e chama no WhatsApp: o **Órbita Horizon** entra em ação, pede o e-mail, valida no banco e manda o link de redefinição na hora.
    
4. O cliente consome 80% do curso em tempo recorde: o **Cortex** detecta isso e liga a flag `recomendacao_upsell: 'MENTORIA_VIP'`.
    
5. Quando o cliente chama no WhatsApp para tirar uma dúvida boba, o **Pulsar** lê essa flag, faz uma abordagem comercial sutil e o cliente diz que quer comprar.
    
6. O **Quasar** assume, abre a ferramenta de agenda do Google Calendar, marca a call estratégica de fechamento e envia o link de checkout.

---

## ✅ Status de Implementação — Kernel (2026-07-23)

A decisão estratégica da Opção A (Evolution API) descrita acima **foi executada e validada em produção local** nesta sessão. Registro do que foi de fato construído, testado e confirmado — não é mais só decisão, é execução:

### Infraestrutura subida
- **Evolution API v2.3.7** self-hosted via Docker em `evolution-api/docker-compose.yml` (repo `zion-workspace`, commit `ae99377`) — API + Postgres + Redis dedicados, porta `8081`.
- Instância `kernel-hq` criada, pareada por QR code com um número real e testada ponta a ponta (foi desconectada ao final da sessão para dar lugar ao número comprado no **br.did**, que é o número virtual oficial planejado para produção).
- Webhook da instância aponta para `http://host.docker.internal:5000/api/whatsapp/webhook`, batendo direto no backend `kernel-hq-prospeccao` (FastAPI, porta 5000).

### Integração de código validada
- `services/whatsapp_evolution.py`: o parser do payload `messages.upsert`, que estava marcado no código como **"não validado contra uma instância real"**, foi confirmado correto contra tráfego real — não precisou de ajuste.
- Fluxo completo testado de ponta a ponta múltiplas vezes: mensagem no WhatsApp → webhook → cria/atualiza lead → agente de IA (tool-calling) responde → grava interação → responde de volta no WhatsApp. Uma conversa de teste completou o funil inteiro até `stage: reuniao_marcada`.

### Rastreamento de custo
- `interactions.prompt_tokens` / `interactions.completion_tokens` adicionados ao schema (migração idempotente em `database.py`) — cada resposta do agente agora grava o custo real em tokens, não só o texto.
- **Prompt caching (Anthropic `cache_control`)** implementado em `services/llm_agent.py` para os dois provedores (Anthropic direto e OpenRouter) — cacheia system prompt + schema de tools (compartilhado entre todos os leads do mesmo tenant) e o histórico incremental de cada conversa, para conter o crescimento de custo por mensagem em conversas longas e com múltiplos leads simultâneos. Implementado; validação de cache-hit em produção real ficou pendente para a próxima sessão (precisa do número do br.did conectado de novo).

### Pendências para a próxima sessão
- Reconectar a instância `kernel-hq` com o número do br.did (não com número pessoal de teste).
- Confirmar hit de cache real nos logs (`[llm_agent] cache — ...`) com uma conversa nova.
- Avaliar se cabe tiering de modelo (Haiku para qualificação, Sonnet para momentos de julgamento) — ainda não implementado, só analisado.