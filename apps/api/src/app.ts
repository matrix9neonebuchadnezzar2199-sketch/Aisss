import cors from '@fastify/cors'
import Fastify from 'fastify'
import type pg from 'pg'
import { checkOllamaHealth } from './services/ollama-health.js'
import type { Settings } from './settings.js'

export type AppDeps = {
  settings: Settings
  pool: pg.Pool
}

export async function buildApp ({ settings, pool }: AppDeps) {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

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

  app.decorate('pool', pool)

  return app
}
