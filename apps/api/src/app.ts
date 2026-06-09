import cors from '@fastify/cors'
import Fastify from 'fastify'
import type pg from 'pg'
import { AppError, sendError } from './lib/errors.js'
import { authPlugin } from './plugins/auth.js'
import { aiRoutes } from './routes/ai.js'
import { auditRoutes } from './routes/audit.js'
import { caseRoutes } from './routes/cases.js'
import { jobRoutes } from './routes/jobs.js'
import { masterRoutes } from './routes/masters.js'
import { ollamaRoutes } from './routes/ollama.js'
import { permissionRoutes } from './routes/permissions.js'
import { checkOllamaHealth } from './services/ollama-health.js'
import type { Settings } from './settings.js'

export type AppDeps = {
  settings: Settings
  pool: pg.Pool
}

export async function buildApp ({ settings, pool }: AppDeps) {
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

  await app.register(authPlugin, { pool, settings })
  await app.register(caseRoutes, { pool })
  await app.register(masterRoutes, { pool })
  await app.register(permissionRoutes, { pool })
  await app.register(auditRoutes, { pool })
  await app.register(jobRoutes, { pool })
  await app.register(ollamaRoutes, { pool, settings })
  await app.register(aiRoutes)

  app.decorate('pool', pool)

  return app
}

// Re-export for tests that import AppError handling
export { AppError }
