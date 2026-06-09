import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { AppError, sendError } from '../lib/errors.js'
import { writeAuditLog } from '../services/audit.js'

export const jobRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.get('/api/jobs', async (request, reply) => {
    try {
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

      const { rows } = await pool.query(
        `SELECT j.id, j.job_type, j.status, j.case_id, j.case_display_id,
                j.attachment_id, j.error, j.created_at, j.updated_at, j.completed_at
         FROM jobs j
         WHERE ${where.join(' AND ')}
         ORDER BY j.updated_at DESC
         LIMIT 200`,
        params
      )
      return { items: rows }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/jobs/:jobId', async (request, reply) => {
    try {
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
      const { jobId } = request.params as { jobId: string }
      const { rows } = await pool.query(
        `UPDATE jobs SET status = 'pending', error = NULL, updated_at = NOW()
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
}
