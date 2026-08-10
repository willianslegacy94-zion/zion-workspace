# BACKLOG DE DESENVOLVIMENTO — VILLA MILL SISTEMA

Este arquivo documenta as tarefas pendentes acordadas para o aprimoramento da plataforma de gestão do **Villa Mill Tamboré** / **Mill Lava Rápido** (CNPJ: 34.668.474/0001-28). Estas implementações visam otimizar a operação de pista e salão, além de mitigar riscos jurídicos identificados na governança operacional.

---

## 📋 1. Exibição da Categoria "Lavagem" no Modal de Vendas

### 📌 Contexto
Os serviços automotivos (*"Carro Médio"*, *"Carro Grande com Cera"*, *"Caminhão VUC"*) já constam mapeados na base de dados PostgreSQL através do Prisma e são visíveis no gerenciamento de cardápio. Contudo, o carrossel horizontal de filtros rápidos do modal de abertura/edição de mesas omite a tag de atalho **"Lavagem"**, forçando a equipe do caixa a buscar manualmente os itens por texto.

### 🛠️ Especificações Técnicas
- **Escopo no Front-end (`Next.js 15 + Tailwind`):** Identificar o componente do modal de adição de itens e assegurar que a query/carregamento via `SWR` não restrinja apenas categorias de alimentos/bebidas.
- **Renderização de Elemento:** Incluir o botão de filtro dinâmico "Lavagem" mantendo a identidade visual do design system.
- **Lógica de Estado:** Ao ser acionado, o componente deve disparar a filtragem instantânea exibindo exclusivamente a listagem dos serviços automotivos indexados.

---

## 📋 2. Impressão de Cupom de Fechamento (Epson TM-T20X)

### 📌 Contexto
Instalação física de hardware térmico não-fiscal (Modelo M352A) na estação de trabalho fixa do caixa. O sistema precisa realizar a comunicação direta para a emissão física estruturada de extratos de consumo, fechamento e divisões de pagamento em formato contínuo.

### 🛠️ Especificações Técnicas
- **Layout Fixo (80mm):** Desenvolver um componente de impressão estruturado sob fonte estritamente monoespaçada (`font-mono` / `Courier New`) simulando fielmente a anatomia de cupons tradicionais com caracteres divisores fixos (`--------------------------------`).
- **Camada de Estilização (`@media print`):** - Ocultar toda a interface administrativa, botões de ação e barras de navegação do Next.js via classes utilitárias `print:hidden`.
  - Aplicar reset de margem na folha (`@page { margin: 0; }`) e garantir contraste máximo em preto puro (`text-black`).
- **Payload de Dados Justificados:**
  - Identificação clara do estabelecimento, CNPJ correspondente e data/hora.
  - Alinhamento em extremidades (`flex justify-between`) relacionando itens, quantidades, valores e o mapeamento do fluxo de *split payment*.
- **Gatilho Operacional:** Vinculação do comando `window.print()` nativo ao botão do painel operacional.

---

## 📋 3. Bloqueio de Acesso Baseado em Horário de Funcionamento

### 📌 Contexto
Alinhado com as diretrizes do Termo Aditivo de Responsabilidade de Dispositivos Próprios (BYOD) para profissionais autônomos e parceiros prestadores, faz-se estritamente necessária uma barreira técnica na camada de software para impedir acessos ao sistema fora do horário operacional estabelecido, eliminando riscos de alegações de tempo à disposição ou subordinação disfarçada.

### 🛠️ Especificações Técnicas
- **Proteção na Camada de Autenticação (`NextAuth.js` / Middleware):**
  - Implementar interceptor no arquivo de rotas protegidas (`middleware.ts`) ou na sessão de callback do NextAuth.
  - Validar se o perfil de usuário autenticado possui a flag de restrição (ex: perfis operacionais de pista ou salão, excetuando administradores e proprietários).
- **Lógica de Verificação Temporal:**
  - Confrontar o horário da requisição do cliente (obtido e sanitizado via servidor para evitar manipulações de relógio local do smartphone) com a matriz de horários permitidos de funcionamento do Villa Mill.
- **Tratamento de Exceção (UI):**
  - Caso o acesso ocorra fora do intervalo regulamentar, o middleware deve revogar o token de sessão ou redirecionar o usuário para uma tela dedicada de bloqueio (`/bloqueio-horario`).
  - Exibir mensagem clara de teor corporativo informando o encerramento do expediente e a indisponibilidade temporária de acesso para segurança de dados.

---

### 📆 Status do Backlog
- [x] Categoria "Lavagem" no Modal
- [x] Middleware de Bloqueio Horário (BYOD Guard)
- [x] Aumentar letra do sistema
- [x] Dividir o lançamento do lava rápido (editar o preço de lançamento da equipe)
- [x] Adicionar forma de pagamento "NOTA"