---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-05-24
owner: willians
---

# System Creation Threshold — Barbearia Thieco Leandro

Resposta às 6 perguntas obrigatórias antes da criação do sistema.
Status: **threshold aprovado** — construção em curso.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | Controle financeiro manual de duas unidades de barbearia: comissões calculadas à mão no fim do dia com risco de erro, sem visibilidade de caixa em tempo real, sem rastreio de origem de clientes ou serviços mais rentáveis, e sem DRE consolidado entre Tambore e Mutinga. |
| **2. Para quem?** | Thieco Leandro (dono e admin) e os barbeiros Igor Hidalgo e Kauã dos Santos (operadores). |
| **3. Qual é o output esperado?** | Um sistema de caixa interno que registra vendas, calcula comissões automaticamente por tipo de item e profissional, apura o valor líquido já descontando taxas PagBank, e gera relatórios financeiros consolidados por período, unidade e profissional. |
| **4. Quais inputs o sistema precisa para funcionar?** | Registro de cada atendimento: serviço ou produto prestado, profissional, unidade, valor, desconto, forma de pagamento, tipo de cliente e origem. Cadastro de gastos por unidade. |
| **5. Qual é o primeiro artefato concreto?** | Tela de registro de venda com cálculo automático de comissão e valor líquido — substituindo o processo manual de anotação e cálculo no fim do dia. Os dados históricos (8.580 vendas de 2024-2026) foram importados na base como ponto de partida. |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Opera sobre lógica financeira específica de barbearia com duas unidades independentes: comissionamento diferenciado por tipo de item (serviço vs. produto físico), taxas de maquininha distintas por unidade e bandeira de cartão, e controle de profissionais com percentuais individualizados. Não é suporte a outro sistema — é o sistema operacional financeiro da barbearia. |

---

## Status do threshold

**Status:** aprovado
**Data de aprovação:** 2024 (construção iniciada)
**Estado atual:** sistema em produção, evolução contínua

---

## Links relacionados

[[indice-thieco]] — mapa de todos os artefatos do sistema
[[prd-thieco]] — PRD completo com problema, objetivo e escopo
