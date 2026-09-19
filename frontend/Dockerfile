# syntax=docker/dockerfile:1
# Build context is the repo root (compose.yaml): the image needs frontend/ and infra/caddy/.
FROM node:24-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ ./
# Demo builds (VITE_DEMO=true) include the debug pages and the Demo settings row (F18).
ARG VITE_DEMO=false
ENV VITE_DEMO=${VITE_DEMO}
RUN npm run build

# Runtime: Caddy serves the static files and proxies /api to the api service.
FROM caddy:2
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
