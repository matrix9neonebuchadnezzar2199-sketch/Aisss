export const MASTER_TABLES: Record<string, string> = {
  'material-types': 'material_types',
  departments: 'departments',
  categories: 'categories',
  regions: 'regions',
  sources: 'sources',
  'information-requests': 'information_requests',
  'handling-types': 'handling_types',
  'reliability-levels': 'reliability_levels',
  'accuracy-levels': 'accuracy_levels',
  'rank-levels': 'rank_levels',
  'retention-policies': 'retention_policies',
  conditions: 'conditions',
  'viewing-ranges': 'viewing_ranges',
  keywords: 'keywords',
  persons: 'persons',
  'acquisition-locations': 'acquisition_locations'
}

export function resolveMasterTable (masterName: string): string | undefined {
  return MASTER_TABLES[masterName]
}
