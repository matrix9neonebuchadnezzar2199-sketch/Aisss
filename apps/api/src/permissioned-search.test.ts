import { test } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import { permissionedSearch } from './services/permissioned-search.js'
import type { Settings } from './settings.js'
import type { AuthUser } from './types/auth.js'

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

function createPoolMock (): pg.Pool {
  return {
    async query (sql: string) {
      if (sql.includes('FROM case_viewing_ranges')) {
        return { rows: [{ viewing_range_id: 'restricted-range' }] }
      }
      if (sql.includes('FROM conditions')) {
        return {
          rows: [{
            name: 'Renamed Inquiry Ban',
            search_policy: 'deny',
            quote_policy: 'deny',
            export_policy: 'deny_all',
            priority: 20
          }]
        }
      }
      return { rows: [] }
    }
  } as unknown as pg.Pool
}

test('permissionedSearch excludes search_policy deny even for admin override', async () => {
  const result = await permissionedSearch(
    createPoolMock(),
    settings,
    admin,
    'restricted question',
    8,
    'webui_chat',
    {
      getEmbeddingModel: async () => 'embed-model',
      embed: async () => [0.1, 0.2],
      search: async () => [{
        id: 'chunk-1',
        score: 0.9,
        payload: {
          chunk_id: 'chunk-1',
          case_id: 'case-1',
          display_id: 'CASE-1',
          title: 'Denied case',
          chunk_text: 'denied text',
          source_type: 'case_body',
          viewing_range_ids: ['restricted-range'],
          rag_enabled: true
        }
      }]
    }
  )

  assert.deepEqual(result.contexts, [])
  assert.equal(result.excluded_counts.search_policy, 1)
  assert.equal(result.excluded_counts.viewing_range ?? 0, 0)
})
