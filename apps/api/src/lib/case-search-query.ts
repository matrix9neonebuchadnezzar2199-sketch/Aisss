import type { CaseSearchQuery } from '../services/cases.js'

const SEARCH_FILTER_KEYS = [
  'q',
  'title',
  'material_number',
  'material_type_id',
  'registering_department_id',
  'rank_id',
  'viewing_range_id',
  'category_id',
  'region_id',
  'source_id',
  'information_request_id',
  'handling_type_id',
  'reliability_id',
  'accuracy_id',
  'condition_id',
  'event_date_from',
  'event_date_to',
  'page',
  'limit',
  'sort',
  'order'
] as const

/** GET /api/cases クエリ文字列を CaseSearchQuery に変換 */
export function parseCaseSearchQuery (q: Record<string, string | undefined>): CaseSearchQuery {
  const out: CaseSearchQuery = {}
  for (const key of SEARCH_FILTER_KEYS) {
    const value = q[key]?.trim()
    if (!value) continue
    if (key === 'page' || key === 'limit') {
      out[key] = Number(value)
    } else if (key === 'order') {
      out.order = value === 'asc' ? 'asc' : 'desc'
    } else {
      ;(out as Record<string, string | number>)[key] = value
    }
  }
  return out
}
