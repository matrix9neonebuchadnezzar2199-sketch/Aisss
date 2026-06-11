import { test } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import { permissionedSearch } from './services/permissioned-search.js'
import type { Settings } from './settings.js'
import type { AuthUser } from './types/auth.js'
import type { ConditionRow } from './services/conditions.js'

const admin: AuthUser = {
  id: 'admin',
  externalId: null,
  displayName: 'Admin',
  departmentId: null,
  role: 'admin',
  groupIds: [],
  viewingRangeIds: ['restricted-range']
}

const settings: Settings = {
  host: '0.0.0.0',
  port: 8000,
  databaseUrl: 'postgres://test',
  ollamaBaseUrl: 'http://ollama',
  vectorDbUrl: 'http://qdrant',
  vectorCollection: 'aisss_chunks',
  migrateOnStart: false,
  migrationsDir: 'migrations',
  devUserId: null,
  objectStorage: {
    endpoint: 'http://minio',
    bucket: 'aisss',
    accessKey: 'test',
    secretKey: 'test'
  },
  maxUploadBytes: 1
}

type PoolFixture = {
  cases?: Record<string, {
    viewingRangeIds: string[]
    conditions?: ConditionRow[]
  }>
  standaloneFiles?: Record<string, {
    viewingRangeIds: string[]
    ragEnabled?: boolean
  }>
}

type SearchHit = {
  id: string
  score: number
  payload: Record<string, unknown>
}

function regularUser (viewingRangeIds: string[]): AuthUser {
  return {
    id: 'user',
    externalId: null,
    displayName: 'User',
    departmentId: null,
    role: 'user',
    groupIds: [],
    viewingRangeIds
  }
}

function condition (
  name: string,
  overrides: Partial<ConditionRow> = {}
): ConditionRow {
  return {
    name,
    search_policy: 'allow',
    quote_policy: 'allow',
    export_policy: 'allow',
    priority: 10,
    ...overrides
  }
}

function caseHit (
  caseId: string,
  overrides: Record<string, unknown> = {}
): SearchHit {
  const displayId = String(overrides.display_id ?? caseId.toUpperCase())
  return {
    id: `${caseId}-chunk`,
    score: 0.9,
    payload: {
      chunk_id: `${caseId}-chunk`,
      case_id: caseId,
      display_id: displayId,
      title: `${displayId} title`,
      chunk_text: `${displayId} text`,
      source_type: 'case_body',
      rag_enabled: true,
      ...overrides
    }
  }
}

function standaloneHit (
  standaloneId: string,
  overrides: Record<string, unknown> = {}
): SearchHit {
  return {
    id: `${standaloneId}-chunk`,
    score: 0.9,
    payload: {
      chunk_id: `${standaloneId}-chunk`,
      standalone_file_id: standaloneId,
      title: `${standaloneId} title`,
      chunk_text: `${standaloneId} text`,
      source_type: 'standalone_file',
      rag_enabled: true,
      ...overrides
    }
  }
}

function createPoolMock (fixture: PoolFixture): pg.Pool {
  return {
    async query (sql: string, params: unknown[] = []) {
      const resourceId = String(params[0])
      if (sql.includes('FROM case_viewing_ranges')) {
        const viewingRangeIds = fixture.cases?.[resourceId]?.viewingRangeIds ?? []
        return { rows: viewingRangeIds.map((viewing_range_id) => ({ viewing_range_id })) }
      }
      if (sql.includes('FROM conditions')) {
        return { rows: fixture.cases?.[resourceId]?.conditions ?? [] }
      }
      if (sql.includes('FROM standalone_file_viewing_ranges')) {
        const viewingRangeIds = fixture.standaloneFiles?.[resourceId]?.viewingRangeIds ?? []
        return { rows: viewingRangeIds.map((viewing_range_id) => ({ viewing_range_id })) }
      }
      // authorizeChunk の DB 最終確認（削除済み・RAG無効の fail-closed 再チェック）
      if (sql.includes('FROM cases WHERE')) {
        return { rows: fixture.cases?.[resourceId] ? [{ '?column?': 1 }] : [] }
      }
      if (sql.includes('FROM standalone_files WHERE')) {
        const file = fixture.standaloneFiles?.[resourceId]
        return { rows: file ? [{ rag_enabled: file.ragEnabled ?? true }] : [] }
      }
      if (sql.includes('FROM attachments a')) {
        return { rows: [] }
      }
      return { rows: [] }
    }
  } as unknown as pg.Pool
}

async function runPermissionedSearch (
  fixture: PoolFixture,
  user: AuthUser,
  hits: SearchHit[],
  overrides: {
    embeddingModel?: string | null
    searchError?: Error
    activeCollection?: string
  } = {}
) {
  let searchedCollection: string | null = null
  const result = await permissionedSearch(
    createPoolMock(fixture),
    settings,
    user,
    'restricted question',
    8,
    'webui_chat',
    {
      getEmbeddingModel: async () => (
        Object.hasOwn(overrides, 'embeddingModel') ? overrides.embeddingModel ?? null : 'embed-model'
      ),
      getActiveCollection: async () => ({
        collectionName: overrides.activeCollection ?? settings.vectorCollection
      }),
      embed: async () => [0.1, 0.2],
      search: async (_baseUrl, collection) => {
        searchedCollection = collection
        if (overrides.searchError) throw overrides.searchError
        return hits
      }
    }
  )
  return { result, searchedCollection }
}

test('permissionedSearch excludes search_policy deny even for admin override', async () => {
  const { result } = await runPermissionedSearch(
    {
      cases: {
        'case-1': {
          viewingRangeIds: ['restricted-range'],
          conditions: [condition('Renamed Inquiry Ban', {
            search_policy: 'deny',
            quote_policy: 'deny',
            export_policy: 'deny_all',
            priority: 20
          })]
        }
      }
    },
    admin,
    [caseHit('case-1')]
  )

  assert.deepEqual(result.contexts, [])
  assert.equal(result.excluded_counts.search_policy, 1)
  assert.equal(result.excluded_counts.viewing_range ?? 0, 0)
})

test('permissionedSearch excludes out-of-range cases for regular users', async () => {
  const { result } = await runPermissionedSearch(
    { cases: { 'case-1': { viewingRangeIds: ['range-a'] } } },
    regularUser(['range-b']),
    [caseHit('case-1')]
  )

  assert.deepEqual(result.contexts, [])
  assert.equal(result.excluded_counts.viewing_range, 1)
  assert.equal(result.excluded_counts.search_policy ?? 0, 0)
})

test('permissionedSearch returns in-range cases for regular users', async () => {
  const { result } = await runPermissionedSearch(
    { cases: { 'case-1': { viewingRangeIds: ['range-a'] } } },
    regularUser(['range-a']),
    [caseHit('case-1', { display_id: 'CASE-1', title: 'Allowed case' })]
  )

  assert.equal(result.contexts.length, 1)
  assert.equal(result.contexts[0]?.display_id, 'CASE-1')
  assert.equal(result.contexts[0]?.title, 'Allowed case')
  assert.deepEqual(result.excluded_counts, {})
})

test('permissionedSearch excludes search_policy deny for in-range regular users', async () => {
  const { result } = await runPermissionedSearch(
    {
      cases: {
        'case-1': {
          viewingRangeIds: ['range-a'],
          conditions: [condition('照会禁止', {
            search_policy: 'deny',
            quote_policy: 'deny',
            export_policy: 'deny_all'
          })]
        }
      }
    },
    regularUser(['range-a']),
    [caseHit('case-1')]
  )

  assert.deepEqual(result.contexts, [])
  assert.equal(result.excluded_counts.search_policy, 1)
  assert.equal(result.excluded_counts.viewing_range ?? 0, 0)
})

test('permissionedSearch excludes rag-disabled chunks for every user', async () => {
  const { result } = await runPermissionedSearch(
    { cases: { 'case-1': { viewingRangeIds: ['range-a'] } } },
    admin,
    [caseHit('case-1', { rag_enabled: false })]
  )

  assert.deepEqual(result.contexts, [])
  assert.equal(result.excluded_counts.rag_disabled, 1)
  assert.equal(result.excluded_counts.viewing_range ?? 0, 0)
  assert.equal(result.excluded_counts.search_policy ?? 0, 0)
})

test('permissionedSearch filters standalone files by viewing range', async () => {
  const { result } = await runPermissionedSearch(
    {
      standaloneFiles: {
        'file-allowed': { viewingRangeIds: ['range-a'] },
        'file-denied': { viewingRangeIds: ['range-b'] }
      }
    },
    regularUser(['range-a']),
    [
      standaloneHit('file-allowed', { title: 'Allowed standalone' }),
      standaloneHit('file-denied', { title: 'Denied standalone' })
    ]
  )

  assert.equal(result.contexts.length, 1)
  assert.equal(result.contexts[0]?.title, 'Allowed standalone')
  assert.equal(result.excluded_counts.viewing_range, 1)
})

test('permissionedSearch does not leak denied case citations or titles', async () => {
  const { result } = await runPermissionedSearch(
    {
      cases: {
        allowed: { viewingRangeIds: ['range-a'] },
        denied: {
          viewingRangeIds: ['range-a'],
          conditions: [condition('照会禁止', { search_policy: 'deny' })]
        }
      }
    },
    regularUser(['range-a']),
    [
      caseHit('allowed', { display_id: 'CASE-OK', title: 'Allowed title' }),
      caseHit('denied', { display_id: 'SECRET-9', title: 'Secret denied title' })
    ]
  )

  const serializedContexts = JSON.stringify(result.contexts)
  assert.equal(result.contexts.length, 1)
  assert.match(serializedContexts, /CASE-OK/)
  assert.doesNotMatch(serializedContexts, /SECRET-9/)
  assert.doesNotMatch(serializedContexts, /Secret denied title/)
  assert.equal(result.excluded_counts.search_policy, 1)
})

test('permissionedSearch aggregates effective policies from allowed contexts', async () => {
  const { result } = await runPermissionedSearch(
    {
      cases: {
        'case-print': {
          viewingRangeIds: ['range-a'],
          conditions: [condition('印刷禁止', {
            quote_policy: 'summarize_only',
            export_policy: 'deny_print'
          })]
        },
        'case-copy': {
          viewingRangeIds: ['range-a'],
          conditions: [condition('複製禁止', {
            quote_policy: 'deny',
            export_policy: 'deny_all'
          })]
        }
      }
    },
    regularUser(['range-a']),
    [caseHit('case-print'), caseHit('case-copy')]
  )

  assert.equal(result.contexts.length, 2)
  assert.equal(result.effective_policies.quote_policy, 'deny')
  assert.equal(result.effective_policies.export_policy, 'deny_all')
  assert.deepEqual(
    result.effective_policies.condition_names.sort(),
    ['印刷禁止', '複製禁止'].sort()
  )
})

test('permissionedSearch excludes chunks of deleted cases even if vectors remain', async () => {
  // Qdrant にベクタが残っていても、DB に行が無ければ（論理削除済みなら）出さない
  const { result } = await runPermissionedSearch(
    { cases: {} },
    admin,
    [caseHit('deleted-case', { display_id: 'DELETED-1', title: 'Deleted case title' })]
  )

  assert.deepEqual(result.contexts, [])
  assert.equal(result.excluded_counts.source_deleted, 1)
})

test('permissionedSearch excludes standalone chunks disabled in DB despite stale payload', async () => {
  // payload.rag_enabled=true のまま Qdrant 削除に失敗しても、DB の rag_enabled=false で fail-closed
  const { result } = await runPermissionedSearch(
    {
      standaloneFiles: {
        'file-stale': { viewingRangeIds: ['range-a'], ragEnabled: false }
      }
    },
    regularUser(['range-a']),
    [standaloneHit('file-stale', { title: 'Stale standalone' })]
  )

  assert.deepEqual(result.contexts, [])
  assert.equal(result.excluded_counts.rag_disabled, 1)
})

test('permissionedSearch fails closed when no embedding model is configured', async () => {
  const { result } = await runPermissionedSearch(
    { cases: { 'case-1': { viewingRangeIds: ['range-a'] } } },
    regularUser(['range-a']),
    [caseHit('case-1')],
    { embeddingModel: null }
  )

  assert.deepEqual(result.contexts, [])
  assert.equal(result.excluded_counts.embedding_model_missing, 1)
})

test('permissionedSearch fails closed when vector search throws', async () => {
  const { result } = await runPermissionedSearch(
    { cases: { 'case-1': { viewingRangeIds: ['range-a'] } } },
    regularUser(['range-a']),
    [caseHit('case-1')],
    { searchError: new Error('vector unavailable') }
  )

  assert.deepEqual(result.contexts, [])
  assert.equal(result.excluded_counts.vector_search_error, 1)
})

test('permissionedSearch resolves collection via getActiveCollection', async () => {
  const { searchedCollection } = await runPermissionedSearch(
    { cases: { 'case-1': { viewingRangeIds: ['range-a'] } } },
    regularUser(['range-a']),
    [],
    { activeCollection: 'aisss_chunks_green' }
  )
  assert.equal(searchedCollection, 'aisss_chunks_green')
})
