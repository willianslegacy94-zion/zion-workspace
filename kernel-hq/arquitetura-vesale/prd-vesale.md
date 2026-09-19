---
status: draft
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-16
owner: willians
---

# PRD — Drogaria Vesale

> Referência: [[system-creation-vesale]]

## 1. Contexto

A Drogaria Vesale é uma farmácia de bairro com perfumaria (fachada real fotografada, endereço nº 1304, telefone 4193-5544), operando no modelo típico de farmácia de proximidade: atendimento de balcão, alto número de SKUs (medicamentos + perfumaria) com margem unitária estreita, e dependência de reposição frequente via fornecedores/distribuidoras que emitem nota fiscal eletrônica (XML) ou, em alguns casos, apenas PDF.

Esse tipo de operação hoje roda, tipicamente, sem sistema de gestão dedicado: venda registrada no balcão sem PDV ágil, nota fiscal de entrada lançada manualmente (quando é lançada) e preço de venda definido "no olho", sem cruzar com o custo real da última compra. O resultado é operação correndo às cegas em relação à margem real por produto.

## 2. Problema

**Dor específica:** não existe controle financeiro digital integrado entre o que entra (compra/nota fiscal), o que sai (venda no balcão) e o resultado real (lucro por produto e da farmácia como um todo).

**Como se manifesta:**
- Vendas no balcão dependem de agilidade manual — sem leitura de código de barras nem atalhos, o atendimento é mais lento do que precisa ser.
- Notas fiscais de fornecedores chegam em XML ou PDF e precisam ser lançadas manualmente no controle de estoque/custo — processo sujeito a erro e atraso.
- O preço de venda de cada produto não é confrontado sistematicamente com o custo da última compra — risco real de vender abaixo do custo sem que ninguém perceba, especialmente em itens de perfumaria com preço mais variável.
- Não há fluxo de caixa nem DRE simplificado cruzando as vendas do PDV com os custos fixos e variáveis do mês — o resultado real do negócio exige reconstrução manual.

**Por que ainda não foi resolvida:** soluções genéricas de ERP de farmácia no mercado são caras e engessadas para o porte de uma farmácia de bairro, e não abrem espaço para automação leve de leitura de XML/PDF nem para uma trava de custo simples por nota fiscal.

## 3. Objetivo

Depois do sistema existir: o operador de balcão finaliza uma venda quase sem usar o mouse; toda nota fiscal de fornecedor recebida (XML ou PDF) alimenta automaticamente estoque e custo, sem lançamento manual linha a linha; e o gestor enxerga, a qualquer momento, se está vendendo com margem positiva ou negativa por produto, além do fluxo de caixa e do DRE simplificado do mês.

## 4. Usuário

**Quem:** proprietário(a)/gestor(a) da Drogaria Vesale (visão de precificação, CMV e resultado financeiro) e operador(es) de caixa/balcão (atendimento direto ao cliente que entra na loja).

**Estado no uso — gestor:** fora do horário de pico de balcão, revisando preços, notas recebidas e resultado do período — precisa confiar no número sem precisar reconciliar manualmente planilha, papel de nota fiscal e caixa.

**Estado no uso — operador de balcão:** em pé, atendendo cliente, sob pressão de agilidade (fila) — precisa fechar a venda rápido, sem telas complexas ou etapas desnecessárias.

**Contexto:** uso dentro da loja física, em horário comercial, provavelmente em desktop/tablet no balcão para o PDV e em desktop para os módulos financeiro/CMV.

## 5. Hipótese de solução

Um sistema web único que integra as quatro frentes — PDV, Financeiro, Notas Fiscais de Entrada e Precificação/CMV — sobre uma única base de dados, eliminando a reconciliação manual entre "o que vendeu", "o que custou" e "o que sobrou".

**Por que faz sentido:** o ponto de dor central não é nenhum módulo isolado, é a desconexão entre eles — uma nota lançada não vira custo automaticamente, um custo não trava o preço, uma venda não vira DRE. Unificar os quatro módulos num mesmo sistema resolve a causa raiz, não o sintoma.

**Risco central da hipótese:** o layout de XML de nota fiscal eletrônica varia entre distribuidoras (mesmo dentro do padrão SEFAZ/NFe, há divergência de preenchimento de campos), e nem todo fornecedor emite XML — alguns só mandam PDF (DANFE), que não tem estrutura fixa para parsing determinístico. Isso é endereçado na arquitetura (ver [[arquitetura-vesale]]) com um parser determinístico para XML no padrão NFe e um fallback assistido por IA (Claude) para os casos de PDF ou XML fora do padrão.

## 6. Escopo

**Dentro:**
- Frente de Caixa (PDV): leitura de código de barras, busca rápida por nome/código, atalhos de teclado, seleção de forma de pagamento, desconto, finalização de venda com recibo/comprovante imprimível, abertura e fechamento de caixa com cálculo de diferença.
- Cadastro de Produtos e Estoque: cadastro/edição de produto (sem exclusão física), sinalização de estoque baixo e de validade próxima, controle de lote e validade por produto (confirmado como requisito real em 2026-09-15, ver [[registro-de-decisoes-vesale]]), sinalização de medicamento controlado com exigência de confirmação de receita na venda.
- Notas Fiscais de Entrada: upload de XML/PDF, extração automática de fornecedor, itens, custo, quantidade, categoria e lote/validade (quando presente no XML), alimentando o estoque; lançamento manual de itens quando só a chave de acesso da nota foi bipada (o QR não dá acesso ao conteúdo, só o XML tem isso).
- Fornecedores: cadastro/edição direto (sem precisar vir de uma nota), com total de pedidos, valor total e data do último pedido por fornecedor.
- Gestão Financeira: contas a pagar/receber com baixa manual.
- Relatórios de vendas: total, ticket médio, produtos mais vendidos e por forma de pagamento, por período.
- Painel: resumo do dia para o gestor (vendas, caixa, estoque baixo, validade).
- Identidade visual aplicada: sidebar de navegação com a marca ("DROGARIA" pequeno + "VESALE" em destaque) e símbolo isolado da cruz (SVG, reproduzido da foto da fachada), paleta extraída da fachada real. Migrou de header fixo no topo para sidebar em 2026-09-17.
- Precificação e CMV — painel de custo da mercadoria vendida e margem, com custo travado pela última nota fiscal e preço de venda em aberto para input manual; alerta visual quando a margem for negativa (Módulo 5, RF-019 a RF-022). Implementado em `/rentabilidade` em 2026-09-17.

**Ainda fora desta versão:**
- Fluxo de caixa consolidado do dia e DRE simplificado mensal (RF-025/RF-026) — dependem do CMV do Módulo 5, que já existe, mas RF-025 ainda não foi implementado.
- Emissão de nota fiscal de saída (NFC-e/cupom fiscal) — o sistema por ora **processa** nota de entrada, não emite nota de venda.
- Integração com convênios/planos de saúde.
- Múltiplas filiais — assume-se uma única loja física (a da fachada fotografada).

*Resolvido em 2026-09-15: controle de lote/validade e produto controlado/receituário estavam aqui como pendência não decidida — Willians confirmou como requisito real e ambos foram implementados (ver [[registro-de-decisoes-vesale]]).*

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Tempo médio de finalização de uma venda simples no PDV | desconhecido (processo manual/sem PDV hoje) | abaixo de 30 segundos por venda de 1 a 3 itens |
| % de notas fiscais de entrada processadas automaticamente sem correção manual | 0% (lançamento manual hoje) | acima de 80% para XML no padrão NFe |
| Produtos vendidos com margem negativa sem alerta do sistema | desconhecido — sem visibilidade hoje | zero — todo produto com preço abaixo do custo travado deve gerar alerta visual antes ou no momento da venda |
| Tempo entre chegada da nota fiscal e produto com custo atualizado no sistema | manual, não medido | mesmo dia útil do upload |

## 8. Requisitos de alto nível

**Funcionais:** PDV com leitura de código de barras e finalização rápida; upload e parsing automatizado de XML/PDF de nota fiscal alimentando estoque e custo; painel de precificação com trava de custo e alerta de margem negativa; fluxo de caixa, contas a pagar/receber e DRE simplificado.

**Não funcionais:** interface do PDV responsiva e operável majoritariamente por teclado (desktop/tablet no balcão); tempo de resposta da busca de produto no PDV próximo de instantâneo; dados financeiros e de custo protegidos por autenticação e controle de papel (gestor vs. operador); disponibilidade do sistema durante o horário comercial da farmácia.

---

# Links relacionados

[[system-creation-vesale]] — threshold aprovado que originou este PRD
[[requisitos-funcionais-vesale]] — próximo passo: tradução deste PRD em comportamento especificado
