import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { AppError, sendError } from '../lib/errors.js'
import type { Settings } from '../settings.js'
import * as modelRoles from '../services/model-roles.js'
import { getAiInferenceStatus } from '../services/ai-inference-tracker.js'
import { deleteOllamaModel } from '../services/ollama-client.js'
import { isAdmin } from '../services/permissions.js'

export const adminOllamaRoutes: FastifyPluginAsync<{
  pool: pg.Pool
  settings: Settings
}> = async (app, { pool, settings }) => {
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

  app.post('/api/admin/ollama/models/delete', async (request, reply) => {
    try {
      const body = request.body as { model_name?: string }
      const modelName = body.model_name?.trim()
      if (!modelName) {
        throw new AppError('validation_error', 'model_name is required.', 400)
      }
      if (!isAdmin(request.user)) {
        throw new AppError('permission_denied', 'Administrator role required.', 403)
      }

      const inference = getAiInferenceStatus()
      if (inference.active && inference.models.includes(modelName)) {
        throw new AppError(
          'inference_active',
          'このモデルで AI 推論中のため削除できません。完了後に再度お試しください。',
          409
        )
      }

      await deleteOllamaModel(settings.ollamaBaseUrl, modelName)
      await modelRoles.removeModelRole(pool, request.user, modelName)
      return { ok: true, model_name: modelName }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
