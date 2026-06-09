import pg from 'pg'
import { loadConfig } from './config.js'
import { createStorageClient } from './storage.js'
import { claimNextJob, processExtractionJob } from './processor.js'
import { processEmbeddingJob } from './embedding.js'

const { Pool } = pg

async function main () {
  const config = loadConfig()
  const pool = new Pool({ connectionString: config.databaseUrl })
  const storage = createStorageClient(config.objectStorage)

  console.log('[aisss-worker] started (extraction + embedding)')

  const loop = async () => {
    try {
      const extractionJob = await claimNextJob(pool, 'extraction')
      if (extractionJob) {
        console.log('[aisss-worker] extraction', extractionJob.id)
        const result = await processExtractionJob(pool, storage, config.objectStorage, extractionJob)
        console.log('[aisss-worker] extraction done', extractionJob.id, result.status)
      }

      const embeddingJob = await claimNextJob(pool, 'embedding')
      if (embeddingJob) {
        console.log('[aisss-worker] embedding', embeddingJob.id)
        try {
          const result = await processEmbeddingJob(pool, config, embeddingJob)
          console.log('[aisss-worker] embedding done', embeddingJob.id, result.status)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'embedding failed'
          await pool.query(
            `UPDATE jobs SET status = 'failed', error = $2, updated_at = NOW(), completed_at = NOW() WHERE id = $1`,
            [embeddingJob.id, message]
          )
          console.error('[aisss-worker] embedding failed', embeddingJob.id, message)
        }
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
