---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-07-29
owner: willians
---

# UX — Jocley Grill

> Referência: [[prd-jocley-lanchonete]] | [[design-system-jocley-lanchonete]]

---

## 1. Pesquisa

**Método:** briefing direto do cliente (áudio transcrito) + exploração de código real dos dois sistemas de referência (vilamill-sistema, sistema-thieco) em produção no mesmo workspace.

**Participantes:**
- Cliente (dono da Jocley Grill) — briefing do fluxo desejado para atendente/caixa
- Willians (operador do workspace, decisões de escopo) — respostas às perguntas de esclarecimento levantadas durante a construção

**Período:** 2026-07-29 (sessão única)

### Descobertas principais

| Descoberta | Evidência | Impacto no produto |
|---|---|---|
| O atendente de mesa não deve ter o mesmo acesso do caixa | Áudio do cliente: "eu quero que o cara, o atendente, esteja só no tablet ali... vai ter acesso só aos produtos... acesso ao fechamento de mesa" | Criação do papel ATENDENTE, distinto de CAIXA, sem acesso a Estoque nem telas administrativas |
| O dono quer delegar a criação de login sem depender de deploy | "a gente pode criar aí um login supervisor... e eu dou os acessos" | Criação do papel SUPERVISOR + tela de Usuários com restrição de papel por quem cria |
| O fechamento físico da comanda passa pelo caixa, mesmo quando o atendente lança os itens | "fechou a mesa, imprimiu o cupom no caixa, vai lá, retira, leva até o cliente para fazer o pagamento" | Interpretado como logística física de impressão (impressora fica no caixa), não como restrição de permissão — o Atendente mantém acesso ao fechamento da comanda em si (ver Registro de Decisões) |
| CMV precisa ser calculado, não digitado (diferente do vilamill original) | Pedido explícito do cliente por uma aba própria de CMV | `/cmv` como aba separada de `/produtos`, com cálculo automático a partir de ficha técnica |
| Cupom térmico já é uma funcionalidade resolvida, não pendência | Pergunta de confirmação do cliente durante a sessão: "lembrando que a parte de impressão do cupom já foi configurada?" | Confirmado: Módulo 8 (Cupom Térmico) implementado e testado desde a Fase 3 da construção — não é item de backlog |

---

## 2. Jornada do usuário

### Jornada principal — Atendente lança pedido na mesa e fecha a comanda

| Etapa | O que o usuário faz | O que pensa/sente | Ponto de fricção | Oportunidade |
|---|---|---|---|---|
| Acessa `/mesas` no tablet | vê o grid de mesas | "qual mesa está livre?" | nenhuma — cores semânticas eliminam leitura de texto | — |
| Clica na mesa LIVRE | navega para a comanda | "abriu direto, sem menu" | nenhuma | tap direto, mesmo padrão do vilamill |
| Adiciona itens do cardápio | seleciona produtos por categoria | "cadê o espeto de frango?" | scroll se a categoria não for evidente | filtro de categoria no topo do catálogo |
| Clica em "Fechar Comanda" | abre o modal de pagamento | "o cliente vai pagar no caixa" | atendente processa o pagamento no próprio tablet, mesmo que fisicamente o cliente pague perto do caixa (decisão de manter o fluxo unificado — ver Registro de Decisões) | — |
| Confirma pagamento (split, se necessário) | informa forma(s) e valor(es) | "validou que a soma bate" | erro de soma só aparecia ao tentar confirmar | validação em tempo real do restante, mesmo padrão do vilamill |
| Cupom imprime | `window.print()` dispara | "cupom saiu" | impressora física normalmente fica no caixa, não no tablet do atendente — depende da configuração de rede/impressora do estabelecimento | fora do escopo de software — decisão de hardware do cliente |
| Mesa libera | grid volta a mostrar LIVRE | "próximo cliente" | — | feedback imediato via SWR |

### Jornada secundária — Admin acompanha o CMV do cardápio

| Etapa | O que o usuário faz | O que pensa/sente | Oportunidade |
|---|---|---|---|
| Acessa `/cmv` | vê a tabela de produtos com custo calculado | "quanto custa cada espeto?" | markup e margem já calculados, sem planilha |
| Edita a ficha técnica de um produto | adiciona/ajusta quantidade de insumo | "isso reflete direto no custo" | recálculo automático, sem botão "salvar cálculo" separado |
| Clica em "Preço sugerido" | aplica novo preço baseado na margem-alvo | "não preciso calcular na mão" | um clique aplica o preço |

### Jornada terciária — Supervisor cadastra um novo atendente

| Etapa | O que o usuário faz | O que pensa/sente | Oportunidade |
|---|---|---|---|
| Acessa `/usuarios` | vê a lista de logins existentes | "quero cadastrar o novo garçom" | tela só aparece pra quem tem permissão de gestão |
| Clica em "Novo Usuário" | preenche nome, login, senha e papel | "só posso escolher Caixa/Atendente/Cozinha" | o seletor de papel já vem restrito — sem tentativa e erro |
| Salva | usuário criado | "pronto, ele já pode logar" | sem precisar pedir pra um desenvolvedor |

---

## 3. Arquitetura de informação

```
/login
├── / (Início — dashboard financeiro) — ADMIN
│   └── /inteligencia — ADMIN
│       └── /inteligencia/dre — ADMIN (impressão)
├── /mesas — ADMIN, SUPERVISOR, CAIXA, ATENDENTE
│   └── /comanda/[id]
├── /balcao — ADMIN, SUPERVISOR, CAIXA, ATENDENTE
├── /produtos (Cardápio) — todos (CRUD para ADMIN/SUPERVISOR; visualização para CAIXA/ATENDENTE)
├── /cmv — ADMIN
├── /estoque — ADMIN, SUPERVISOR, CAIXA (visualização para CAIXA)
├── /cozinha — ADMIN, SUPERVISOR, COZINHA
├── /lancamentos — ADMIN, SUPERVISOR
├── /despesas — ADMIN, SUPERVISOR
├── /time — ADMIN, SUPERVISOR
├── /usuarios — ADMIN, SUPERVISOR
└── /configuracoes — ADMIN
```

**Critério de organização:** cada papel começa e termina na própria home operacional (`/mesas` para os papéis de venda, `/cozinha` para a cozinha, `/` para o Admin) — a Sidebar/Navbar só lista o que aquele papel efetivamente acessa.

---

## 4. Fluxos principais

### Fluxo: Abertura e fechamento de comanda (mesa ou balcão)

```
[/mesas ou /balcao]
    ↓ abre mesa LIVRE ou cria comanda de balcão
[/comanda/[id]]
    ↓ adiciona itens do cardápio
[total atualiza em tempo real]
    ↓ clica "Fechar Comanda"
[PagamentoSplitDialog]
    ↓ (pagamento simples)         ↓ (split payment, com bandeira opcional)
[seleciona forma + confirma]   [adiciona formas/valores até restante = 0]
    ↓                               ↓
[Comanda FECHADO → estoque deduzido → cupom imprime → mesa libera (se MESA)]
```

**Critério de sucesso:** fechamento em menos de 2 minutos, mesmo padrão do vilamill.

### Fluxo: Cálculo de CMV

```
[/cmv]
    ↓ abre ficha técnica de um produto
[FichaTecnicaEditor]
    ↓ adiciona/edita insumo + quantidade
[Product.costPrice recalculado automaticamente]
    ↓ volta pra tabela de CMV
[markup e margem atualizados, cor condicional pela faixa de margem]
```

### Fluxo: Criação de usuário por Supervisor

```
[/usuarios — Supervisor logado]
    ↓ clica "Novo Usuário"
[formulário com seletor de papel já restrito a Caixa/Atendente/Cozinha]
    ↓ preenche e salva
[POST /api/users — servidor valida de novo que o papel está na lista permitida]
    ↓ (papel válido)              ↓ (tentativa de burlar via API direta)
[usuário criado]              [403 — bloqueado no servidor, não só na UI]
```

---

## 5. Testes de usabilidade

| Cenário testado | Comportamento esperado | Comportamento observado | Conclusão |
|---|---|---|---|
| Caixa/Atendente tenta chamar API de mesas/pedidos após a primeira versão do middleware | deveria funcionar normalmente (é a própria tela dele) | middleware bloqueava, porque a restrição de rota por role também cobria `/api/*` sem considerar que a própria UI do papel depende dessas chamadas | corrigido: restrição de role passou a valer só para páginas, `/api/*` liberado após checagem de sessão (ver Registro de Decisões) |
| Login em porta diferente da configurada em `NEXTAUTH_URL` | deveria redirecionar para a própria aplicação após login | redirecionava para a porta 3000, onde o vilamill-sistema (outro projeto do mesmo workspace) estava rodando | corrigido: `.env` ajustado para a porta real (3001) |
| Fechamento de comanda com forma Crédito + bandeira Visa cadastrada a 2,5% (taxa padrão de crédito era 3,49%) | taxa aplicada deveria ser a específica da bandeira | confirmado via requisição real: `taxaTotal` calculado com 2,5%, não 3,49% | taxa por bandeira funcionando corretamente |
| Reset do banco (`prisma migrate reset`) com sessão de teste antiga ainda ativa | deveria continuar funcionando ou dar erro de sessão claro | erro 500 (`Foreign key constraint violated: Order_caixaId_fkey`) — sessão antiga referenciava um `User.id` que não existia mais após o reset | não é bug do sistema — artefato do próprio processo de teste manual (login precisa ser refeito após um reset de banco); documentado para não ser confundido com defeito real |

---

## 6. Iterações registradas

| Data | O que mudou | Por que mudou | Resultado observado |
|---|---|---|---|
| 2026-07-29 | Restrição de role no middleware passou a valer só para páginas, não para `/api/*` | Caixa/Atendente não conseguiam usar o próprio PDV — todas as chamadas de API do próprio fluxo operacional estavam sendo bloqueadas | PDV voltou a funcionar para todos os papéis; escrita sensível (produtos/insumos/usuários) passou a ser reforçada dentro do próprio route handler (`guardGestor()`) em vez de no middleware |
| 2026-07-29 | `.env` corrigido — `NEXTAUTH_URL`/`AUTH_URL` para a porta real do projeto | Redirect pós-login levava para outro sistema do mesmo workspace, rodando em outra porta | Login passou a redirecionar corretamente para dentro do próprio sistema |
| 2026-07-29 | Papéis SUPERVISOR e ATENDENTE adicionados, com tela de Usuários | Pedido explícito do cliente por segregação de acesso mais granular do que Admin/Caixa/Cozinha | Atendente de tablet restrito a Cardápio+Mesas+Balcão; Supervisor com acesso operacional amplo mas sem financeiro estratégico; dono pode criar login sem deploy |
| 2026-07-29 | Taxa por forma de pagamento ganhou suporte opcional a bandeira | Pedido do cliente: "na parte de cartão eu quero que seja possível cadastrar por bandeira, mas isso pode ser opcional" | Split payment ganhou seletor de bandeira (opcional) para Crédito/Débito; Configurações ganhou seção expansível "Por bandeira" |
