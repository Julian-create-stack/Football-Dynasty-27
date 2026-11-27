# syntax=docker/dockerfile:1

# --- build the frontend bundle -------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js postcss.config.js tailwind.config.js ./
COPY src ./src
COPY server ./server
RUN npm run build

# --- production runtime --------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=10000

WORKDIR /app

# Litestream keeps the SQLite database in object storage, so the container
# filesystem can stay disposable.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL https://github.com/benbjohnson/litestream/releases/download/v0.3.14/litestream-v0.3.14-linux-amd64.tar.gz \
    | tar -xz -C /usr/local/bin \
 && apt-get purge -y --auto-remove curl \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY server ./server
COPY --from=build /app/dist ./dist
COPY litestream.yml /etc/litestream.yml
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p "$DATA_DIR"

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 10000) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
