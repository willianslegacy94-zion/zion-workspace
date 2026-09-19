---
status: draft
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-18
owner: willians
---

# Registro de Decisões — Drogaria Vesale

> Referência: [[prd-vesale]] | [[requisitos-funcionais-vesale]] | [[arquitetura-vesale]]

---

## [2026-09-12] — Criação da governança inicial do sistema a partir de briefing estruturado

**Motivo:** Willians trouxe um briefing já estruturado (diagnóstico de identidade visual, arquitetura e módulos) para uma nova farmácia — Drogaria Vesale — junto com a foto real da fachada (`LogoVesale.png`), pedindo para usar `00-governance-systems` como base de construção do projeto.
**Impacto:** criação da pasta `arquitetura-vesale/` com threshold aprovado e os documentos das camadas 1 a 4 (PRD, Requisitos Funcionais, Arquitetura Técnica, Modelo de Dados, Design System, UI Kit, UX). Nenhuma linha de código do sistema real foi escrita nesta sessão.
**Status:** aplicado
**Artefatos atualizados:** `system-creation-vesale.md`, `prd-vesale.md`, `requisitos-funcionais-vesale.md`, `arquitetura-vesale.md`, `modelo-de-dados-vesale.md`, `design-system-vesale.md`, `ui-kit-vesale.md`, `ux-flows-vesale.md`, `indice-vesale.md` (este registro incluído)
**Observação:** o sistema herda o padrão de stack já validado em outros sistemas do portfólio (Next.js + Prisma + PostgreSQL + NextAuth v5, Docker + VPS Hostinger) por decisão explícita de arquitetura, não por indicação da cliente. A paleta de cores do Design System foi extraída visualmente da foto da fachada — sem arquivo vetorial da marca — e precisa de confirmação. Diversos pontos de domínio farmacêutico (controle de lote/validade, produtos controlados/receituário) não estavam no briefing e foram registrados como pendências abertas, não como requisitos decididos — ver [[prd-vesale]] (Escopo → Fora).

---

## Pendências abertas (a resolver antes ou durante a implementação)

| Pendência | Onde está registrada | Precisa de |
|---|---|---|
| Arquivo vetorial da logo completa (hoje só há a foto da fachada) | [[ui-kit-vesale]] → Assets | pedir arquivo original à cliente, se existir — símbolo da cruz isolado já foi redesenhado como SVG, ver entrada 2026-09-15 |
| Catálogo real de produtos, fornecedores e formato real dos XMLs recebidos | [[system-creation-vesale]] → Origem | primeira conversa/levantamento presencial com a cliente |
| Emissão de nota fiscal de venda (NFC-e) | [[prd-vesale]] → Escopo → Fora | decisão de negócio — está fora do escopo atual, mas farmácia pode exigir por obrigação fiscal; validar |

---

## [2026-09-15] — Lote/validade e medicamento controlado confirmados; módulos de Estoque, Financeiro e Relatórios implementados

**Motivo:** Willians revisou o sistema gerado contra os 3 prompts originais e apontou que estava
mais raso do que o pedido. Comparando com a governança, identificamos três categorias de lacuna:
requisito já aprovado sem UI (cadastro de produto RF-004, fechamento de caixa RF-013), pendência
nunca decidida (lote/validade e controlado — ver pendências acima) e pedido novo sem RF formal
(desconto, relatório de vendas, contas a pagar/receber). Perguntado diretamente, Willians confirmou
as duas pendências como requisito real e pediu os três itens novos também.

**Impacto:**
- **Resolvido:** lote/validade de medicamento (RF-027/RF-028, RN-014/RN-015) e produto controlado
  exigindo receita na venda (RF-027, RN-013) — ambos confirmados como requisito real, não mais
  pendência. Modelados como entidade própria `LoteProduto` com baixa por FEFO, em vez de um campo
  solto em Produto — permite mais de um lote/validade por produto ao longo do tempo.
- **Implementado:** tela de cadastro de produto/estoque (RF-004/RF-007, Módulo 2 — não tinha UI
  nenhuma antes), fechamento de caixa (RF-013, só a abertura existia), desconto na venda (RF-029),
  relatório de vendas (RF-030), contas a pagar/receber (RF-023/RF-024, Módulo 6 — só schema antes).
- **Decidido não implementar:** ajuste de estoque por leitura de código de barras fora do fluxo de
  nota fiscal (ideia original do Prompt 2 do Willians — "bipar código já cadastrado soma a
  quantidade recebida no estoque"). Isso quebraria RF-006/RN-008 (estoque e custo travado só
  entram via nota fiscal conciliada) — criaria estoque sem custo/origem rastreável, o que
  corromperia o CMV real (RN-012). O "modo leitor" foi implementado só para as duas partes que não
  colidem com essa regra: bipar código já cadastrado abre a edição do produto (não altera
  estoque), bipar código novo abre o cadastro pré-preenchido, e bipar/colar a chave de acesso da
  nota (do QR) abre a conciliação daquela nota direto.
- **Resolvido (parcial):** símbolo isolado da cruz da fachada redesenhado como SVG inline
  (`PharmacyCross`), usado no header e no login. Paleta de cores recalibrada a partir da mesma foto
  (`LogoVesale.png`) — ver [[design-system-vesale]]. Segue faltando o arquivo vetorial da marca
  completa "DROGARIA VESALE", se um dia existir.

**Status:** aplicado — schema migrado (`estoque_lote_desconto_receita`), telas em
`/estoque`, `/financeiro`, `/relatorios` no ar, PDV e Notas Fiscais atualizados.
**Artefatos atualizados:** `modelo-de-dados-vesale.md`, `requisitos-funcionais-vesale.md`,
`design-system-vesale.md`, `ui-kit-vesale.md` (este registro incluído), `AGENTS.md` do repositório.

---

## [2026-09-16] — Comparação com protótipo client-side, Painel, aba de Fornecedores e nota fiscal só pela chave

**Motivo:** Willians trouxe um protótipo React client-side (`vesale-sistema.jsx`, gerado a partir dos
3 prompts originais, sem servidor) e pediu pra implementar o que faltava em relação a ele. Comparado
ao sistema real, a lacuna era: uma tela de Painel/Dashboard que o protótipo tinha e o sistema real
não; recibo de venda com impressão; diferença de caixa no fechamento; e — apontado pelo próprio
protótipo — que a chave de acesso da nota (QR) sozinha não dá acesso aos itens, só o XML ou o portal
da Sefaz têm isso.

**Impacto:**
- **Implementado:** Painel (RF-035, resumo do dia pro gestor — vendas, caixa, estoque baixo,
  validade); recibo de venda com impressão (RF-033); diferença de caixa calculada no fechamento e
  histórico de sessões em Financeiro (RF-034); lançamento manual de nota fiscal a partir da chave de
  acesso, quando o XML ainda não foi enviado (RF-032); aba de Fornecedores com cadastro direto
  (RF-031), sem precisar vir de uma nota — lista pedidos recebidos, valor total e data do último
  pedido por fornecedor.
- **Corrigido:** a extração da chave de acesso do texto lido no leitor tirava todo caractere que não
  fosse dígito da string inteira — como o QR real é uma URL de consulta com outros números
  (`nVersao`, `tpAmb` etc.), isso embaralhava a chave. Corrigido pra extrair só o bloco contíguo de
  44 dígitos (é assim que a chave sempre aparece dentro da URL do QR).
- **Decidido:** CNPJ de fornecedor é sempre normalizado pra dígitos puros antes de gravar (RN-017) —
  evita duplicar o cadastro do mesmo fornecedor entre o que vem do XML e o que é digitado à mão.

**Status:** aplicado e testado ponta a ponta com Playwright (bipar chave sem XML → cadastrar
fornecedor → lançar itens → cadastrar produto novo pelo item → conciliar — sem erros de console).
**Artefatos atualizados:** `requisitos-funcionais-vesale.md` (este registro incluído).

---

<!-- novas entradas sempre abaixo desta linha, nunca acima -->

## [2026-09-17] — Redesign para sidebar a partir de mockup de referência, Módulo 5 implementado

**Motivo:** Willians trouxe um mockup HTML estático (`Vesale_Gestao_Farmacia_v2.html`, protótipo
com localStorage e dados fake, paleta verde/teal genérica) e pediu pra deixar o sistema real
"assim". Mesmo padrão da entrada de 2026-09-16 (comparar com protótipo trazido pelo cliente e
implementar a lacuna), agora com foco em navegação/layout em vez de funcionalidade.

**Decisões tomadas antes de implementar (perguntadas ao Willians):**
- Módulos novos do mockup sem tela no sistema real (Clientes, Perdas, Auditoria, Assistente IA,
  Controlados como tela própria, Compras) — quando forem construídos, terão persistência real
  (Prisma/Postgres), não dado mockado.
- Ordem de execução: redesign visual global primeiro (sidebar + paleta + reorganização de nav),
  módulos novos ficam pra depois, um de cada vez.
- Paleta: **mantida** azul-marinho/vermelho calibrados da fachada real — a paleta verde/teal do
  mockup foi descartada. Só o layout (sidebar, cards, grid de KPI) foi aproveitado.

**Impacto:**
- **Implementado:** navegação migrou de header fixo no topo para sidebar fixa à esquerda
  (`src/components/shared/Sidebar.tsx`, `Topbar.tsx`), reorganizada em grupos (Compras agrupa
  Fornecedores + Notas Fiscais); módulos ainda não construídos aparecem na sidebar com indicação
  "em breve" em vez de sumirem, pro gestor ver o roadmap sem linkar pra rota inexistente.
- **Implementado — Módulo 5 (Precificação e CMV, RF-019 a RF-022):** painel em `/rentabilidade`
  com custo travado × preço lado a lado, margem calculada, alerta de margem negativa/zerada
  (também retroagido pro cadastro de produto em `/estoque`, que a spec também exige e ainda não
  tinha), edição de preço sem tocar no custo (RN-009), CMV do período por intervalo de datas
  (RN-012 — itens sem custo travado no momento da venda ficam sinalizados à parte, não entram no
  cálculo). Sem mudança de schema — os campos já existiam desde a migração de 2026-09-15.
- **Corrigido (bug pré-existente, não relacionado ao mockup):** o formulário de edição de produto
  em `/estoque` sempre resetava o select de categoria pra "Selecione..." em vez de mostrar a
  categoria atual — o tipo de retorno do server action não carregava `categoriaId`, só o nome.
- **Pendência aberta, não resolvida:** a ordem dos itens na sidebar nova segue a ordem do mockup
  (PDV logo no topo), não o critério de "fluxo do dinheiro" (nota fiscal → precificação → PDV →
  financeiro) documentado em [[ux-flows-vesale]] desde antes desta entrada. Ninguém decidiu
  formalmente abandonar aquele critério — fica registrado pra alguém resolver: reordenar a
  sidebar, ou atualizar o critério documentado.

**Status:** aplicado e testado ponta a ponta com Playwright (login → Dashboard → Estoque → PDV com
venda real finalizada → CMV do período refletindo a venda) e `next build`/`tsc`/`eslint` limpos.
**Artefatos atualizados:** `arquitetura-vesale.md`, `prd-vesale.md`, `indice-vesale.md`,
`design-system-vesale.md`, `ui-kit-vesale.md`, `ux-flows-vesale.md` (árvore de IA reescrita),
`requisitos-funcionais-vesale.md` (este registro incluído), `AGENTS.md` do repositório,
comentário do `schema.prisma`.

---

## [2026-09-18] — Operador de caixa ganha acesso restrito a Estoque e upload de Notas Fiscais

**Motivo:** Willians pediu um usuário de caixa que, ao logar, só visse o Estoque (mas apenas o preço
de venda, nunca o custo) e, em Compras, só conseguisse subir a nota fiscal — nenhuma outra tela. Isso
muda uma decisão anterior: até aqui RF-002/RNF-002 e a acceptance criteria de
[[requisitos-funcionais-vesale]] previam o operador de caixa **sem nenhum acesso** a Notas Fiscais de
Entrada, e Estoque não tinha nem sido cogitado pra esse papel.

**Impacto:**
- **Decidido:** operador de caixa passa a acessar `/estoque` em modo somente leitura — vê nome,
  categoria, quantidade, validade e preço de venda; o custo travado nunca é enviado pelo servidor
  pra esse papel (não é só ocultado na UI). Cadastro/edição de produto continuam exclusivos do
  gestor. Novo RN-018 documentando essa regra.
- **Decidido:** operador de caixa passa a poder enviar (upload) uma nota fiscal de entrada em
  `/notas-fiscais` — a tela, pra esse papel, mostra só o formulário de upload. Lista de notas,
  valores, busca por chave de acesso (RF-032), vínculo de item (RF-017) e conciliação (RF-018)
  continuam exclusivos do gestor, com o mesmo bloqueio real no servidor (`exigirGestor()`) que já
  existia. Novo RN-019 documentando essa regra.
- **Não mudou:** venda no PDV decrementando estoque (RF-005) já existia e não precisou de alteração.
- Sidebar (`src/components/shared/Sidebar.tsx`) passou a filtrar item-filho dentro de grupos com
  submenu (não só o grupo inteiro) — Compras aparece pro operador, mas só com "Notas Fiscais",
  nunca "Fornecedores". "Dashboard" também entrou pra lista oculta do operador, corrigindo uma
  inconsistência pré-existente: a página `/painel` já redirecionava operador pra `/pdv`, mas o link
  continuava aparecendo na sidebar dele.

**Status:** aplicado e testado via login real (curl + cookies de sessão) como `operador@vesale.local`
e como `gestor@vesale.local` — confirmado que o operador recebe a tela de Estoque sem o texto/valor
de custo e sem os controles de cadastro, a tela de Notas Fiscais só com o upload, `/fornecedores`
segue redirecionando pra `/pdv`, e a visão do gestor não mudou. `tsc --noEmit` e `eslint` limpos.
**Artefatos atualizados:** `requisitos-funcionais-vesale.md` (RF-002, RN-018, RN-019, critério de
aceite), `arquitetura-vesale.md` (fronteiras de segurança e ponto de integração de upload de nota),
este registro. Código: `src/components/shared/Sidebar.tsx`,
`src/app/(app)/estoque/page.tsx`, `src/components/estoque/EstoqueClient.tsx`,
`src/server/actions/estoque.ts`, `src/app/(app)/notas-fiscais/page.tsx`,
`src/server/actions/notas-fiscais.ts`, `src/components/notas-fiscais/UploadNotaForm.tsx`.
