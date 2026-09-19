---
status: draft
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-18
owner: willians
---

# Arquitetura Técnica — Drogaria Vesale

> Referência: [[prd-vesale]] | [[requisitos-funcionais-vesale]]

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Frontend + Backend | Next.js (App Router) + TypeScript + Tailwind CSS | Stack padrão já validado em produção em outros sistemas do portfólio (Villamill, Lane Confeitaria, Kernel) — monolito único reduz custo de manutenção e é suficiente para o porte de uma farmácia de bairro | Não é a escolha certa se o sistema precisar escalar para múltiplas filiais/alto tráfego simultâneo mais adiante — mas isso está fora de escopo (ver [[prd-vesale]]) |
| ORM / Banco de dados | Prisma + PostgreSQL | PostgreSQL sobre MySQL: melhor suporte a JSON (útil para guardar o payload bruto extraído de cada nota fiscal, mesmo depois do parsing estruturado) e é o padrão já operado em Docker em outros sistemas do workspace, reduzindo risco operacional | Fecha a porta de usar MySQL gerenciado caso a Hostinger ofereça algum tier facilitado só para MySQL — não é o caso hoje |
| Autenticação | NextAuth v5 (credentials) | Já validado em produção (academia-sandro, lane-confeitaria); suporta papel de usuário (gestor/operador) exigido por RF-001/RF-002 | — |
| Parsing de XML de nota fiscal (NFe/SEFAZ) | Parser XML determinístico (`fast-xml-parser` ou equivalente), em camada dedicada `lib/nfe/parser-xml.ts` | XML no padrão NFe segue schema oficial da SEFAZ — parsing determinístico é mais barato, mais rápido e 100% confiável para o caso feliz (RF-015), sem depender de chamada externa | Não resolve XML fora do padrão nem PDF — ver linha seguinte |
| Extração de dados de PDF (DANFE) ou XML fora do padrão | Claude API (Anthropic), em camada dedicada `lib/nfe/parser-ia.ts`, como fallback | PDF de nota fiscal (DANFE) não tem estrutura fixa para regex/parsing determinístico — leitura assistida por IA é a abordagem indicada no próprio briefing do projeto ("o Claude será muito útil para a lógica complexa de parsing dos XML das notas fiscais") | Introduz dependência de API externa e custo por chamada — mitigado por essa via ser fallback, não o caminho principal (RF-016 só aciona quando RF-015 não se aplica) |
| Hospedagem | VPS Hostinger | Definido no briefing do projeto; dá controle total de infraestrutura, compatível com o padrão Docker já operado em outros sistemas do portfólio | Exige a própria equipe cuidar de deploy, backup e monitoramento — não é PaaS gerenciado |
| Infraestrutura | Docker Compose (container da aplicação Next.js + container PostgreSQL + Nginx como reverse proxy) | Isola o banco em container próprio (facilita rotina de backup e portabilidade, conforme pedido no briefing) e mantém o servidor organizado, replicando o padrão já em produção em outros sistemas do workspace | — |

## 2. Camadas do sistema

```
[Apresentação — Next.js App Router, páginas do PDV/Financeiro/NF/CMV]
         ↓  ↑
[Lógica de negócio — regras de precificação, conciliação de NF, cálculo de CMV/DRE]
         ↓  ↑
[Dados — PostgreSQL via Prisma]
         ↓  ↑
[Integrações — upload de XML/PDF, parser determinístico, Claude API, Nginx/VPS]
```

**Apresentação:** páginas Next.js por módulo — `/painel`, `/pdv`, `/estoque`, `/notas-fiscais`, `/fornecedores`, `/financeiro`, `/relatorios`, `/rentabilidade` (Módulo 5 — rota batizada por tela, não `/precificacao` como planejado antes de existir) implementadas. Navegação migrou de header fixo no topo para sidebar fixa à esquerda em 2026-09-17 — ver Design System → Sidebar/navegação. Server components para leitura, server actions para escrita (venda, upload de nota, atualização de preço).

**Lógica de negócio:** funções dedicadas por regra crítica — `conciliarNotaFiscal()`, `travarCustoProduto()`, `calcularMargem()`, `calcularCMVPeriodo()`, `calcularDRE()` — nunca embutidas direto no componente de UI, para manter as regras de negócio (RN-007 a RN-012) auditáveis e testáveis isoladamente.

**Dados:** schema Prisma como fonte de verdade do modelo (ver [[modelo-de-dados-vesale]]); toda escrita de estoque/custo passa pelas funções da camada de lógica de negócio, nunca por update direto de UI.

**Integrações:** upload de arquivo (XML/PDF) → parser determinístico tenta primeiro (RF-015) → se falhar ou o arquivo for PDF, aciona Claude API com prompt de extração estruturada (RF-016) → resultado cai como nota "pendente de vínculo" ou "conciliada", conforme RF-017/RF-018.

## 3. Fluxo de dados

```
[Upload de XML/PDF pelo gestor] → [Parser XML determinístico OU Claude API (fallback)]
      → [Itens extraídos + vínculo automático por código de barras/NCM]
      → [Gestor confirma conciliação] → [Estoque incrementado + custo travado atualizado]
      → [Produto disponível no PDV com custo travado]
      → [Operador vende no PDV] → [Estoque decrementado + receita lançada no caixa do dia]
      → [Financeiro consolida: receita PDV − CMV real − despesas do mês = DRE simplificado]
```

## 4. Pontos de integração

| Integração | Direção | Formato | Autenticação | Versionamento |
|---|---|---|---|---|
| Upload de nota fiscal (XML/PDF) | entrada (usuário → sistema) | multipart/form-data | sessão NextAuth (qualquer papel — gestor ou operador de caixa, RN-019) | — |
| Claude API (extração de dados de PDF/XML fora do padrão) | consumo (sistema → serviço externo) | REST/JSON via SDK Anthropic | API key (variável de ambiente, nunca no cliente) | pinada à versão do modelo em uso no momento da implementação |
| Leitor de código de barras | entrada (dispositivo → sistema) | entrada de teclado (HID — o leitor se comporta como teclado, sem integração de API dedicada) | — | — |

## 5. Fronteiras de segurança

- **Autenticação:** NextAuth v5, sessão validada em toda rota de API e em todo server component sensível.
- **Autorização:** papel do usuário (gestor/operador) verificado em cada rota do Financeiro e Precificação/CMV — nunca só escondido na UI (RNF-002 exige bloqueio real, não só ocultação visual). Em Notas Fiscais de Entrada, o operador de caixa só tem a rota de upload liberada (RN-019); em Estoque, só a leitura sem custo (RN-018) — as demais rotas desses dois módulos seguem com o mesmo bloqueio real no servidor.
- **Dados sensíveis:** custo travado, margem e dados financeiros — nunca retornados em resposta de API para sessão com papel operador de caixa, mesmo que a UI não os exiba.
- **Arquivos de nota fiscal:** validados por tipo (XML/PDF) e tamanho antes do upload ser aceito (RNF-003); armazenados fora do diretório público da aplicação.
- **API key da Claude API:** exclusivamente em variável de ambiente do servidor, nunca exposta ao client.

## 6. Estratégia de escala

**Gargalos previstos:** volume de upload/processamento de notas fiscais em horário de recebimento de mercadoria (picos pontuais, não constantes); busca de produto no PDV se o catálogo crescer para dezenas de milhares de itens sem índice adequado.

**Estratégia:** índice de banco em código de barras e nome de produto (busca do PDV, RNF-001); processamento de nota fiscal assíncrono/isolado por nota (RNF-006), de forma que uma nota com erro nunca bloqueia outras notas em processamento.

**O que exige reescrita acima de X:** se a operação crescer para múltiplas filiais, o modelo de dados (hoje assumindo uma única loja, ver [[prd-vesale]] → Escopo → Fora) precisa ganhar uma entidade Loja/Filial antes de qualquer coisa — isso não é um ajuste incremental, é uma decisão de modelo de dados a ser tomada com antecedência se esse cenário se tornar real.

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v0.1 | 2026-09-12 | Criação inicial a partir do briefing — stack definida, nenhuma linha de código do sistema real escrita ainda |
| v0.2 | 2026-09-16 | Stack implementada e no ar localmente: Autenticação, PDV, Estoque, Notas Fiscais (upload + lançamento manual), Fornecedores, Financeiro parcial, Relatórios, Painel. Módulo 5 (Precificação/CMV) segue não implementado — ver [[registro-de-decisoes-vesale]] e `vesale/AGENTS.md`. |
| v0.3 | 2026-09-17 | Módulo 5 (Precificação/CMV — RF-019 a RF-022) implementado em `/rentabilidade`, sem alteração de schema (campos já existiam). Navegação redesenhada para sidebar fixa à esquerda, mantendo a paleta azul/vermelho da marca; itens ainda não construídos (Validades, Clientes, Receitas/Controlados, Perdas, Auditoria, Assistente IA) aparecem na sidebar com indicação de "em breve", sem rota por trás — ver [[registro-de-decisoes-vesale]] e `vesale/AGENTS.md`. |

---

# Links relacionados

[[requisitos-funcionais-vesale]] — requisitos que esta arquitetura sustenta
[[modelo-de-dados-vesale]] — como os dados vivem dentro desta arquitetura
[[registro-de-decisoes-vesale]] — histórico de decisões arquiteturais
