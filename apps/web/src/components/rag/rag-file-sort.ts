import type { RagFileItem } from '../../lib/api'

export type RagSortKey = 'file_name' | 'viewing_range' | 'pipeline' | 'rag_enabled' | 'registered_at'
export type SortDirection = 'asc' | 'desc'

function compareText (a: string, b: string): number {
  return a.localeCompare(b, 'ja')
}

function fileLabel (item: RagFileItem): string {
  return `${item.title} / ${item.file_name}`
}

function viewingRangeLabel (item: RagFileItem): string {
  return item.viewing_range_labels.join(', ')
}

function pipelineLabel (item: RagFileItem): string {
  return item.pipeline_status
}

export function sortRagFileItems (
  items: RagFileItem[],
  key: RagSortKey,
  direction: SortDirection
): RagFileItem[] {
  const sorted = [...items].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'file_name':
        cmp = compareText(fileLabel(a), fileLabel(b))
        break
      case 'viewing_range':
        cmp = compareText(viewingRangeLabel(a), viewingRangeLabel(b))
        break
      case 'pipeline':
        cmp = compareText(pipelineLabel(a), pipelineLabel(b))
        break
      case 'rag_enabled':
        cmp = Number(a.rag_enabled) - Number(b.rag_enabled)
        break
      case 'registered_at':
        cmp = compareText(a.registered_at ?? '', b.registered_at ?? '')
        break
      default:
        cmp = 0
    }
    return direction === 'asc' ? cmp : -cmp
  })
  return sorted
}
