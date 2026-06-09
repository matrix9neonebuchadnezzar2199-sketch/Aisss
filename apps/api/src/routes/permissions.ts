import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { AppError, sendError } from '../lib/errors.js'
import { writeAuditLog } from '../services/audit.js'
import { isAdmin } from '../services/permissions.js'

export const permissionRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.get('/api/me', async (request) => {
    return {
      user_id: request.user.id,
      display_name: request.user.displayName,
      department_id: request.user.departmentId,
      role: request.user.role,
      groups: request.user.groupIds,
      viewing_range_ids: request.user.viewingRangeIds
    }
  })

  app.get('/api/users', async (request, reply) => {
    try {
      const q = (request.query as { q?: string }).q
      const params: unknown[] = []
      let where = 'WHERE u.is_active = TRUE'
      if (q) {
        params.push(`%${q}%`)
        where += ` AND (u.display_name ILIKE $1 OR u.external_id ILIKE $1)`
      }
      const { rows } = await pool.query(
        `SELECT u.id, u.external_id, u.display_name, u.department_id, u.role,
                d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         ${where}
         ORDER BY u.display_name ASC`,
        params
      )
      return { items: rows }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/groups', async (request, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT g.id, g.name, g.is_active,
          COALESCE(json_agg(json_build_object('user_id', u.id, 'display_name', u.display_name))
            FILTER (WHERE u.id IS NOT NULL), '[]') AS members
         FROM groups g
         LEFT JOIN user_groups ug ON ug.group_id = g.id
         LEFT JOIN users u ON u.id = ug.user_id
         WHERE g.is_active = TRUE
         GROUP BY g.id
         ORDER BY g.name ASC`
      )
      return { items: rows }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/groups', async (request, reply) => {
    try {
      if (!isAdmin(request.user)) {
        throw new AppError('permission_denied', 'Admin role required.', 403)
      }
      const body = request.body as { name: string }
      if (!body.name?.trim()) throw new AppError('validation_error', 'name is required.', 400)
      const { rows } = await pool.query(
        `INSERT INTO groups (name) VALUES ($1) RETURNING id, name, is_active`,
        [body.name.trim()]
      )
      return reply.code(201).send(rows[0])
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.put('/api/groups/:groupId/members', async (request, reply) => {
    try {
      if (!isAdmin(request.user)) {
        throw new AppError('permission_denied', 'Admin role required.', 403)
      }
      const { groupId } = request.params as { groupId: string }
      const body = request.body as { user_ids: string[] }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`DELETE FROM user_groups WHERE group_id = $1`, [groupId])
        for (const userId of body.user_ids ?? []) {
          await client.query(
            `INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, groupId]
          )
        }
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
      await writeAuditLog(pool, {
        userId: request.user.id,
        action: 'group.members.update',
        resourceType: 'group',
        resourceId: groupId
      })
      return { group_id: groupId, user_ids: body.user_ids ?? [] }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/viewing-ranges', async (request, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT vr.id, vr.code, vr.name, vr.sort_order,
          COALESCE(json_agg(g.id) FILTER (WHERE g.id IS NOT NULL), '[]') AS group_ids
         FROM viewing_ranges vr
         LEFT JOIN group_viewing_ranges gvr ON gvr.viewing_range_id = vr.id
         LEFT JOIN groups g ON g.id = gvr.group_id
         WHERE vr.is_active = TRUE
         GROUP BY vr.id
         ORDER BY vr.sort_order ASC, vr.name ASC`
      )
      return { items: rows }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.put('/api/viewing-ranges/:id/groups', async (request, reply) => {
    try {
      if (!isAdmin(request.user)) {
        throw new AppError('permission_denied', 'Admin role required.', 403)
      }
      const { id } = request.params as { id: string }
      const body = request.body as { group_ids: string[] }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`DELETE FROM group_viewing_ranges WHERE viewing_range_id = $1`, [id])
        for (const groupId of body.group_ids ?? []) {
          await client.query(
            `INSERT INTO group_viewing_ranges (group_id, viewing_range_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [groupId, id]
          )
        }
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
      await writeAuditLog(pool, {
        userId: request.user.id,
        action: 'viewing_range.groups.update',
        resourceType: 'viewing_range',
        resourceId: id
      })
      return { viewing_range_id: id, group_ids: body.group_ids ?? [] }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
