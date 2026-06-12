import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { FormGroup } from '../form/FormGroup'
import { ViewingRangeCheckboxGroup } from '../ViewingRangeCheckboxGroup'
import { formatBytes, type FolderFileEntry } from '../../lib/folder-files'
import type { MasterItem } from '../../lib/api'

export type FolderFileDraft = FolderFileEntry & {
  title: string
  viewingRangeIds: string[]
}

type FolderRegisterDialogProps = {
  open: boolean
  folderLabel: string
  drafts: FolderFileDraft[]
  viewingRanges: MasterItem[]
  enableRag: boolean
  pending?: boolean
  progress?: { done: number; total: number } | null
  error?: string | null
  onChangeDrafts: (drafts: FolderFileDraft[]) => void
  onEnableRagChange: (enabled: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

function viewingRangeSummary (ids: string[], options: MasterItem[]): string {
  if (ids.length === 0) return '未設定'
  const names = options.filter((o) => ids.includes(o.id)).map((o) => o.name)
  return names.length > 0 ? names.join('、') : '未設定'
}

export function FolderRegisterDialog ({
  open,
  folderLabel,
  drafts,
  viewingRanges,
  enableRag,
  pending = false,
  progress = null,
  error = null,
  onChangeDrafts,
  onEnableRagChange,
  onCancel,
  onConfirm
}: FolderRegisterDialogProps) {
  const [bulkViewingRangeIds, setBulkViewingRangeIds] = useState<string[]>([])
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [folderTitle, setFolderTitle] = useState(folderLabel)

  useEffect(() => {
    if (!open) return
    const nextTitle = folderLabel.trim() || '参照資料'
    setFolderTitle(nextTitle)
    onChangeDrafts(drafts.map((d) => ({ ...d, title: nextTitle })))
    // ダイアログを開いたときだけフォルダ名で表題を初期化する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folderLabel])

  const invalidCount = useMemo(
    () => drafts.filter((d) => !d.title.trim() || d.viewingRangeIds.length === 0).length,
    [drafts]
  )

  if (!open) return null

  function updateDraft (id: string, patch: Partial<Pick<FolderFileDraft, 'title' | 'viewingRangeIds'>>) {
    onChangeDrafts(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function removeDraft (id: string) {
    onChangeDrafts(drafts.filter((d) => d.id !== id))
    if (expandedRowId === id) setExpandedRowId(null)
  }

  function applyBulkViewingRanges () {
    if (bulkViewingRangeIds.length === 0) return
    onChangeDrafts(drafts.map((d) => ({ ...d, viewingRangeIds: [...bulkViewingRangeIds] })))
  }

  return (
    <div
      className="rag-delete-overlay folder-register-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folderRegisterTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel()
      }}
    >
      <div className="folder-register-dialog">
        <div className="folder-register-header">
          <h3 id="folderRegisterTitle">フォルダ登録 — 閲覧範囲の設定</h3>
          <p className="folder-register-sub">{folderLabel}</p>
          <p className="folder-register-meta">{drafts.length} 件のファイル</p>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="folder-register-title">
          <FormGroup label="細部 / 表題" required wide>
            <input
              value={folderTitle}
              disabled={pending}
              placeholder="フォルダ名"
              onChange={(e) => {
                const nextTitle = e.target.value
                setFolderTitle(nextTitle)
                onChangeDrafts(drafts.map((d) => ({ ...d, title: nextTitle })))
              }}
            />
          </FormGroup>
          <p className="folder-register-title-note">フォルダ内の全ファイルに同じ表題が適用されます。</p>
        </div>

        <div className="folder-register-bulk">
          <h4>一括設定</h4>
          <FormGroupInline label="閲覧範囲（すべてに適用）">
            <ViewingRangeCheckboxGroup
              options={viewingRanges}
              value={bulkViewingRangeIds}
              onChange={setBulkViewingRangeIds}
              disabled={pending}
            />
          </FormGroupInline>
          <button
            type="button"
            className="btn btn-sm"
            disabled={pending || bulkViewingRangeIds.length === 0}
            onClick={applyBulkViewingRanges}
          >
            すべてのファイルに適用
          </button>
        </div>

        <div className="folder-register-table-wrap">
          <table className="folder-register-table">
            <thead>
              <tr>
                <th>パス / ファイル</th>
                <th>細部 / 表題</th>
                <th>サイズ</th>
                <th>閲覧範囲</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {drafts.map((row) => {
                const invalid = !row.title.trim() || row.viewingRangeIds.length === 0
                const expanded = expandedRowId === row.id
                return (
                  <tr key={row.id} className={invalid ? 'folder-row-invalid' : ''}>
                    <td className="folder-path-cell" title={row.relativePath}>
                      {row.relativePath}
                    </td>
                    <td>
                      <input
                        className="folder-title-input"
                        value={row.title}
                        disabled={pending}
                        onChange={(e) => updateDraft(row.id, { title: e.target.value })}
                      />
                    </td>
                    <td className="folder-size-cell">{formatBytes(row.file.size)}</td>
                    <td className="folder-vr-cell">
                      <button
                        type="button"
                        className="btn btn-sm folder-vr-toggle"
                        disabled={pending}
                        onClick={() => setExpandedRowId(expanded ? null : row.id)}
                      >
                        {viewingRangeSummary(row.viewingRangeIds, viewingRanges)}
                      </button>
                      {expanded && (
                        <div className="folder-vr-popover">
                          <ViewingRangeCheckboxGroup
                            options={viewingRanges}
                            value={row.viewingRangeIds}
                            onChange={(ids) => updateDraft(row.id, { viewingRangeIds: ids })}
                            disabled={pending}
                          />
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={pending}
                        onClick={() => removeDraft(row.id)}
                        title="一覧から除外"
                      >
                        除外
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <label className="inline-check folder-rag-check">
          <input
            type="checkbox"
            checked={enableRag}
            disabled={pending}
            onChange={(e) => onEnableRagChange(e.target.checked)}
          />
          登録後に RAG ナレッジ化を有効にする（抽出完了後、自動でベクトル索引へ）
        </label>

        {invalidCount > 0 && !pending && (
          <p className="folder-register-warn">
            表題または閲覧範囲が未設定のファイルが {invalidCount} 件あります。
          </p>
        )}

        {progress && (
          <p className="folder-register-progress">
            登録中… {progress.done} / {progress.total}
          </p>
        )}

        <div className="rag-delete-actions folder-register-actions">
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={pending}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onConfirm}
            disabled={pending || drafts.length === 0 || invalidCount > 0}
          >
            {pending ? '登録中…' : `${drafts.length} 件を登録する`}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormGroupInline ({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="folder-bulk-field">
      <span className="folder-bulk-label">{label}</span>
      {children}
    </div>
  )
}
