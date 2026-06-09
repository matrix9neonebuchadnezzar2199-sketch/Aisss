FROM node:22-alpine

WORKDIR /app

COPY apps/workers/package.json ./
COPY apps/workers/src ./src

ENV WORKER_HEARTBEAT_MS=60000

CMD ["npm", "start"]
