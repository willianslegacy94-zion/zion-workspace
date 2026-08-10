---
status: stable
domain: orbita-whitelabel
source: claude
created: 2026-06-24
updated: 2026-07-10
owner: willians
---

# PRD — Sistema Orbita Whitelabel

> Referência: [[indice-orbita-whitelabel]]

---

## Identidade

**Nome comercial: Kernel** (rebrand em 2026-08-02). **Domínio: `kercellwc.online`**, registrado em 2026-08-02 — ainda sem VPS/DNS/deploy apontados (ver [[registro-de-decisoes-orbita-whitelabel]]).

---

## Contexto

O `sistema-thieco` (Sistema de Caixa da Barbearia Thieco Leandro) provou ser um sistema funcional e confiável para gestão de vendas, comissões e financeiro de um estabelecimento de serviços. Após operar com dados reais desde 2024, o sistema foi generalizado como produto de prateleira: o **Sistema Orbita**.

A generalização mantém toda a lógica de negócio do thieco mas remove qualquer hardcode específico de cliente — nomes de unidades, taxas de operadora, percentuais fixos e terminologia de nicho são todos configuráveis por variáveis de ambiente.

---

## Problema

Proprietários de estabelecimentos de serviços (barbearias, salões, clínicas) usam planilhas para controlar vendas e calcular comissões de colaboradores. O processo é manual, propenso a erro e não escala quando há múltiplos colaboradores ou unidades.

Não há um sistema acessível, pronto para uso em um dia, que:
- Rode no celular via browser (sem app instalado)
- Calcule comissões automaticamente por colaborador
- Gere DRE simplificado com filtros por período e unidade
- Permita ao colaborador ver seu próprio painel de desempenho
- Seja adaptável a diferentes nichos com mínima configuração

---

## Objetivo

Entregar um sistema SaaS whitelabel que um novo cliente (proprietário de estabelecimento) possa ter em produção no mesmo dia, com:

1. Branding próprio (nome, cores)
2. Terminologia do nicho (barbeiro/especialista/profissional)
3. Módulos ativados conforme necessidade (estoque, combos, metas, relatórios)
4. Colaboradores cadastrados com seus percentuais de comissão
5. Zero dependência de planilha para controle financeiro diário

---

## Usuários

| Perfil | Quem é | O que precisa |
|---|---|---|
| **admin** | Dono ou gerente | Visibilidade total — relatórios, DRE, controle de colaboradores, configuração do sistema |
| **operador** | Recepcionista, caixa | Registrar vendas e gastos, ver resumo do dia da própria unidade |
| **colaborador** | Barbeiro, especialista, profissional | Ver próprio painel de desempenho, registrar vendas em login individual, acompanhar metas |

---

## Hipótese de solução

Um sistema web com arquitetura monolítica simples (Node.js + React + PostgreSQL + Docker) é suficiente para o volume de um estabelecimento de pequeno/médio porte. O deploy em VPS + Nginx garante custo baixo. A parametrização por variáveis de ambiente elimina a necessidade de código customizado por cliente.

---

## Escopo

### Dentro do escopo

- Registro de vendas (serviços e produtos) com cálculo automático de comissão
- Gestão de gastos operacionais por categoria
- Catálogo de serviços e produtos com controle de estoque opcional
- Módulo de combos/pacotes pré-pagos por cliente
- Painel do colaborador com metas (Bronze/Prata/Ouro), fechamento do dia e ganho estimado em tempo real
- Relatórios: faturamento, DRE, comissões, inteligência financeira, origem de clientes
- Cadastro de clientes com histórico
- Gestão de time: feedbacks PDCA e sugestões
- Metas diárias com cota dinâmica por colaborador
- Multi-unidade via feature flag
- Autenticação JWT com recuperação de senha por email
- Branding customizável por tenant (cores, nome, logo, terminologia), resolvido em runtime a partir do login/URL — não mais em build-time
- Multi-tenant em banco compartilhado — um deployment atende N clientes, isolados por `tenant_id` (ver [[registro-de-decisoes-orbita-whitelabel]] 2026-07-10)
- Deploy via Docker Compose em qualquer VPS Linux, ou banco gerenciado (Supabase)

### Fora do escopo

- Agendamento online
- Integração com maquininha de cartão (sem cálculo de taxas hardcoded)
- App nativo (iOS/Android)
- Relatórios fiscais (NF-e, SPED)
- Integração com sistemas externos de RH ou contabilidade
- Row Level Security (RLS) no Postgres — isolação primária é `tenant_id` obrigatório em toda query; RLS fica como endurecimento futuro
- Terminologia por nicho (`VITE_NICHO`) em runtime — continua build-time, um valor por deployment (ver limitação em [[requisitos-funcionais-orbita-whitelabel]])

---

## Métricas de sucesso

| Métrica | Alvo |
|---|---|
| Tempo de onboarding (zero a produção) | < 1 dia útil |
| Tempo de registro de venda | < 60 segundos |
| Precisão dos cálculos de comissão | 100% idêntica ao cálculo manual |
| Disponibilidade no horário de operação | ≥ 99% |
| Custo de infraestrutura por cliente | Suportado por VPS básica (~R$ 60/mês) |

---

## Requisitos de alto nível

| ID | Requisito |
|---|---|
| RAN-001 | Sistema deve funcionar em mobile via browser sem instalação |
| RAN-002 | Cada módulo (estoque, combos, metas, etc.) pode ser ativado ou desativado por tenant sem alterar código |
| RAN-003 | Terminologia da interface deve se adaptar ao nicho do cliente sem alterar código |
| RAN-004 | Branding (cores, nome, logo) deve ser configurável por tenant, resolvido em runtime a partir do login/URL — sem exigir rebuild |
| RAN-005 | Colaborador jamais acessa dados de outro colaborador — isolamento garantido no backend |
| RAN-005b | Tenant jamais acessa dado de outro tenant — `tenant_id` obrigatório em toda query, mesmo por ID direto (proteção contra IDOR) |
| RAN-006 | DRE e comissões sempre lidos das colunas armazenadas — nunca recalculados ad hoc |
| RAN-007 | Deploy único reproduzível via `docker compose up -d` atende múltiplos clientes — onboarding de cliente novo é inserir uma linha em `tenants`, não subir infraestrutura nova |
| RAN-008 | Dados históricos importados via script dentro do container, não via SQL direto |
