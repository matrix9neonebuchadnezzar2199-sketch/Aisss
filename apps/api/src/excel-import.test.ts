import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import type pg from 'pg'
import { TEMPLATE_HEADERS } from './lib/excel-columns.js'
import {
  ADMIN_ONLY_VIEWING_RANGE_ID,
  ALL_USERS_VIEWING_RANGE_ID
} from './lib/viewing-ranges.js'
import { buildTemplateWorkbook, parseWorkbook, previewExcelImport } from './services/excel-import.js'
import type { AuthUser } from './types/auth.js'

const user: AuthUser = {
  id: 'user-1',
  externalId: null,
  displayName: 'User',
  departmentId: null,
  role: 'operator',
  groupIds: [],
  viewingRangeIds: []
}

function buildWorkbook (fields: Record<string, string>): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_HEADERS],
    TEMPLATE_HEADERS.map((header) => fields[header] ?? '')
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Cases')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

function createPoolMock (): pg.Pool {
  return {
    async query (sql: string) {
      if (sql.includes('FROM viewing_ranges')) {
        return {
          rows: [
            { id: ALL_USERS_VIEWING_RANGE_ID, name: '全員' },
            { id: ADMIN_ONLY_VIEWING_RANGE_ID, name: '管理者のみ' }
          ]
        }
      }
      return { rows: [] }
    }
  } as unknown as pg.Pool
}

test('buildTemplateWorkbook and parseWorkbook round-trip sample row', () => {
  const buffer = buildTemplateWorkbook()
  const rows = parseWorkbook(buffer)
  assert.ok(rows.length >= 1)
  assert.equal(rows[0].title, 'サンプル表題')
  assert.equal(rows[0].material_type, '報告書')
})

test('previewExcelImport rejects rows without viewing_ranges', async () => {
  const result = await previewExcelImport(
    createPoolMock(),
    user,
    'cases.xlsx',
    buildWorkbook({ title: 'No viewing range' })
  )

  assert.equal(result.summary.valid_rows, 0)
  assert.equal(result.summary.error_rows, 1)
  assert.equal(result.rows[0]?.errors[0]?.code, 'missing_viewing_range')
})

test('previewExcelImport resolves all and admin-only viewing ranges', async () => {
  const result = await previewExcelImport(
    createPoolMock(),
    user,
    'cases.xlsx',
    buildWorkbook({ title: 'Explicit range', viewing_ranges: '全員;管理者のみ' })
  )

  assert.equal(result.summary.valid_rows, 1)
  assert.deepEqual(result.rows[0]?.parsed?.viewing_range_ids, [
    ALL_USERS_VIEWING_RANGE_ID,
    ADMIN_ONLY_VIEWING_RANGE_ID
  ])
})
