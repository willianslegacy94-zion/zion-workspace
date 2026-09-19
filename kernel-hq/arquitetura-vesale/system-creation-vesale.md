---
status: stable
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-12
owner: willians
---

# System Creation Threshold — Drogaria Vesale

Resposta às 6 perguntas obrigatórias antes da criação do sistema.
Status: **threshold aprovado** — briefing recebido diretamente do Willians (Zion Ops), com diagnóstico de módulos já estruturado e a logo real da fachada (`LogoVesale.png`) como referência de identidade visual. Ainda não há levantamento presencial com a cliente (farmácia) nem cadastro de produtos real — este documento registra a base de partida, não um sistema validado em campo.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | A Drogaria Vesale (farmácia de bairro com perfumaria) opera sem sistema de gestão integrado: vendas no balcão sem PDV ágil, notas fiscais de fornecedores sem lançamento automatizado no estoque/custo, e preço de venda definido sem cruzar com o custo real da última compra — risco de vender abaixo do custo sem perceber. Não há fluxo de caixa nem DRE consolidado cruzando vendas do PDV com custos fixos e variáveis. |
| **2. Para quem?** | Proprietário(a)/gestor(a) da Drogaria Vesale — visão de precificação, CMV e resultado financeiro do negócio — e operador(es) de caixa/balcão — frente de loja, atendimento ao cliente que entra na farmácia. |
| **3. Qual é o output esperado?** | Sistema web com: PDV ágil (leitura de código de barras, busca rápida, atalhos de teclado, quase sem uso de mouse); Gestão Financeira (fluxo de caixa, contas a pagar/receber, DRE simplificado); Notas Fiscais de Entrada (upload e leitura automatizada de XML/PDF de fornecedores, alimentando estoque e custo); Precificação e CMV (trava do custo vindo da nota, preço de venda em aberto para input manual, alerta visual de margem negativa). |
| **4. Quais inputs o sistema precisa para funcionar?** | Catálogo de produtos da farmácia (nome, categoria, código de barras) — ainda a ser cadastrado pela cliente; XMLs/PDFs reais de notas fiscais dos fornecedores da farmácia; tabela de formas de pagamento e taxas de maquininha por bandeira; despesas fixas e variáveis do negócio para compor o DRE. Nenhum desses inputs foi fornecido ainda — o sistema nasce da especificação, não de dados reais da operação. |
| **5. Qual é o primeiro artefato concreto?** | Tela de PDV — busca/leitura de produto por código de barras, montagem da venda e finalização com forma de pagamento, gerando total líquido automaticamente — o núcleo que substitui o controle manual no balcão. |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Integra PDV, Financeiro, Notas Fiscais de Entrada e Precificação/CMV — cada módulo alimenta o outro: a NF de entrada alimenta estoque e custo, o PDV consome o estoque e gera receita, o Financeiro cruza venda com custo fixo/variável para o lucro real, e o CMV trava o custo da nota mas depende de decisão humana sobre o preço. É a operação completa da farmácia — não apoio a outro sistema do portfólio. |

---

## Origem — briefing estruturado + imagem real da fachada, sem levantamento presencial ainda

Diferente de sistemas como Lane Confeitaria (kickoff direto por conversa com a cliente) ou Jocley Lanchonete (reaproveitamento de sistemas irmãos do mesmo domínio), o Vesale nasce de um **briefing já estruturado fornecido pelo Willians** — diagnóstico de identidade visual, arquitetura e módulos already redigido — complementado pela **foto real da fachada** (`LogoVesale.png`), usada para extrair a paleta de cores.

Isso muda o tipo de risco do projeto: a estrutura de módulos e a paleta visual estão bem definidas desde o início, mas **nenhum dado real da operação da farmácia foi validado ainda** — catálogo de produtos, volume de vendas, fornecedores reais, formato exato dos XMLs que a farmácia recebe. O [[prd-vesale]] e os documentos seguintes assumem premissas de domínio (farmácia + perfumaria de bairro) que precisam ser confirmadas na primeira conversa real com a cliente.

**Regra explícita adotada nesta documentação:** nenhuma regra de negócio específica de farmácia que não apareça no briefing original foi inventada como decidida. Onde o domínio farmacêutico exige algo que o briefing não cobre (ex.: controle de lote/validade, produtos controlados/receituário), isso é registrado como **pergunta em aberto**, não como requisito implementado — ver [[prd-vesale]] (Escopo → Fora) e [[registro-de-decisoes-vesale]].

---

## Status do threshold

**Status:** aprovado
**Data de aprovação:** 2026-09-12
**Estado atual:** documentação de governança (camadas 1 a 3) criada nesta sessão a partir do briefing. Nenhuma linha de código do sistema real foi escrita ainda — próximo passo natural é a implementação do primeiro artefato (Módulo PDV) definido em [[requisitos-funcionais-vesale]], após validar com a cliente os pontos em aberto listados no PRD.

---

## Links relacionados

[[indice-vesale]] — mapa de todos os artefatos do sistema
[[prd-vesale]] — PRD completo com problema, objetivo e escopo
