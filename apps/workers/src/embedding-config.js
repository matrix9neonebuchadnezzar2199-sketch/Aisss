/** worker 向け: active 埋め込みコレクション解決 */

export async function getActiveCollection (pool, fallbackCollection) {
  const { rows } = await pool.query(
    `SELECT id, model_name, dimensions, collection_name
     FROM embedding_configs
     WHERE status = 'active'
     LIMIT 1`
  )
  const row = rows[0]
  if (!row) {
    return {
      id: null,
      model_name: null,
      dimensions: null,
      collection_name: fallbackCollection
    }
  }
  return row
}

/** building 中の reindex ターゲット設定 */
export async function getBuildingConfig (pool, configId) {
  const { rows } = await pool.query(
    `SELECT id, model_name, dimensions, collection_name, status
     FROM embedding_configs
     WHERE id = $1`,
    [configId]
  )
  return rows[0] ?? null
}
