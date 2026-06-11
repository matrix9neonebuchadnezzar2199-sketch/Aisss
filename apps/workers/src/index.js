import pg from 'pg'
import { loadConfig } from './config.js'
import { createStorageClient } from './storage.js'
import { claimNextJob, markJobFailed, processExtractionJob, requeueStaleRunningJobs } from './processor.js'
import { processEmbeddingJob } from './embedding.js'
import { processReindexJob } from './reindex.js'

const { Pool } = pg

async function main () {
  const config = loadConfig()
  const pool = new Pool({ connectionString: config.databaseUrl })
  const storage = createStorageClient(config.objectStorage)

  console.log('[aisss-worker] started (extraction + embedding)')

  const loop = async () => {
    try {
      const requeued = await requeueStaleRunningJobs(pool)
      for (const j of requeued) {
        console.warn('[aisss-worker] requeued stale running job', j.id, j.job_type)
      }

      const extractionJob = await claimNextJob(pool, 'extraction')
      if (extractionJob) {
        console.log('[aisss-worker] extraction', extractionJob.id)
        try {
          const result = await processExtractionJob(pool, storage, config.objectStorage, extractionJob)
          console.log('[aisss-worker] extraction done', extractionJob.id, result.status)
        } catch (error) {
          const failed = await markJobFailed(pool, extractionJob, error)
          console.error('[aisss-worker] extraction failed', extractionJob.id, failed.error)
        }
      }

      const reindexJob = await claimNextJob(pool, 'reindex')
      if (reindexJob) {
        console.log('[aisss-worker] reindex', reindexJob.id)
        try {
          const result = await processReindexJob(pool, config, reindexJob)
          console.log('[aisss-worker] reindex done', reindexJob.id, result.status)
        } catch (error) {
          const failed = await markJobFailed(pool, reindexJob, error)
          console.error('[aisss-worker] reindex failed', reindexJob.id, failed.error)
        }
      }

      const embeddingJob = await claimNextJob(pool, 'embedding')
      if (embeddingJob) {
        console.log('[aisss-worker] embedding', embeddingJob.id)
        try {
          const result = await processEmbeddingJob(pool, config, embeddingJob)
          console.log('[aisss-worker] embedding done', embeddingJob.id, result.status)
        } catch (error) {
          const failed = await markJobFailed(pool, embeddingJob, error)
          console.error('[aisss-worker] embedding failed', embeddingJob.id, failed.error)
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
