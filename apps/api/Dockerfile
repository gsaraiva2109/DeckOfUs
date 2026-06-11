# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# DeckOfUs backend — Fastify + Socket.IO + Prisma (SQLite)
#
# Base image: node:22-slim (Debian) rather than alpine.
# Reason: this app pulls in three native/compiled modules — `sharp` (libvips),
# `argon2` (node-gyp/N-API), and Prisma's query engine. On alpine (musl libc)
# these frequently need extra build deps and the musl Prisma engine, and
# `sharp` in particular is brittle on musl. Debian slim (glibc) builds these
# cleanly with prebuilt binaries and is the most reliable choice. The size
# difference vs alpine is minor for this stack.
# -----------------------------------------------------------------------------

# ---------- Stage 1: build ----------
FROM node:22-slim AS build
WORKDIR /app

# OpenSSL is required by Prisma to pick the correct query engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install ALL deps (incl. dev: typescript, prisma CLI) using the lockfile.
COPY package.json package-lock.json ./
RUN npm ci

# Generate the Prisma client (needs schema) then compile TS -> dist/.
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Strip dev dependencies so we can copy a lean prod node_modules to the runtime.
# `prisma generate` already ran, so the generated client survives the prune.
RUN npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATABASE_URL=file:./data/deckofus.db \
    LOCAL_STORAGE_DIR=./data/uploads

# OpenSSL for the Prisma engine at runtime; tini for proper signal handling.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl tini \
  && rm -rf /var/lib/apt/lists/*

# Bring over the production node_modules (with generated Prisma client),
# the compiled app, the Prisma schema + migrations, and the entrypoint.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Writable data dir for SQLite + uploads. Owned by the non-root `node` user
# (provided by the base image, uid 1000). Declared as a volume mount point.
RUN mkdir -p /app/data/uploads \
  && chown -R node:node /app
VOLUME ["/app/data"]

USER node
EXPOSE 8080

# Healthcheck hits the app's /healthz endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps zombies and forwards signals; entrypoint runs migrations then app.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
