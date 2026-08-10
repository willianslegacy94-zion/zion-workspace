---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-07-11
owner: willians
---

# PRD — Academia Prof. Sandro (Sistema de Gestão)

## 1. Contexto

A Academia Prof. Sandro é uma academia de artes marciais (modalidades com faixa/graduação — Jiu-Jitsu, Muay Thai, Judô, Boxe). O sistema está sendo construído do zero para digitalizar o controle de alunos (matrícula, modalidade, graduação, status de pagamento) e o financeiro básico (receitas e despesas), hoje presumivelmente controlado de forma manual ou informal.

> **Nota:** este PRD documenta o que foi efetivamente decidido e construído até 2026-07-11. Contexto de negócio mais amplo (volume atual de alunos, processo anterior exato, prazos) ainda não foi levantado formalmente com o usuário — marcado como pendente onde aplicável, em vez de presumido.

## 2. Problema

**Dor específica:** ausência de um sistema centralizado para acompanhar quem são os alunos, em que graduação estão, se estão aptos para exame, e qual o resultado financeiro da academia (mensalidades recebidas vs. despesas).

**Como se manifesta (inferido do escopo implementado):**
- Sem registro estruturado de aluno, modalidade e faixa
- Sem controle de status de pagamento por aluno
- Sem rastreio de aptidão para exame de graduação
- Sem visão consolidada de receitas e despesas (saldo)

**Por que ainda não foi resolvida:** pendente de levantamento — não há registro de tentativas anteriores ou ferramentas descartadas.

## 3. Objetivo

Após o sistema existir (nesta primeira fase):
- Sandro cadastra e visualiza todos os alunos com modalidade, faixa, status de pagamento e aptidão para exame
- Sandro registra receitas e despesas, com saldo calculado automaticamente
- Transações podem opcionalmente ser vinculadas a um aluno específico (ex: mensalidade de um aluno identificado)

## 4. Usuário

**Quem:**
- **Sandro (professor/admin):** único usuário até o momento — sem autenticação ou perfis implementados; acesso direto às telas

**Estado no uso:** administrativo — consulta e mantém dados fora do horário de aula, não em tempo real durante o treino.

**Contexto:** acessado via browser, ainda apenas em ambiente de desenvolvimento local (não implantado em produção).

## 5. Hipótese de solução

Um painel web simples (Next.js + Prisma + PostgreSQL) com duas entidades centrais — Aluno e Transação Financeira — cobrindo cadastro, listagem e exclusão, como base para expansão futura (edição, relatórios, autenticação).

**Por que faz sentido:** escopo mínimo viável que já resolve o registro estruturado de alunos e financeiro, sem exigir infraestrutura complexa (single-tenant, sem autenticação ainda).

**Risco central:** nenhuma validação de negócio além de campos obrigatórios — dados como duplicidade de aluno, edição de cadastro e trilha de auditoria financeira ainda não existem.

## 6. Escopo

**Dentro (implementado em 2026-07-11):**
- Cadastro de aluno (nome, modalidade, faixa/graduação, status de pagamento, apto para exame)
- Listagem de alunos com exclusão
- Cadastro de transação financeira (tipo Receita/Despesa, categoria, valor, data, aluno vinculado opcional)
- Listagem de transações com saldo (receitas − despesas) e exclusão
- Identidade visual própria (tema claro/escuro, paleta dourado/bronze)

**Fora (não implementado ainda):**
- Autenticação e perfis de acesso
- Edição de aluno e de transação (só criação e exclusão)
- Relatórios financeiros por período, exportação
- Controle de mensalidade recorrente / cobrança automática
- Multi-tenant (mais de uma academia)
- Deploy em produção

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Cadastro estruturado de aluno | inexistente | 100% dos alunos com modalidade, faixa e status de pagamento registrados |
| Visão de saldo financeiro | manual/inexistente | saldo calculado automaticamente a cada transação |

> Métricas de negócio mais específicas (tempo de cadastro, adoção pelo Sandro no dia a dia) ainda não foram definidas — pendente de uso real do sistema.

## 8. Requisitos de alto nível

**Funcionais:**
- CRUD parcial (criar, listar, excluir) de Aluno
- CRUD parcial (criar, listar, excluir) de Transação Financeira, com vínculo opcional a um Aluno
- Cálculo de saldo (receitas − despesas) na tela de transações

**Não funcionais:**
- Interface renderizada no servidor (Server Components) com Server Actions para mutações — sem necessidade de API REST separada
- Conexão com PostgreSQL (Supabase) via driver adapter `pg` (exigência do novo gerador de cliente do Prisma 7)
- Identidade visual consistente com tokens de tema definidos em `globals.css` (Tailwind v4, `@theme inline`)
