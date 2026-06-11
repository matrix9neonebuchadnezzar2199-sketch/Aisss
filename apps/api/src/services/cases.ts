import type pg from 'pg'
import { AppError } from '../lib/errors.js'
import type { AuthUser } from '../types/auth.js'
import { canAccessCase, isAdmin } from './permissions.js'
import { nextDisplayId } from './display-id.js'
import { writeAuditLog } from './audit.js'
import { enqueueCaseBodyEmbedding, enqueueCaseMetadataSync, purgeCaseVectors } from './rag-admin.js'
import type { Settings } from '../settings.js'
import { ALL_USERS_VIEWING_RANGE_ID } from '../lib/viewing-ranges.js'
import { loadCaseCollectors, syncCaseCollectors } from './case-collectors.js'
import { loadCaseKeywords, syncCaseKeywords } from './case-keywords.js'

export type CaseInput = {
  material_number?: string | null
  title: string
  summary?: string | null
  body_summary?: string | null
  body_article?: string | null
  body_assessment?: string | null
  body_reference?: string | null
  event_start_date?: string | null
  event_end_date?: string | null
  material_type_id?: string | null
  registering_department_id?: string | null
  category_id?: string | null
  region_id?: string | null
  source_id?: string | null
  registrant_id?: string | null
  information_request_id?: string | null
  handling_type_id?: string | null
  reliability_id?: string | null
  accuracy_id?: string | null
  rank_id?: string | null
  retention_policy_id?: string | null
  classification_number?: string | null
  action_taken?: string | null
  condition_notes?: string | null
  viewing_range_note?: string | null
  note_1?: string | null
  note_2?: string | null
  note_3?: string | null
  note_4?: string | null
  note_5?: string | null
  note_6?: string | null
  viewing_range_ids?: string[]
  condition_ids?: string[]
  keyword_names?: string[]
  collector_person_ids?: string[]
  acquisition_location_id?: string | null
}

export type CaseSearchQuery = {
  q?: string
  title?: string
  material_number?: string
  material_type_id?: string
  registering_department_id?: string
  rank_id?: string
  viewing_range_id?: string
  category_id?: string
  region_id?: string
  source_id?: string
  information_request_id?: string
  handling_type_id?: string
  reliability_id?: string
  accuracy_id?: string
  condition_id?: string
  event_date_from?: string
  event_date_to?: string
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
}

const SORT_COLUMNS: Record<string, string> = {
  display_id: 'c.display_id',
  title: 'c.title',
  event_start_date: 'c.event_start_date',
  updated_at: 'c.updated_at',
  created_at: 'c.created_at'
}

async function loadCaseViewingRanges (
  pool: pg.Pool,
  caseId: string
): Promise<string[]> {
  const { rows } = await pool.query<{ viewing_range_id: string }>(
    `SELECT viewing_range_id FROM case_viewing_ranges WHERE case_id = $1`,
    [caseId]
  )
  return rows.map((r) => r.viewing_range_id)
}

function permissionSql (user: AuthUser, paramIndex: number): string {
  if (isAdmin(user)) return 'TRUE'
  return `EXISTS (
    SELECT 1 FROM case_viewing_ranges cvr
    WHERE cvr.case_id = c.id
      AND (
        cvr.viewing_range_id = '${ALL_USERS_VIEWING_RANGE_ID}'::uuid
        OR EXISTS (
          SELECT 1
          FROM group_viewing_ranges gvr
          JOIN user_groups ug ON ug.group_id = gvr.group_id
          WHERE gvr.viewing_range_id = cvr.viewing_range_id
            AND ug.user_id = $${paramIndex}
        )
      )
  )`
}

export async function searchCases (
  pool: pg.Pool,
  user: AuthUser,
  query: CaseSearchQuery
) {
  const page = Math.max(1, query.page ?? 1)
  const limit = Math.min(100, Math.max(1, query.limit ?? 20))
  const offset = (page - 1) * limit
  const sortCol = SORT_COLUMNS[query.sort ?? 'updated_at'] ?? 'c.updated_at'
  const sortOrder = query.order === 'asc' ? 'ASC' : 'DESC'

  const params: unknown[] = []
  const where: string[] = ['c.deleted_at IS NULL']

  if (!isAdmin(user)) {
    params.push(user.id)
    where.push(permissionSql(user, params.length))
  }

  if (query.q) {
    // LIKE ワイルドカード（% _ \）をエスケープしてリテラル検索にする
    const escaped = query.q.replace(/[\\%_]/g, (m) => `\\${m}`)
    params.push(`%${escaped}%`)
    const idx = params.length
    where.push(`(
      c.title ILIKE $${idx}
      OR c.summary ILIKE $${idx}
      OR c.body_summary ILIKE $${idx}
      OR c.body_article ILIKE $${idx}
      OR c.display_id ILIKE $${idx}
      OR c.material_number ILIKE $${idx}
    )`)
  }
  if (query.material_type_id) {
    params.push(query.material_type_id)
    where.push(`c.material_type_id = $${params.length}`)
  }
  if (query.registering_department_id) {
    params.push(query.registering_department_id)
    where.push(`c.registering_department_id = $${params.length}`)
  }
  if (query.rank_id) {
    params.push(query.rank_id)
    where.push(`c.rank_id = $${params.length}`)
  }
  if (query.viewing_range_id) {
    params.push(query.viewing_range_id)
    where.push(`EXISTS (
      SELECT 1 FROM case_viewing_ranges cvr
      WHERE cvr.case_id = c.id AND cvr.viewing_range_id = $${params.length}
    )`)
  }
  if (query.title) {
    params.push(`%${query.title.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
    where.push(`c.title ILIKE $${params.length}`)
  }
  if (query.material_number) {
    params.push(`%${query.material_number.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
    where.push(`c.material_number ILIKE $${params.length}`)
  }
  if (query.category_id) {
    params.push(query.category_id)
    where.push(`c.category_id = $${params.length}`)
  }
  if (query.region_id) {
    params.push(query.region_id)
    where.push(`c.region_id = $${params.length}`)
  }
  if (query.source_id) {
    params.push(query.source_id)
    where.push(`c.source_id = $${params.length}`)
  }
  if (query.information_request_id) {
    params.push(query.information_request_id)
    where.push(`c.information_request_id = $${params.length}`)
  }
  if (query.handling_type_id) {
    params.push(query.handling_type_id)
    where.push(`c.handling_type_id = $${params.length}`)
  }
  if (query.reliability_id) {
    params.push(query.reliability_id)
    where.push(`c.reliability_id = $${params.length}`)
  }
  if (query.accuracy_id) {
    params.push(query.accuracy_id)
    where.push(`c.accuracy_id = $${params.length}`)
  }
  if (query.condition_id) {
    params.push(query.condition_id)
    where.push(`EXISTS (
      SELECT 1 FROM case_conditions cc
      WHERE cc.case_id = c.id AND cc.condition_id = $${params.length}
    )`)
  }
  if (query.event_date_from) {
    params.push(query.event_date_from)
    where.push(`c.event_start_date >= $${params.length}::date`)
  }
  if (query.event_date_to) {
    params.push(query.event_date_to)
    where.push(`c.event_end_date <= $${params.length}::date`)
  }

  const whereSql = where.join(' AND ')
  params.push(limit, offset)

  const listSql = `
    SELECT
      c.id, c.display_id, c.material_number, c.title, c.summary,
      c.event_start_date, c.event_end_date, c.updated_at, c.created_at,
      mt.name AS material_type_name,
      d.name AS department_name,
      r.name AS rank_name
    FROM cases c
    LEFT JOIN material_types mt ON mt.id = c.material_type_id
    LEFT JOIN departments d ON d.id = c.registering_department_id
    LEFT JOIN rank_levels r ON r.id = c.rank_id
    WHERE ${whereSql}
    ORDER BY ${sortCol} ${sortOrder}
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `

  const countSql = `SELECT COUNT(*)::int AS total FROM cases c WHERE ${whereSql}`

  const [listResult, countResult] = await Promise.all([
    pool.query(listSql, params),
    pool.query<{ total: number }>(countSql, params.slice(0, -2))
  ])

  return {
    items: listResult.rows,
    page,
    limit,
    total: countResult.rows[0]?.total ?? 0
  }
}

export async function getCaseById (
  pool: pg.Pool,
  user: AuthUser,
  caseId: string
) {
  const { rows } = await pool.query(
    `SELECT c.*,
      mt.name AS material_type_name,
      d.name AS department_name,
      cat.name AS category_name,
      reg.name AS region_name,
      src.name AS source_name,
      ht.name AS handling_type_name,
      rel.name AS reliability_name,
      acc.name AS accuracy_name,
      rk.name AS rank_name
     FROM cases c
     LEFT JOIN material_types mt ON mt.id = c.material_type_id
     LEFT JOIN departments d ON d.id = c.registering_department_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     LEFT JOIN regions reg ON reg.id = c.region_id
     LEFT JOIN sources src ON src.id = c.source_id
     LEFT JOIN handling_types ht ON ht.id = c.handling_type_id
     LEFT JOIN reliability_levels rel ON rel.id = c.reliability_id
     LEFT JOIN accuracy_levels acc ON acc.id = c.accuracy_id
     LEFT JOIN rank_levels rk ON rk.id = c.rank_id
     WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [caseId]
  )
  const row = rows[0]
  if (!row) {
    throw new AppError('not_found', 'Case not found.', 404)
  }

  const viewingRangeIds = await loadCaseViewingRanges(pool, caseId)
  if (!canAccessCase(user, viewingRangeIds)) {
    throw new AppError('permission_denied', 'You do not have permission to access this resource.', 403)
  }

  const [viewingRanges, conditions, attachments, keywords, collectors] = await Promise.all([
    pool.query(
      `SELECT vr.id, vr.name FROM viewing_ranges vr
       JOIN case_viewing_ranges cvr ON cvr.viewing_range_id = vr.id
       WHERE cvr.case_id = $1`,
      [caseId]
    ),
    pool.query(
      `SELECT co.id, co.name FROM conditions co
       JOIN case_conditions cc ON cc.condition_id = co.id
       WHERE cc.case_id = $1`,
      [caseId]
    ),
    pool.query(
      `SELECT id, file_name, extraction_status, extraction_error, uploaded_at
       FROM attachments WHERE case_id = $1 ORDER BY uploaded_at DESC`,
      [caseId]
    ),
    loadCaseKeywords(pool, caseId),
    loadCaseCollectors(pool, caseId)
  ])

  return {
    ...row,
    viewing_ranges: viewingRanges.rows,
    conditions: conditions.rows,
    attachments: attachments.rows,
    keywords,
    collectors
  }
}

export async function getCaseByDisplayId (
  pool: pg.Pool,
  user: AuthUser,
  displayId: string
) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM cases WHERE display_id = $1 AND deleted_at IS NULL`,
    [displayId]
  )
  if (!rows[0]) {
    throw new AppError('not_found', 'Case not found.', 404)
  }
  return getCaseById(pool, user, rows[0].id)
}

async function syncJoinIds (
  client: pg.PoolClient,
  caseId: string,
  table: 'case_viewing_ranges' | 'case_conditions',
  column: 'viewing_range_id' | 'condition_id',
  ids: string[] | undefined
) {
  if (ids === undefined) return
  await client.query(`DELETE FROM ${table} WHERE case_id = $1`, [caseId])
  for (const id of ids) {
    await client.query(
      `INSERT INTO ${table} (case_id, ${column}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [caseId, id]
    )
  }
}

function requireViewingRanges (
  ids: string[] | undefined,
  context: 'create' | 'update'
) {
  if (ids === undefined) {
    if (context === 'create') {
      throw new AppError('validation_error', 'viewing_range_ids must contain at least one item.', 400)
    }
    return
  }
  if (ids.length === 0) {
    throw new AppError('validation_error', 'viewing_range_ids must contain at least one item.', 400)
  }
}

export async function createCase (
  pool: pg.Pool,
  user: AuthUser,
  input: CaseInput
) {
  if (!input.title?.trim()) {
    throw new AppError('validation_error', 'title is required.', 400)
  }
  requireViewingRanges(input.viewing_range_ids, 'create')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const displayId = await nextDisplayId(pool)
    const { rows } = await client.query(
      `INSERT INTO cases (
        display_id, material_number, title, summary,
        body_summary, body_article, body_assessment, body_reference,
        event_start_date, event_end_date,
        material_type_id, registering_department_id, category_id, region_id, source_id,
        registrant_id, information_request_id, handling_type_id,
        reliability_id, accuracy_id, rank_id, retention_policy_id,
        classification_number, action_taken, condition_notes, viewing_range_note,
        note_1, note_2, note_3, note_4, note_5, note_6,
        acquisition_location_id,
        created_by, updated_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
      ) RETURNING id, display_id`,
      [
        displayId,
        input.material_number ?? null,
        input.title.trim(),
        input.summary ?? null,
        input.body_summary ?? null,
        input.body_article ?? null,
        input.body_assessment ?? null,
        input.body_reference ?? null,
        input.event_start_date ?? null,
        input.event_end_date ?? null,
        input.material_type_id ?? null,
        input.registering_department_id ?? null,
        input.category_id ?? null,
        input.region_id ?? null,
        input.source_id ?? null,
        input.registrant_id ?? null,
        input.information_request_id ?? null,
        input.handling_type_id ?? null,
        input.reliability_id ?? null,
        input.accuracy_id ?? null,
        input.rank_id ?? null,
        input.retention_policy_id ?? null,
        input.classification_number ?? null,
        input.action_taken ?? null,
        input.condition_notes ?? null,
        input.viewing_range_note ?? null,
        input.note_1 ?? null,
        input.note_2 ?? null,
        input.note_3 ?? null,
        input.note_4 ?? null,
        input.note_5 ?? null,
        input.note_6 ?? null,
        input.acquisition_location_id ?? null,
        user.id,
        user.id
      ]
    )
    const caseId = rows[0].id as string
    await syncJoinIds(client, caseId, 'case_viewing_ranges', 'viewing_range_id', input.viewing_range_ids)
    await syncJoinIds(client, caseId, 'case_conditions', 'condition_id', input.condition_ids)
    await syncCaseKeywords(client, caseId, input.keyword_names)
    await syncCaseCollectors(client, caseId, input.collector_person_ids)
    // 同一トランザクションで監査を書き、本体と監査の原子性を保つ
    await writeAuditLog(client, {
      userId: user.id,
      action: 'case.create',
      resourceType: 'case',
      resourceId: caseId,
      caseDisplayId: displayId
    })
    await client.query('COMMIT')
    const hasBody = Boolean(
      input.body_summary?.trim() ||
      input.body_article?.trim() ||
      input.body_assessment?.trim() ||
      input.body_reference?.trim()
    )
    if (hasBody) {
      await enqueueCaseBodyEmbedding(pool, caseId, displayId)
    }
    return getCaseById(pool, user, caseId)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateCase (
  pool: pg.Pool,
  user: AuthUser,
  caseId: string,
  input: Partial<CaseInput>
) {
  if ('title' in input) {
    if (!input.title?.trim()) {
      throw new AppError('validation_error', 'title is required.', 400)
    }
    input = { ...input, title: input.title.trim() }
  }
  requireViewingRanges(input.viewing_range_ids, 'update')
  const existing = await getCaseById(pool, user, caseId)
  const fields: string[] = []
  const values: unknown[] = []

  const columnMap: Record<string, keyof CaseInput> = {
    material_number: 'material_number',
    title: 'title',
    summary: 'summary',
    body_summary: 'body_summary',
    body_article: 'body_article',
    body_assessment: 'body_assessment',
    body_reference: 'body_reference',
    event_start_date: 'event_start_date',
    event_end_date: 'event_end_date',
    material_type_id: 'material_type_id',
    registering_department_id: 'registering_department_id',
    category_id: 'category_id',
    region_id: 'region_id',
    source_id: 'source_id',
    registrant_id: 'registrant_id',
    information_request_id: 'information_request_id',
    handling_type_id: 'handling_type_id',
    reliability_id: 'reliability_id',
    accuracy_id: 'accuracy_id',
    rank_id: 'rank_id',
    retention_policy_id: 'retention_policy_id',
    classification_number: 'classification_number',
    action_taken: 'action_taken',
    condition_notes: 'condition_notes',
    viewing_range_note: 'viewing_range_note',
    note_1: 'note_1',
    note_2: 'note_2',
    note_3: 'note_3',
    note_4: 'note_4',
    note_5: 'note_5',
    note_6: 'note_6',
    acquisition_location_id: 'acquisition_location_id'
  }

  for (const [col, key] of Object.entries(columnMap)) {
    if (key in input) {
      values.push(input[key])
      fields.push(`${col} = $${values.length}`)
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (fields.length > 0) {
      values.push(user.id, caseId)
      await client.query(
        `UPDATE cases SET ${fields.join(', ')}, updated_by = $${values.length - 1}, updated_at = NOW()
         WHERE id = $${values.length} AND deleted_at IS NULL`,
        values
      )
    }
    await syncJoinIds(client, caseId, 'case_viewing_ranges', 'viewing_range_id', input.viewing_range_ids)
    await syncJoinIds(client, caseId, 'case_conditions', 'condition_id', input.condition_ids)
    await syncCaseKeywords(client, caseId, input.keyword_names)
    await syncCaseCollectors(client, caseId, input.collector_person_ids)
    await writeAuditLog(client, {
      userId: user.id,
      action: 'case.update',
      resourceType: 'case',
      resourceId: caseId,
      caseDisplayId: existing.display_id as string
    })
    await client.query('COMMIT')
    const bodyTouched =
      'body_summary' in input ||
      'body_article' in input ||
      'body_assessment' in input ||
      'body_reference' in input
    if (bodyTouched) {
      await enqueueCaseBodyEmbedding(pool, caseId, existing.display_id as string)
    }
    // 閲覧範囲・条件の変更は Qdrant payload の権限メタデータ再同期が必要
    const permissionsTouched =
      input.viewing_range_ids !== undefined ||
      input.condition_ids !== undefined ||
      input.keyword_names !== undefined ||
      input.collector_person_ids !== undefined ||
      'acquisition_location_id' in input
    if (permissionsTouched && !bodyTouched) {
      await enqueueCaseMetadataSync(pool, caseId, existing.display_id as string)
    }
    return getCaseById(pool, user, caseId)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function deleteCase (
  pool: pg.Pool,
  settings: Settings,
  user: AuthUser,
  caseId: string
) {
  const existing = await getCaseById(pool, user, caseId)
  await pool.query(
    `UPDATE cases SET deleted_at = NOW(), updated_by = $1 WHERE id = $2`,
    [user.id, caseId]
  )
  // 論理削除後にベクタ・チャンクを掃除（残存しても検索側 DB 再認可で露出しない）
  await purgeCaseVectors(pool, settings, caseId)
  await writeAuditLog(pool, {
    userId: user.id,
    action: 'case.delete',
    resourceType: 'case',
    resourceId: caseId,
    caseDisplayId: existing.display_id as string
  })
  return { id: caseId, deleted: true }
}
