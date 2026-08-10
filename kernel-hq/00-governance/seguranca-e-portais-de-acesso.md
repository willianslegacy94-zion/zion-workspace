## 🔒 Segurança

### 🔑 Implementação de Tokens e Links
Seguindo os padrões de governança da **Órbita**, o fluxo de "Esqueci minha senha" e os tokens de sessão deste sistema utilizam hashes criptográficos para mitigar riscos de IDOR nas rotas do Express.

## 8. Proteção contra Ataques de Engenharia Reversa (IDOR)

- **Tokens de Sessão e Reset:** Todos os parâmetros públicos expostos em URLs (como recuperação de senhas ou chaves de webhook de WhatsApp) utilizam criptografia identificadora única (Hashes/UUIDv4) em vez de IDs numéricos sequenciais.
- **Resultado:** Impede que concorrentes ou usuários mal-intencionados adivinhem ou façam varreduras de dados alterando números nas requisições. Segurança em nível bancário para a operação das barbearias.