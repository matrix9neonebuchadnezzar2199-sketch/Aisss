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

  // Fastify 由来のクライアントエラー（空 JSON body 等）は 500 に丸めず本来の 4xx を返す
  const httpError = error as { statusCode?: number; code?: string; message?: string }
  if (
    typeof httpError?.statusCode === 'number' &&
    httpError.statusCode >= 400 &&
    httpError.statusCode < 500
  ) {
    return reply.code(httpError.statusCode).send({
      error: {
        code: typeof httpError.code === 'string' ? httpError.code : 'bad_request',
        message: httpError.message ?? 'Bad request.',
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
