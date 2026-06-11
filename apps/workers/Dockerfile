# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

COPY apps/workers/package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev

COPY apps/workers/src ./src

ENV WORKER_POLL_MS=5000

CMD ["npm", "start"]
