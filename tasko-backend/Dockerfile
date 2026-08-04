# syntax=docker/dockerfile:1

# ---- Build stage: install all deps + compile TS ----
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage: prod deps only + compiled dist ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Local-disk uploads live here (see STORAGE_DRIVER/UPLOAD_DIR in compose).
RUN mkdir -p /app/storage && chown -R node:node /app

# Run as the unprivileged `node` user shipped with the base image.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Migrations are applied by the CI/CD pipeline (see .github/workflows/ci.yml),
# not inline here, so a failed migration never leaves a half-booted container.
CMD ["node", "dist/main.js"]
