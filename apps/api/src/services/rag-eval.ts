import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type pg from 'pg'
import type { Settings } from '../settings.js'
import type { AuthUser } from '../types/auth.js'
import type { ConditionRow } from './conditions.js'
import { permissionedSearch } from './permissioned-search.js'

export type EvalScenario = {
  id: string
  query: string
  user: {
    role: AuthUser['role']
    viewing_range_ids: string[]
  }
  hits: Array<{
    case_id: string
    display_id: string
    title: string
    standalone_file_id?: string
  }>
  fixture: {
    cases?: Record<string, {
      viewing_range_ids: string[]
      conditions?: ConditionRow[]
    }>
    standalone_files?: Record<string, {
      viewing_range_ids: string[]
    }>
  }
  expect: {
    allowed_display_ids: string[]
    forbidden_display_ids: string[]
    min_contexts?: number
    excluded_counts?: Partial<Record<'viewing_range' | 'search_policy' | 'rag_disabled', number>>
  }
}

export type EvalSet = {
  version: number
  description: string
  scenarios: EvalScenario[]
}

export type EvalScenarioResult = {
  id: string
  query: string
  pass: boolean
  retrieved_display_ids: string[]
  citation_display_ids: string[]
  excluded_counts: Record<string, number>
  failures: string[]
}

export type EvalReport = {
  total: number
  passed: number
  failed: number
  results: EvalScenarioResult[]
}

type SearchHit = {
  id: string
  score: number
  payload: Record<string, unknown>
}

function toAuthUser (scenarioUser: EvalScenario['user']): AuthUser {
  return {
    id: 'eval-user',
    externalId: null,
    displayName: 'Eval User',
    departmentId: null,
    role: scenarioUser.role,
    groupIds: [],
    viewingRangeIds: scenarioUser.viewing_range_ids
  }
}

function createPoolMock (scenario: EvalScenario): pg.Pool {
  return {
    async query (sql: string, params: unknown[] = []) {
      const resourceId = String(params[0])
      if (sql.includes('FROM case_viewing_ranges')) {
        const viewingRangeIds = scenario.fixture.cases?.[resourceId]?.viewing_range_ids ?? []
        return { rows: viewingRangeIds.map((viewing_range_id) => ({ viewing_range_id })) }
      }
      if (sql.includes('FROM conditions')) {
        return { rows: scenario.fixture.cases?.[resourceId]?.conditions ?? [] }
      }
      if (sql.includes('FROM standalone_file_viewing_ranges')) {
        const viewingRangeIds = scenario.fixture.standalone_files?.[resourceId]?.viewing_range_ids ?? []
        return { rows: viewingRangeIds.map((viewing_range_id) => ({ viewing_range_id })) }
      }
      // authorizeChunk の DB 最終確認（削除済み・RAG無効チェック）に応答する
      if (sql.includes('FROM cases WHERE')) {
        return { rows: scenario.fixture.cases?.[resourceId] ? [{ '?column?': 1 }] : [] }
      }
      if (sql.includes('FROM standalone_files WHERE')) {
        return {
          rows: scenario.fixture.standalone_files?.[resourceId] ? [{ rag_enabled: true }] : []
        }
      }
      return { rows: [] }
    }
  } as unknown as pg.Pool
}

function toSearchHits (scenario: EvalScenario): SearchHit[] {
  return scenario.hits.map((hit) => {
    if (hit.standalone_file_id) {
      return {
        id: `${hit.standalone_file_id}-chunk`,
        score: 0.9,
        payload: {
          chunk_id: `${hit.standalone_file_id}-chunk`,
          standalone_file_id: hit.standalone_file_id,
          title: hit.title,
          chunk_text: `${hit.title} text`,
          source_type: 'standalone_file',
          rag_enabled: true
        }
      }
    }
    return {
      id: `${hit.case_id}-chunk`,
      score: 0.9,
      payload: {
        chunk_id: `${hit.case_id}-chunk`,
        case_id: hit.case_id,
        display_id: hit.display_id,
        title: hit.title,
        chunk_text: `${hit.title} text`,
        source_type: 'case_body',
        rag_enabled: true
      }
    }
  })
}

export async function runRetrievalEval (
  settings: Settings,
  scenarios: EvalScenario[]
): Promise<EvalReport> {
  const results: EvalScenarioResult[] = []

  for (const scenario of scenarios) {
    const search = await permissionedSearch(
      createPoolMock(scenario),
      settings,
      toAuthUser(scenario.user),
      scenario.query,
      8,
      'webui_chat',
      {
        getEmbeddingModel: async () => 'eval-embed-model',
        embed: async () => [0.1, 0.2],
        search: async () => toSearchHits(scenario)
      }
    )

    const retrievedDisplayIds = search.contexts
      .map((ctx) => ctx.display_id)
      .filter((displayId): displayId is string => Boolean(displayId))
    const citationDisplayIds = search.contexts
      .map((ctx) => ctx.display_id ?? ctx.citation)
      .filter((displayId): displayId is string => Boolean(displayId))
    const failures: string[] = []

    for (const displayId of scenario.expect.allowed_display_ids) {
      if (!retrievedDisplayIds.includes(displayId)) {
        failures.push(`expected hit missing: ${displayId}`)
      }
    }
    for (const displayId of scenario.expect.forbidden_display_ids) {
      if (retrievedDisplayIds.includes(displayId)) {
        failures.push(`forbidden hit leaked into contexts: ${displayId}`)
      }
      if (citationDisplayIds.includes(displayId)) {
        failures.push(`forbidden hit leaked into citations: ${displayId}`)
      }
    }
    if (scenario.expect.min_contexts !== undefined && search.contexts.length < scenario.expect.min_contexts) {
      failures.push(`expected at least ${scenario.expect.min_contexts} contexts, got ${search.contexts.length}`)
    }
    if (scenario.expect.excluded_counts) {
      for (const [key, expected] of Object.entries(scenario.expect.excluded_counts)) {
        const actual = search.excluded_counts[key as keyof typeof search.excluded_counts] ?? 0
        if (actual !== expected) {
          failures.push(`excluded_counts.${key} expected ${expected}, got ${actual}`)
        }
      }
    }

    results.push({
      id: scenario.id,
      query: scenario.query,
      pass: failures.length === 0,
      retrieved_display_ids: retrievedDisplayIds,
      citation_display_ids: citationDisplayIds,
      excluded_counts: search.excluded_counts,
      failures
    })
  }

  const passed = results.filter((result) => result.pass).length
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results
  }
}

export async function loadRetrievalEvalSet (
  evalPath?: string
): Promise<EvalSet> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const resolved = evalPath ?? path.resolve(moduleDir, '../../eval/retrieval-eval-set.json')
  const raw = await readFile(resolved, 'utf8')
  return JSON.parse(raw) as EvalSet
}

export function formatEvalReport (report: EvalReport): string {
  const lines = [
    `retrieval-eval: ${report.passed}/${report.total} passed`
  ]
  for (const result of report.results) {
    lines.push(
      `- ${result.id}: ${result.pass ? 'PASS' : 'FAIL'} query="${result.query}" hits=${result.retrieved_display_ids.join(',') || '(none)'}`
    )
    for (const failure of result.failures) {
      lines.push(`  ! ${failure}`)
    }
  }
  return lines.join('\n')
}
