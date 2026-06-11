# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/

RUN --mount=type=cache,target=/root/.npm \
    npm install -w @aisss/api

COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src
COPY infra/migrations ./infra/migrations

WORKDIR /repo/apps/api
RUN npm run build

FROM node:22-alpine

ARG APP_VERSION=0.0.0
ARG GIT_SHA=dev

WORKDIR /app

ENV NODE_ENV=production
ENV MIGRATIONS_DIR=/infra/migrations
ENV AISSS_VERSION=$APP_VERSION
ENV AISSS_GIT_SHA=$GIT_SHA

COPY apps/api/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev

COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/infra/migrations /infra/migrations

EXPOSE 8000

CMD ["node", "dist/server.js"]
