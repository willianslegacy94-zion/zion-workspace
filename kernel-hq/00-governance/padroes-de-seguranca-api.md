# 🔒 Diretrizes de Segurança de API — Órbita

## 🛡️ Proteção contra Engenharia Reversa (IDOR)
- **Regra de Ouro:** Todos os parâmetros públicos expostos em URLs em sistemas desenvolvidos pela Órbita (como recuperação de senhas ou chaves de webhooks) devem utilizar criptografia identificadora única (Hashes/UUIDv4) em vez de IDs numéricos sequenciais.
- **Resultado:** Impede que usuários mal-intencionados adivinhem dados alterando números nas requisições.