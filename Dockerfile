# syntax=docker/dockerfile:1
# Imagem multi-arquitetura (linux/amd64 e linux/arm64):
#   docker buildx build --platform linux/amd64,linux/arm64 -t karaoke-vote .

ARG NODE_VERSION=24
ARG BUN_VERSION=1.4.3

# --- Dependências + build (bun instala, Node compila) ---
FROM oven/bun:${BUN_VERSION}-slim AS bun
FROM node:${NODE_VERSION}-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY package.json bun.lock ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN bun install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build \
  # O seed é empacotado num único ficheiro (usa o better-sqlite3 do standalone)
  && bun build prisma/seed.ts --target node --format esm --external better-sqlite3 --outfile docker-out/seed.mjs

# --- Imagem final ---
FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/karaoke.db
WORKDIR /app
COPY --from=build --chown=node:node /src/.next/standalone ./
COPY --from=build --chown=node:node /src/.next/static ./.next/static
COPY --from=build --chown=node:node /src/docker-out/seed.mjs ./docker/seed.mjs
COPY --from=build --chown=node:node /src/prisma/migrations ./prisma/migrations
COPY --chown=node:node docker/entrypoint.mjs docker/migrate.mjs docker/edge.mjs ./docker/
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/state').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "docker/entrypoint.mjs"]
