import type pg from 'pg'
import type { Settings } from '../settings.js'

export type ActiveEmbeddingConfig = {
  id: string | null
  modelName: string | null
  dimensions: number | null
  collectionName: string
}

/** DB 上の active 埋め込みコレクションを解決する。未登録時は settings にフォールバック。 */
export async function getActiveCollection (
  pool: pg.Pool,
  settings: Settings
): Promise<ActiveEmbeddingConfig> {
  const { rows } = await pool.query<{
    id: string
    model_name: string
    dimensions: number | null
    collection_name: string
  }>(
    `SELECT id, model_name, dimensions, collection_name
     FROM embedding_configs
     WHERE status = 'active'
     LIMIT 1`
  )
  const row = rows[0]
  if (!row) {
    return {
      id: null,
      modelName: null,
      dimensions: null,
      collectionName: settings.vectorCollection
    }
  }
  return {
    id: row.id,
    modelName: row.model_name,
    dimensions: row.dimensions,
    collectionName: row.collection_name
  }
}

/** Qdrant 削除用: ソースに紐づく sync 行をコレクション別に取得 */
export async function listVectorPointsByCollection (
  pool: pg.Pool,
  whereSql: string,
  params: unknown[]
): Promise<Map<string, string[]>> {
  const { rows } = await pool.query<{ vector_collection: string; vector_point_id: string }>(
    `SELECT rs.vector_collection, rs.vector_point_id
     FROM rag_sync_states rs
     JOIN rag_chunks rc ON rc.id = rs.chunk_id
     WHERE ${whereSql}`,
    params
  )
  const grouped = new Map<string, string[]>()
  for (const row of rows) {
    const list = grouped.get(row.vector_collection) ?? []
    list.push(row.vector_point_id)
    grouped.set(row.vector_collection, list)
  }
  return grouped
}

/** 全コレクションからポイントを削除する（blue-green 中の二重 sync 対応） */
export async function deletePointsAcrossCollections (
  pool: pg.Pool,
  vectorDbUrl: string,
  whereSql: string,
  params: unknown[],
  deletePointsFn: (baseUrl: string, collection: string, pointIds: string[]) => Promise<void>
): Promise<void> {
  const grouped = await listVectorPointsByCollection(pool, whereSql, params)
  for (const [collection, pointIds] of grouped) {
    if (pointIds.length === 0) continue
    try {
      await deletePointsFn(vectorDbUrl, collection, pointIds)
    } catch {
      // vectors may already be gone
    }
  }
}
