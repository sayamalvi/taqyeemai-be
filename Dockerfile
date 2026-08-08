FROM node:22-bookworm-slim AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN apt-get update -y && apt-get install -y openssl

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npx prisma generate

RUN pnpm build

FROM ghcr.io/puppeteer/puppeteer:latest AS production

USER root
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app
RUN chown -R pptruser:pptruser /app

USER pptruser

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_SKIP_DOWNLOAD=false

COPY --chown=pptruser:pptruser package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build --chown=pptruser:pptruser /app/dist ./dist
COPY --from=build --chown=pptruser:pptruser /app/generated ./generated
COPY --from=build --chown=pptruser:pptruser /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=pptruser:pptruser /app/prisma ./prisma

EXPOSE 4000

CMD ["node", "dist/src/main.js"]