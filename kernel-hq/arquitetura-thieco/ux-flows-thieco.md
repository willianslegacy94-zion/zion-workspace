---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-07-12
owner: willians
---

# UX — Barbearia Thieco Leandro

> Referência: [[prd-thieco]] | [[design-system-thieco]]

---

## 1. Pesquisa

**Método:** observação direta da operação + análise dos dados históricos (8.580 vendas) + conversas com o dono (Thieco/Willians) sobre as dores do processo manual anterior.

**Participantes:**
- Thieco Leandro (dono e admin) — 1 pessoa
- Igor Hidalgo e Kauã dos Santos (barbeiros/operadores) — 2 pessoas

**Período:** sessões de levantamento desde o início do projeto (2024)

### Descobertas principais

| Descoberta | Evidência | Impacto no produto |
|---|---|---|
| Barbeiro quer registrar a venda no próprio celular, imediatamente após o atendimento | Processo anterior: anotação no caderno para lançar depois — gerava esquecimentos | Interface mobile-first com formulário de venda simples e rápido |
| O maior ponto de atrito era o cálculo de comissão no fim do dia | Cálculo manual com planilha — erros frequentes geravam conflito | Cálculo automático em tempo real no momento do registro |
| Tambore e Mutinga têm dinâmicas distintas — o dono quer ver cada uma separada | Faturamentos misturados tornavam impossível saber qual unidade performava melhor | Filtro de unidade em todas as telas de relatório |
| Desconto era absorvido pelo barbeiro (reduzia a comissão) — o que gerava resistência | Barbeiros reclamavam de perder comissão em descontos que não deram | Regra: comissão calculada sobre valor bruto, desconto absorvido pela barbearia |
| Produtos físicos (pomadas, shampoos) eram tratados igual a serviços nas comissões | 40% de comissão sobre venda de produto era desproporcional e cria desincentivo para vender | Comissão diferenciada: 10% para produto físico, 40% para serviço |

---

## 2. Jornada do usuário

### Jornada principal — Barbeiro registra uma venda

| Etapa | O que o usuário faz | O que pensa/sente | Ponto de fricção | Oportunidade |
|---|---|---|---|---|
| Login | abre o sistema no celular e entra com suas credenciais | "preciso fazer isso rápido entre um cliente e outro" | teclado pequeno no celular | autocomplete de email; senha simples |
| Seleciona profissional | sistema já pré-seleciona com base no login | — | nenhum — automático | manter default para próprio profissional |
| Informa serviço | digita ou seleciona no autocomplete do catálogo | "qual é o nome exato que devo usar?" | variações de nome para o mesmo serviço | catálogo como autocomplete evita digitação livre |
| Informa valor | digita o valor com máscara monetária | "tenho que lembrar o desconto que dei" | campo de desconto separado não é óbvio | desconto visível ao lado do valor, não escondido |
| Seleciona pagamento | toca em dinheiro / pix / débito / crédito | "se foi crédito Visa tenho que informar a bandeira" | bandeira de cartão só aparece em Mutinga — em Tambore não | mostrar campo de bandeira condicionalmente |
| Revisa e salva | vê comissão e valor líquido calculados | "certo — bate com o que eu esperava" | — | confirmação visual clara antes do submit |
| Confirmação | toast "venda registrada" | "pronto, posso chamar o próximo" | — | retorno imediato sem reload de página |

### Jornada secundária — Admin fecha o dia

| Etapa | O que o usuário faz | O que pensa/sente | Ponto de fricção | Oportunidade |
|---|---|---|---|---|
| Acessa relatório | filtra por data e unidade | "quero ver só hoje em Tambore" | ter que selecionar filtros toda vez | persistir última seleção de filtro na sessão |
| Confere faturamento | vê total por forma de pagamento | "o PIX bateu com o que está no app?" | não há conciliação automática com banco | separação clara por forma facilita conferência manual |
| Confere comissões | vê comissão por profissional | "preciso pagar o Igor e o Kauã" | comissão de serviço e produto separadas podem confundir | exibir total consolidado em destaque + breakdown abaixo |
| Registra gastos do dia | lança aluguel, produtos comprados | "tenho que lembrar de tudo que gastei" | sem alerta para gastos recorrentes | futura melhoria: gastos recorrentes com template |
| Fecha mentalmente o dia | subtrai gastos do faturamento | "quanto sobrou hoje?" | DRE não está sempre visível | seção de resultado (faturamento - gastos) no próprio relatório |

---

## 3. Arquitetura de informação

```
Login
└── Home / Dashboard
    ├── Caixa do Dia (default para barbeiro)
    │   ├── Registrar Venda (formulário)
    │   └── Listagem de Vendas do Dia
    ├── Relatórios (admin)
    │   ├── Faturamento por Período
    │   ├── Comissões por Profissional
    │   └── DRE Simplificado
    ├── Gastos
    │   ├── Registrar Gasto
    │   └── Listagem de Gastos
    ├── Profissionais (admin)
    │   ├── Listar / Criar / Editar
    │   └── Ativar / Desativar
    ├── Catálogo
    │   └── Serviços e Produtos com flag de estoque
    ├── Clientes
    ├── Combos
    ├── Metas (por unidade e profissional)
    ├── Agenda (desde 2026-07-12 — barbeiro vê a própria, admin/operador com filtro)
    └── Configurações (admin — Taxas de Cartão + Notificações, desde 2026-07-12)

Fora do shell autenticado (desde 2026-07-12):
    ├── ?agendar=<unidade>  — cliente agenda sozinho, sem login
    └── ?confirmar=<codigo> — cliente confirma presença, sem login
```

**Critério de organização:** o que o barbeiro usa está sempre acessível sem scroll ou menu profundo; o que é exclusivo do admin está separado na navegação — evita que o barbeiro veja opções irrelevantes.

---

## 4. Fluxos principais

### Fluxo: Registro de venda (barbeiro)

```
[Login]
    ↓
[Caixa do Dia — lista de vendas]
    ↓ clica em "+ Registrar Venda"
[Formulário de Venda]
    ↓ preenche campos → comissão e valor líquido calculados em tempo real
    ↓ (campos válidos)              ↓ (campo inválido)
[Submit → toast "Venda registrada"]  [Erro inline no campo]
    ↓
[Volta para lista do dia — nova venda aparece no topo]
```

**Critério de sucesso:** barbeiro registra uma venda em menos de 60 segundos sem precisar de ajuda.
**Ponto de abandono mais comum:** campo de valor sem máscara — operador digitava ponto onde deveria ser vírgula.

### Fluxo: Relatório do dia (admin)

```
[Login como admin]
    ↓
[Dashboard]
    ↓ clica em "Relatório"
[Seleciona período e unidade]
    ↓
[Tabela de vendas + totais por forma de pagamento]
    ↓ clica em "Comissões"
[Total por profissional, separado por serviço e produto]
    ↓ clica em "DRE"]
[Faturamento - Gastos = Resultado]
```

**Critério de sucesso:** admin consegue fechar o dia com números em menos de 5 minutos.
**Ponto de abandono mais comum:** DRE incompleto porque gastos não foram lançados no sistema.

### Fluxo: Cliente agenda sozinho via link público (desde 2026-07-12)

```
[Cliente clica no link do WhatsApp/bio — ?agendar=mutinga ou ?agendar=tambore]
    ↓ (sem login, fora do shell autenticado)
[Escolhe o serviço — lista com preço e duração]
    ↓
[Escolhe a data — próximos 14 dias]
    ↓ sistema consulta disponibilidade real (jornada + agendamentos já marcados)
[Escolhe o horário — só os realmente livres aparecem]
    ↓
[Escolhe o barbeiro, ou "qualquer disponível"]
    ↓
[Preenche nome e WhatsApp]
    ↓ servidor revalida tudo antes de confirmar (nunca confia no cliente)
[Tela de sucesso com resumo do agendamento]
```

**Critério de sucesso:** cliente agenda sem precisar falar com ninguém, vendo só horários que realmente existem (nunca um horário que na hora de confirmar já não está mais livre).
**Ponto de atenção:** se dois clientes tentam o mesmo horário ao mesmo tempo, o segundo recebe erro claro ("horário acabou de ser ocupado") em vez de um agendamento fantasma — testado com corrida real.

### Fluxo: Cliente confirma presença (desde 2026-07-12)

```
[Barbeiro/admin copia o link de confirmação na tela Agenda]
    ↓ (envio hoje é manual, via WhatsApp)
[Cliente clica no link — ?confirmar=<codigo>]
    ↓ (sem login)
[Vê os dados do agendamento: serviço, barbeiro, data/hora]
    ↓ clica "Sim, vou comparecer"
[Tela de confirmação — "Te esperamos!"]
    ↓
[Barbeiro/admin vê o ✓ de confirmado direto no card da Agenda]
```

**Critério de sucesso:** reduz falta (no-show) sem exigir que o cliente crie conta ou baixe nada.
**Limitação conhecida:** envio do link ainda é manual — sem integração de WhatsApp automatizada, depende de alguém lembrar de mandar (mitigado parcialmente pelo lembrete automatizado que já enfileira a mensagem sozinho, mas o disparo de fato ainda não existe).

### Fluxo: Admin liga um gatilho automático ao cliente (desde 2026-07-12)

```
[Configurações → aba "Gatilhos ao Cliente"]
    ↓
[Escolhe a unidade — cada uma tem sua própria configuração]
    ↓
[Vê os 3 cards: Aniversariante, Cliente sumido, Pedido de avaliação]
    ↓
[Liga o toggle do gatilho desejado]
    ↓ (cliente sumido) define quantos dias sem visita | (avaliação) precisa do link do Google já cadastrado acima
[Edita o template da mensagem — preview substitui os placeholders por um exemplo]
    ↓
[Salva]
    ↓ (sem ação manual daqui pra frente)
[Sistema dispara sozinho quando a condição bate — 5min ou 15min de ciclo, dependendo do gatilho]
```

**Critério de sucesso:** admin liga uma vez e esquece — não precisa lembrar de mandar mensagem individual pra cada cliente que faz aniversário ou some.
**Ponto de atenção:** "Pedido de avaliação" fica mudo se o link do Google Meu Negócio não estiver preenchido no card acima — falha silenciosa por design (não dispara mensagem sem link), não é bug.

### Fluxo: Admin dispara promoção segmentada e confere resultado (desde 2026-07-12)

```
[Configurações → aba "Promoções"]
    ↓
[Escreve título (uso interno) e mensagem]
    ↓
[Define o filtro: dias sem visita, tipo de cliente, ticket gasto, serviço já consumido]
    ↓
[Clica "Ver audiência" — obrigatório antes de poder disparar]
    ↓ sistema mostra quantos clientes batem o filtro + amostra de nomes + quantos foram pulados por cooldown
[Confere o número, ajusta o filtro se necessário]
    ↓
[Clica "Disparar agora" — confirmação explícita, ação não reversível]
    ↓
[Mensagem some do formulário, aparece no histórico]

--- dias/semanas depois ---

[Histórico de disparos → clica na campanha]
    ↓
[Expande "resultados": quantos converteram, taxa de conversão, faturamento gerado, agendamentos gerados]
```

**Critério de sucesso:** admin nunca dispara "às cegas" (audiência sempre confirmada antes de enviar) e consegue ver depois se a campanha trouxe cliente de volta, sem precisar cruzar planilha nenhuma.
**Ponto de atenção:** "Ver audiência" é obrigatório — o botão "Disparar agora" fica desabilitado até isso acontecer, e qualquer mudança no filtro invalida o preview (evita disparar pra um número que não confere mais com o filtro atual).

---

## 5. Testes de usabilidade

| Cenário testado | Comportamento esperado | Comportamento observado | Conclusão |
|---|---|---|---|
| Barbeiro registra venda com desconto | Preenche valor, desconto, vê comissão calculada corretamente | Barbeiro não percebia o campo de desconto ao lado do valor | Campo de desconto ganhou label mais visível |
| Barbeiro tenta ver relatório de outro profissional | Sistema bloqueia, mostra só as próprias vendas | Não houve tentativa — barbeiro não via opção de filtro de profissional | Confirmado: filtro de profissional não aparece para barbeiro logado |
| Admin filtra por Mutinga e confere taxa de cartão | Taxa diferenciada por bandeira aplicada ao valor líquido | Admin questionou diferença entre Visa e outras bandeiras | Campo de bandeira com tooltip explicando as taxas |

---

## 6. Iterações registradas

| Data | O que mudou | Por que mudou | Resultado observado |
|---|---|---|---|
| 2025 | Adição de unidade Mutinga com taxas separadas | Segunda unidade aberta com regras de maquininha distintas | Relatórios de Tambore e Mutinga passaram a ser comparáveis |
| 2026-04 | Separação de comissão por tipo de item (40% serviço / 10% produto) | Barbeiros reclamavam da comissão alta em produtos e resistiam a vender | Aceitação maior da venda de produtos físicos pelos barbeiros |
| 2026-04 | Campo de bandeira de cartão condicional (só Mutinga) | Taxa PagBank varia por bandeira em Mutinga — Tambore usa taxa flat | Valor líquido calculado com precisão em ambas as unidades |
| 2026-05 | Produto físico excluído do ranking de serviços e sugestão de upsell | Pomadas e shampoos distorciam o ranking dos serviços mais vendidos | Ranking passou a refletir apenas performance de serviços |
| 2026-07-04 | Aba Combos: `<select>` nativo trocado por seletor premium, créditos viram steppers, carrinho unificado de avulsos | Combo com serviços fixos (corte/barba) não escalava para pacotes com Risco/Progressiva/Sobrancelha etc.; dropdown nativo quebrava o padrão visual dourado do resto do app | Steppers travados no saldo real por serviço; seletor de pacote com busca e preço, valor travado ao selecionar; "Serviço adicional (upsell)" ganhou o mesmo padrão de quantidade + "Adicionar" do carrinho de Produtos, reposicionado logo abaixo do card de saldo do combo; renovação exposta direto quando o saldo esgota, sem duplicar a ação de pagamento antecipado |
| 2026-07-08 | Botão "Editar" na aba Combos para corrigir data de lançamento | Cadastro retroativo de combo vendido fora do sistema (Booksy) gravava a validade a partir do dia do cadastro, não da compra real | Primeira versão (só ícone de lápis 11px embutido no texto) passou despercebida pelo usuário; corrigida para botão com texto "Editar", padrão de `Clientes.jsx` |
| 2026-07-09 | Comissão do barbeiro exibida por lançamento na tela de Lançamentos (não só no momento do registro) | Barbeiro só via o ganho estimado ao registrar a venda (RF-049); depois disso, sem consultar o fechamento do dia, não sabia quanto tinha ganhado num atendimento específico | Comissão visível no card simples, no total do grupo e em cada item expandido |
| 2026-07-09 | Campo "Caixinha" na aba Venda e na aba Combo (RegistroVenda) | Gorjeta já acontecia na prática mas só ficava registrada como texto solto em `observacao`, sem forma de pagamento própria nem visibilidade no fechamento | Caixinha some do faturamento/comissão da empresa (100% repasse), aparece separada no "Seu Ganho Total" do barbeiro e no fechamento do dia (`MeuPainel`) |
| 2026-07-12 | Tela Agenda + página pública de agendamento sem login | Dependência total do Booksy — sem visibilidade de agenda dentro do próprio sistema, sem forma do cliente agendar sozinho | Barbeiro/admin gerenciam a agenda pelo sistema; cliente agenda por um link, vendo só horário realmente disponível |
| 2026-07-12 | Selo de confirmação de presença + botão "Copiar link" na Agenda | Sem forma de saber se o cliente vai mesmo aparecer, mesmo já tendo o motor de agendamento pronto | Barbeiro/admin veem de relance quem confirmou (✓ no card); reduz falta sem depender ainda de envio automático |
| 2026-07-12 | Aba "Notificações" em Configurações (faturamento/ranking/estoque parado) | Admin não tinha visão periódica automática de faturamento, ranking ou estoque parado sem abrir o sistema e consultar manualmente | 4 tipos de notificação configuráveis (liga/desliga, periodicidade, horário) — hoje só enfileiram a mensagem, envio de verdade ainda pendente de integração externa |
| 2026-07-12 | Cards "Cadastro do administrador" e "Número remetente do WhatsApp por unidade" fixos acima das abas de Configurações | Telefone de destino tinha que ser digitado à mão em cada um dos 8 cards de notificação — repetitivo e propenso a erro | Cadastro único (nome/telefone/e-mail + canais) reaproveitado por todas as notificações; ambos os cards ficam visíveis independente da aba ativa, por serem cross-cutting |
| 2026-07-12 | Nova aba "Gatilhos ao Cliente" (Aniversariante, Cliente sumido, Pedido de avaliação) | Mensagens de marketing/relacionamento pro cliente (diferente das notificações do admin) precisavam de espaço próprio, com placeholders e preview de template | 3 cards com toggle, template editável e preview ao vivo; "Pedido de avaliação" some o campo de horário (não se aplica, é por evento) |
| 2026-07-12 | Nova aba "Promoções": formulário + preview de audiência obrigatório + histórico expansível | Willians pediu disparo manual segmentado em vez do cupom automático do escopo original; depois, preocupação real com spam levou ao cooldown e à necessidade de ver resultado da campanha | Botão "Disparar agora" só habilita depois de "Ver audiência"; qualquer mudança de filtro invalida o preview; histórico expande pra mostrar conversão/faturamento gerado por campanha |
| 2026-07-28 | Botão "Desconectar" do WhatsApp direto no card de remetente (Tamboré/Mutinga/Admin), fora do modal de QR Code | Desconectar só era possível dentro do modal, depois de abrir e ver que o canal já estava pareado — um clique e uma procura a mais do que precisava | Card carrega o status de cada canal ao abrir a tela; alterna "QR Code"/"Desconectar" e mostra o número pareado, sem precisar entrar no modal pra achar o botão |
| 2026-07-28 | PDV (RegistroVenda, abas Venda e Combo): seletor de Serviço/Produto passa a dividir o catálogo por `categoria`, não por `controla_estoque` | Item sem "Controla estoque" marcado (ex.: snack/bebida sem controle de quantidade) caía escondido dentro do seletor de Serviço, misturado com Corte/Barba | Item aparece na aba certa (Produto) independente de ter ou não controle de estoque; classificação de comissão/upsell/alertas continua usando `controla_estoque`, só a divisão visual do PDV mudou |
