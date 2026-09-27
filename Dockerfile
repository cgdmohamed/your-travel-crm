# Multi-stage build for Your Travel CRM — no external build service, plain Bun + Node.
FROM oven/bun:1-slim AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- Runtime image ---
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/server-entry.mjs ./server-entry.mjs
COPY --from=build /app/public ./public

# TanStack Start's SSR build leaves some packages (react-dom, h3-v2, etc.)
# as external requires resolved at runtime rather than bundling them — the
# server crashes on every request without node_modules present here.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Applied on every container start (see CMD below) — idempotent, safe to run
# against an already-migrated database. This is the source of truth for the
# schema now, not docker-entrypoint-initdb.d (which only runs once against a
# brand-new, empty Postgres volume and silently no-ops on any redeploy after
# a previous attempt already created that volume, even an empty one).
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/db ./db

# Local file storage (package images, customer attachments, company logo) —
# mount this as a volume in docker-compose.yaml so uploads survive restarts.
RUN mkdir -p /app/data/uploads/package-images \
    /app/data/uploads/attachments \
    /app/data/uploads/company-assets

EXPOSE 3000
CMD ["sh", "-c", "bun scripts/migrate.mjs && bun run server-entry.mjs"]
