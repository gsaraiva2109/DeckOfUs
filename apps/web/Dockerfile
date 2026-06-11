# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# DeckOfUs frontend — Vite/React static SPA served by nginx.
# -----------------------------------------------------------------------------

# ---------- Stage 1: build the Vite bundle ----------
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Stage 2: serve with nginx ----------
FROM nginx:alpine AS runtime

# Replace the default site config with our SPA-fallback config.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static bundle.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

# nginx:alpine's default CMD already runs nginx in the foreground.
