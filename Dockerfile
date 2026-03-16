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
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Production ──
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Find where server.js actually is (Next.js nests it in monorepo paths)
# and copy that entire directory as /app
COPY --from=builder /app/.next/standalone /tmp/standalone

RUN SERVERJS=$(find /tmp/standalone -name "server.js" -not -path "*/node_modules/*" | head -1) && \
    SERVERDIR=$(dirname "$SERVERJS") && \
    mkdir -p /app && \
    cp -r "$SERVERDIR"/. /app/ && \
    rm -rf /tmp/standalone

# Copy static assets into the correct .next location inside /app
COPY --from=builder /app/.next/static /app/.next/static

WORKDIR /app
RUN mkdir -p /app/uploads /tmp/uploads

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
