import type { FastifyPluginAsync } from 'fastify'
import type pg from 'pg'
import { sendError } from '../lib/errors.js'
import * as excelImport from '../services/excel-import.js'

export const importRoutes: FastifyPluginAsync<{ pool: pg.Pool }> = async (app, { pool }) => {
  app.get('/api/imports/excel/template', async (_request, reply) => {
    const buffer = excelImport.buildTemplateWorkbook()
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="aisss-cases-template.xlsx"')
      .send(buffer)
  })

  app.post('/api/imports/excel/preview', async (request, reply) => {
    try {
      const file = await request.file()
      if (!file) {
        return reply.code(400).send({
          error: { code: 'validation_error', message: 'file is required.' }
        })
      }
      const buffer = await file.toBuffer()
      const result = await excelImport.previewExcelImport(
        pool,
        request.user,
        file.filename,
        buffer
      )
      return reply.code(201).send(result)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.post('/api/imports/excel/:previewId/confirm', async (request, reply) => {
    try {
      const { previewId } = request.params as { previewId: string }
      const result = await excelImport.confirmExcelImport(pool, request.user, previewId)
      return reply.code(201).send(result)
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })

  app.get('/api/imports/:importId', async (request, reply) => {
    try {
      const { importId } = request.params as { importId: string }
      const run = await excelImport.getImportRun(pool, request.user, importId)
      return run
    } catch (error) {
      return sendError(reply, error, request.id)
    }
  })
}
