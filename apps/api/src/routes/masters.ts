import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { AppError, sendError } from '../lib/errors.js'
import { resolveMasterTable } from '../lib/masters.js'
import { writeAuditLog } from '../services/audit.js'
import { isAdmin, isOperator } from '../services/permissions.js'
import type { AuthUser } from '../types/auth.js'

// 権限判定の根幹に関わるマスタは admin 限定（deactivate で deny が外れる等の影響があるため）
const ADMIN_ONLY_MASTERS = new Set(['conditions', 'viewing-ranges'])

function requireMasterWriteRole (user: AuthUser, masterName: string) {
  if (ADMIN_ONLY_MASTERS.has(masterName)) {
    if (!isAdmin(user)) {
      throw new AppError('permission_denied', 'Admin role required for this master.', 403)
    }
    return
  }
  if (!isOperator(user)) {
    throw new AppError('permission_denied', 'Operator role required.', 403)
  }
}

export const masterRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.get('/api/masters/:masterName', async (request, reply) => {
    try {
      const { masterName } = request.params as { masterName: string }
      const table = resolveMasterTable(masterName)
      if (!table) throw new AppError('not_found', 'Unknown master.', 404)

      const isConditions = table === 'conditions'
      const columns = isConditions
        ? 'id, name, search_policy, quote_policy, export_policy, priority, is_active'
        : 'id, code, name, sort_order, is_active'
      const orderBy = isConditions ? 'priority DESC, name ASC' : 'sort_order ASC, name ASC'

      const { rows } = await pool.query(
        `SELECT ${columns} FROM ${table}
         WHERE is_active = TRUE
         ORDER BY ${orderBy}`
      )
      return { items: rows }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/masters/:masterName', async (request, reply) => {
    try {
      const { masterName } = request.params as { masterName: string }
      const table = resolveMasterTable(masterName)
      if (!table) throw new AppError('not_found', 'Unknown master.', 404)
      requireMasterWriteRole(request.user, masterName)

      const body = request.body as { name: string; code?: string; sort_order?: number }
      if (!body.name?.trim()) throw new AppError('validation_error', 'name is required.', 400)

      // conditions は code / sort_order 列を持たない専用スキーマ
      const { rows } = table === 'conditions'
        ? await pool.query(
          `INSERT INTO conditions (name)
           VALUES ($1)
           RETURNING id, name, search_policy, quote_policy, export_policy, priority, is_active`,
          [body.name.trim()]
        )
        : await pool.query(
          `INSERT INTO ${table} (name, code, sort_order)
           VALUES ($1, $2, COALESCE($3, 0))
           RETURNING id, code, name, sort_order, is_active`,
          [body.name.trim(), body.code ?? null, body.sort_order ?? null]
        )

      await writeAuditLog(pool, {
        userId: request.user.id,
        action: 'master.create',
        resourceType: masterName,
        resourceId: rows[0].id as string,
        details: { name: body.name }
      })

      return reply.code(201).send(rows[0])
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.patch('/api/masters/:masterName/:id', async (request, reply) => {
    try {
      const { masterName, id } = request.params as { masterName: string; id: string }
      const table = resolveMasterTable(masterName)
      if (!table) throw new AppError('not_found', 'Unknown master.', 404)
      requireMasterWriteRole(request.user, masterName)

      const isConditions = table === 'conditions'
      const body = request.body as { name?: string; code?: string; sort_order?: number }
      const fields: string[] = []
      const values: unknown[] = []
      if (body.name !== undefined) {
        values.push(body.name)
        fields.push(`name = $${values.length}`)
      }
      // conditions は code / sort_order 列を持たないため受け付けない
      if (!isConditions && body.code !== undefined) {
        values.push(body.code)
        fields.push(`code = $${values.length}`)
      }
      if (!isConditions && body.sort_order !== undefined) {
        values.push(body.sort_order)
        fields.push(`sort_order = $${values.length}`)
      }
      if (fields.length === 0) {
        throw new AppError('validation_error', 'No fields to update.', 400)
      }

      values.push(id)
      const returning = isConditions
        ? 'id, name, search_policy, quote_policy, export_policy, priority, is_active'
        : 'id, code, name, sort_order, is_active'
      const { rows } = await pool.query(
        `UPDATE ${table} SET ${fields.join(', ')}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING ${returning}`,
        values
      )
      if (!rows[0]) throw new AppError('not_found', 'Master value not found.', 404)

      await writeAuditLog(pool, {
        userId: request.user.id,
        action: 'master.update',
        resourceType: masterName,
        resourceId: id
      })

      return rows[0]
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/masters/:masterName/:id/deactivate', async (request, reply) => {
    try {
      const { masterName, id } = request.params as { masterName: string; id: string }
      const table = resolveMasterTable(masterName)
      if (!table) throw new AppError('not_found', 'Unknown master.', 404)
      requireMasterWriteRole(request.user, masterName)

      const { rows } = await pool.query(
        `UPDATE ${table} SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1 RETURNING id, name, is_active`,
        [id]
      )
      if (!rows[0]) throw new AppError('not_found', 'Master value not found.', 404)

      await writeAuditLog(pool, {
        userId: request.user.id,
        action: 'master.deactivate',
        resourceType: masterName,
        resourceId: id
      })

      return rows[0]
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
