import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { sendError } from '../lib/errors.js'
import type { Settings } from '../settings.js'
import * as caseService from '../services/cases.js'

export const caseRoutes: FastifyPluginAsync<{
  pool: pg.Pool
  settings: Settings
}> = async (app, { pool, settings }) => {
  app.get('/api/cases', async (request, reply) => {
    try {
      const q = request.query as Record<string, string | undefined>
      const result = await caseService.searchCases(pool, request.user, {
        q: q.q,
        material_type_id: q.material_type_id,
        registering_department_id: q.registering_department_id,
        rank_id: q.rank_id,
        viewing_range_id: q.viewing_range_id,
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        sort: q.sort,
        order: q.order === 'asc' ? 'asc' : 'desc'
      })
      return result
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/cases', async (request, reply) => {
    try {
      const body = request.body as caseService.CaseInput
      const created = await caseService.createCase(pool, request.user, body)
      return reply.code(201).send(created)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/cases/:caseId', async (request, reply) => {
    try {
      const { caseId } = request.params as { caseId: string }
      const item = await caseService.getCaseById(pool, request.user, caseId)
      return item
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/cases/by-display-id/:displayId', async (request, reply) => {
    try {
      const { displayId } = request.params as { displayId: string }
      const item = await caseService.getCaseByDisplayId(pool, request.user, displayId)
      return item
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.patch('/api/cases/:caseId', async (request, reply) => {
    try {
      const { caseId } = request.params as { caseId: string }
      const body = request.body as Partial<caseService.CaseInput>
      const updated = await caseService.updateCase(pool, request.user, caseId, body)
      return updated
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.delete('/api/cases/:caseId', async (request, reply) => {
    try {
      const { caseId } = request.params as { caseId: string }
      const result = await caseService.deleteCase(pool, settings, request.user, caseId)
      return result
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
