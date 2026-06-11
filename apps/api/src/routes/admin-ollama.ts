import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { AppError, sendError } from '../lib/errors.js'
import * as modelRoles from '../services/model-roles.js'
import { getAiInferenceStatus } from '../services/ai-inference-tracker.js'

export const adminOllamaRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.put('/api/admin/ollama/model-roles', async (request, reply) => {
    try {
      const body = request.body as {
        assignments?: modelRoles.ModelRoleAssignment[]
        rerank_enabled?: boolean
      }
      const assignments = body.assignments ?? []
      if (
        getAiInferenceStatus().active &&
        await modelRoles.chatRolesWouldChange(pool, assignments)
      ) {
        throw new AppError(
          'inference_active',
          'AI 推論中はチャット有効・既定チャットの変更はできません。Ollama を再起動してから再度お試しください。',
          409
        )
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
