FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Dependencies ──
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-workspace

# ── Build ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Production ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create upload directory
RUN mkdir -p /tmp/uploads

# Copy standalone output — Next.js may nest under the monorepo path
# so we find server.js and copy from its parent directory
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the standalone bundle (handle both flat and nested monorepo output)
COPY --from=builder /app/.next/standalone ./standalone-raw

# Move files to /app — find the actual server.js location
RUN if [ -f ./standalone-raw/server.js ]; then \
      cp -r ./standalone-raw/* ./ ; \
    else \
      SERVERJS=$(find ./standalone-raw -name "server.js" -not -path "*/node_modules/*" | head -1) && \
      SERVERDIR=$(dirname "$SERVERJS") && \
      cp -r "$SERVERDIR"/* ./ && \
      cp -r ./standalone-raw/node_modules ./node_modules 2>/dev/null || true ; \
    fi && \
    rm -rf ./standalone-raw

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
