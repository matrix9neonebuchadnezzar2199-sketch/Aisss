import { useCallback, useMemo, useState } from 'react'
import type { RagTreeFile, RagTreeGenre, RagTreeGroup } from '../../lib/api'
import { RagStatusMark } from './RagStatusMark'
import { resolveTreeFileVisibility } from './rag-status-visual'
import {
  selectionActiveKey,
  toFullWidthCount,
  type RagTreeSelection
} from './rag-tree-utils'

type RagTreePanelProps = {
  genres: RagTreeGenre[]
  pending: Record<string, boolean>
  selection: RagTreeSelection
  onSelect: (selection: RagTreeSelection) => void
  onSetFileRag: (file: RagTreeFile, enabled: boolean) => void
}

type CheckState = {
  checked: boolean
  indeterminate: boolean
  disabled: boolean
}

function fileCheckDisabled (file: RagTreeFile, pending: boolean): boolean {
  if (pending) return true
  if (file.rag_enabled) return false
  return file.extraction_status !== 'succeeded'
}

function collectDescendantFiles (node: RagTreeGenre | RagTreeGroup): RagTreeFile[] {
  if ('groups' in node) {
    return node.groups.flatMap((g) => collectDescendantFiles(g))
  }
  return node.files
}

function computeCheckState (
  files: RagTreeFile[],
  pending: Record<string, boolean>
): CheckState {
  const enabled = files.filter((f) => !fileCheckDisabled(f, pending[f.id] ?? false))
  if (enabled.length === 0) {
    return { checked: false, indeterminate: false, disabled: true }
  }
  const checkedCount = enabled.filter((f) => f.rag_enabled).length
  if (checkedCount === 0) {
    return { checked: false, indeterminate: false, disabled: false }
  }
  if (checkedCount === enabled.length) {
    return { checked: true, indeterminate: false, disabled: false }
  }
  return { checked: false, indeterminate: true, disabled: false }
}

function countFilesInNode (node: RagTreeGenre | RagTreeGroup): number {
  if ('groups' in node) {
    return node.groups.reduce((sum, g) => sum + countFilesInNode(g), 0)
  }
  return node.files.length
}

type TreeFileNodeProps = {
  file: RagTreeFile
  genreId: string
  groupLabel: string
  active: boolean
  pending: boolean
  onSelect: RagTreePanelProps['onSelect']
  onSetFileRag: RagTreePanelProps['onSetFileRag']
}

function TreeFileNode ({
  file,
  genreId,
  groupLabel,
  active,
  pending,
  onSelect,
  onSetFileRag
}: TreeFileNodeProps) {
  const disabled = fileCheckDisabled(file, pending)
  const visibilityState = resolveTreeFileVisibility(file)

  return (
    <li className="rag-tree-node" data-rag-file={file.id}>
      <div className={`rag-tree-item file${active ? ' active' : ''}`}>
        <label className="rag-tree-check-wrap" title="㋹ RAG">
          <input
            type="checkbox"
            className="rag-tree-check"
            data-rag-file-id={file.id}
            checked={file.rag_enabled}
            disabled={disabled}
            onChange={(e) => {
              e.stopPropagation()
              onSetFileRag(file, e.target.checked)
            }}
          />
        </label>
        <button
          type="button"
          className="rag-tree-btn"
          onClick={() => onSelect({ level: 'file', fileId: file.id, genreId, groupLabel })}
        >
          <RagStatusMark
            state={visibilityState}
            label={file.rag_visibility_label}
            variant="tree"
          />
          <span className="rag-tree-label">{file.label}</span>
        </button>
      </div>
    </li>
  )
}

type TreeGroupNodeProps = {
  group: RagTreeGroup
  genreId: string
  collapsedKeys: Set<string>
  selection: RagTreeSelection
  pending: Record<string, boolean>
  onToggleCollapsed: (key: string) => void
  onSelect: RagTreePanelProps['onSelect']
  onSetFileRag: RagTreePanelProps['onSetFileRag']
  onCascade: (files: RagTreeFile[], enabled: boolean) => void
}

function TreeGroupNode ({
  group,
  genreId,
  collapsedKeys,
  selection,
  pending,
  onToggleCollapsed,
  onSelect,
  onSetFileRag,
  onCascade
}: TreeGroupNodeProps) {
  const nodeKey = `group:${genreId}:${group.label}`
  const collapsed = collapsedKeys.has(nodeKey)
  const active = selectionActiveKey(selection) === nodeKey
  const fileCount = group.files.length
  const checkState = computeCheckState(group.files, pending)

  return (
    <li className={`rag-tree-node rag-tree-expandable${collapsed ? ' collapsed' : ''}`}>
      <div className={`rag-tree-item${active ? ' active' : ''}`}>
        <label className="rag-tree-check-wrap" title="㋹ 配下を一括選択">
          <input
            type="checkbox"
            className="rag-tree-check"
            checked={checkState.checked}
            disabled={checkState.disabled}
            ref={(el) => {
              if (el) el.indeterminate = checkState.indeterminate
            }}
            onChange={(e) => {
              e.stopPropagation()
              onCascade(group.files, e.target.checked)
            }}
          />
        </label>
        <button
          type="button"
          className="rag-tree-btn"
          aria-expanded={!collapsed}
          onClick={() => {
            onToggleCollapsed(nodeKey)
            onSelect({ level: 'group', genreId, groupLabel: group.label })
          }}
        >
          <span className="chev">{collapsed ? '▸' : '▼'}</span>
          <span className="rag-tree-label">{group.label}</span>
          <span className="rag-tree-count">{toFullWidthCount(fileCount)}</span>
        </button>
      </div>
      <ul>
        {group.files.map((file) => (
          <TreeFileNode
            key={file.id}
            file={file}
            genreId={genreId}
            groupLabel={group.label}
            active={selection.level === 'file' && selection.fileId === file.id}
            pending={pending[file.id] ?? false}
            onSelect={onSelect}
            onSetFileRag={onSetFileRag}
          />
        ))}
      </ul>
    </li>
  )
}

type TreeGenreNodeProps = {
  genre: RagTreeGenre
  collapsedKeys: Set<string>
  selection: RagTreeSelection
  pending: Record<string, boolean>
  onToggleCollapsed: (key: string) => void
  onSelect: RagTreePanelProps['onSelect']
  onSetFileRag: RagTreePanelProps['onSetFileRag']
  onCascade: (files: RagTreeFile[], enabled: boolean) => void
}

function TreeGenreNode ({
  genre,
  collapsedKeys,
  selection,
  pending,
  onToggleCollapsed,
  onSelect,
  onSetFileRag,
  onCascade
}: TreeGenreNodeProps) {
  const nodeKey = `genre:${genre.id}`
  const collapsed = collapsedKeys.has(nodeKey)
  const active = selectionActiveKey(selection) === nodeKey
  const allFiles = useMemo(() => collectDescendantFiles(genre), [genre])
  const fileCount = countFilesInNode(genre)
  const checkState = computeCheckState(allFiles, pending)

  return (
    <li className={`rag-tree-node rag-tree-expandable${collapsed ? ' collapsed' : ''}`}>
      <div className={`rag-tree-item${active ? ' active' : ''}`}>
        <label className="rag-tree-check-wrap" title="㋹ 配下を一括選択">
          <input
            type="checkbox"
            className="rag-tree-check"
            checked={checkState.checked}
            disabled={checkState.disabled}
            ref={(el) => {
              if (el) el.indeterminate = checkState.indeterminate
            }}
            onChange={(e) => {
              e.stopPropagation()
              onCascade(allFiles, e.target.checked)
            }}
          />
        </label>
        <button
          type="button"
          className="rag-tree-btn"
          data-rag-genre={genre.id}
          aria-expanded={!collapsed}
          onClick={() => {
            onToggleCollapsed(nodeKey)
            onSelect({ level: 'genre', genreId: genre.id })
          }}
        >
          <span className="chev">{collapsed ? '▸' : '▼'}</span>
          <span className="rag-tree-label">{genre.label}</span>
          <span className="rag-tree-count">{toFullWidthCount(fileCount)}</span>
        </button>
      </div>
      <ul>
        {genre.groups.map((group) => (
          <TreeGroupNode
            key={`${genre.id}-${group.id}`}
            group={group}
            genreId={genre.id}
            collapsedKeys={collapsedKeys}
            selection={selection}
            pending={pending}
            onToggleCollapsed={onToggleCollapsed}
            onSelect={onSelect}
            onSetFileRag={onSetFileRag}
            onCascade={onCascade}
          />
        ))}
      </ul>
    </li>
  )
}

export function RagTreePanel ({
  genres,
  pending,
  selection,
  onSelect,
  onSetFileRag
}: RagTreePanelProps) {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set())

  const toggleCollapsed = useCallback((key: string) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const onCascade = useCallback((files: RagTreeFile[], enabled: boolean) => {
    for (const file of files) {
      if (fileCheckDisabled(file, pending[file.id] ?? false)) continue
      if (file.rag_enabled === enabled) continue
      onSetFileRag(file, enabled)
    }
  }, [onSetFileRag, pending])

  if (genres.length === 0) {
    return (
      <div className="rag-tree-panel">
        <div className="rag-tree-head">RAGの体系管理</div>
        <p className="ai-history-empty">ファイルがありません</p>
      </div>
    )
  }

  return (
    <div className="rag-tree-panel">
      <div className="rag-tree-head">RAGの体系管理</div>
      <ul className="rag-tree" id="ragTree">
        {genres.map((genre) => (
          <TreeGenreNode
            key={genre.id}
            genre={genre}
            collapsedKeys={collapsedKeys}
            selection={selection}
            pending={pending}
            onToggleCollapsed={toggleCollapsed}
            onSelect={onSelect}
            onSetFileRag={onSetFileRag}
            onCascade={onCascade}
          />
        ))}
      </ul>
    </div>
  )
}
