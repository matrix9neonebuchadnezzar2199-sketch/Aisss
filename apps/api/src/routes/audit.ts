import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { sendError } from '../lib/errors.js'
import { isAdmin } from '../services/permissions.js'
import { AppError } from '../lib/errors.js'
import { getAuditStats } from '../services/audit-stats.js'

export const auditRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.get('/api/audit-logs/stats', async (request, reply) => {
    try {
      if (!isAdmin(request.user)) {
        throw new AppError('permission_denied', 'Audit access requires admin role.', 403)
      }
      return await getAuditStats(pool)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

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
      if (q.query_id) {
        params.push(q.query_id)
        where.push(`al.query_id = $${params.length}`)
      }
      if (q.resource_type) {
        params.push(q.resource_type)
        where.push(`al.resource_type = $${params.length}`)
      }
      if (q.date_from) {
        params.push(q.date_from)
        where.push(`al.created_at >= $${params.length}::timestamptz`)
      }
      if (q.date_to) {
        params.push(q.date_to)
        // 日付のみ指定（YYYY-MM-DD）はその日全体を含める
        if (/^\d{4}-\d{2}-\d{2}$/.test(q.date_to)) {
          where.push(`al.created_at < ($${params.length}::date + INTERVAL '1 day')`)
        } else {
          where.push(`al.created_at <= $${params.length}::timestamptz`)
        }
      }

      const page = Math.max(1, Number(q.page ?? 1))
      const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50)))
      const offset = (page - 1) * limit

      const baseSql = `FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE ${where.join(' AND ')}`

      if (q.export === 'csv') {
        const { rows } = await pool.query(
          `SELECT al.created_at, u.display_name AS user_name, al.action,
                  al.resource_type, al.resource_id, al.case_display_id, al.query_id
           ${baseSql}
           ORDER BY al.created_at DESC
           LIMIT 1000`,
          params
        )
        const csv = [
          'created_at,user_name,action,resource_type,resource_id,case_display_id,query_id',
          ...rows.map((row) => [
            row.created_at?.toISOString?.() ?? row.created_at,
            row.user_name ?? '',
            row.action ?? '',
            row.resource_type ?? '',
            row.resource_id ?? '',
            row.case_display_id ?? '',
            row.query_id ?? ''
          ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
        ].join('\n')
        // ExcelがUTF-8として認識するようBOMを付与（日本語の文字化け対策）
        const csvWithBom = '\uFEFF' + csv
        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
          .send(csvWithBom)
      }

      params.push(limit, offset)

      const [list, count] = await Promise.all([
        pool.query(
        `SELECT al.id, al.action, al.resource_type, al.resource_id,
                al.case_display_id, al.query_id, al.details_json, al.created_at,
                u.display_name AS user_name
         ${baseSql}
         ORDER BY al.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
        ),
        pool.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total ${baseSql}`,
          params.slice(0, -2)
        )
      ])

      return { items: list.rows, total: count.rows[0]?.total ?? 0, page, limit }
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
