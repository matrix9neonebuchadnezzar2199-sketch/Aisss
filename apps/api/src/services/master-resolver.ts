import type pg from 'pg'

type MasterCache = Map<string, Map<string, string>>

const MASTER_TABLES: Record<string, string> = {
  material_type: 'material_types',
  registering_department: 'departments',
  category: 'categories',
  region: 'regions',
  source: 'sources',
  handling_type: 'handling_types',
  reliability: 'reliability_levels',
  accuracy: 'accuracy_levels',
  rank: 'rank_levels',
  retention_policy: 'retention_policies',
  viewing_range: 'viewing_ranges',
  condition: 'conditions',
  keyword: 'keywords',
  person: 'persons',
  acquisition_location: 'acquisition_locations',
  information_request: 'information_requests'
}

export class MasterResolver {
  private cache: MasterCache = new Map()

  constructor (private pool: pg.Pool) {}

  private async loadTable (key: string, table: string): Promise<Map<string, string>> {
    if (this.cache.has(key)) return this.cache.get(key)!
    const { rows } = await this.pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM ${table} WHERE is_active = TRUE`
    )
    const map = new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.id]))
    this.cache.set(key, map)
    return map
  }

  async resolve (field: string, label: string | null | undefined): Promise<string | null> {
    if (!label || String(label).trim() === '') return null
    const table = MASTER_TABLES[field]
    if (!table) return null
    const map = await this.loadTable(field, table)
    const id = map.get(String(label).trim().toLowerCase())
    return id ?? null
  }

  async resolveMany (
    field: 'viewing_range' | 'condition' | 'person',
    labels: string
  ): Promise<{ ids: string[]; unknown: string[] }> {
    const parts = labels.split(';').map((s) => s.trim()).filter(Boolean)
    const ids: string[] = []
    const unknown: string[] = []
    for (const part of parts) {
      const id = await this.resolve(field, part)
      if (id) ids.push(id)
      else unknown.push(part)
    }
    return { ids, unknown }
  }

  async findOrCreateKeyword (name: string): Promise<string> {
    const existing = await this.resolve('keyword', name)
    if (existing) return existing
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO keywords (name) VALUES ($1) RETURNING id`,
      [name.trim()]
    )
    this.cache.delete('keyword')
    return rows[0].id
  }
}
