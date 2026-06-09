import type { FastifyPluginAsync } from 'fastify'
import { sendError } from '../lib/errors.js'

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/ai/chat', async (request, reply) => {
    try {
      const body = request.body as { message?: string; model?: string }
      if (!body.message?.trim()) {
        return reply.code(400).send({
          error: { code: 'validation_error', message: 'message is required.' }
        })
      }
      return {
        answer: 'AI chat is not fully implemented yet. Permissioned RAG search and Ollama completion will be added in Milestone 5.',
        model: body.model ?? null,
        citations: []
      }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
