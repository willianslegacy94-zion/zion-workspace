---
status: draft
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-12
owner: willians
---

# UX — Drogaria Vesale

> Referência: [[prd-vesale]] | [[design-system-vesale]]
> **Aviso de estágio:** este documento nasce da intenção especificada no briefing, não de observação real de uso — não houve ainda pesquisa, teste de usabilidade nem uso real do sistema pela cliente. As seções de pesquisa e testes ficam propositalmente vazias/marcadas como pendentes, para não simular validação que não aconteceu.

## 1. Pesquisa

**Método:** nenhum realizado ainda — este documento parte do briefing estruturado fornecido pelo Willians, não de entrevista ou observação direta da operação da farmácia.
**Participantes:** pendente — primeira conversa real com a proprietária/gestor(a) da Drogaria Vesale ainda não ocorreu.
**Período:** —

### Descobertas principais

| Descoberta | Evidência | Impacto no produto |
|---|---|---|
| Nenhuma ainda | — | Pendente: descobertas reais só existirão após a primeira conversa com a cliente, observando o balcão de venda e o processo real de recebimento de mercadoria |

---

## 2. Jornada do usuário

Jornadas abaixo descrevem o fluxo **pretendido** pelos requisitos ([[requisitos-funcionais-vesale]]), não um fluxo validado com o usuário real.

### Jornada 1 — Operador de balcão finaliza uma venda

| Etapa | O que o usuário faz | O que pensa/sente | Ponto de fricção | Oportunidade |
|---|---|---|---|---|
| 1. Cliente chega ao balcão com produto(s) | operador lê o código de barras ou busca pelo nome | foco na agilidade, cliente esperando | leitor pode falhar em embalagens amassadas — precisa de busca manual rápida como plano B | busca por nome precisa ser tão rápida quanto o código de barras |
| 2. Produto aparece na venda em andamento | operador confirma quantidade se mais de 1 unidade | quer confirmação visual rápida do que foi lido | — | total já visível a cada item adicionado (RF-010) |
| 3. Operador seleciona forma de pagamento | escolhe dinheiro/débito/crédito/PIX | quer decidir e finalizar em um único passo | tela com etapas demais quebraria a agilidade exigida no PRD | atalho de teclado por forma de pagamento |
| 4. Venda finalizada | sistema confirma, limpa a tela para a próxima venda | alívio, já olhando para o próximo cliente | qualquer travamento aqui gera fila | feedback não-bloqueante (ver Design System → Padrões de interação) |

### Jornada 2 — Gestor concilia uma nota fiscal recebida

| Etapa | O que o usuário faz | O que pensa/sente | Ponto de fricção | Oportunidade |
|---|---|---|---|---|
| 1. Recebe XML/PDF do fornecedor | faz upload no sistema | quer processar rápido para liberar o produto pra venda | incerteza se o arquivo vai ser lido corretamente (XML fora do padrão, PDF) | status claro de processamento (RF-014 a RF-016) |
| 2. Sistema extrai os itens | revisa a lista extraída | precisa confiar no que foi extraído sem conferir cada linha manualmente | itens sem correspondência a um produto cadastrado geram trabalho manual (RF-017) | sugestão automática de vínculo por código de barras/NCM reduz esse trabalho |
| 3. Confirma a conciliação | clica em conciliar | quer ver o custo e o estoque atualizados imediatamente | — | confirmação clara de que estoque e custo foram atualizados |

---

## 3. Arquitetura de informação

```
Login
├── Dashboard / Painel (gestor)
├── PDV / Vendas (operador de caixa e gestor)
├── Estoque (gestor)
├── Compras (gestor)
│   ├── Fornecedores
│   └── Notas Fiscais de Entrada
│       ├── Upload
│       └── Conciliação
├── Validades (gestor) — em breve, sem tela ainda
├── Financeiro (gestor)
│   ├── Contas a pagar/receber
│   ├── Fluxo de caixa — em breve (RF-025)
│   └── DRE simplificado — em breve (RF-026)
├── Lucro & Rentabilidade / Precificação e CMV (gestor)
├── Clientes (gestor) — em breve, sem tela ainda
├── Receitas / Controlados (gestor) — em breve, sem tela ainda
├── Perdas (gestor) — em breve, sem tela ainda
├── Relatórios (gestor)
├── Auditoria (gestor) — em breve, sem tela ainda
└── Assistente IA (gestor) — em breve, sem tela ainda
```

*Árvore atualizada em 2026-09-17 para bater com a sidebar real (`src/components/shared/Sidebar.tsx`) — a versão anterior já estava desatualizada mesmo antes disso (faltava Estoque e Fornecedores). "Cadastro > Usuários" não tem tela própria hoje (usuário é seedado, RF-003 não implementado); removido da árvore.*

**Critério de organização (decisão original):** separação por papel é a primeira decisão de navegação — o operador de caixa só enxerga o PDV; o gestor enxerga tudo. Dentro da visão do gestor, a ordem dos módulos deveria seguir o fluxo natural do dinheiro na farmácia: nota fiscal entra → produto é precificado → produto é vendido no PDV → resultado aparece no financeiro.

**⚠️ Pendência aberta:** a ordem real da sidebar (acima) segue a ordem de um mockup de referência (PDV logo no topo, antes de Compras e de Precificação), não o critério de fluxo do dinheiro descrito acima. Ninguém decidiu formalmente abandonar o critério original — precisa de uma decisão: reordenar a sidebar para bater com o critério, ou atualizar o critério para refletir a ordem atual (provavelmente mais familiar para quem já usou outro sistema de PDV/farmácia).

---

## 4. Fluxos principais

### Fluxo: Venda no PDV

```
[Tela PDV — busca vazia]
      ↓
[Operador lê código de barras ou busca por nome]
      ↓ (produto encontrado)                 ↓ (produto não encontrado)
[Item adicionado à venda]              [Mensagem: produto não cadastrado]
      ↓
[Operador seleciona forma de pagamento e confirma]
      ↓
[Venda finalizada — estoque e caixa atualizados]
```

**Critério de sucesso:** operador finaliza a venda sem precisar sair do teclado (RN-006).
**Ponto de abandono mais comum:** ainda não medido — hipótese a validar é a leitura de código de barras falhar em embalagens danificadas, forçando busca manual mais lenta.

### Fluxo: Conciliação de nota fiscal

```
[Upload do XML/PDF]
      ↓
[Parser XML padrão] → sucesso → [Itens extraídos]
      ↓ falha/PDF
[Extração assistida por IA] → [Itens extraídos, nota marcada para conferência]
      ↓
[Itens sem produto vinculado?] → sim → [Gestor vincula manualmente]
      ↓ não
[Gestor confirma conciliação]
      ↓
[Estoque e custo atualizados]
```

**Critério de sucesso:** nota conciliada no mesmo dia útil do upload (métrica do PRD).
**Ponto de abandono mais comum:** ainda não medido.

---

## 5. Testes de usabilidade

| Cenário testado | Comportamento esperado | Comportamento observado | Conclusão |
|---|---|---|---|
| Nenhum teste realizado ainda | — | — | pendente — primeiro teste real deve ocorrer com a implementação do Módulo PDV (primeiro artefato do sistema) |

---

## 6. Iterações registradas

| Data | O que mudou | Por que mudou | Resultado observado |
|---|---|---|---|
| Nenhuma ainda | — | — | este documento nasce na v0.1 do sistema — iterações aparecerão aqui conforme uso real acontecer |

---

# Links relacionados

[[design-system-vesale]] — princípios que esta UX deveria validar, quando houver uso real
[[ui-kit-vesale]] — componentes planejados que ainda não foram testados
[[prd-vesale]] — hipótese que esta UX deveria confirmar ou refutar
