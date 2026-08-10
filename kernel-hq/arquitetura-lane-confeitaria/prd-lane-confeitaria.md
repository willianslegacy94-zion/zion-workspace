---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-02
owner: willians
---

# PRD — Lane Confeitaria

## 1. Contexto

A Confeitaria Artesanal da Lane vende bolos e docinhos (brigadeiros por cento) sob encomenda, hoje divulgados via WhatsApp e materiais promocionais informais — cardápio de ~40 sabores de bolo, tabela de docinhos por cento e regras de pedido (sinal de 50%, cancelamento com menos de 24h sem devolução, acréscimos por cartão/glitter/topper). Todo o negócio é operado por Lane sozinha (MEI solo).

O pedido original do kickoff foi replicar padrões já validados em três sistemas do mesmo workspace — CRM em kanban (sdr-crm), agenda com limite diário (academia-sandro) e dashboard financeiro (lanchonete-sistema) — aplicados ao domínio real da confeitaria, com identidade visual extraída de material de divulgação fornecido pela própria cliente (imagens de cardápio).

## 2. Problema

**Dor específica:** ausência de qualquer sistema de gestão — funil de pedidos, capacidade de produção e financeiro dependem de memória e WhatsApp.

**Como se manifesta:**
- Sem funil organizado, negociações de pedido se perdem entre conversas de WhatsApp
- Sem controle de capacidade (5 bolos/dia), risco real de aceitar mais encomendas do que consegue produzir
- Sem CMV calculado, não há certeza de qual sabor realmente dá lucro
- Sem histórico estruturado de clientes, não há como identificar quem compra recorrentemente
- Sem dado de vendas por peso, decisões de produção/insumo são feitas no "achismo"

**Por que ainda não foi resolvida:** ferramentas de CRM/PDV genéricas não têm o vocabulário do negócio (sabor, peso do bolo, sinal, acréscimo de glitter) nem a regra de limite de produção diária embutida.

## 3. Objetivo

Após o sistema existir:
- Lane organiza pedidos num funil kanban com filas que ela mesma nomeia (sem se preocupar com limites técnicos do sistema)
- A agenda impede automaticamente que ela aceite um 6º bolo num dia já cheio
- O sistema calcula sozinho o sinal (50%) e aplica os acréscimos combinados (cartão, glitter, topper)
- O dashboard mostra receita, lucro, CMV por sabor, progresso de meta, clientes recorrentes e ranking de bolos por peso — tudo automático, sem planilha

## 4. Usuário

**Quem:** Lane — dona, única usuária do sistema. Acumula os papéis de atendimento (fecha pedido), produção (confeiteira) e gestão (financeiro).

**Estado no uso:** majoritariamente mobile — gestão do negócio acontece entre uma tarefa e outra, pelo celular. Uso analítico (dashboard) e operacional (CRM/agenda) misturados na mesma pessoa, ao contrário de sistemas com equipe segregada por papel.

**Contexto:** acessado via navegador, com prioridade mobile-first.

## 5. Hipótese de solução

Um sistema web único (Next.js + Prisma + PostgreSQL + NextAuth) que replica, para o domínio de confeitaria, os três padrões já provados no workspace: funil kanban configurável (sdr-crm), agenda com limite diário (academia-sandro) e dashboard financeiro com Recharts/SWR (lanchonete-sistema) — com a identidade visual e as regras de negócio reais da marca da Lane.

**Por que faz sentido:** os três padrões de referência já resolveram, separadamente, problemas equivalentes (funil, agenda, financeiro) em produção. Combiná-los reduz o risco de reinventar UX já testada.

**Risco central:** duas peças de dado dependem inteiramente de cadastro manual da Lane e não têm valor de fábrica — preço por sabor de bolo e custo de insumos por receita. Sem esse cadastro, precificação e CMV não funcionam (ver tratamento de "custo não calculado" no Modelo de Dados).

## 6. Escopo

**Dentro:**
- CRM kanban: filas com nome livre, limite de 7 nunca exposto como erro técnico (o botão de criar simplesmente desaparece)
- Cadastro de pedido: cliente, até 2 sabores, massa (branca/chocolate, sem custo adicional), peso, data de entrega, referência do modelo (texto/link, sem upload de imagem), valor combinado
- Catálogo pré-carregado: 44 sabores de bolo reais + 12 itens de docinho (2 faixas de preço: R$150 e R$180 o cento)
- Precificação: acréscimos configuráveis (cartão, glitter, topper), sinal automático (50%), cancelamento com retenção de sinal se a menos de 24h da entrega
- Agenda: calendário com ocupação diária, limite configurável (padrão 5 bolos/dia), bloqueio transacional contra overbooking
- Integração CRM → Agenda: fila marcável como "dispara agendamento" (flag configurável — filas são livres, não há nome fixo de "produção confirmada")
- Financeiro: despesas, insumos com custo unitário, receita por sabor (associação insumo↔sabor), CMV por sabor com tratamento explícito de "custo não calculado"
- Dashboard: indicadores financeiros (receita/despesas/lucro/fluxo), quadro de meta com destaque dourado ao atingir, calculadora de projeção (sem persistir dados reais), clientes recorrentes, ranking de bolos por faixa de peso (5/10/15kg + "outros")
- Autenticação single-tenant (NextAuth v5, credentials)

**Fora (registrado como premissa/decisão, não esquecimento):**
- Multiusuário/papéis — sistema é single-tenant (premissa validada no PRD original)
- Seletor de período no dashboard financeiro (fixo no mês atual até o momento)
- Deploy em produção — sistema testado localmente (sem VPS conectada neste ambiente ainda)
- Rate limiting e log de auditoria nas rotas `/api/internal/*`

**Saiu do "fora" em 2026-08-02 (integração real com o Quasar foi além do previsto no PRD original):**
- ~~Notificações via WhatsApp~~ — WhatsApp real conectado (Evolution API), atendimento automático via Mel (Quasar)
- ~~Upload de imagem de referência do bolo~~ — não via formulário do sistema (continua texto/link ali), mas o cliente manda foto direto no WhatsApp e a Mel analisa por visão computacional
- ~~Marcação manual de "sinal pago"/"saldo pago"~~ — `PedidoDetalheModal` (clique no card) expõe os botões que faltavam

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Pedidos organizados em funil visual | inexistente (WhatsApp) | 100% dos pedidos ativos no kanban |
| Overbooking de produção | risco real, sem controle | 0% — bloqueio automático no limite diário |
| Sabores com CMV calculado | 0% (sem sistema) | cresce conforme Lane cadastra receitas — sistema nunca mostra custo incorreto (mostra "não calculado" em vez de zero) |
| Cálculo de sinal/saldo | manual, sujeito a erro | 100% automático a partir do valor combinado + acréscimos |
| Visão de clientes recorrentes | inexistente | calculada automaticamente a partir do histórico de pedidos concluídos |

## 8. Requisitos de alto nível

**Funcionais:** ver [[requisitos-funcionais-lane-confeitaria]] — 18 FRs originais do PRD de produto (6 módulos) + 15 FRs adicionados em 2026-08-02 com a integração real do Quasar (atendimento automático, visão computacional, validação de pagamento, conexão WhatsApp — módulos 7 a 9), reorganizados em 9 módulos funcionais neste documento de governança.

**Não funcionais:**
- Mobile-first (prioridade validada com a cliente)
- Autenticação obrigatória em todas as rotas de negócio
- Limites de sistema (filas, bolos/dia) como configuração em banco, nunca hardcoded
- Valores monetários calculados via `Decimal`, nunca `number` float puro, nos Services

---

## Links relacionados

[[indice-lane-confeitaria]] — mapa completo dos artefatos do sistema
[[requisitos-funcionais-lane-confeitaria]] — FRs/NFRs detalhados por módulo
