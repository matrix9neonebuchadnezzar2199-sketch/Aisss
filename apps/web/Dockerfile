# syntax=docker/dockerfile:1
# Layer order: deps (stable) → source (volatile). npm cache mount: BuildKit.
FROM node:22-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/

RUN --mount=type=cache,target=/root/.npm \
    npm install -w @aisss/web

COPY apps/web ./apps/web
COPY mockups ./mockups

WORKDIR /repo/apps/web
RUN npm run build
RUN mkdir -p dist/mockups && cp -r ../../mockups/* dist/mockups/

FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
