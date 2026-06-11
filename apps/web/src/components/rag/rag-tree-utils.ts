import type { RagFileItem } from '../../lib/api'

export type RagTreeSelection =
  | { level: 'all' }
  | { level: 'genre'; genreId: string }
  | { level: 'group'; genreId: string; groupLabel: string }
  | { level: 'file'; fileId: string; genreId: string; groupLabel: string }

export function selectionActiveKey (selection: RagTreeSelection): string {
  switch (selection.level) {
    case 'all': return 'all'
    case 'genre': return `genre:${selection.genreId}`
    case 'group': return `group:${selection.genreId}:${selection.groupLabel}`
    case 'file': return `file:${selection.fileId}`
  }
}

export function filterItemsByTreeSelection (
  items: RagFileItem[],
  selection: RagTreeSelection
): RagFileItem[] {
  switch (selection.level) {
    case 'all':
      return items
    case 'genre':
      return items.filter((item) => (
        selection.genreId === 'standalone'
          ? item.source_kind === 'standalone'
          : item.source_kind === 'case_attachment'
      ))
    case 'group':
      return items.filter((item) => item.title === selection.groupLabel)
    case 'file':
      return items.filter((item) => item.id === selection.fileId)
  }
}

export function ragToggleDisabled (item: RagFileItem, pending: boolean): boolean {
  if (pending) return true
  if (item.rag_enabled) return false
  return item.extraction_status !== 'succeeded'
}

/** モック準拠: 半角数字 → 全角（件数表示）。0 件も「　０」と表示する */
export function toFullWidthCount (n: number): string {
  const safe = Math.max(0, Math.floor(n))
  const full = String(safe).replace(/\d/g, (d) => '０１２３４５６７８９'[Number(d)])
  return '\u3000' + full
}
