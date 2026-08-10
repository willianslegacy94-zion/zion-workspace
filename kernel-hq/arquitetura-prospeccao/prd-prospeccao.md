---
status: stable
domain: prospeccao
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# PRD — Kernel: Motor Ativo de Prospecção

## 1. Contexto

A Kernel possui uma base de 1829 clientes ativos cadastrados em planilha (originalmente 1857, filtrados por email e telefone válidos). Esses clientes já tiveram ou têm relação com o negócio, mas nunca receberam uma abordagem comercial estruturada e automatizada. O processo de prospecção ativa era manual, esporádico e sem rastreio de resposta — dependia de iniciativa individual sem sistema de acompanhamento.

## 2. Problema

**Dor específica:** Ausência de um motor automatizado que converta a base de clientes existente em oportunidades comerciais qualificadas.

**Como se manifesta:**
- 1829 contatos com telefone e email válidos sem abordagem ativa sistemática
- Sem classificação automática de interesse — equipe comercial abordava a todos manualmente sem priorização
- Sem registro de quem foi contactado, quando e qual foi a resposta
- Sem triagem por IA: leads interessados e leads recusados recebiam o mesmo tratamento
- Sem gancho para transbordo humano — quando o lead respondia positivamente, não havia alerta estruturado para o time comercial

**Por que ainda não foi resolvida:** A operação não tinha infraestrutura técnica para automatizar disparos e processar respostas via WhatsApp. A classificação de interesse exigia leitura humana de cada resposta — inviável em escala de 1829 leads.

## 3. Objetivo

Após o motor existir:
- Os 1829 leads são abordados de forma controlada (lotes configuráveis), com mensagem persuasiva e personalizada pelo nome
- Cada resposta recebida é classificada automaticamente por IA (Claude 3.5 Sonnet via OpenRouter) em: INTERESSADO, RECUSADO ou NEUTRO
- Leads INTERESSADOS disparam alerta de transbordo para o time comercial (Trello card ou notificação)
- O banco registra o histórico completo de status de cada lead — rastreio total da fila

## 4. Usuário

**Quem:**
- **Willians (operador do robô):** aciona os disparos, monitora o banco e ativa o transbordo
- **Time comercial do Kernel:** recebe os alertas de leads INTERESSADOS para follow-up humano

**Estado no uso:**
- Willians: técnico-operacional — aciona endpoints via Postman, Insomnia ou integração futura com Evolution API
- Time comercial: receptor — recebe card no Trello ou alerta e entra em contato com o lead qualificado

**Contexto:** sistema headless (sem interface visual), operado via API REST local na porta 5000. Disparos controlados manualmente enquanto a Evolution API não está integrada.

## 5. Hipótese de solução

Um motor de prospecção ativa em Python + FastAPI que mantém fila de leads no SQLite, gera mensagens personalizadas por lote, recebe webhooks de resposta do WhatsApp e usa Claude 3.5 Sonnet (via OpenRouter) para classificar o interesse do lead — redirecionando os INTERESSADOS para o time comercial sem intervenção manual na triagem.

**Por que faz sentido:** a base já existe e está qualificada (contatos com telefone válido da carteira real de clientes). Não é prospecção fria — são clientes que já conhecem o negócio. A IA reduz o gargalo humano de leitura e classificação de respostas.

**Risco central:** a qualidade da classificação depende do prompt do sistema. Respostas ambíguas ou irônicas podem ser classificadas incorretamente. A consequência é baixa — INTERESSADO classificado como NEUTRO apenas atrasa o follow-up, não o elimina.

## 6. Escopo

**Dentro:**
- Importação da base de leads via CSV (`database.py`)
- Motor de disparo em lote via endpoint GET (quantidade configurável por chamada)
- Geração de mensagem personalizada pelo nome do lead
- Webhook POST para receber respostas da Evolution API (WhatsApp)
- Classificação de resposta por IA: INTERESSADO / RECUSADO / NEUTRO
- Atualização de status no banco por resultado da classificação
- Gancho comentado para criação de card no Trello ao detectar INTERESSADO
- Log em console para alertas em tempo real

**Fora:**
- Interface visual (painel, dashboard) — sistema headless por decisão
- Envio real de WhatsApp (integração Evolution API é etapa futura)
- Agendamento automático de disparos (cron) — acionamento manual por enquanto
- Múltiplos canais além de WhatsApp
- Métricas e analytics em tempo real
- Autenticação nos endpoints (sistema interno, sem exposição pública)

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Leads abordados sistematicamente | 0 (processo manual) | 1829 (100% da base) |
| Tempo de classificação por resposta | minutos (leitura humana) | < 2 segundos (IA) |
| Taxa de identificação de INTERESSADOS | sem rastreio | > 0% com alerta imediato |
| Leads sem resposta rastreada | 100% (sem sistema) | 0% após disparo |
| Acionamento comercial para INTERESSADO | manual e tardio | automático em < 5 segundos da resposta |

## 8. Requisitos de alto nível

**Funcionais:**
- Importar leads de CSV com filtro de email e telefone válidos
- Disparar lotes de N leads (parâmetro `limite`) buscando status PENDENTE
- Atualizar status para ENVIADO após geração da mensagem
- Receber webhook com telefone do remetente e texto da mensagem
- Identificar lead pelo telefone no banco
- Classificar resposta por IA e retornar INTERESSADO / RECUSADO / NEUTRO
- Atualizar status do lead com base na classificação
- Ativar gancho de transbordo para INTERESSADO

**Não funcionais:**
- API disponível localmente na porta 5000
- Resposta do endpoint de classificação < 15 segundos (inclui chamada OpenRouter)
- SQLite como banco — zero configuração, portável, suficiente para 1829 leads
- `.env` na raiz do workspace para isolar a chave da API de OpenRouter do código
- Fallback seguro: se OpenRouter falhar, retornar NEUTRO sem quebrar o webhook
