import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { sendError } from '../lib/errors.js'
import type { Settings } from '../settings.js'
import { getCurrentReindexJob, startReindex } from '../services/embedding-reindex.js'

export const adminReindexRoutes: FastifyPluginAsync<{
  pool: pg.Pool
  settings: Settings
}> = async (app, { pool, settings }) => {
  app.post('/api/admin/reindex', async (request, reply) => {
    try {
      const body = request.body as { model_name?: string }
      const result = await startReindex(pool, settings, request.user, body.model_name ?? '')
      return result
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/admin/reindex/current', async (request, reply) => {
    try {
      const job = await getCurrentReindexJob(pool, request.user)
      return { job }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
