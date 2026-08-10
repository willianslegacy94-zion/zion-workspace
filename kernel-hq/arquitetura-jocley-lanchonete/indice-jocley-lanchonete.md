---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-08-07
owner: willians
---

# Índice — Jocley Grill

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/arquitetura-jocley-lanchonete/` com sufixo `-jocley-lanchonete`.
Código-fonte real em `Kernel Workspace/lanchonete-sistema/` (fora do Obsidian).

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-jocley-lanchonete]] | As 6 perguntas respondidas antes da criação do sistema — threshold aprovado; explica a origem do sistema como combinação deliberada de vilamill-sistema + sistema-thieco |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-jocley-lanchonete]] | @pm | Contexto de lanchonete sem PDV nem CMV calculado, problema de segregação de acesso por papel, hipótese de reaproveitar dois sistemas irmãos, escopo e métricas |
| [[requisitos-funcionais-jocley-lanchonete]] | @pm | 106 RFs em 17 módulos: autenticação/RBAC, PDV (mesas+balcão, quantidade na venda), pedidos, cardápio (com flag "enviar para cozinha"), CMV, estoque (com valor total + filtro oculto pra não-ADMIN, **entrada rápida de estoque** e **rendimento do insumo no custo efetivo**, novos), KDS (filtro por mesa + exclusão de item sem preparo), cupom térmico, financeiro, inteligência financeira (com Calculadora de Metas), despesas, lançamentos, gestão de time, configurações (com Taxas de Delivery + WhatsApp real via Evolution API), usuários, tratamento e registro de erros, permissões granulares por usuário |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-jocley-lanchonete]] | @architect | Stack (Next.js 15 + Prisma + PostgreSQL + NextAuth v5 + SWR + Recharts + Docker + Nginx/Certbot em produção), camadas, fluxos de dados (abertura de comanda, fechamento com split+bandeira, cálculo de CMV com custo efetivo por rendimento, entrada rápida de estoque), segurança (RBAC de página + de API + permissões granulares por usuário + guard de identidade `devmaster` + tratamento de erro), integração com Evolution API (WhatsApp) via rede Docker `orbita_shared`, deploy em produção (VPS compartilhada, `jocleygrill.online`), histórico de versão (v1.0 a v1.28) |
| [[modelo-de-dados-jocley-lanchonete]] | @data-engineer | 19 entidades com schema Prisma real (User com 5 roles + conta `devmaster` oculta + permissões granulares opcionais, Order com tipo MESA/BALCAO, ContadorComanda, Product com categorias canônicas do cardápio, RecipeItem, Ingredient com rendimento percentual (custo efetivo), TaxaPagamento com bandeira opcional, TaxaDelivery por canal, Despesa recorrente, Funcionario/Feedback/PlanoAcao/Sugestao, ConfiguracaoGeral (telefone WhatsApp), ErrorLog), ENUMs, regras de cálculo de CMV, taxa e Calculadora de Metas |

---

## Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente | O que cobre |
|---|---|---|
| [[design-system-jocley-lanchonete]] | @ux-design-expert | 5 princípios de design (cores claras de restaurante, papel define o que se vê), tokens de cor de marca (`brand-primary` laranja queimado, `brand-accent` dourado), voz e governança |
| [[ui-kit-jocley-lanchonete]] | @ux-design-expert | Inventário de Sidebar/Navbar role-aware, MesaGrid, ComandaItens, PagamentoSplitDialog, KdsBoard, CardapioCalculoTable, templates de todas as 17 telas |

---

## Camada 4 — Funciona? (validação da experiência)

| Documento | Agente | O que cobre |
|---|---|---|
| [[ux-flows-jocley-lanchonete]] | @ux-design-expert | Pesquisa a partir do briefing direto do cliente (áudio transcrito), jornadas de Atendente/Admin/Supervisor, arquitetura de navegação por papel, fluxos de comanda/CMV/criação de usuário, testes que revelaram os dois bugs corrigidos na mesma sessão |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-jocley-lanchonete]] | @pm / todos | 29 decisões cronológicas: bootstrap do schema, PDV core, cardápio+estoque+CMV, KDS, dashboard financeiro, taxa afetando Receita Líquida, Inteligência Financeira, despesas recorrentes, gestão de time, configurações, correção do bloqueio de API dos papéis operacionais, correção do redirect de login para porta errada, papéis Supervisor/Atendente + Usuários, taxa por bandeira de cartão, rebranding "Jocley Grill" + repositório Git próprio, Taxas de Delivery + Calculadora de Metas, card de valor total + filtro no Estoque (com correção de bug de hidratação), sistema de tratamento e registro de erros + conta `devmaster`, push para o GitHub, deploy em produção na VPS compartilhada + domínio jocleygrill.online, correção de build (pasta `public/` ausente), correção de conflito de porta do Postgres (configurável via `POSTGRES_HOST_PORT`), cardápio real cadastrado (dois cardápios) + favicon provisório, dez melhorias operacionais (KDS filtrado, quantidade na venda, estoque oculto, permissões granulares, WhatsApp real via Evolution API), correção de rede Docker pro WhatsApp alcançar a Evolution API (rede `orbita_shared`), correções pós-deploy do WhatsApp (DDI automático, botão Desconectar, campo de dias da periodicidade, disparo respeitando a periodicidade), **rendimento do insumo + custo efetivo no CMV**, **PDV lista todos os produtos + entrada rápida de estoque + ficha técnica do Espeto de Contrafilé + categorias canônicas do cardápio**, **correção do erro de sessão quebrada da Evolution (sendMessage undefined) + esclarecimento dos cards de WhatsApp em Configurações** |

---

## Ordem de leitura recomendada

```
system-creation-jocley-lanchonete
        ↓
   prd-jocley-lanchonete
        ↓
requisitos-funcionais-jocley-lanchonete
        ↓
arquitetura-jocley-lanchonete  ←→  design-system-jocley-lanchonete
        ↓                                  ↓
modelo-de-dados-jocley-lanchonete       ui-kit-jocley-lanchonete
        ↓                                  ↓
        └────── ux-flows-jocley-lanchonete ┘
                        ↓
        registro-de-decisoes-jocley-lanchonete (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-jocley-lanchonete  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-jocley-lanchonete  ←  regra de negócio alterada
  - arquitetura-jocley-lanchonete            ←  decisão técnica estrutural (ex: nova migration)
  - modelo-de-dados-jocley-lanchonete        ←  entidade ou campo alterado no schema Prisma
  - design-system-jocley-lanchonete          ←  cor semântica ou padrão visual alterado
```

Alterações sem impacto sistêmico (bugs cosméticos, ajustes de texto, linting) não precisam atualizar estes documentos.

---

## Próximos artefatos a criar (backlog de governança)

| Artefato | Quando criar |
|---|---|
| ~~Deploy em produção (VPS)~~ | **feito em 2026-08-03** — VPS compartilhada (`2.24.93.178`), domínio `jocleygrill.online`, Nginx+Certbot, ver v1.19 na arquitetura e decisão "Deploy em produção" no registro |
| ~~Worker/cron de disparo de notificações~~ | **feito em 2026-08-04** — `src/instrumentation.ts` + `src/lib/notificacoes-dispatcher.ts`, envio real via Evolution API (WhatsApp), ver v1.23/v1.25 na arquitetura e decisões "Dez melhorias operacionais" e "Correções pós-deploy" no registro. Limitação conhecida registrada na Seção 6 da arquitetura: agendador em processo `setInterval`, não escala para múltiplas réplicas do app |
| Backup automatizado do banco de produção | deploy feito, mas sem rotina de backup do Postgres da VPS até este índice — mesma lacuna que outros sistemas da mesma VPS podem ter; avaliar `pg_dump` agendado (cron) ou snapshot do volume Docker antes do primeiro mês de operação real |
| Migration real aplicada só no deploy, nunca via `prisma migrate dev` local | a migration `20260803140000_add_kds_flag_and_permissoes` (2026-08-04) foi escrita manualmente e nunca rodou contra um banco de verdade antes do deploy na VPS — ambiente de trabalho não tinha Docker/Postgres acessível (WSL sem integração Docker Desktop). Funcionou porque o `Dockerfile` já roda `prisma migrate deploy` automaticamente no start do container, mas é um risco a evitar: preferir ambiente com banco acessível pra rodar `prisma migrate dev` de verdade antes de mudanças de schema futuras |
| `ui-kit-jocley-lanchonete` — telas ainda sem uso real da equipe validando | sistema está em produção desde 2026-08-03, com uso real confirmado em 2026-08-04 (10 melhorias vieram de feedback direto de uma semana de operação) — ainda falta reclassificar formalmente como "validado em produção" neste índice |
| `design-system-jocley-lanchonete` — logo da marca | cliente **já forneceu** arte de marca (imagem de cardápio com o logo "Jocley Grill — BBQ & Espetos": chama estilizada, paleta preto/dourado) — o sistema ganhou um favicon provisório em texto ("JG", cores da marca) em 2026-08-03, mas a arte real (chama) ainda não foi integrada à UI |
| Preço das 6 bebidas cadastradas em R$ 0,00 | cardápio real cadastrado em 2026-08-03 não trazia preço de bebida explícito — cliente precisa preencher pela tela de Produtos antes de vender (ver decisão "Cardápio real cadastrado") |
| Rotina de expurgo de `ErrorLog` | tabela cresce indefinidamente, sem TTL nem limite — avaliar se precisa antes do volume de produção real |
| `ui-kit-jocley-lanchonete` / `ux-flows-jocley-lanchonete` sem atualização desde as 10 melhorias de 2026-08-04 | seletor de quantidade, filtro de mesa no KDS, matriz de permissões e campo de telefone WhatsApp são telas/fluxos novos ainda não documentados nesses dois artefatos de Camada 3/4 — o `ModalEntrada` de estoque (2026-08-07) também entra nessa lista |
| Deploy do commit `7abd46c`/`1b56d7f` (2026-08-07) na VPS de produção | código já está na `main` do GitHub, mas o `git pull && docker compose up -d --build` em `/opt/lanchonete-sistema` (`2.24.93.178`) ainda não foi confirmado como executado — enquanto isso, `jocleygrill.online` continua rodando a versão anterior (sem entrada rápida de estoque, sem a ficha técnica do Espeto de Contrafilé, com as categorias antigas do cardápio) |
| Commit + push da correção de WhatsApp (2026-08-10, v1.28) + confirmação do deploy via `scp` | os 3 arquivos alterados (`testar/route.ts`, `evolution-api.ts`, `notificacoes-tab.tsx`) não foram commitados no git local até o fim da sessão — deploy foi feito direto via `scp` pra `/opt/lanchonete-sistema` (comandos fornecidos, execução não confirmada nesta sessão), o que deixa a working tree da VPS potencialmente divergente do histórico git enquanto ninguém commitar/push essas mudanças localmente |
