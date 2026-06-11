# syntax=docker/dockerfile:1
# Layer order: deps (stable) → source (volatile). npm cache mount: BuildKit.
FROM node:22-alpine AS build

ARG APP_VERSION=0.0.0
ARG GIT_SHA=dev
ENV VITE_APP_VERSION=$APP_VERSION
ENV VITE_GIT_SHA=$GIT_SHA

WORKDIR /repo

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/

RUN --mount=type=cache,target=/root/.npm \
    npm install -w @aisss/web

COPY apps/web ./apps/web
COPY mockups ./mockups

WORKDIR /repo/apps/web
# Reference ARGs in RUN so Docker invalidates cache when GIT_SHA / APP_VERSION change.
RUN echo "build web ${APP_VERSION} (${GIT_SHA})" && npm run build
RUN mkdir -p dist/mockups && cp -r ../../mockups/* dist/mockups/

FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
