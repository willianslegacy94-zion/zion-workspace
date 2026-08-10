---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-02
owner: willians
---

# UX — Lane Confeitaria

## 1. Pesquisa

Pesquisa a partir do briefing direto da cliente na conversa de kickoff, mais 5 imagens reais de material de divulgação (cardápio de sabores, menu de docinhos, regras de pedido, logo da marca). Sem entrevista estruturada adicional nem protótipo validado com a Lane antes da implementação.

### Descobertas principais

- A cliente já opera com regras de negócio bem definidas (sinal 50%, cancelamento 24h, até 2 sabores, acréscimos) — o sistema não precisa "inventar" processo, só digitalizar o que já existe
- O maior risco de UX não é estético, é de **omissão de dado**: preço por sabor e custo de insumo não foram fornecidos, então a interface precisa lidar bem com "ainda não sei esse número" sem mentir com um zero

## 2. Jornada do usuário

### Jornada principal — Lane fecha um pedido novo

1. Abre o CRM (`/crm`), clica em "Novo pedido"
2. Preenche cliente, escolhe até 2 sabores (chips selecionáveis), massa, peso, data de entrega, valor combinado e acréscimos aplicáveis
3. Sistema calcula sinal automaticamente — Lane não faz conta de cabeça
4. Pedido aparece na primeira fila do funil; Lane move o card conforme negocia com a cliente

### Jornada secundária — Lane confirma produção e a Agenda protege a capacidade

1. Lane move o pedido para a fila marcada como "dispara agendamento" (configurada previamente)
2. Se o dia da entrega já tem 5 bolos agendados, o sistema bloqueia a movimentação e avisa — Lane escolhe outra data ou negocia com a cliente antes de prometer

### Jornada terciária — Lane olha o dashboard no fim do dia

1. Abre `/dashboard` no celular
2. Vê progresso da meta do mês, receita/lucro, ranking de peso e se algum sabor está sem custo cadastrado
3. Usa a calculadora de projeção para decidir se vale aceitar mais 3 bolos de um sabor específico no mês

### Jornada nova (2026-08-02) — cliente fala com a Mel no WhatsApp, Lane só acompanha

1. Cliente manda a primeira mensagem no WhatsApp da confeitaria — card aparece sozinho em "Novo Cliente" no `/crm` da Lane, sem ela precisar fazer nada
2. Conforme a conversa avança (cliente descreve o que quer), o card pula pra "Em negociação" sozinho
3. Mel confirma sabor (com preço real do catálogo), massa, peso, data (checando vaga real na agenda) e nome do cliente
4. Se o cliente manda foto do bolo desejado, Mel comenta o que vê antes de seguir
5. Ao fechar, `Pedido` de verdade é criado e avança sozinho até "Agendado" (reservando a vaga real de produção)
6. Se a Mel não conseguir resolver algo sozinha (sabor sem preço, dúvida fora do roteiro), o card pula pra "Atendimento Humanizado" e ela **para de responder** — só a Lane continua a conversa a partir daí, até mover o card pra outro lugar
7. Cliente manda comprovante de Pix do sinal — Mel analisa (valor, data, destinatário) e, se bater, sinaliza "🔍 validar comprovante" no card; **nunca marca como pago sozinha**
8. Lane abre o card (modal), vê o resumo que a Mel escreveu do comprovante, e aprova ou rejeita — só aí o sinal fica de fato marcado como pago

## 3. Arquitetura de informação

```
/ (redireciona conforme sessão)
├── /login
└── /(app) — exige sessão
    ├── /dashboard        → metas, financeiro, ranking, projeção, recorrência
    ├── /crm               → kanban de pedidos
    ├── /agenda            → calendário de produção
    ├── /financeiro         → indicadores + CMV
    │   ├── /despesas
    │   └── /insumos
    ├── /clientes           → listagem + recorrência
    └── /configuracoes
        ├── /whatsapp
        ├── /filas
        ├── /cardapio
        ├── /agenda
        └── /precificacao
```

Sem segregação por papel (sistema single-tenant) — toda a árvore é acessível à única usuária autenticada.

## 4. Fluxos principais

### Fluxo: criar pedido → mover para produção → agendar

Ver diagrama completo em [[arquitetura-lane-confeitaria]], seção 4. Do ponto de vista de UX, o ponto crítico é que o bloqueio de agenda cheia acontece **no momento de mover o card**, não em uma tela separada — a usuária não perde o contexto do pedido que está tentando confirmar.

### Fluxo: sabor sem preço cadastrado

Ao criar um pedido, sabores sem `precoPorKg` ainda aparecem selecionáveis no formulário (o pedido em si não depende do preço de catálogo — o valor é digitado manualmente por pedido). Já na Calculadora de Projeção (dashboard), sabores sem preço **não aparecem como opção** — porque ali o preço de catálogo é a única fonte possível, sem valor manual por simulação.

### Fluxo: cancelamento com sinal retido

Cancelar um pedido é uma ação de um clique no card (com `confirm()`), mas o resultado é assíncrono e visível: o card fica com opacidade reduzida e um badge vermelho ("cancelado · sinal retido" quando aplicável) — a usuária não precisa abrir o pedido para saber o que aconteceu.

### Fluxo (2026-08-02): conectar WhatsApp

Lane entra em Configurações → WhatsApp, vê um QR code na tela (gerado na hora, sem precisar pedir pra ninguém), escaneia com o celular da confeitaria (Aparelhos conectados → Conectar um aparelho). A tela detecta a conexão sozinha (poll a cada 3s) e troca o QR code por "✅ WhatsApp conectado", sem precisar dar refresh manual. Ponto de atenção de UX que virou recomendação operacional: se o número escaneado já tiver uso pessoal ativo, o histórico inteiro sincroniza — vale só conectar um número dedicado ao negócio.

### Fluxo (2026-08-02): validar comprovante sinalizado pela IA

Card com badge "🔍 validar comprovante" chama atenção na coluna sem a Lane precisar abrir um por um. Clicar no card abre o modal com o resumo que a Mel escreveu do que viu na imagem (valor, data, remetente) — a Lane confere contra o extrato de verdade e clica em "Aprovar" (marca sinal como pago) ou "Rejeitar" (só limpa o alerta, sinal continua pendente). Mesmo modal também expõe botões pra marcar sinal/saldo como pago manualmente, sem depender de a IA ter sinalizado nada.

## 5. Testes de usabilidade

Nenhum teste com a usuária real (Lane) foi realizado até este documento. Validação foi feita via:
- Smoke test de rotas com `curl` (proteção de login, redirecionamentos)
- Build de produção limpo + 30 testes unitários das regras de negócio
- Revisão de código dos fluxos críticos (limite de fila, limite de agenda, cálculo de CMV/sinal)

**Lacuna registrada:** UX real de mobile (toque, tamanho de área clicável, drag-and-drop em touchscreen) não foi testada em dispositivo físico.

## 6. Iterações registradas

Duas correções nasceram diretamente de teste/revisão durante a construção, não de feedback da usuária (ainda não houve):

1. **Proteção de rota:** smoke test revelou que `/dashboard` era acessível sem login — corrigido adicionando o callback `authorized` faltante
2. **Classificação de faixa de peso:** teste unitário revelou que um bolo de 1kg era classificado como "5kg" — corrigido com limite inferior de 2.5kg por faixa

Mais quatro, nascidas do primeiro teste real com o usuário acompanhando ao vivo (2026-08-02), primeira vez com alguém observando a tela em tempo real durante o desenvolvimento:

3. **Card não nascia até o pedido estar 100% fechado** — usuário esperava ver o card assim que a Mel começasse a conversa, não só no fechamento. Motivou o modelo `Atendimento`.
4. **Card não avançava sozinho pelo funil** — usuário esperava ver o Kanban se mover conforme a conversa progredia, sem precisar arrastar manualmente. Motivou os flags `recebePedidoAutomatico`/`disparaAtendimentoHumano`.
5. **Board não atualizava sem F5** — usuário reparou que precisava atualizar a página manualmente pra ver mudança feita pela IA. Motivou o polling de 5s (`router.refresh()`) no `KanbanBoard`.
6. **IA confirmando pagamento sozinha, sem checagem humana** — usuário viu a Mel marcar sinal como pago só por ter lido um comprovante, e pediu que isso nunca acontecesse sem validação da Lane. Motivou `comprovanteParaValidar` + modal.

Todas registradas com detalhe em [[registro-de-decisoes-lane-confeitaria]].

---

## Links relacionados

[[prd-lane-confeitaria]] — objetivo, usuário e escopo que estes fluxos validam
[[design-system-lane-confeitaria]] — padrões de interação referenciados nos fluxos acima
[[arquitetura-lane-confeitaria]] — implementação técnica dos fluxos descritos
