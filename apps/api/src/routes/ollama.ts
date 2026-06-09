import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { sendError } from '../lib/errors.js'
import type { Settings } from '../settings.js'

export const ollamaRoutes: FastifyPluginAsync<{
  pool: pg.Pool
  settings: Settings
}> = async (app, { pool, settings }) => {
  app.get('/api/ollama/models', async (request, reply) => {
    try {
      const response = await fetch(new URL('/api/tags', settings.ollamaBaseUrl))
      if (!response.ok) {
        return { models: [], error: `Ollama HTTP ${response.status}` }
      }
      const body = await response.json() as {
        models?: Array<{ name: string; size: number; modified_at: string }>
      }
      const roles = await pool.query(
        `SELECT model_name, roles, enabled_for_chat, is_default_chat, is_default_embedding, is_rerank
         FROM ollama_model_roles`
      )
      const roleMap = new Map(roles.rows.map((r) => [r.model_name, r]))

      const models = (body.models ?? []).map((m) => {
        const role = roleMap.get(m.name)
        return {
          name: m.name,
          size_bytes: m.size,
          modified_at: m.modified_at,
          roles: role?.roles ?? [],
          enabled_for_chat: role?.enabled_for_chat ?? false,
          is_default_chat: role?.is_default_chat ?? false,
          is_default_embedding: role?.is_default_embedding ?? false,
          is_rerank: role?.is_rerank ?? false
        }
      })
      const defaults = await pool.query(
        `SELECT value_json FROM app_settings WHERE key = 'rag'`
      )
      const ragSettings = defaults.rows[0]?.value_json as { rerank_enabled?: boolean } | undefined
      const defaultChat = models.find((m) => m.is_default_chat)
      const defaultEmbed = models.find((m) => m.is_default_embedding)
      const rerank = models.find((m) => m.is_rerank)

      return {
        models,
        defaults: {
          chat_model: defaultChat?.name ?? null,
          embedding_model: defaultEmbed?.name ?? null,
          rerank_model: rerank?.name ?? null,
          rerank_enabled: ragSettings?.rerank_enabled ?? false,
          enabled_chat_models: models.filter((m) => m.enabled_for_chat).map((m) => m.name)
        }
      }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
