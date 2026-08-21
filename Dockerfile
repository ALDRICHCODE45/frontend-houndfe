# ---------- Stage 1: build ----------
FROM node:24-alpine AS build

# pnpm pinned to the repo's local version (11.18.0) via corepack
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

WORKDIR /app

# 1. Dependencies first: lockfile changes rarely, source changes often
#    (keeps the expensive layer cached across builds)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 2. Source code
COPY . .

# 3. Build-time configuration — Vite inlines env vars at build time,
#    so the API base URL must be a build ARG, not a runtime env var.
ARG VITE_API_BASE_URL=https://api.houndfe.com
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# 4. Production build (type-check + vite build)
RUN pnpm build

# ---------- Stage 2: runtime ----------
FROM nginx:1.27-alpine AS runtime

# SPA config: history-mode fallback, gzip, immutable asset cache
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static artifacts only — no node_modules, no build tooling
COPY --from=build /app/dist /usr/share/nginx/html

# Allow non-root nginx to write its cache and pid paths (official image
# only creates these when running as root)
RUN chown -R nginx:nginx /var/cache/nginx /run /etc/nginx/conf.d

# Run as non-root (official nginx image entrypoint self-configures temp paths)
USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
