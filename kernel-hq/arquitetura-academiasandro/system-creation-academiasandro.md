---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-08-12
owner: willians
---

# System Creation Threshold — Academia Prof. Sandro

Resposta às 6 perguntas obrigatórias antes da criação do sistema.
Status: **threshold aprovado informalmente** — construção já iniciada antes deste registro formal; respostas reconstituídas a partir do que foi efetivamente implementado.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | Gestão de alunos e financeiro de uma academia de artes marciais (Prof. Sandro) sem depender de planilha ou controle manual — cadastro de aluno, faixa/graduação e status de pagamento, mais registro de receitas e despesas. |
| **2. Para quem?** | Prof. Sandro (e eventual equipe administrativa da academia) — usuário único até o momento, sem perfis de acesso diferenciados implementados. |
| **3. Qual é o output esperado?** | Um painel web simples para cadastrar alunos, acompanhar status de pagamento e apto para exame, e registrar transações financeiras (receitas/despesas) com saldo calculado. |
| **4. Quais inputs o sistema precisa para funcionar?** | Dados de matrícula do aluno (nome, modalidade, faixa, status de pagamento), e lançamentos financeiros (tipo, categoria, valor, data, aluno vinculado opcional). |
| **5. Qual é o primeiro artefato concreto?** | Tela `/alunos` (cadastro + listagem) e tela `/transacoes` (cadastro + listagem + saldo) — implementadas em 2026-07-11. |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Alunos e Transações Financeiras têm relação estrutural (uma transação pode referenciar um aluno) e evoluem juntas — é a base de um ERP simples de academia, não uma automação pontual. |

---

## Status do threshold

**Status:** aprovado informalmente (uso pessoal/single-tenant, sem processo formal de aprovação)
**Data de início da construção:** 2026-07-10
**Estado no momento deste registro (2026-07-11):** MVP em construção — schema definido, migração aplicada, 2 telas funcionais (Alunos, Transações), sem autenticação
**Estado atual (nota 2026-08-12):** em produção desde 2026-08-03, dezenas de módulos, autenticação, WhatsApp real — ver [[registro-de-decisoes-academiasandro]] pro histórico completo. Linha acima preservada como registro histórico, não atualizada por cima

---

## Links relacionados

[[indice-academiasandro]] — mapa de todos os artefatos do sistema
[[prd-academiasandro]] — PRD completo com problema, objetivo e escopo
