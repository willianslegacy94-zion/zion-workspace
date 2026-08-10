---
status: stable
domain: black
source: claude
created: 2026-07-22
updated: 2026-07-22
owner: willians
---

# PRD — Kernel v2: CRM Conversacional Multi-Tenant

## 1. Contexto

O Kernel nasceu ([[../arquitetura-prospeccao/prd-prospeccao|PRD original]]) como um motor de disparo em lote + classificação de interesse (INTERESSADO/RECUSADO/NEUTRO) sobre uma base de 1829 leads reais (infoprodutores). Era headless, single-tenant, e a "qualificação" terminava na classificação — o transbordo pro time comercial era um gancho de Trello comentado, nunca ativado.

Em paralelo, nesta sessão, foi construído um protótipo separado em Node.js (`sdr-crm/`) para validar rapidamente um agente conversacional completo (tool-calling real, CRM com kanban, chat de teste) sem o peso de decidir arquitetura definitiva primeiro. O protótipo funcionou e foi validado visualmente. Só depois, ao analisar a documentação de arquitetura já existente (`08-modulo-de-inteligencia-artificial-e-agentes.md`), ficou claro que a stack oficial da Órbita é Python + FastAPI + Evolution API — e que já existia uma escada de agentes (Horizon/Pulsar/Quasar) com um padrão de multi-tenant simples e consistente, mas com implementações fracas nos pontos que importam (qualificação do Pulsar é parsing de tag em texto, não tool-calling; agendamento do Quasar é lista Python em memória, sem persistência).

## 2. Problema

**Dor específica:** o Black conseguia prospectar e classificar interesse, mas não tinha como qualificar de verdade nem agendar reunião — a promessa da mensagem fria ("conversarmos 5 minutos") não tinha um fluxo automatizado por trás. E era single-tenant, incompatível com o modelo de negócio (vender o mesmo sistema para outros infoprodutores).

**Como se manifesta:**
- Lead responde "sim, tenho interesse" → sistema só loga e espera ação manual do time comercial
- Nenhum registro estruturado de por que o lead é qualificado (porte, dor, autoridade de decisão)
- Nenhuma forma de agendar reunião com persistência — dependeria de um humano fazer isso fora do sistema
- Schema sem `tenant_id` — cada cliente futuro exigiria um banco/deploy separado

**Por que ainda não foi resolvida:** o protótipo original (Nível 0) foi construído pra validar a hipótese mais barata primeiro (disparo + classificação simples). Qualificação conversacional e agendamento automático são capacidades mais caras de construir corretamente — exigem loop de tool-calling real, não um `if/elif` de classificação.

## 3. Objetivo

Após o sistema evoluído existir:
- Um lead que responde ao disparo é atendido por um agente que qualifica de verdade (porte, dor, autoridade), guiado por um funil de 5 estágios (`novo` → `qualificando` → `reuniao_marcada` → `ganho`/`perdido`)
- O agente agenda reunião com persistência real quando o lead topa um horário — sem depender de handoff manual imediato
- O sistema é multi-tenant desde a base do schema — pronto para operar mais de um cliente sem re-arquitetar
- Existe um painel visual (antes o sistema era 100% headless) — kanban do funil, busca, chat de teste

## 4. Usuário

**Quem:**
- **Willians (operador/vendedor):** aciona disparos, acompanha o funil no painel, recebe leads com reunião já agendada
- **Lead (infoprodutor da base de 1829):** interage via WhatsApp (ou chat de teste no painel enquanto a Evolution API não está pareada)

**Estado no uso:**
- Willians: opera pelo painel visual (`http://127.0.0.1:5000`) em vez de Postman/Insomnia
- Lead: conversa naturalmente, sem saber que fala com um agente orientado por tools

**Contexto:** sistema com painel visual próprio, servido pela mesma API FastAPI (`StaticFiles`). WhatsApp real ainda depende de parear uma instância Evolution API via QR code (passo de infra não coberto por este PRD).

## 5. Hipótese de solução

Evoluir o mesmo projeto Python (não recriar do zero) incorporando: (a) schema multi-tenant (`tenant_id` + `tenants_config`, padrão já usado por Pulsar/Quasar), (b) um agente de IA com loop de tool-calling real (4 tools: `update_lead_stage`, `schedule_meeting`, `add_note`, `escalate_to_human`) suportando Anthropic direto e OpenRouter, (c) três tabelas novas (`leads`, `interactions`, `meetings`) evoluídas do protótipo Node validado nesta sessão, (d) um painel estático (HTML/CSS/JS) portado do mesmo protótipo, servido pela própria API.

**Por que faz sentido:** o protótipo Node já validou que o loop de tool-calling funciona (testado com Anthropic e OpenRouter reais) e que o painel kanban é utilizável. Portar essa lógica para Python evita reinventar o design, e evoluir o Black em vez de criar um projeto novo preserva os 1829 leads reais sem exigir re-importação.

**Risco central:** a Evolution API nunca foi testada contra uma instância real — o parser do webhook é "plausível, não validado". Se o formato real divergir, o webhook de WhatsApp de produção quebra silenciosamente até ser corrigido. Mitigação: `disparar-lote` e `webhook-resposta` (os endpoints que já funcionam com dado real) não dependem do parser da Evolution API — só o webhook de entrada real depende.

## 6. Escopo

**Dentro:**
- Migração do banco real preservando os 1829 leads (backup + verificação + tabela legada intacta)
- Schema multi-tenant: `tenants_config`, `leads`, `interactions`, `meetings`
- Agente de IA com 4 tools, gate de tools por feature flag do tenant, suporte a Anthropic e OpenRouter
- Distinção estruturada entre erro de rede (503) e erro de API (502) — decisão originada de uma confusão real enfrentada com o protótipo Node
- Painel visual (kanban, busca, drag-and-drop, drawer de detalhe, chat de teste)
- Endpoints legados adaptados (`/disparar-lote`, `/webhook-resposta`) rodando o agente completo em vez de só classificar
- Adapter para Evolution API (parser + sender), não validado contra instância real

**Fora:**
- Pareamento real de uma instância Evolution API via QR code (passo de infra interativo, próxima sessão)
- Qualquer mudança em Horizon, Pulsar, Quasar, Cortex, Insight — o Black evolui isolado
- **Produto A (atendimento a alunos sobre conteúdo de curso) e Produto B (inteligência de dados de plataformas de membros — Kiwify, Hotmart, The Members, Astron Members)** — são os produtos que o Black efetivamente venderia ao qualificar um lead, mas nenhum dos dois existe hoje (nem em Horizon/Insight/Cortex, verificado em código). Ver [[registro-de-decisoes-black]] D-06.
- Autenticação real de tenant (hoje é só um campo `tenant_id` no payload, sem JWT/API key) — aceito como risco de fase de desenvolvimento, mesmo padrão de Horizon/Pulsar/Quasar

## 7. Métrica de sucesso

| Métrica | Referência anterior (Nível 0) | Meta (v2) |
|---|---|---|
| Leads com qualificação estruturada | 0 (só classificação de interesse) | Registrada em `notes` + `stage` a cada conversa |
| Reuniões agendadas com persistência | 0 (dependia de handoff manual) | 1 linha em `meetings` por reunião aceita |
| Tenants suportados pelo schema | 1 implícito (sem coluna) | N, com 1 ativo (`orbita`) hoje |
| Operação via painel visual | 0% (100% headless) | Disponível em `http://127.0.0.1:5000` |
| Confusão erro de rede vs erro de API | Ocorreu 1x no protótipo Node desta sessão | 0x — distinção testada com chave inválida (502) e host inexistente (503) |

## 8. Requisitos de alto nível

**Funcionais:**
- Migrar `leads_prospeccao` (1829 linhas) para `leads` multi-tenant sem perda de dado, com script idempotente e reversível
- Rodar o loop de tool-calling completo em `/api/test-chat`, `/api/whatsapp/webhook` e `/api/v1/black/webhook-resposta`
- Servir o painel visual como arquivos estáticos, com `tenant_id` fixo (`orbita`) até existir um segundo tenant real
- Gate de tools (`schedule_meeting`, `escalate_to_human`) por feature flag do tenant

**Não funcionais:**
- SQLite continua suficiente (mesmo raciocínio do PRD original — single-user, baixa concorrência)
- Erros de rede e erros de API nunca retornam a mesma mensagem genérica ao chamador
- Migração de banco nunca destrutiva — dado legado sempre preservado em tabela separada
