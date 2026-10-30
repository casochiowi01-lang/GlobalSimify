# syntax=docker/dockerfile:1

# GlobalSimify API (NestJS, ESM, Prisma) — container for Cloud Run.
# Debian-slim base (not Alpine) so the native Prisma query engine matches at
# build and run time. Build + run on the same OS to keep the engine compatible.

# ---- Builder ----------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Prisma needs OpenSSL available when it generates the client.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install all deps (including devDependencies — @prisma/client + prisma live there).
COPY package.json package-lock.json ./
RUN npm ci

# Generate the Prisma client, then compile TypeScript.
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build && npm test -- --runInBand && npm run test:contracts

# ---- Runner -----------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# OpenSSL for the Prisma query engine at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy the full node_modules from the builder. We can't `npm ci --omit=dev`
# here because @prisma/client is declared under devDependencies; pruning it
# would break the generated client. This also carries the generated client
# (node_modules/.prisma) so no second `prisma generate` is needed.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Cloud Run injects PORT (defaults to 8080); the app reads it via config.
ENV PORT=8080
EXPOSE 8080

# Run as the non-root user that the node image ships with.
USER node

CMD ["node", "dist/main"]
