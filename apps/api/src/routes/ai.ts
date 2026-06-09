import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { sendError } from '../lib/errors.js'
import type { Settings } from '../settings.js'
import { runAiChat, streamAiChat } from '../services/ai-chat.js'

export const aiRoutes: FastifyPluginAsync<{
  pool: pg.Pool
  settings: Settings
}> = async (app, { pool, settings }) => {
  app.post('/api/ai/chat', async (request, reply) => {
    try {
      const body = request.body as {
        message?: string
        model?: string
        conversation_id?: string
      }
      if (!body.message?.trim()) {
        return reply.code(400).send({
          error: { code: 'validation_error', message: 'message is required.' }
        })
      }
      return await runAiChat(pool, settings, request.user, {
        message: body.message,
        model: body.model,
        conversation_id: body.conversation_id
      })
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/ai/chat/stream', async (request, reply) => {
    try {
      const body = request.body as { message?: string; model?: string }
      if (!body.message?.trim()) {
        return reply.code(400).send({
          error: { code: 'validation_error', message: 'message is required.' }
        })
      }

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })

      for await (const event of streamAiChat(pool, settings, request.user, {
        message: body.message,
        model: body.model
      })) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      }
      reply.raw.end()
    } catch (error) {
      if (!reply.sent) {
        return sendError(reply, error, request.id)
      }
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: 'stream_failed' })}\n\n`)
      reply.raw.end()
    }
  })
}
