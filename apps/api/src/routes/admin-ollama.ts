import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { sendError } from '../lib/errors.js'
import * as modelRoles from '../services/model-roles.js'

export const adminOllamaRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.put('/api/admin/ollama/model-roles', async (request, reply) => {
    try {
      const body = request.body as {
        assignments?: modelRoles.ModelRoleAssignment[]
        rerank_enabled?: boolean
      }
      const defaults = await modelRoles.updateModelRoles(pool, request.user, {
        assignments: body.assignments ?? [],
        rerank_enabled: body.rerank_enabled
      })
      return { defaults }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
