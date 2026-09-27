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

# Local file storage (package images, customer attachments, company logo) —
# mount this as a volume in docker-compose.yaml so uploads survive restarts.
RUN mkdir -p /app/data/uploads/package-images \
    /app/data/uploads/attachments \
    /app/data/uploads/company-assets

EXPOSE 3000
CMD ["bun", "run", "server-entry.mjs"]
