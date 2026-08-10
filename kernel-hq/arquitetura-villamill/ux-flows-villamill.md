---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-07-29
owner: willians
---

# UX — Villa Mill Tamboré PDV & Management

> Referência: [[prd-villamill]] | [[design-system-villamill]]

---

## 1. Pesquisa

**Método:** observação da operação do restaurante + conversas com os operadores de caixa + análise das decisões de design registradas nas migrações do banco (historico de evolução do schema em 2 semanas).

**Participantes:**
- Willians (admin e dono do projeto) — 1 pessoa
- Emilly e Melissa (operadoras de caixa) — 2 pessoas

**Período:** abril a maio de 2026

### Descobertas principais

| Descoberta | Evidência | Impacto no produto |
|---|---|---|
| Operador precisa saber o estado do salão inteiro sem se mover | Sem PDV, o caixa tinha que ir até cada mesa para saber se estava ocupada | Grade de mesas como tela principal com cores semânticas de status |
| Pagamentos raramente são de uma forma só | Clientes frequentemente pagam parte em dinheiro e parte em PIX ou cartão | Split payment como funcionalidade de primeira classe, não workaround |
| O operador não deve ser interrompido para confirmar adição de item | Adicionar item é ação de baixo risco — confirmação seria fricção desnecessária | Adição de item sem modal de confirmação; remoção exige confirmação |
| Cancelamento sem motivo não tem valor gerencial | Cancelamentos aconteciam sem registro — impossível auditar abuso | Campo de motivo obrigatório para cancelamento |
| Modo treinamento é essencial para onboarding sem risco | Sem simulação, novo operador treinava diretamente no sistema real | Modo treinamento: todas as ações parecem funcionar mas não persistem |
| O estoque só importa quando está acabando | Operador não monitora estoque durante o serviço | Alerta passivo (badge âmbar) no dashboard — não interrompe o fluxo |

---

## 2. Jornada do usuário

### Jornada principal — Operador abre mesa, adiciona itens e fecha a conta

| Etapa | O que o usuário faz | O que pensa/sente | Ponto de fricção | Oportunidade |
|---|---|---|---|---|
| Acessa /mesas | visualiza a grade de mesas | "onde está o cliente?" | nenhuma — vê tudo de uma vez | cores semânticas eliminam leitura de texto |
| Clica na mesa LIVRE | navega para a comanda da mesa | "simples — clicou, abriu" | nenhuma | tap direto sem menu intermediário |
| Adiciona itens | seleciona produtos do cardápio, ajusta quantidade | "cadê a costela? está na categoria certa?" | scroll longo se categoria não for evidente | filtro por categoria no topo do cardápio |
| Confere total | vê total atualizado em tempo real | "bate com o que o cliente pediu" | total muda muito rápido ao adicionar vários itens | animação suave na atualização do total |
| Aplica desconto | digita valor de desconto | "o gerente autorizou X de desconto" | desconto reduz total mas não fica documentado o motivo | futura melhoria: campo de motivo do desconto |
| Fecha a conta | clica em "Fechar Conta" | "agora precisa saber como vai pagar" | cliente quer pagar em dois cartões e o operador não sabe como | SplitPaymentForm com visual claro de saldo restante |
| Confirma pagamento | informa as formas e valores, confirma | "validou que a soma bate" | erro de soma só aparecia ao submeter | validação em tempo real do saldo restante no split |
| Mesa liberada | modal fecha, mesa volta para verde na grade | "próximo!" | — | feedback imediato + mesa já disponível na grade |

### Jornada secundária — Admin acompanha o resultado do dia

| Etapa | O que o usuário faz | O que pensa/sente | Ponto de fricção | Oportunidade |
|---|---|---|---|---|
| Acessa /financeiro | seleciona período (hoje) | "quero ver só hoje" | padrão não era "hoje" | padrão de data = hoje ao abrir a página |
| Confere faturamento | vê total por forma de pagamento | "quanto entrou em dinheiro físico?" | breakdown de split misturava formas | split payment devidamente distribuído por forma |
| Confere cancelamentos | vê seção de cancelamentos com motivo | "quem cancelou e por quê?" | sem motivo registrado era impossível auditar | motivo obrigatório + email de quem cancelou |
| Registra despesas | acessa /despesas e lança gastos do dia | "fornecedor de bebidas, R$400" | sem lembrete de gastos recorrentes | futura melhoria: template de despesa recorrente |
| Fecha mentalmente | mentalmente subtrai gastos do faturamento | "quanto sobrou hoje?" | DRE não é automático na tela | exibir resultado (faturamento - despesas) no financeiro |

---

## 3. Arquitetura de informação

```
/login
└── / (Dashboard) — admin
    ├── /mesas — operador e admin
    │   └── /comanda/[id]
    │       ├── lista de itens (adicionar/remover)
    │       ├── campo de desconto
    │       └── modal de fechamento (simples ou split)
    ├── /produtos — admin
    │   └── modal de ficha técnica por produto
    ├── /estoque — admin e caixa
    ├── /financeiro — admin
    ├── /despesas — admin
    ├── /cozinha — cozinha (login dedicado) e admin (desde 2026-07-29, via navbar/dashboard)
    └── /dashboard — admin
```

**Critério de organização:** operador de caixa começa e termina em /mesas — sem necessidade de navegar para outros módulos durante o serviço. Admin tem visão completa, incluindo a fila da cozinha em tempo real. Navbar exibe apenas os itens acessíveis para o role atual.

**Nota (2026-07-29):** /cozinha já aceitava ADMIN no servidor desde a v1.13 do KDS (2026-06-27), mas sem nenhum link visível — só era alcançável digitando a URL manualmente. Passou a existir na navbar (item "Cozinha") e no dashboard inicial (card, mesmo padrão do card "Caixas"), ambos restritos a ADMIN.

---

## 4. Fluxos principais

### Fluxo: Abertura de mesa e registro de pedido

```
[/mesas — grade com polling 3s]
    ↓ clica em mesa verde (LIVRE)
[/comanda/[id] — comanda vazia]
    ↓ seleciona produto do cardápio
[item adicionado → total atualiza]
    ↓ adiciona mais itens
    ↓ (opcionalmente) digita desconto
[total final visível]
    ↓ clica "Fechar Conta"
[Modal de fechamento]
    ↓ (pagamento simples)        ↓ (split payment)
[seleciona forma + confirma]   [adiciona formas e valores até saldo = 0]
    ↓                               ↓
[Pedido PAGO → Mesa LIVRE → Modal fecha → Grade atualiza]
```

**Critério de sucesso:** operador fecha mesa com split payment em menos de 2 minutos.
**Ponto de abandono mais comum:** confusão entre "Fechar Conta" (fecha o pedido) e liberar a mesa — resolvido com botão único "Fechar e Liberar Mesa".

### Fluxo: Cancelamento de pedido

```
[/comanda/[id]]
    ↓ clica "Cancelar Pedido"
[Dialog de confirmação]
    ↓ campo de motivo (obrigatório)
    ↓ (motivo preenchido)          ↓ (motivo vazio)
[Confirma → CancelamentoLog criado → Mesa LIVRE]   [Submit bloqueado]
```

**Critério de sucesso:** cancelamento fica auditado com motivo, responsável e timestamp.
**Ponto de abandono mais comum:** operador clicava em cancelar por acidente — dialog de confirmação resolve.

### Fluxo: Onboarding de novo operador (modo treinamento)

```
[Login com credencial de treinamento]
    ↓ middleware detecta isTrainee = true
[Todas as telas visualmente iguais]
    ↓ operador abre mesa, adiciona itens, fecha conta
[Middleware intercepta mutações → retorna sucesso falso]
[Nada é persistido no banco]
```

**Critério de sucesso:** novo operador pratica o fluxo completo sem risco de contaminar dados reais.

---

## 5. Testes de usabilidade

| Cenário testado | Comportamento esperado | Comportamento observado | Conclusão |
|---|---|---|---|
| Operador fecha conta com dinheiro + PIX | informa dois valores que somam o total, confirma | confusão sobre qual campo era cada forma | SplitPaymentForm ganhou labels explícitos e saldo restante em tempo real |
| Operador tenta cancelar sem motivo | submit bloqueado, campo highlighted | operador deixava o campo vazio e esperava — sem feedback | mensagem de erro inline ao tentar submeter |
| Admin consulta financeiro do dia anterior | seleciona ontem no filtro de data | padrão era "hoje" — usuário não sabia que podia selecionar outro período | label "Período" mais visível; exemplos de datas nos tooltips |
| Operador adiciona item que não está no estoque | sistema permite adicionar — estoque vai negativo | operador ficava em dúvida se a operação foi correta | toast informativo "item adicionado — estoque atual negativo" (não bloqueia) |

---

## 6. Iterações registradas

| Data | O que mudou | Por que mudou | Resultado observado |
|---|---|---|---|
| 2026-04-30 | FormaPagamento como enum (DINHEIRO, CARTAO, PIX) | texto livre gerava inconsistências no relatório | relatório de formas de pagamento passou a ser confiável |
| 2026-05-11 | CancelamentoLog com motivo obrigatório | cancelamentos sem rastreio impossibilitavam auditoria | 100% dos cancelamentos agora têm motivo e responsável |
| 2026-05-11 | Modo treinamento via isTrainee no middleware | operadoras precisavam praticar sem afetar dados reais | onboarding sem risco implementado |
| 2026-05-11 | CREDITO e DEBITO separados de CARTAO | operador precisava distinguir para relatório de taxas | relatório financeiro passou a mostrar cartão em categoria específica |
| 2026-05-14 | Split payment com validação de soma em tempo real | operador precisava saber quanto faltava ao compor o split | erro de soma eliminado antes do submit |
| 2026-07-29 | Correção de quantidade não exibida no card do KDS | pedido de "2x" um prato aparecia como 1 unidade só, sem multiplicador visível | cozinheiro passa a ver "2x Nome do Prato" e o contador "a fazer" soma quantidades corretamente |
| 2026-07-29 | ADMIN ganha ponto de acesso à Cozinha (navbar + dashboard) | admin precisava digitar /cozinha manualmente para acompanhar a fila — autorização já existia, faltava descoberta | admin acompanha a fila da cozinha em tempo real a partir da própria navegação, sem sair do fluxo normal do sistema |
