FROM node:22-alpine

WORKDIR /app

COPY apps/workers/package.json ./
RUN npm install --omit=dev

COPY apps/workers/src ./src

ENV WORKER_POLL_MS=5000

CMD ["npm", "start"]
