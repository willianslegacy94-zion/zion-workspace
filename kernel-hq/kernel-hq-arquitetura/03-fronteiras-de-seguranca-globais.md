## 🛡️ 

- **Banco de Dados:** As portas das bases de dados relacionais (PostgreSQL/MySQL - porta 5432) nunca são mapeadas para fora das redes do Docker (`ports` não expostas externamente), permitindo acesso exclusivo através do backend local.
    
- **Isolamento de Aplicações:** Cada cliente do portfólio de negócios físicos ou infoprodutos roda em containers isolados ou possui lógicas estritas de separação (`multitenancy` via roles ou IDs de escopo), garantindo a privacidade dos dados comerciais.
    
- **Dados Sensíveis:** Credenciais de API (OpenRouter, Evolution) e hashes de senhas de usuários administradores (`bcrypt`) residem estritamente em arquivos `.env` locais no VPS, totalmente blindados contra vazamentos ou repositórios públicos.