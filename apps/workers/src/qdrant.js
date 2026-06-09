export async function ensureCollection (baseUrl, collection, vectorSize) {
  const check = await fetch(new URL(`/collections/${collection}`, baseUrl))
  if (check.ok) return
  const create = await fetch(new URL(`/collections/${collection}`, baseUrl), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: { size: vectorSize, distance: 'Cosine' } })
  })
  if (!create.ok) throw new Error(`Qdrant create collection HTTP ${create.status}`)
}

export async function upsertPoints (baseUrl, collection, points) {
  if (points.length === 0) return
  const response = await fetch(
    new URL(`/collections/${collection}/points?wait=true`, baseUrl),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points })
    }
  )
  if (!response.ok) throw new Error(`Qdrant upsert HTTP ${response.status}`)
}
