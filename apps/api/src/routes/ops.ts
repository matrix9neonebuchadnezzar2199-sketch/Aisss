import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { AppError, sendError } from '../lib/errors.js'
import { writeAuditLog } from '../services/audit.js'
import { isAdmin, isOperator } from '../services/permissions.js'

export const opsRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.get('/api/admin/dashboard', async (request, reply) => {
    try {
      if (!isOperator(request.user)) {
        throw new AppError('permission_denied', 'Operator role required.', 403)
      }
      const [
        cases,
        attachmentsFailed,
        jobsFailed,
        ragChunks,
        auditToday,
        feedbackOpen
      ] = await Promise.all([
        pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM cases WHERE deleted_at IS NULL`),
        pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM attachments WHERE extraction_status = 'failed'`),
        pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM jobs WHERE status IN ('failed', 'dead_letter')`),
        pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM rag_chunks`),
        pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM audit_logs WHERE created_at >= CURRENT_DATE`),
        pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM pilot_feedback WHERE status <> 'closed'`)
      ])
      return {
        cases: Number(cases.rows[0]?.count ?? 0),
        failed_extractions: Number(attachmentsFailed.rows[0]?.count ?? 0),
        failed_jobs: Number(jobsFailed.rows[0]?.count ?? 0),
        rag_chunks: Number(ragChunks.rows[0]?.count ?? 0),
        audit_events_today: Number(auditToday.rows[0]?.count ?? 0),
        open_feedback: Number(feedbackOpen.rows[0]?.count ?? 0)
      }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/admin/backup-checks', async (request, reply) => {
    try {
      if (!isAdmin(request.user)) {
        throw new AppError('permission_denied', 'Admin role required.', 403)
      }
      const body = request.body as { scope?: string; status?: string; notes?: string }
      if (!body.scope?.trim()) throw new AppError('validation_error', 'scope is required.', 400)
      const { rows } = await pool.query(
        `INSERT INTO backup_restore_checks (checked_by, scope, status, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [request.user.id, body.scope.trim(), body.status ?? 'ok', body.notes ?? null]
      )
      await writeAuditLog(pool, {
        userId: request.user.id,
        action: 'backup_restore.check',
        resourceType: 'backup_restore_check',
        resourceId: rows[0].id as string,
        details: { scope: body.scope, status: body.status ?? 'ok' }
      })
      return reply.code(201).send(rows[0])
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/admin/backup-checks', async (request, reply) => {
    try {
      if (!isAdmin(request.user)) {
        throw new AppError('permission_denied', 'Admin role required.', 403)
      }
      const { rows } = await pool.query(
        `SELECT brc.*, u.display_name AS checked_by_name
         FROM backup_restore_checks brc
         LEFT JOIN users u ON u.id = brc.checked_by
         ORDER BY brc.checked_at DESC
         LIMIT 50`
      )
      return { items: rows }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/pilot/feedback', async (request, reply) => {
    try {
      if (!isOperator(request.user)) {
        throw new AppError('permission_denied', 'Operator role required.', 403)
      }
      const q = request.query as { status?: string }
      const params: unknown[] = []
      const where: string[] = ['TRUE']
      if (q.status) {
        params.push(q.status)
        where.push(`pf.status = $${params.length}`)
      }
      const { rows } = await pool.query(
        `SELECT pf.*, u.display_name AS submitted_by_name
         FROM pilot_feedback pf
         LEFT JOIN users u ON u.id = pf.submitted_by
         WHERE ${where.join(' AND ')}
         ORDER BY pf.created_at DESC
         LIMIT 100`,
        params
      )
      return { items: rows }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/pilot/feedback', async (request, reply) => {
    try {
      const body = request.body as {
        area?: string
        severity?: string
        title?: string
        description?: string
      }
      if (!body.area?.trim()) throw new AppError('validation_error', 'area is required.', 400)
      if (!body.title?.trim()) throw new AppError('validation_error', 'title is required.', 400)
      const { rows } = await pool.query(
        `INSERT INTO pilot_feedback (submitted_by, area, severity, title, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          request.user.id,
          body.area.trim(),
          body.severity ?? 'medium',
          body.title.trim(),
          body.description ?? ''
        ]
      )
      await writeAuditLog(pool, {
        userId: request.user.id,
        action: 'pilot.feedback.create',
        resourceType: 'pilot_feedback',
        resourceId: rows[0].id as string,
        details: { area: body.area, severity: body.severity ?? 'medium' }
      })
      return reply.code(201).send(rows[0])
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.patch('/api/pilot/feedback/:id', async (request, reply) => {
    try {
      if (!isOperator(request.user)) {
        throw new AppError('permission_denied', 'Operator role required.', 403)
      }
      const { id } = request.params as { id: string }
      const body = request.body as { status?: string }
      const { rows } = await pool.query(
        `UPDATE pilot_feedback
         SET status = COALESCE($2, status), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, body.status ?? null]
      )
      if (!rows[0]) throw new AppError('not_found', 'Feedback not found.', 404)
      return rows[0]
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
