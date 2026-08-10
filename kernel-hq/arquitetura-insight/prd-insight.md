---
status: stable
domain: orbita-insight
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# PRD — Órbita Insight

## 1. Contexto

Infoprodutores digitais geram receita contínua por retenção e upsell, mas operam cegos: não sabem quais alunos estão prestes a pedir reembolso, quais estão prontos para comprar o próximo produto e quais simplesmente travaram e precisam de suporte. As plataformas de área de membros fornecem dados brutos (progresso, data de compra), mas não transformam esses dados em inteligência acionável.

## 2. Problema

**Dor específica:** O infoprodutor não age no momento certo porque não sabe que o momento chegou.

**Como se manifesta:**
- Aluno compra, abre o curso uma vez e some — reembolso em 7 dias sem nenhum contato anterior
- Aluno conclui 80% do curso e ninguém oferece a mentoria ou o próximo produto
- Aluno travado no módulo 2 há 20 dias sem nenhuma ação de suporte ou reengajamento
- Produtor só descobre o problema no relatório mensal, quando já é tarde

**Por que ainda não foi resolvida:** Plataformas de área de membros não enviam alertas comportamentais. Ferramentas de CRM genéricas não têm as regras de negócio de infoprodutos. Construir isso internamente custa meses de desenvolvimento.

## 3. Objetivo

Após o sistema existir:
- O produtor recebe um alerta no WhatsApp no momento em que um aluno entra em risco de churn
- Oportunidades de upsell são identificadas e comunicadas automaticamente quando o aluno está em momentum
- Alunos travados geram alertas de reengajamento antes de virarem abandono silencioso
- Cada insight é armazenado com histórico auditável para análise de padrões futuros

## 4. Usuário

**Quem:**
- **Infoprodutor (cliente do SaaS):** criador de cursos, mentorias ou comunidades digitais — recebe o insight no WhatsApp
- **Integrador (técnico do produtor):** conecta a plataforma de área de membros ao Órbita Insight via webhook ou automação

**Estado no uso:**
- Infoprodutor: reativo — recebe o alerta e age (liga para o aluno, oferece suporte, envia oferta)
- Integrador: configurador — conecta a fonte de dados uma vez e a automação opera continuamente

**Contexto:** alerta recebido no celular do produtor durante o dia de operação, no momento em que o comportamento do aluno dispara a regra.

## 5. Hipótese de solução

Um engine SaaS de API-first que recebe dados de consumo via POST, aplica 3 regras de classificação comportamental e gera um insight textual humanizado usando IA, pronto para ser entregue ao WhatsApp do produtor.

**Por que faz sentido:** Os dados já existem nas plataformas. O gap é a interpretação e o alerta. Um engine especializado com regras de negócio de infoprodutos resolve isso sem exigir que o produtor entenda dados.

**Risco central:** A qualidade do insight gerado determina a confiança do produtor. Um insight genérico ou incorreto quebra o produto. O prompt e as regras de classificação são o core IP do sistema.

## 6. Escopo

**Dentro:**
- Endpoint de análise com classificação comportamental (churn / upsell / reengajamento)
- Geração de insight textual via IA (Claude 3.5 Sonnet via OpenRouter)
- Persistência de histórico de insights no banco local (SQLite)
- Contrato de API formal com validação de tipos (Pydantic)
- Log de status de envio por insight (`PENDENTE` → `ENVIADO` → `ERRO`)

**Fora:**
- Envio direto de WhatsApp (o sistema entrega o texto pronto; a entrega é responsabilidade do integrador)
- Interface web ou dashboard (API-first — sem frontend no MVP)
- Integração direta com plataformas de área de membros (o integrador conecta via webhook)
- Autenticação de múltiplos produtores (MVP é single-tenant; multi-tenant é fase 2)
- Billing e cobrança por uso (fase 2)

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Tempo de geração do insight | — | < 5 segundos por chamada |
| Taxa de classificação correta | — | 100% nas 3 regras (churn / upsell / reengajamento) |
| Insights persistidos com histórico | — | 100% das chamadas bem-sucedidas |
| Disponibilidade da API | — | > 99% em ambiente local |

## 8. Requisitos de alto nível

**Funcionais:**
- Receber payload com 7 campos obrigatórios via POST
- Classificar o aluno em uma das 3 regras com base nos campos `dias_desde_a_compra` e `progresso_aulas`
- Gerar insight textual humanizado e acionável via IA
- Persistir log com produtor, aluno, produto, insight e status no SQLite
- Retornar JSON com insight pronto para envio ao WhatsApp

**Não funcionais:**
- API responde em < 5 segundos (timeout de 15s na chamada à IA)
- Banco SQLite não pode ser apagado acidentalmente — arquivo `orbita_insight.db` versionado fora do `.gitignore`
- Chave de API (`OPENROUTER_API_KEY`) nunca exposta em código — carregada exclusivamente via `.env`
- Sistema operacional sem frontend — consumido exclusivamente por chamadas de API
