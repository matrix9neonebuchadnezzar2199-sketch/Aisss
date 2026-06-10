import { AppError } from '../lib/errors.js'
import { ALL_USERS_VIEWING_RANGE_ID } from '../lib/viewing-ranges.js'

export type QdrantPoint = {
  id: string
  vector: number[]
  payload: Record<string, unknown>
}

export type QdrantSearchHit = {
  id: string
  score: number
  payload: Record<string, unknown>
}

export async function ensureCollection (
  baseUrl: string,
  collection: string,
  vectorSize: number
): Promise<void> {
  const check = await fetch(new URL(`/collections/${collection}`, baseUrl))
  if (check.ok) return

  const create = await fetch(new URL(`/collections/${collection}`, baseUrl), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vectors: { size: vectorSize, distance: 'Cosine' }
    })
  })
  if (!create.ok) {
    throw new AppError('vector_db_error', `Qdrant create collection failed: HTTP ${create.status}`, 502)
  }
}

export async function upsertPoints (
  baseUrl: string,
  collection: string,
  points: QdrantPoint[]
): Promise<void> {
  if (points.length === 0) return
  const response = await fetch(
    new URL(`/collections/${collection}/points?wait=true`, baseUrl),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points })
    }
  )
  if (!response.ok) {
    throw new AppError('vector_db_error', `Qdrant upsert failed: HTTP ${response.status}`, 502)
  }
}

export async function deletePoints (
  baseUrl: string,
  collection: string,
  pointIds: string[]
): Promise<void> {
  if (pointIds.length === 0) return
  await fetch(new URL(`/collections/${collection}/points/delete?wait=true`, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points: pointIds })
  })
}

export async function searchPoints (
  baseUrl: string,
  collection: string,
  vector: number[],
  limit: number,
  filter?: Record<string, unknown>
): Promise<QdrantSearchHit[]> {
  const body: Record<string, unknown> = { vector, limit, with_payload: true }
  if (filter) body.filter = filter

  const response = await fetch(
    new URL(`/collections/${collection}/points/search`, baseUrl),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )
  if (!response.ok) {
    throw new AppError('vector_db_error', `Qdrant search failed: HTTP ${response.status}`, 502)
  }
  const json = await response.json() as {
    result?: Array<{ id: string | number; score: number; payload?: Record<string, unknown> }>
  }
  return (json.result ?? []).map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload ?? {}
  }))
}

export function buildViewingRangeFilter (
  viewingRangeIds: string[],
  isAdmin: boolean
): Record<string, unknown> | undefined {
  if (isAdmin) return undefined
  const allowedRangeIds = Array.from(new Set([...viewingRangeIds, ALL_USERS_VIEWING_RANGE_ID]))
  return {
    must: [
      { key: 'rag_enabled', match: { value: true } },
      { key: 'viewing_range_ids', match: { any: allowedRangeIds } }
    ]
  }
}
