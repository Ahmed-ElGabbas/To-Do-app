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

EXPOSE 3000

# Apply migrations (compiled CLI, no ts-node needed) then start the API.
CMD ["sh", "-c", "npm run migration:run:prod && node dist/main.js"]
