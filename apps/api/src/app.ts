import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import type pg from 'pg'
import type { S3Client } from '@aws-sdk/client-s3'
import { AppError, sendError } from './lib/errors.js'
import { authPlugin } from './plugins/auth.js'
import { attachmentRoutes } from './routes/attachments.js'
import { adminOllamaRoutes } from './routes/admin-ollama.js'
import { aiRoutes } from './routes/ai.js'
import { ragRoutes } from './routes/rag.js'
import { auditRoutes } from './routes/audit.js'
import { caseRoutes } from './routes/cases.js'
import { importRoutes } from './routes/imports.js'
import { jobRoutes } from './routes/jobs.js'
import { masterRoutes } from './routes/masters.js'
import { ollamaRoutes } from './routes/ollama.js'
import { opsRoutes } from './routes/ops.js'
import { permissionRoutes } from './routes/permissions.js'
import { checkOllamaHealth } from './services/ollama-health.js'
import type { Settings } from './settings.js'

export type AppDeps = {
  settings: Settings
  pool: pg.Pool
  storage: S3Client
}

export async function buildApp ({ settings, pool, storage }: AppDeps) {
  const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() })

  await app.register(cors, { origin: true })

  app.setErrorHandler((error, request, reply) => {
    return sendError(reply, error, request.id)
  })

  async function pingDatabase (): Promise<boolean> {
    const client = await pool.connect()
    try {
      await client.query('SELECT 1')
      return true
    } finally {
      client.release()
    }
  }

  app.get('/api/health', async () => {
    let database = false
    try {
      database = await pingDatabase()
    } catch {
      database = false
    }

    return {
      status: database ? 'ok' : 'degraded',
      service: 'aisss-api',
      database,
      checked_at: new Date().toISOString()
    }
  })

  app.get('/api/ollama/health', async () => {
    return checkOllamaHealth(settings.ollamaBaseUrl)
  })

  app.get('/api/health/ready', async (_request, reply) => {
    try {
      const ok = await pingDatabase()
      if (!ok) {
        return reply.code(503).send({ status: 'not_ready', database: false })
      }
      return { status: 'ready', database: true }
    } catch {
      return reply.code(503).send({ status: 'not_ready', database: false })
    }
  })

  await app.register(multipart, {
    limits: { fileSize: settings.maxUploadBytes }
  })

  await app.register(authPlugin, { pool, settings })
  await app.register(attachmentRoutes, {
    pool,
    storage,
    storageConfig: settings.objectStorage
  })
  await app.register(caseRoutes, { pool })
  await app.register(importRoutes, { pool })
  await app.register(masterRoutes, { pool })
  await app.register(permissionRoutes, { pool })
  await app.register(auditRoutes, { pool })
  await app.register(jobRoutes, { pool })
  await app.register(opsRoutes, { pool })
  await app.register(ollamaRoutes, { pool, settings })
  await app.register(adminOllamaRoutes, { pool })
  await app.register(ragRoutes, {
    pool,
    settings,
    storage,
    storageConfig: settings.objectStorage
  })
  await app.register(aiRoutes, { pool, settings })

  app.decorate('pool', pool)

  return app
}

// Re-export for tests that import AppError handling
export { AppError }
