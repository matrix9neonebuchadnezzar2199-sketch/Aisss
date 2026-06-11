/** RAG パイプライン / 可視状態の表示記号（ツリー・一覧共通） */

export type RagVisibilityState =
  | 'rag_enabled'
  | 'auto_enable_reserved'
  | 'knowledge_candidate'
  | 'extraction_failed'
  | 'extracting'
  | 'rag_disabled'

type RagStatusVisual = {
  mark: string
  className: string
  title: string
}

const VISUALS: Record<RagVisibilityState, RagStatusVisual> = {
  rag_enabled: {
    mark: '●',
    className: 'rag-mark-rag-enabled',
    title: 'RAG有効（抽出済み）'
  },
  extraction_failed: {
    mark: '×',
    className: 'rag-mark-extraction-failed',
    title: '抽出失敗'
  },
  extracting: {
    mark: '◐',
    className: 'rag-mark-extracting',
    title: '抽出中'
  },
  auto_enable_reserved: {
    mark: '◎',
    className: 'rag-mark-auto-reserved',
    title: '自動ON予約'
  },
  knowledge_candidate: {
    mark: '○',
    className: 'rag-mark-knowledge-candidate',
    title: '未ナレッジ化候補（抽出済み）'
  },
  rag_disabled: {
    mark: '○',
    className: 'rag-mark-rag-disabled',
    title: 'RAG無効'
  }
}

export function getRagStatusVisual (state: string): RagStatusVisual {
  return VISUALS[state as RagVisibilityState] ?? VISUALS.rag_disabled
}

/** API 未拡張時のフォールバック（ツリー file 最小フィールドから推定） */
export function resolveTreeFileVisibility (file: {
  rag_enabled: boolean
  extraction_status: string
  auto_enable_rag_on_extraction?: boolean
  rag_visibility_state?: string
}): RagVisibilityState {
  if (file.rag_visibility_state) {
    return file.rag_visibility_state as RagVisibilityState
  }
  if (file.rag_enabled) return 'rag_enabled'
  if (file.extraction_status === 'failed') return 'extraction_failed'
  if (file.extraction_status === 'pending' || file.extraction_status === 'running') return 'extracting'
  if (file.auto_enable_rag_on_extraction) return 'auto_enable_reserved'
  if (file.extraction_status === 'succeeded') return 'knowledge_candidate'
  return 'rag_disabled'
}

export function ragRowClassName (state: string, isCandidate: boolean): string | undefined {
  const classes: string[] = []
  if (state === 'extraction_failed') classes.push('rag-row-extraction-failed')
  else if (isCandidate) classes.push('rag-row-candidate')
  return classes.length > 0 ? classes.join(' ') : undefined
}
