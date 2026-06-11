import type pg from 'pg'
import type { Settings } from '../settings.js'
import type { AuthUser } from '../types/auth.js'
import { canAccessCase, isAdmin } from './permissions.js'
import {
  computeEffectivePolicies,
  isSearchDenied,
  type ConditionRow,
  type EffectivePolicies
} from './conditions.js'
import { embedText } from './ollama-client.js'
import { buildViewingRangeFilter, searchPoints } from './qdrant.js'
import { getDefaultEmbeddingModel } from './model-roles.js'
import { getActiveCollection } from './embedding-config.js'

export type SearchContext = {
  chunk_id: string
  case_id: string | null
  display_id: string | null
  title: string
  text: string
  source_type: string
  citation: string
  policies: EffectivePolicies
}

export type PermissionedSearchResult = {
  contexts: SearchContext[]
  effective_policies: EffectivePolicies
  excluded_counts: Record<string, number>
}

export type PermissionedSearchDeps = {
  getEmbeddingModel?: (pool: pg.Pool) => Promise<string | null>
  getActiveCollection?: (pool: pg.Pool, settings: Settings) => Promise<{ collectionName: string }>
  embed?: (baseUrl: string, model: string, text: string) => Promise<number[]>
  search?: (
    baseUrl: string,
    collection: string,
    vector: number[],
    limit: number,
    filter?: Record<string, unknown>
  ) => Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>>
}

async function loadCaseConditions (
  pool: pg.Pool,
  caseId: string
): Promise<ConditionRow[]> {
  const { rows } = await pool.query<ConditionRow>(
    `SELECT co.name, co.search_policy, co.quote_policy, co.export_policy, co.priority
     FROM conditions co
     JOIN case_conditions cc ON cc.condition_id = co.id
     WHERE cc.case_id = $1 AND co.is_active = TRUE
     ORDER BY co.priority DESC`,
    [caseId]
  )
  return rows
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

async function authorizeChunk (
  pool: pg.Pool,
  user: AuthUser,
  payload: Record<string, unknown>,
  channel: string
): Promise<{ context: SearchContext | null; excluded_reason?: string }> {
  const ragEnabled = payload.rag_enabled === true
  if (!ragEnabled) return { context: null, excluded_reason: 'rag_disabled' }

  const chunkId = String(payload.chunk_id ?? '')
  const caseId = payload.case_id ? String(payload.case_id) : null
  const standaloneId = payload.standalone_file_id ? String(payload.standalone_file_id) : null
  const displayId = payload.display_id ? String(payload.display_id) : null
  const title = String(payload.title ?? '')
  const text = String(payload.chunk_text ?? '')
  const sourceType = String(payload.source_type ?? 'unknown')

  if (caseId) {
    // payload は事前フィルタのヒントに過ぎない。削除済み・RAG無効は必ず DB で最終確認する（fail-closed）。
    const attachmentId = payload.attachment_id ? String(payload.attachment_id) : null
    if (attachmentId) {
      const { rows } = await pool.query<{ rag_enabled: boolean }>(
        `SELECT a.rag_enabled
         FROM attachments a
         JOIN cases c ON c.id = a.case_id
         WHERE a.id = $1 AND c.deleted_at IS NULL`,
        [attachmentId]
      )
      if (!rows[0]) return { context: null, excluded_reason: 'source_deleted' }
      if (rows[0].rag_enabled !== true) return { context: null, excluded_reason: 'rag_disabled' }
    } else {
      const { rows } = await pool.query(
        `SELECT 1 FROM cases WHERE id = $1 AND deleted_at IS NULL`,
        [caseId]
      )
      if (!rows[0]) return { context: null, excluded_reason: 'source_deleted' }
    }
    const viewingRangeIds = await loadCaseViewingRanges(pool, caseId)
    if (!canAccessCase(user, viewingRangeIds)) {
      return { context: null, excluded_reason: 'viewing_range' }
    }
    const conditions = await loadCaseConditions(pool, caseId)
    if (isSearchDenied(conditions, channel)) {
      return { context: null, excluded_reason: 'search_policy' }
    }
    const policies = computeEffectivePolicies(conditions)
    return { context: {
      chunk_id: chunkId,
      case_id: caseId,
      display_id: displayId,
      title,
      text,
      source_type: sourceType,
      citation: displayId ? `${displayId} / ${title}` : title,
      policies
    } }
  }

  if (standaloneId) {
    const { rows: fileRows } = await pool.query<{ rag_enabled: boolean }>(
      `SELECT rag_enabled FROM standalone_files WHERE id = $1 AND deleted_at IS NULL`,
      [standaloneId]
    )
    if (!fileRows[0]) return { context: null, excluded_reason: 'source_deleted' }
    if (fileRows[0].rag_enabled !== true) return { context: null, excluded_reason: 'rag_disabled' }
    const { rows } = await pool.query<{ viewing_range_id: string }>(
      `SELECT viewing_range_id FROM standalone_file_viewing_ranges WHERE standalone_file_id = $1`,
      [standaloneId]
    )
    const viewingRangeIds = rows.map((r) => r.viewing_range_id)
    if (!canAccessCase(user, viewingRangeIds)) {
      return { context: null, excluded_reason: 'viewing_range' }
    }
    return { context: {
      chunk_id: chunkId,
      case_id: null,
      display_id: null,
      title,
      text,
      source_type: sourceType,
      citation: title,
      policies: computeEffectivePolicies([])
    } }
  }

  return { context: null, excluded_reason: 'unknown_source' }
}

export async function permissionedSearch (
  pool: pg.Pool,
  settings: Settings,
  user: AuthUser,
  query: string,
  topK = 8,
  channel = 'webui_chat',
  deps: PermissionedSearchDeps = {}
): Promise<PermissionedSearchResult> {
  const embeddingModel = await (deps.getEmbeddingModel ?? getDefaultEmbeddingModel)(pool)
  if (!embeddingModel) {
    return {
      contexts: [],
      effective_policies: computeEffectivePolicies([]),
      excluded_counts: { embedding_model_missing: 1 }
    }
  }

  const vector = await (deps.embed ?? embedText)(settings.ollamaBaseUrl, embeddingModel, query)
  const filter = buildViewingRangeFilter(user.viewingRangeIds, isAdmin(user))
  const activeCollection = await (deps.getActiveCollection ?? getActiveCollection)(pool, settings)

  let hits
  try {
    hits = await (deps.search ?? searchPoints)(
      settings.vectorDbUrl,
      activeCollection.collectionName,
      vector,
      topK * 3,
      filter
    )
  } catch {
    return {
      contexts: [],
      effective_policies: computeEffectivePolicies([]),
      excluded_counts: { vector_search_error: 1 }
    }
  }

  const contexts: SearchContext[] = []
  const policyAccumulator: ConditionRow[] = []
  const excludedCounts: Record<string, number> = {}

  for (const hit of hits) {
    const authorized = await authorizeChunk(pool, user, {
      ...hit.payload,
      chunk_id: hit.id,
      chunk_text: hit.payload.chunk_text
    }, channel)
    const ctx = authorized.context
    if (!ctx) {
      const reason = authorized.excluded_reason ?? 'unknown'
      excludedCounts[reason] = (excludedCounts[reason] ?? 0) + 1
      continue
    }
    contexts.push(ctx)
    for (const name of ctx.policies.condition_names) {
      policyAccumulator.push({
        name,
        search_policy: 'allow',
        quote_policy: ctx.policies.quote_policy,
        export_policy: ctx.policies.export_policy,
        priority: 0
      })
    }
    if (contexts.length >= topK) break
  }

  return {
    contexts,
    effective_policies: computeEffectivePolicies(policyAccumulator),
    excluded_counts: excludedCounts
  }
}
