import pg from 'pg'
import { loadConfig } from './config.js'
import { createStorageClient } from './storage.js'
import { claimNextJob, processJob } from './processor.js'

const { Pool } = pg

async function main () {
  const config = loadConfig()
  const pool = new Pool({ connectionString: config.databaseUrl })
  const storage = createStorageClient(config.objectStorage)

  console.log('[aisss-worker] extraction worker started')

  const loop = async () => {
    try {
      const job = await claimNextJob(pool)
      if (job) {
        console.log('[aisss-worker] processing job', job.id, job.attachment_id)
        const result = await processJob(pool, storage, config.objectStorage, job)
        console.log('[aisss-worker] job done', job.id, result.status)
      }
    } catch (error) {
      console.error('[aisss-worker] loop error', error)
    }
    setTimeout(loop, config.pollIntervalMs)
  }

  void loop()

  const shutdown = async (signal) => {
    console.log(`[aisss-worker] ${signal}, shutting down`)
    await pool.end()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
