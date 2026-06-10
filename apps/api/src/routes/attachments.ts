import type { FastifyPluginAsync } from 'fastify'
import type { S3Client } from '@aws-sdk/client-s3'
import type pg from 'pg'
import { sendError } from '../lib/errors.js'
import { getObjectStream } from '../services/storage.js'
import * as attachmentService from '../services/attachments.js'
import type { ObjectStorageSettings } from '../settings.js'

export const attachmentRoutes: FastifyPluginAsync<{
  pool: pg.Pool
  storage: S3Client
  storageConfig: ObjectStorageSettings
}> = async (app, { pool, storage, storageConfig }) => {
  app.post('/api/cases/:caseId/attachments', async (request, reply) => {
    try {
      const { caseId } = request.params as { caseId: string }
      const file = await request.file()
      if (!file) {
        return reply.code(400).send({
          error: { code: 'validation_error', message: 'file is required.' }
        })
      }
      const fields = file.fields as Record<string, { value?: string } | Array<{ value?: string }>>
      const autoEnableRaw = (fields.auto_enable_rag_on_extraction as { value?: string })?.value
      const buffer = await file.toBuffer()
      const created = await attachmentService.uploadAttachment(
        pool,
        storage,
        storageConfig,
        request.user,
        caseId,
        file.filename,
        file.mimetype,
        buffer,
        autoEnableRaw === 'true'
      )
      return reply.code(201).send(created)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/cases/:caseId/attachments', async (request, reply) => {
    try {
      const { caseId } = request.params as { caseId: string }
      const items = await attachmentService.listAttachments(pool, request.user, caseId)
      return { items }
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/attachments/:attachmentId/download', async (request, reply) => {
    try {
      const { attachmentId } = request.params as { attachmentId: string }
      const attachment = await attachmentService.getAttachmentForUser(
        pool,
        request.user,
        attachmentId
      )
      const object = await getObjectStream(
        storage,
        storageConfig.bucket,
        attachment.storage_key as string
      )
      reply.header('Content-Type', attachment.content_type as string)
      reply.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(attachment.file_name as string)}"`
      )
      return reply.send(object.Body)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/attachments/:attachmentId/extracted-text', async (request, reply) => {
    try {
      const { attachmentId } = request.params as { attachmentId: string }
      return await attachmentService.getExtractedText(pool, request.user, attachmentId)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/attachments/:attachmentId/retry-extraction', async (request, reply) => {
    try {
      const { attachmentId } = request.params as { attachmentId: string }
      return await attachmentService.retryExtraction(pool, request.user, attachmentId)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.patch('/api/attachments/:attachmentId/auto-enable-rag', async (request, reply) => {
    try {
      const { attachmentId } = request.params as { attachmentId: string }
      const body = request.body as { enabled?: boolean }
      return await attachmentService.updateAutoEnableRagOnExtraction(
        pool,
        request.user,
        attachmentId,
        body.enabled === true
      )
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
