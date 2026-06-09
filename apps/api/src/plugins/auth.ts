import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type pg from 'pg'
import { AppError } from '../lib/errors.js'
import type { AuthUser } from '../types/auth.js'
import type { Settings } from '../settings.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
  }
}

async function loadUser (pool: pg.Pool, userId: string): Promise<AuthUser | null> {
  const { rows } = await pool.query<{
    id: string
    external_id: string | null
    display_name: string
    department_id: string | null
    role: string
  }>(
    `SELECT id, external_id, display_name, department_id, role
     FROM users WHERE id = $1 AND is_active = TRUE`,
    [userId]
  )
  const row = rows[0]
  if (!row) return null

  const groups = await pool.query<{ group_id: string }>(
    `SELECT group_id FROM user_groups WHERE user_id = $1`,
    [userId]
  )
  const groupIds = groups.rows.map((g) => g.group_id)

  let viewingRangeIds: string[] = []
  if (groupIds.length > 0) {
    const ranges = await pool.query<{ viewing_range_id: string }>(
      `SELECT DISTINCT viewing_range_id
       FROM group_viewing_ranges
       WHERE group_id = ANY($1::uuid[])`,
      [groupIds]
    )
    viewingRangeIds = ranges.rows.map((r) => r.viewing_range_id)
  }

  return {
    id: row.id,
    externalId: row.external_id,
    displayName: row.display_name,
    departmentId: row.department_id,
    role: row.role,
    groupIds,
    viewingRangeIds
  }
}

const authPluginImpl: FastifyPluginAsync<{
  pool: pg.Pool
  settings: Settings
}> = async (app, { pool, settings }) => {
  app.decorateRequest('user', null as unknown as AuthUser)

  app.addHook('preHandler', async (request) => {
    if (
      request.url.startsWith('/api/health') ||
      request.url.startsWith('/api/ollama/health')
    ) {
      return
    }

    const headerUserId = request.headers['x-aisss-user-id']
    const userId = typeof headerUserId === 'string'
      ? headerUserId
      : settings.devUserId

    if (!userId) {
      throw new AppError('unauthorized', 'Authentication required.', 401)
    }

    const user = await loadUser(pool, userId)
    if (!user) {
      throw new AppError('unauthorized', 'Unknown or inactive user.', 401)
    }

    request.user = user
  })
}

export const authPlugin = fp(authPluginImpl)
