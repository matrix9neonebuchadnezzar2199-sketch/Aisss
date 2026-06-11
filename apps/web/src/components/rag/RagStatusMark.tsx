import { getRagStatusVisual } from './rag-status-visual'

type RagStatusMarkProps = {
  state: string
  /** ツールチップ。省略時は state の既定ラベル */
  label?: string
  /** tree | table — サイズ調整 */
  variant?: 'tree' | 'table'
}

export function RagStatusMark ({ state, label, variant = 'tree' }: RagStatusMarkProps) {
  const visual = getRagStatusVisual(state)
  const title = label ?? visual.title

  return (
    <span
      className={`rag-status-mark ${visual.className} rag-status-mark-${variant}`}
      title={title}
      aria-label={title}
      role="img"
    >
      {visual.mark}
    </span>
  )
}
