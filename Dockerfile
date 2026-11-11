# syntax=docker/dockerfile:1

# ---------- build: instala tudo (inclui devDependencies) e compila ----------
FROM node:24-alpine AS build
WORKDIR /app

# Copia primeiro só o que define dependências: se o código mudar mas o
# package-lock não, o Docker reaproveita o cache desta camada (npm ci).
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# O postinstall roda `prisma generate`, e o prisma.config.ts exige DATABASE_URL.
# O generate não conecta no banco: o valor fictício existe só neste comando.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm ci

COPY . .
RUN npm run build

# ---------- migrate: aplica as migrations e encerra ----------
# Reaproveita o estágio de build, que já tem o Prisma CLI (devDependency).
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- runtime: imagem final, só com o necessário para rodar ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
# Só dependências de produção:
# --omit=optional  o prisma CLI e o typescript são peers *opcionais* do
#                  @prisma/client/@nestjs/swagger; sem isso o npm os instala
#                  e eles dominam o tamanho da imagem (só servem no build);
# --ignore-scripts pula o postinstall (o client do Prisma já está em dist/).
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist

# Não rodar como root dentro do container
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
