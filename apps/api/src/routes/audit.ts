import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { sendError } from '../lib/errors.js'
import { isAdmin } from '../services/permissions.js'
import { AppError } from '../lib/errors.js'

export const auditRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.get('/api/audit-logs', async (request, reply) => {
    try {
      if (!isAdmin(request.user)) {
        throw new AppError('permission_denied', 'Audit access requires admin role.', 403)
      }
      const q = request.query as Record<string, string | undefined>
      const params: unknown[] = []
      const where: string[] = ['TRUE']

      if (q.user_id) {
        params.push(q.user_id)
        where.push(`al.user_id = $${params.length}`)
      }
      if (q.action) {
        params.push(q.action)
        where.push(`al.action = $${params.length}`)
      }
      if (q.case) {
        params.push(q.case)
        where.push(`al.case_display_id = $${params.length}`)
      }
      if (q.date_from) {
        params.push(q.date_from)
        where.push(`al.created_at >= $${params.length}::timestamptz`)
      }
      if (q.date_to) {
        params.push(q.date_to)
        where.push(`al.created_at <= $${params.length}::timestamptz`)
      }

      const page = Math.max(1, Number(q.page ?? 1))
      const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50)))
      const offset = (page - 1) * limit
      params.push(limit, offset)

      const { rows } = await pool.query(
        `SELECT al.id, al.action, al.resource_type, al.resource_id,
                al.case_display_id, al.query_id, al.details_json, al.created_at,
                u.display_name AS user_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE ${where.join(' AND ')}
         ORDER BY al.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      )

      return { items: rows, page, limit }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/audit-logs/:id', async (request, reply) => {
    try {
      if (!isAdmin(request.user)) {
        throw new AppError('permission_denied', 'Audit access requires admin role.', 403)
      }
      const { id } = request.params as { id: string }
      const { rows } = await pool.query(
        `SELECT al.*, u.display_name AS user_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE al.id = $1`,
        [id]
      )
      if (!rows[0]) throw new AppError('not_found', 'Audit log not found.', 404)
      return rows[0]
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
