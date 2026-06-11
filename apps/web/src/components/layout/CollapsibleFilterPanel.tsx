import type { ReactNode } from 'react'
import { useFilterPanelCollapsed } from '../../hooks/useFilterPanelCollapsed'

type CollapsibleFilterPanelProps = {
  /** localStorage キー（画面ごとに一意） */
  storageKey: string
  title?: string
  defaultCollapsed?: boolean
  className?: string
  children: ReactNode
}

/** ケース検索と同型の折りたたみフィルタパネル */
export function CollapsibleFilterPanel ({
  storageKey,
  title = '検索条件',
  defaultCollapsed = false,
  className,
  children
}: CollapsibleFilterPanelProps) {
  const [collapsed, toggle] = useFilterPanelCollapsed(storageKey, defaultCollapsed)
  const extra = className ? ` ${className}` : ''

  return (
    <div className={`filter-panel${collapsed ? ' collapsed' : ''}${extra}`}>
      <button
        type="button"
        className="filter-panel-toggle"
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        <span className="filter-chevron">{collapsed ? '▶' : '▼'}</span>
        <span>{title}</span>
        <span className="filter-collapsed-hint">クリックで展開</span>
      </button>
      <div className="filter-panel-body">
        {children}
      </div>
    </div>
  )
}
