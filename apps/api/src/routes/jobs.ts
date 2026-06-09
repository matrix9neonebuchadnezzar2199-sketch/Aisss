import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { AppError, sendError } from '../lib/errors.js'
import { writeAuditLog } from '../services/audit.js'
import { isOperator } from '../services/permissions.js'

export const jobRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.get('/api/jobs/stats', async (request, reply) => {
    try {
      if (!isOperator(request.user)) {
        throw new AppError('permission_denied', 'Operator role required.', 403)
      }
      const { rows } = await pool.query<{
        status: string
        job_type: string
        count: string
      }>(
        `SELECT status, job_type, COUNT(*)::text AS count
         FROM jobs
         GROUP BY status, job_type`
      )
      const summary = {
        running: 0,
        pending: 0,
        failed: 0,
        dead_letter: 0,
        completed_today: 0,
        by_type: {} as Record<string, Record<string, number>>
      }
      for (const row of rows) {
        const count = Number(row.count)
        if (row.status in summary) {
          summary[row.status as 'running' | 'pending' | 'failed' | 'dead_letter'] += count
        }
        summary.by_type[row.job_type] ??= {}
        summary.by_type[row.job_type][row.status] = count
      }
      const completed = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM jobs
         WHERE status = 'completed' AND completed_at >= CURRENT_DATE`
      )
      summary.completed_today = Number(completed.rows[0]?.count ?? 0)
      return summary
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/jobs', async (request, reply) => {
    try {
      if (!isOperator(request.user)) {
        throw new AppError('permission_denied', 'Operator role required.', 403)
      }
      const q = request.query as Record<string, string | undefined>
      const params: unknown[] = []
      const where: string[] = ['TRUE']

      if (q.status) {
        params.push(q.status)
        where.push(`j.status = $${params.length}`)
      }
      if (q.job_type) {
        params.push(q.job_type)
        where.push(`j.job_type = $${params.length}`)
      }
      if (q.case) {
        params.push(q.case)
        where.push(`j.case_display_id = $${params.length}`)
      }
      if (q.failed_only === 'true') {
        where.push(`j.status IN ('failed', 'dead_letter')`)
      }

      const page = Math.max(1, Number(q.page ?? 1))
      const limit = Math.min(200, Math.max(1, Number(q.limit ?? 100)))
      const offset = (page - 1) * limit
      params.push(limit, offset)

      const [list, total] = await Promise.all([
        pool.query(
        `SELECT j.id, j.job_type, j.status, j.case_id, j.case_display_id,
                j.attachment_id, j.error, j.retry_count, j.max_attempts,
                j.dead_lettered_at, j.created_at, j.updated_at, j.completed_at
         FROM jobs j
         WHERE ${where.join(' AND ')}
         ORDER BY j.updated_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
        ),
        pool.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM jobs j WHERE ${where.join(' AND ')}`,
          params.slice(0, -2)
        )
      ])
      return { items: list.rows, total: total.rows[0]?.total ?? 0, page, limit }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/jobs/:jobId', async (request, reply) => {
    try {
      if (!isOperator(request.user)) {
        throw new AppError('permission_denied', 'Operator role required.', 403)
      }
      const { jobId } = request.params as { jobId: string }
      const { rows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId])
      if (!rows[0]) throw new AppError('not_found', 'Job not found.', 404)
      return rows[0]
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/jobs/:jobId/retry', async (request, reply) => {
    try {
      if (!isOperator(request.user)) {
        throw new AppError('permission_denied', 'Operator role required.', 403)
      }
      const { jobId } = request.params as { jobId: string }
      const { rows } = await pool.query(
        `UPDATE jobs
         SET status = 'pending',
             error = NULL,
             retry_count = retry_count + 1,
             last_retry_at = NOW(),
             dead_lettered_at = NULL,
             updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [jobId]
      )
      if (!rows[0]) throw new AppError('not_found', 'Job not found.', 404)
      await writeAuditLog(pool, {
        userId: request.user.id,
        action: 'job.retry',
        resourceType: 'job',
        resourceId: jobId,
        caseDisplayId: rows[0].case_display_id as string | undefined
      })
      return rows[0]
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/jobs/:jobId/dead-letter', async (request, reply) => {
    try {
      if (!isOperator(request.user)) {
        throw new AppError('permission_denied', 'Operator role required.', 403)
      }
      const { jobId } = request.params as { jobId: string }
      const body = request.body as { reason?: string }
      const { rows } = await pool.query(
        `UPDATE jobs
         SET status = 'dead_letter',
             error = COALESCE($2, error),
             dead_lettered_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [jobId, body.reason ?? null]
      )
      if (!rows[0]) throw new AppError('not_found', 'Job not found.', 404)
      await writeAuditLog(pool, {
        userId: request.user.id,
        action: 'job.dead_letter',
        resourceType: 'job',
        resourceId: jobId,
        caseDisplayId: rows[0].case_display_id as string | undefined,
        details: { reason: body.reason ?? null }
      })
      return rows[0]
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
