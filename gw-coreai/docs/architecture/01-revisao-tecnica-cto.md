# GW CoreAI — Revisão Técnica (Etapa 1)

Papel: revisão crítica como CTO responsável pelo projeto, antes de qualquer código.
Status: primeira etapa concluída. Próxima etapa: arquitetura final consolidada.

---

## Decisões já tomadas (a validar com o time conforme o produto avança)

| Decisão | Escolha | Origem |
|---|---|---|
| WhatsApp | **Evolution API** (wrapper open-source não-oficial sobre Baileys/WhatsApp Web) | Definido por Willians |
| Multi-tenant por usuário | Assumido: 1 usuário → 1 empresa no MVP (mais simples de auditar) | Recomendação assumida, não confirmada |
| Isolamento de dado sensível (clínicas/advocacia) | Assumido: shared-schema + RLS + criptografia de campo no MVP; isolamento dedicado fica para quando houver exigência contratual de cliente enterprise | Recomendação assumida, não confirmada |
| Auth | Assumido: auth próprio (JWT + refresh), não provedor gerenciado | Recomendação assumida, não confirmada |

As três últimas linhas foram assumidas para não travar o andamento — devem ser revisadas explicitamente com o time antes da implementação de cada área.

### Risco aceito: Evolution API para WhatsApp

Evolution API não é a Cloud API oficial da Meta — é um invólucro sobre uma biblioteca não-oficial (Baileys) que emula o WhatsApp Web. Isso é aceitável para validar o produto rápido, mas carrega risco real de **banimento de número sem aviso**, o que é um incidente de produção para qualquer tenant pago.

Mitigação obrigatória, não opcional:
- Toda comunicação com WhatsApp passa por uma interface `WhatsAppProvider` (adapter), nunca chamada direta à Evolution API no código de negócio/domínio.
- Isso permite trocar de instância (ban) ou migrar para Cloud API oficial futuramente sem reescrever o motor de automação, CRM ou agente de IA — só o adapter muda.
- Monitoramento de saúde da conexão (status da sessão) e alerta automático de desconexão/ban por tenant.
- Divulgar para os tenants, no contrato de uso, que o canal de WhatsApp roda sobre integração não-oficial e está sujeito a instabilidade — evita passivo comercial/jurídico se um número cair.

---

## CRÍTICO

**[Multi-tenancy] RLS sozinho não é isolamento suficiente — colide com connection pooling.**
Shared database + shared schema + Postgres RLS via `current_setting('app.tenant_id')` quebra na prática com PgBouncer em modo *transaction pooling* (necessário para escalar com poucos devs/orçamento): a variável de sessão de um tenant pode vazar para a próxima requisição que reusa a mesma conexão física. Resultado possível: request do tenant A lê dado do tenant B.
**Alternativa:** RLS como defesa em profundidade, nunca único mecanismo. Toda query da aplicação também filtra por `tenant_id` explicitamente (repositório/DAO nunca aceita query sem tenant_id no WHERE). `SET` do RLS sempre via `SET LOCAL` dentro de transação explícita, nunca a nível de sessão pooled.

**[LGPD + Segurança] Tratar clínica e barbearia com o mesmo nível de proteção de dado é erro de classificação.**
Dado de saúde é dado sensível (Art. 5º, II LGPD); dado de processo jurídico tem sigilo profissional. Precisa de classificação de campo sensível por tipo/nicho, criptografia em repouso para esses campos específicos (não o banco inteiro), e trilha de consentimento mais rígida para tenants desses segmentos.

**[IA + LGPD + Segurança] Enviar dado de cliente para LLM sem base legal e sem sandbox de ações.**
Dois problemas: (1) *Compliance* — GW CoreAI é operador, tenant é controlador, Anthropic é suboperador; precisa estar em contrato e ser divulgado. (2) *Segurança* — agente de IA com function-calling conectado a ações de escrita (criar/cancelar agendamento, alterar cadastro) exposto via WhatsApp é superfície de prompt injection. Precisa: escopo de ferramentas restrito por conversa, confirmação para ações irreversíveis, log auditável de toda ação tomada pela IA.

**[Integrações] Canal de WhatsApp não-oficial exige adapter e monitoramento — ver seção de decisões acima.**

**[Financeiro] Reaproveitar o "Sistema de Caixa" existente sem tenant_id é risco concreto.**
Antes de reaproveitar esse código no GW CoreAI: auditar se toda tabela tem `tenant_id` e se toda query já está preparada para filtro multi-tenant. Módulo financeiro é o pior lugar para descobrir isso em produção.

---

## IMPORTANTE

- **[Arquitetura]** Modular monolith é a escolha certa para 2 pessoas, mas sem enforcement de fronteira entre módulos (ex. dependency-cruiser) desde o commit inicial, vira acoplamento difícil de desfazer em poucos meses.
- **[Banco de dados]** Toda tabela precisa de `tenant_id` como primeira coluna de todo índice composto desde o dia 1 — sem isso, um tenant grande degrada performance de todos os outros.
- **[Escalabilidade]** Rate limiting por tenant (não só global) na API e na fila de envio de WhatsApp — evita que automação em loop de um tenant afete os demais.
- **[Backup/DR]** Shared schema dificulta restauração granular de um único tenant. Precisa de rotina de export lógico por tenant além do backup físico — também serve para portabilidade LGPD.
- **[Autorização]** RBAC fixo por enum de papel não serve para todos os nichos (advocacia ≠ barbearia). RBAC com permissões por módulo desde o MVP, sem ir para ABAC completo agora.
- **[Observabilidade]** Todo log/métrica taggeado com `tenant_id` desde o MVP — necessário para depurar problema de cliente específico e medir custo real de IA por tenant (base para precificação).
- **[Testes]** Teste automatizado de isolamento entre tenants no CI desde o commit zero — única forma de pegar regressão de isolamento antes de produção.

---

## MELHORIA

- **[Custos/IA]** Usage metering por tenant (tokens/mensagens de IA) desde o início — necessário para precificar plano e identificar tenant estourando custo de LLM.
- **[Auth]** Reavaliar provedor gerenciado (Clerk/WorkOS) vs. auth próprio quando o escopo de multi-tenant estiver mais claro.
- **[API]** GraphQL para dashboards complexos pode entrar depois via BFF; não é bloqueador de MVP.
- **[Automação]** Feature flag por tenant para liberar gradualmente automações e IA.

---

## FUTURO

- Tenant tiering: schema ou banco dedicado para clientes enterprise/regulados.
- Portal de autoatendimento do cliente final.
- Multi-idioma/multi-moeda para expansão fora do Brasil.
- Extração de serviços do monólito (worker de IA, worker de WhatsApp) quando houver gargalo real medido.
- Marketplace de integrações (Google Calendar, gateways de pagamento, ERPs).

---

## Próxima etapa

Consolidar a arquitetura final do GW CoreAI incorporando as decisões acima, cobrindo os 22 pontos solicitados originalmente (visão geral, multi-tenant, módulos, entidades, modelo de dados, autenticação/autorização, API, eventos, automações, WhatsApp, agente de IA, notificações, auditoria, observabilidade, segurança, LGPD, escalabilidade, backup, estrutura de pastas, tecnologias), com MVP e futuro claramente separados.
