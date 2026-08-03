# syntax=docker/dockerfile:1

# ---- deps: instala dependências (cache separado do código-fonte) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: gera o Prisma Client e builda o Next (output standalone) ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runner: imagem final enxuta, só com o necessário pra rodar ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Pasta de comprovantes é montada como volume em runtime (docker-compose) —
# precisa existir com o dono certo antes do volume herdar essas permissões.
RUN mkdir -p ./public/comprovantes && chown nextjs:nodejs ./public/comprovantes

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
