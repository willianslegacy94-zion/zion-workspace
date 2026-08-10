# Onboarding — Novo Cliente Orbita

Como criar e subir o sistema para um cliente novo.

---

## Pré-requisitos

- Servidor VPS com Docker e Docker Compose instalados
- Acesso SSH ao servidor
- Repositório: `https://github.com/willianslegacy94-zion/sistema-orbita-whitelabel`

---

## Passo a passo

### 1. Clonar o repositório com o nome do cliente

```bash
git clone https://github.com/willianslegacy94-zion/sistema-orbita-whitelabel.git barbearia-fulano
cd barbearia-fulano
```

---

### 2. Escolher o preset do nicho

| Preset | Quando usar |
|--------|------------|
| `.env.barbearia` | Barbearia completa — todos os módulos ativos |
| `.env.simples` | Negócio básico — sem metas, combos ou gestão de time |
| `.env.example` | Configuração do zero — preencher tudo manualmente |

```bash
cp .env.barbearia .env
```

---

### 3. Editar o `.env` com os dados do cliente

```bash
nano .env
```

Campos obrigatórios a preencher:

```env
# Identificação do projeto — deve ser único por cliente (sem espaços)
PROJECT_NAME=barbearia-fulano

# Nome e identidade visual
VITE_TENANT_NOME=Barbearia Fulano
VITE_TENANT_SLOGAN=Estilo que transforma.
VITE_NICHO=barbearia

# Cores (hex) — primária, fundo, superfície
VITE_COR_PRIMARIA=#C1440E
VITE_COR_FUNDO=#0A0A0A
VITE_COR_SUPERFICIE=#1A0F0A

# Banco de dados — senha forte e única por cliente
DB_NAME=sistema_barbearia_fulano
DB_PASSWORD=SenhaForte@2025!

# JWT — gerar um segredo único: openssl rand -hex 32
JWT_SECRET=cole-aqui-o-secret-gerado

# Usuário admin inicial
ADMIN_USERNAME=fulano
ADMIN_PASSWORD=SenhaAdmin@2025!
ADMIN_NOME=Fulano Silva

# Unidade padrão (primeira filial)
UNIDADE_PADRAO=matriz
UNIDADE_PADRAO_NOME=Matriz

# Porta pública (80 se único na VPS, outra porta se compartilhar VPS)
APP_PORT=80
```

---

### 4. Subir o sistema

```bash
docker compose up -d --build
```

Na primeira execução o banco é criado automaticamente e o admin é gerado.

---

### 5. Verificar

```bash
# Ver se os 3 containers subiram
docker compose ps

# Ver logs da API (deve mostrar "Admin criado" e "Servidor rodando")
docker logs barbearia-fulano_api
```

Acessar no browser: `http://IP-DO-SERVIDOR` (ou a porta configurada em APP_PORT)

---

### 6. Entregar ao cliente

Passar para o cliente:

- **URL de acesso:** `http://IP-DO-SERVIDOR`
- **Usuário:** valor de `ADMIN_USERNAME`
- **Senha:** valor de `ADMIN_PASSWORD`

Orientar o cliente a trocar a senha no primeiro acesso.

---

## Múltiplos clientes na mesma VPS

É possível rodar vários clientes no mesmo servidor usando portas diferentes. Cada cliente precisa de um `PROJECT_NAME` único para isolar containers e volumes.

```
Cliente A → APP_PORT=8081, PROJECT_NAME=barbearia-fulano
Cliente B → APP_PORT=8082, PROJECT_NAME=barbearia-ciclano
Cliente C → APP_PORT=8083, PROJECT_NAME=salao-maria
```

Com um Nginx reverso na frente, cada cliente pode ter seu próprio domínio apontando para a porta certa.

---

## Comandos úteis

```bash
# Parar o sistema
docker compose down

# Parar e apagar o banco (cuidado — destrói os dados)
docker compose down -v

# Atualizar para nova versão do sistema
git pull
docker compose up -d --build

# Ver logs em tempo real
docker compose logs -f
```

---

## Estrutura de arquivos de configuração

```
.env.barbearia   → preset completo para barbearia
.env.simples     → preset básico para serviços simples
.env.example     → template documentado com todos os campos
```
