import type { FastifyReply } from 'fastify'

export class AppError extends Error {
  constructor (
    public code: string,
    message: string,
    public statusCode = 400
  ) {
    super(message)
  }
}

export function sendError (
  reply: FastifyReply,
  error: unknown,
  requestId?: string
) {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        request_id: requestId
      }
    })
  }

  reply.log.error(error)
  return reply.code(500).send({
    error: {
      code: 'internal_error',
      message: 'An unexpected error occurred.',
      request_id: requestId
    }
  })
}
