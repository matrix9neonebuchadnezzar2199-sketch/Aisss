import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import type { S3Client } from '@aws-sdk/client-s3'
import { sendError } from '../lib/errors.js'
import type { Settings } from '../settings.js'
import type { ObjectStorageSettings } from '../settings.js'
import * as ragAdmin from '../services/rag-admin.js'
import { permissionedSearch } from '../services/permissioned-search.js'

export const ragRoutes: FastifyPluginAsync<{
  pool: pg.Pool
  settings: Settings
  storage: S3Client
  storageConfig: ObjectStorageSettings
}> = async (app, { pool, settings, storage, storageConfig }) => {
  app.get('/api/rag/status', async (request, reply) => {
    try {
      return await ragAdmin.getRagStatus(pool)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/rag/tree', async (request, reply) => {
    try {
      return await ragAdmin.getRagTree(pool)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/rag/files', async (request, reply) => {
    try {
      const q = request.query as Record<string, string | undefined>
      return await ragAdmin.listRagFiles(pool, {
        q: q.q,
        viewing_range_id: q.viewing_range_id,
        tag: q.tag,
        date_from: q.date_from,
        date_to: q.date_to,
        knowledge_candidates_only: q.knowledge_candidates_only === 'true'
      })
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.patch('/api/rag/files/:fileId/enable', async (request, reply) => {
    try {
      const { fileId } = request.params as { fileId: string }
      const body = request.body as { enabled?: boolean; source_kind?: 'case_attachment' | 'standalone' }
      return await ragAdmin.setRagEnabled(
        pool,
        settings,
        request.user,
        fileId,
        body.enabled ?? true,
        body.source_kind
      )
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/rag/standalone-files', async (request, reply) => {
    try {
      const data = await request.file()
      if (!data) {
        return reply.code(400).send({
          error: { code: 'validation_error', message: 'file is required.' }
        })
      }
      const fields = data.fields as Record<string, { value?: string } | Array<{ value?: string }>>
      const title = (fields.title as { value?: string })?.value ?? ''
      const viewingRaw = (fields.viewing_range_ids as { value?: string })?.value ?? '[]'
      const tagsRaw = (fields.tags as { value?: string })?.value ?? '[]'
      const ragEnabledRaw = (fields.rag_enabled as { value?: string })?.value ?? 'false'
      const viewingRangeIds = JSON.parse(viewingRaw) as string[]
      const tags = JSON.parse(tagsRaw) as string[]
      const ragEnabled = ragEnabledRaw === 'true' || ragEnabledRaw === '1'
      const buffer = await data.toBuffer()

      const created = await ragAdmin.registerStandaloneFile(
        pool,
        storage,
        storageConfig,
        request.user,
        {
          title,
          viewing_range_ids: viewingRangeIds,
          tags,
          fileName: data.filename,
          contentType: data.mimetype,
          buffer,
          rag_enabled: ragEnabled
        }
      )
      return reply.code(201).send(created)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.patch('/api/rag/standalone-files/:fileId/viewing-ranges', async (request, reply) => {
    try {
      const { fileId } = request.params as { fileId: string }
      const body = request.body as { viewing_range_ids?: string[] }
      return await ragAdmin.updateStandaloneViewingRanges(
        pool,
        settings,
        request.user,
        fileId,
        body.viewing_range_ids ?? []
      )
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.delete('/api/rag/standalone-files/:fileId', async (request, reply) => {
    try {
      const { fileId } = request.params as { fileId: string }
      return await ragAdmin.deleteStandaloneFile(
        pool,
        settings,
        storage,
        storageConfig,
        request.user,
        fileId
      )
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/rag/bulk-reindex', async (request, reply) => {
    try {
      return await ragAdmin.bulkReindexRag(pool, request.user)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/rag/search', async (request, reply) => {
    try {
      const body = request.body as { query?: string; top_k?: number; channel?: string }
      if (!body.query?.trim()) {
        return reply.code(400).send({
          error: { code: 'validation_error', message: 'query is required.' }
        })
      }
      const result = await permissionedSearch(
        pool,
        settings,
        request.user,
        body.query.trim(),
        body.top_k ?? 8,
        body.channel ?? 'webui_chat'
      )
      return {
        contexts: result.contexts,
        effective_policies: result.effective_policies
      }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
