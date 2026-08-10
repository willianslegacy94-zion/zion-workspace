# 04 — Segurança e Portais de Acesso

##  1. Proteção Baseada em Token JWT (JSON Web Token)
- **Tempo de Expiração:** A sessão ativa do usuário expira estritamente após **8 horas** de inatividade.
- **Isolamento de Payload:** O token trafega no cabeçalho HTTP (`Authorization: Bearer <TOKEN>`) carregando criptografados o `id`, `role`, e a `unidade_id` do usuário.

##  2. Matriz de Perfis de Acesso (RBAC)
O sistema bloqueia rotas no backend de acordo com três níveis de permissão:

1. **Admin (Dono/Franquia):** Acesso irrestrito a todas as unidades, relatórios de DRE global, alteração de porcentagem de comissão e gerenciamento de funcionários.
2. **Operador (Caixa/Gerente de Unidade):** Permissão de leitura e escrita restrita à sua respectiva `unidade_id`. Pode abrir/fechar caixa, lançar despesas e registrar vendas. Não visualiza o lucro líquido global da rede.
3. **Barbeiro (Profissional):** Acesso exclusivo ao `/meu-painel`. Vê apenas seu histórico de comissões, agendamentos do dia e barra de progresso de metas.

## 3. Regra Crítica de Segurança de Dados (Isolamento de Escopo)
- **Bloqueio de Injeção de ID:** Quando a rota `/api/painel-barbeiro/resumo` é acionada, o backend **ignora** qualquer ID enviado pelo frontend. Ele descriptografa o token JWT e usa o ID interno do token para fazer a query no banco.
- **Objetivo:** Um barbeiro jamais conseguirá ver o faturamento de outro alterando parâmetros na requisição.

##  4. Proteção contra Ataques de Engenharia Reversa (IDOR)
- **Tokens de Sessão e Reset:** Todos os parâmetros públicos expostos em URLs (como recuperação de senhas ou chaves de webhook de WhatsApp) utilizam criptografia identificadora única (Hashes/UUIDv4) em vez de IDs numéricos sequenciais.
- **Resultado:** Impede que concorrentes ou usuários mal-intencionados adivinhem ou façam varreduras de dados alterando números nas requisições.

## 5. Fluxo de Recuperação Autônoma de Senha
- **Validação:** O e-mail informado precisa constar na tabela `profissionais`.
- **Expirabilidade:** O sistema gera um token SHA-256 temporário válido por apenas **1 hora**.
- **Criptografia:** A nova senha é tratada no backend usando o algoritmo de hash **Bcrypt** com *salt* de 10 antes de ser salva no PostgreSQL.

## 6. Portal Público de Agendamento (sem autenticação, desde 2026-07-12)
- **Exceção deliberada à regra 1:** `GET /agendamentos/servicos`, `GET /agendamentos/disponibilidade`, `POST /agendamentos/publico` e `GET/POST /agendamentos/confirmar/:codigo` não exigem JWT — é a superfície que o cliente final (sem conta no sistema) usa pra agendar e confirmar presença.
- **Superfície de dado exposta:** só serviços/preços/duração e horários livres (sem nome de outros clientes). `GET /agendamentos/disponibilidade` nunca revela quem está agendado num horário — só se está livre ou não.
- **Anti-abuso:** `POST /agendamentos/publico` revalida toda a disponibilidade no servidor no momento da criação — nunca aceita o horário calculado do lado do cliente como verdade. Duas camadas de anti-overbooking (aplicação + constraint no banco) impedem dupla-reserva mesmo em requisições simultâneas.
- **Identificador do link de confirmação:** `codigo_confirmacao` é aleatório (hex, não sequencial) — evita que alguém adivinhe ou varra agendamentos de outros clientes trocando um número na URL, mesmo critério já usado no token de reset de senha (seção 4), embora aqui sem expiração por tempo.
- **Fora de escopo, registrado como pendência:** captcha e rate-limit nesses endpoints — hoje não existe proteção contra automação/spam de agendamentos falsos além da validação de formato dos campos.