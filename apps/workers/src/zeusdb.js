/** ZEUS-DB HTTP client for SQLite forensic extraction. */

export async function analyzeSQLiteBuffer (buffer, fileName, config) {
  const baseUrl = (config.zeusdbUrl ?? 'http://zeus-db:8090').replace(/\/$/, '')
  const form = new FormData()
  form.append('database', new Blob([buffer]), fileName || 'upload.db')
  form.append('carve', 'true')

  const response = await fetch(`${baseUrl}/analyze/upload`, {
    method: 'POST',
    body: form
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`ZEUS-DB analyze failed (${response.status}): ${detail}`)
  }

  const payload = await response.json()
  const lines = [`# ZEUS-DB: ${fileName}`, `Tables: ${(payload.tables ?? []).join(', ')}`, '']
  for (const record of payload.records ?? []) {
    const cols = Object.entries(record.columns ?? {})
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ')
    const provenances = record.provenances ?? []
    const source = provenances.length > 0
      ? provenances.map((p) => p.source ?? 'unknown').join(';')
      : (record.provenance?.source ?? 'unknown')
    lines.push(`[${source}] ${record.table_name} row_id=${record.row_id ?? 'null'} ${cols}`)
  }

  return {
    text: lines.join('\n').trim(),
    engine: 'zeus-db',
    sourceType: 'sqlite_forensic',
    metadata: {
      schema_version: payload.schema_version,
      summary: payload.summary,
      timeline: payload.timeline
    }
  }
}
