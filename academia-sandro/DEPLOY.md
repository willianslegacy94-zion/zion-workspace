# Deploy em produção — VPS Hostinger (compartilhada) + Docker + Supabase

Domínio (`sandrofreiresf.online`, na Hostinger) e banco (Supabase) já estão
prontos. O VPS Hostinger já roda outros sistemas (VillaMill, Thieco Leandro,
etc.) atrás de um **nginx no host** que cuida do roteamento por domínio e do
TLS via Certbot — cada app publica sua porta só em `127.0.0.1` e o nginx faz
o proxy. `academia-sandro` usa a porta **3010**.

Por isso este projeto **não** roda seu próprio Caddy/reverse proxy — o
`docker-compose.yml` só sobe o `app` publicado em `127.0.0.1:3010`, e quem
expõe pra internet é o nginx do host, com mais um `server{}` block.

## 1. DNS (painel da Hostinger)

No painel da Hostinger → domínio → **Zona DNS**, aponte pra o IP do VPS:

| Tipo | Nome | Valor       |
|------|------|-------------|
| A    | @    | IP do VPS   |
| A    | www  | IP do VPS   |

Propagação pode levar de alguns minutos até algumas horas.

## 2. Levar o projeto pro VPS

Do seu computador (não copie `node_modules`, `.next`, `.git`):

```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  "academia-sandro/" root@IP-DO-VPS:/opt/academia-sandro/
```

## 3. Configurar o `.env.production` no VPS

No VPS:

```bash
cd /opt/academia-sandro
cp .env.production.example .env.production
nano .env.production
```

Preencha:
- `DATABASE_URL` / `DIRECT_URL` — connection string do Supabase (Project Settings → Database).
- `AUTH_SECRET` — gere um novo, exclusivo de produção: `openssl rand -base64 32`
- `ADMIN_EMAIL` — pode ser um placeholder (ex: `sandro@sandrofreiresf.online`); o admin troca depois em Configurações.
- `PIX_KEY_CT` — deixe vazio; a chave PIX é cadastrada pelo próprio admin em Configurações, não vem do `.env`.

## 4. Build, migrations e seed

```bash
docker compose build
docker compose run --rm migrate   # aplica as migrations no Supabase
docker compose run --rm seed      # cria o usuário admin (Sandro) — só na primeira vez
docker compose up -d app
```

Confirma que subiu certo:

```bash
docker compose ps
curl -I http://127.0.0.1:3010
```

## 5. Configurar o nginx do host

Cria `/etc/nginx/sites-available/academia-sandro`:

```nginx
server {
    server_name sandrofreiresf.online www.sandrofreiresf.online;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 80;
    listen [::]:80;
}
```

`client_max_body_size 20m` é necessário porque alunos anexam foto de
comprovante de pagamento (câmera de celular passa fácil de 1MB, o default do
nginx).

Ativa o site e recarrega:

```bash
ln -s /etc/nginx/sites-available/academia-sandro /etc/nginx/sites-enabled/academia-sandro
nginx -t && systemctl reload nginx
```

## 6. HTTPS via Certbot

Só funciona depois que o DNS já estiver resolvendo pro IP do VPS (`dig +short sandrofreiresf.online` deve devolver o IP do VPS):

```bash
certbot --nginx -d sandrofreiresf.online -d www.sandrofreiresf.online
```

O Certbot reescreve o `academia-sandro` sozinho, adicionando o bloco HTTPS +
redirect 80→443 (mesmo padrão usado nos outros sites da VPS).

## 7. Conferir

Acesse `https://sandrofreiresf.online` — deve cair na tela de login.

```bash
docker compose logs -f app
```

## 8. Deploys seguintes (quando o código mudar)

```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  "academia-sandro/" root@IP-DO-VPS:/opt/academia-sandro/
cd /opt/academia-sandro
docker compose build app
docker compose run --rm migrate   # só se o schema.prisma mudou
docker compose up -d app
```

## 9. Limpeza de comprovantes expirados (opcional)

A limpeza já roda "preguiçosa" quando o admin abre `/matriculas` ou
`/transacoes`. Se quiser garantir execução diária mesmo sem acesso, adicione
ao crontab do VPS (fora do Docker):

```bash
# crontab -e
0 3 * * * curl -s https://sandrofreiresf.online/api/cron/limpar-comprovantes > /dev/null
```

## Pendências de segurança conhecidas

- A senha atual do Postgres no Supabase já apareceu em texto puro numa
  conversa anterior (ver `PROGRESS.md`) e **não foi rotacionada**. Decisão do
  responsável foi manter por ora — mas recomenda-se rotacionar em
  Supabase → Settings → Database → Reset Database Password antes ou logo
  depois de abrir pro público.
