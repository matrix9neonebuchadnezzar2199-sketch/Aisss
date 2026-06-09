const heartbeatMs = Number(process.env.WORKER_HEARTBEAT_MS ?? '60000')

console.log('[aisss-worker] skeleton started')

const timer = setInterval(() => {
  console.log('[aisss-worker] heartbeat', new Date().toISOString())
}, heartbeatMs)

function shutdown (signal) {
  console.log(`[aisss-worker] received ${signal}, shutting down`)
  clearInterval(timer)
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
