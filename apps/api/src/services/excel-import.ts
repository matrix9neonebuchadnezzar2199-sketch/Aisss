import { randomUUID } from 'node:crypto'
import * as XLSX from 'xlsx'
import type pg from 'pg'
import { AppError } from '../lib/errors.js'
import {
  EXCEL_TEMPLATE_VERSION,
  TEMPLATE_HEADERS,
  type ExcelRow,
  type RowIssue,
  type ValidatedExcelRow
} from '../lib/excel-columns.js'
import type { AuthUser } from '../types/auth.js'
import { createCase, updateCase, type CaseInput } from './cases.js'
import { MasterResolver } from './master-resolver.js'
import { writeAuditLog } from './audit.js'

const STRICT_MASTER_FIELDS = [
  'material_type',
  'registering_department',
  'category',
  'region',
  'source',
  'handling_type',
  'reliability',
  'accuracy',
  'rank'
] as const

function cellString (value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function parseDate (value: unknown): string | null {
  const text = cellString(value)
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const mm = String(parsed.m).padStart(2, '0')
      const dd = String(parsed.d).padStart(2, '0')
      return `${parsed.y}-${mm}-${dd}`
    }
  }
  return null
}

export function parseWorkbook (buffer: Buffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = workbook.Sheets.Cases ?? workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new AppError('validation_error', 'Workbook has no data sheet.', 400)
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' })
  return rows.filter((row) => Object.values(row).some((v) => cellString(v) !== ''))
}

export function buildTemplateWorkbook (): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_HEADERS],
    [
      '',
      '',
      'サンプル表題',
      'DOC-2026-0099',
      '要約テキスト',
      '本文要約',
      '本文記事',
      '所見',
      '',
      '2026-01-01',
      '2026-01-31',
      '報告書',
      '分析第一課',
      '地政学',
      '東アジア',
      '公開情報',
      '通常',
      '高',
      '確認済',
      'A',
      '全員',
      '',
      'CLS-2026-099',
      'keyword-a',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ]
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Cases')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

async function validateRow (
  resolver: MasterResolver,
  rowNumber: number,
  raw: ExcelRow
): Promise<ValidatedExcelRow> {
  const errors: RowIssue[] = []
  const warnings: RowIssue[] = []

  const title = cellString(raw.title)
  if (!title) {
    errors.push({ level: 'error', code: 'required_title', message: 'title is required.' })
  }

  const startDate = parseDate(raw.event_start_date)
  const endDate = parseDate(raw.event_end_date)
  if (cellString(raw.event_start_date) && !startDate) {
    errors.push({ level: 'error', code: 'invalid_date', message: 'event_start_date must be YYYY-MM-DD.' })
  }
  if (cellString(raw.event_end_date) && !endDate) {
    errors.push({ level: 'error', code: 'invalid_date', message: 'event_end_date must be YYYY-MM-DD.' })
  }
  if (startDate && endDate && endDate < startDate) {
    errors.push({ level: 'error', code: 'date_range', message: 'event_end_date must be >= event_start_date.' })
  }

  const parsed: Record<string, unknown> = {
    case_uuid: cellString(raw.case_uuid) || null,
    title,
    material_number: cellString(raw.material_number) || null,
    summary: cellString(raw.summary) || null,
    body_summary: cellString(raw.body_summary) || null,
    body_article: cellString(raw.body_article) || null,
    body_assessment: cellString(raw.body_assessment) || null,
    body_reference: cellString(raw.body_reference) || null,
    event_start_date: startDate,
    event_end_date: endDate,
    classification_number: cellString(raw.classification_number) || null,
    action_taken: cellString(raw.action_taken) || null,
    condition_notes: cellString(raw.condition_notes) || null,
    viewing_range_note: cellString(raw.viewing_range_note) || null,
    note_1: cellString(raw.note1) || null,
    note_2: cellString(raw.note2) || null,
    note_3: cellString(raw.note3) || null,
    note_4: cellString(raw.note4) || null,
    note_5: cellString(raw.note5) || null,
    note_6: cellString(raw.note6) || null,
    keywords: [
      raw.keyword1, raw.keyword2, raw.keyword3, raw.keyword4, raw.keyword5, raw.keyword6
    ].map((k) => cellString(k)).filter(Boolean)
  }

  for (const field of STRICT_MASTER_FIELDS) {
    const label = cellString(raw[field])
    if (!label) continue
    const id = await resolver.resolve(field, label)
    if (!id) {
      errors.push({
        level: 'error',
        code: 'unknown_master',
        message: `Unknown ${field}: ${label}`
      })
    } else {
      parsed[`${field}_id`] = id
    }
  }

  const viewingLabel = cellString(raw.viewing_ranges)
  if (viewingLabel) {
    const { ids, unknown } = await resolver.resolveMany('viewing_range', viewingLabel)
    if (unknown.length > 0) {
      errors.push({
        level: 'error',
        code: 'unknown_viewing_range',
        message: `Unknown viewing range: ${unknown.join(', ')}`
      })
    }
    parsed.viewing_range_ids = ids
  } else {
    errors.push({
      level: 'error',
      code: 'missing_viewing_range',
      message: 'viewing_ranges is required.'
    })
    parsed.viewing_range_ids = []
  }

  const conditionsLabel = cellString(raw.conditions)
  if (conditionsLabel) {
    const { ids, unknown } = await resolver.resolveMany('condition', conditionsLabel)
    if (unknown.length > 0) {
      errors.push({
        level: 'error',
        code: 'unknown_condition',
        message: `Unknown condition: ${unknown.join(', ')}`
      })
    }
    parsed.condition_ids = ids
  } else {
    parsed.condition_ids = []
  }

  if (!cellString(raw.body_summary) && !cellString(raw.body_article) && !cellString(raw.summary)) {
    warnings.push({ level: 'warning', code: 'empty_body', message: 'No summary or body content.' })
  }

  const valid = errors.length === 0 && !!title

  return {
    row_number: rowNumber,
    raw,
    parsed: valid ? parsed : null,
    errors,
    warnings,
    valid
  }
}

export async function previewExcelImport (
  pool: pg.Pool,
  user: AuthUser,
  fileName: string,
  buffer: Buffer,
  expiryHours = 24
) {
  const rows = parseWorkbook(buffer)
  if (rows.length === 0) {
    throw new AppError('validation_error', 'No data rows found.', 400)
  }
  if (rows.length > 500) {
    throw new AppError('validation_error', 'Maximum 500 rows per import.', 400)
  }

  const resolver = new MasterResolver(pool)
  const validated: ValidatedExcelRow[] = []
  for (let i = 0; i < rows.length; i++) {
    validated.push(await validateRow(resolver, i + 2, rows[i]))
  }

  const summary = {
    template_version: EXCEL_TEMPLATE_VERSION,
    total_rows: validated.length,
    valid_rows: validated.filter((r) => r.valid).length,
    error_rows: validated.filter((r) => r.errors.length > 0).length,
    warning_rows: validated.filter((r) => r.warnings.length > 0).length
  }

  const previewId = randomUUID()
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

  await pool.query(
    `INSERT INTO excel_import_previews (id, user_id, file_name, rows_json, summary_json, expires_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
    [previewId, user.id, fileName, JSON.stringify(validated), JSON.stringify(summary), expiresAt.toISOString()]
  )

  await writeAuditLog(pool, {
    userId: user.id,
    action: 'excel.import.preview',
    resourceType: 'excel_import_preview',
    resourceId: previewId,
    details: summary
  })

  return { preview_id: previewId, expires_at: expiresAt.toISOString(), summary, rows: validated }
}

function toCaseInput (parsed: Record<string, unknown>): CaseInput {
  return {
    title: parsed.title as string,
    material_number: parsed.material_number as string | null,
    summary: parsed.summary as string | null,
    body_summary: parsed.body_summary as string | null,
    body_article: parsed.body_article as string | null,
    body_assessment: parsed.body_assessment as string | null,
    body_reference: parsed.body_reference as string | null,
    event_start_date: parsed.event_start_date as string | null,
    event_end_date: parsed.event_end_date as string | null,
    material_type_id: parsed.material_type_id as string | null,
    registering_department_id: parsed.registering_department_id as string | null,
    category_id: parsed.category_id as string | null,
    region_id: parsed.region_id as string | null,
    source_id: parsed.source_id as string | null,
    handling_type_id: parsed.handling_type_id as string | null,
    reliability_id: parsed.reliability_id as string | null,
    accuracy_id: parsed.accuracy_id as string | null,
    rank_id: parsed.rank_id as string | null,
    classification_number: parsed.classification_number as string | null,
    action_taken: parsed.action_taken as string | null,
    condition_notes: parsed.condition_notes as string | null,
    viewing_range_note: parsed.viewing_range_note as string | null,
    note_1: parsed.note_1 as string | null,
    note_2: parsed.note_2 as string | null,
    note_3: parsed.note_3 as string | null,
    note_4: parsed.note_4 as string | null,
    note_5: parsed.note_5 as string | null,
    note_6: parsed.note_6 as string | null,
    viewing_range_ids: (parsed.viewing_range_ids as string[]) ?? [],
    condition_ids: (parsed.condition_ids as string[]) ?? []
  }
}

async function linkKeywords (
  pool: pg.Pool,
  caseId: string,
  keywords: string[],
  resolver: MasterResolver
) {
  for (const kw of keywords) {
    const keywordId = await resolver.findOrCreateKeyword(kw)
    await pool.query(
      `INSERT INTO case_keywords (case_id, keyword_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [caseId, keywordId]
    )
  }
}

export async function confirmExcelImport (
  pool: pg.Pool,
  user: AuthUser,
  previewId: string
) {
  const { rows } = await pool.query(
    `SELECT * FROM excel_import_previews WHERE id = $1`,
    [previewId]
  )
  const preview = rows[0]
  if (!preview) throw new AppError('not_found', 'Preview not found.', 404)
  if (preview.user_id !== user.id && user.role !== 'admin') {
    throw new AppError('permission_denied', 'Preview belongs to another user.', 403)
  }
  if (new Date(preview.expires_at as string) < new Date()) {
    throw new AppError('validation_error', 'Preview has expired.', 400)
  }

  const validated = preview.rows_json as ValidatedExcelRow[]
  const resolver = new MasterResolver(pool)
  const rowResults: Array<Record<string, unknown>> = []
  let created = 0
  let updated = 0
  let skipped = 0

  for (const row of validated) {
    if (!row.valid || !row.parsed) {
      skipped++
      rowResults.push({
        row_number: row.row_number,
        status: 'skipped',
        errors: row.errors
      })
      continue
    }

    try {
      const input = toCaseInput(row.parsed)
      const caseUuid = row.parsed.case_uuid as string | null
      let caseId: string
      let displayId: string

      if (caseUuid) {
        const result = await updateCase(pool, user, caseUuid, input)
        caseId = result.id as string
        displayId = result.display_id as string
        updated++
        rowResults.push({ row_number: row.row_number, status: 'updated', case_id: caseId, display_id: displayId })
      } else {
        const result = await createCase(pool, user, input)
        caseId = result.id as string
        displayId = result.display_id as string
        created++
        rowResults.push({ row_number: row.row_number, status: 'created', case_id: caseId, display_id: displayId })
      }

      const keywords = (row.parsed.keywords as string[]) ?? []
      if (keywords.length > 0) {
        await linkKeywords(pool, caseId, keywords, resolver)
      }
    } catch (error) {
      skipped++
      rowResults.push({
        row_number: row.row_number,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Import failed'
      })
    }
  }

  const importId = randomUUID()
  await pool.query(
    `INSERT INTO excel_import_runs (
      id, preview_id, user_id, status, created_count, updated_count, skipped_count, row_results_json
    ) VALUES ($1,$2,$3,'completed',$4,$5,$6,$7::jsonb)`,
    [importId, previewId, user.id, created, updated, skipped, JSON.stringify(rowResults)]
  )

  await writeAuditLog(pool, {
    userId: user.id,
    action: 'excel.import.confirm',
    resourceType: 'excel_import_run',
    resourceId: importId,
    details: { preview_id: previewId, created, updated, skipped }
  })

  return {
    import_id: importId,
    preview_id: previewId,
    created_count: created,
    updated_count: updated,
    skipped_count: skipped,
    row_results: rowResults
  }
}

export async function getImportRun (pool: pg.Pool, user: AuthUser, importId: string) {
  const { rows } = await pool.query(
    `SELECT r.*, p.file_name
     FROM excel_import_runs r
     JOIN excel_import_previews p ON p.id = r.preview_id
     WHERE r.id = $1`,
    [importId]
  )
  const run = rows[0]
  if (!run) throw new AppError('not_found', 'Import not found.', 404)
  if (run.user_id !== user.id && user.role !== 'admin') {
    throw new AppError('permission_denied', 'Import belongs to another user.', 403)
  }
  return run
}
