import { useEffect, useRef, useState } from 'react'

import { apiFetch, type MasterItem } from '../../lib/api'
import { MasterDeactivateDialog } from './MasterDeactivateDialog'

const AUTOSAVE_MS = 600

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type MasterValueListProps = {
  masterKey: string
  label: string
  items: MasterItem[]
  onChange: (items: MasterItem[]) => void
  onError: (message: string | null) => void
}

/** 1 マスタ種別の候補リスト（名称編集は debounce オートセーブ） */
export function MasterValueList ({
  masterKey,
  label,
  items,
  onChange,
  onError
}: MasterValueListProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [statusById, setStatusById] = useState<Record<string, SaveStatus>>({})
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const item of items) {
        if (!(item.id in next)) {
          next[item.id] = item.name
        }
      }
      for (const id of Object.keys(next)) {
        if (!items.some((item) => item.id === id)) {
          delete next[id]
        }
      }
      return next
    })
  }, [items])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const id of Object.keys(timers)) {
        clearTimeout(timers[id])
      }
    }
  }, [])

  function setStatus (id: string, status: SaveStatus) {
    setStatusById((prev) => ({ ...prev, [id]: status }))
  }

  async function persistName (id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) {
      setStatus(id, 'error')
      onError(`${label} の名称を空にできません`)
      return
    }
    const original = itemsRef.current.find((item) => item.id === id)?.name
    if (trimmed === original?.trim()) {
      setStatus(id, 'idle')
      return
    }

    setStatus(id, 'saving')
    onError(null)
    try {
      const updated = await apiFetch<MasterItem>(`/api/masters/${masterKey}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed })
      })
      onChange(itemsRef.current.map((item) => (item.id === id ? { ...item, name: updated.name } : item)))
      setStatus(id, 'saved')
      window.setTimeout(() => {
        setStatusById((prev) => (prev[id] === 'saved' ? { ...prev, [id]: 'idle' } : prev))
      }, 1500)
    } catch (e) {
      setStatus(id, 'error')
      onError(e instanceof Error ? e.message : `${label} の保存に失敗しました`)
    }
  }

  function scheduleSave (id: string, name: string) {
    clearTimeout(timersRef.current[id])
    timersRef.current[id] = setTimeout(() => {
      void persistName(id, name)
    }, AUTOSAVE_MS)
  }

  function handleNameChange (id: string, value: string) {
    setDrafts((prev) => ({ ...prev, [id]: value }))
    setStatus(id, 'idle')
    scheduleSave(id, value)
  }

  function handleBlur (id: string) {
    clearTimeout(timersRef.current[id])
    void persistName(id, drafts[id] ?? '')
  }

  async function addValue () {
    const trimmed = newName.trim()
    if (!trimmed || adding) return
    setAdding(true)
    onError(null)
    try {
      const created = await apiFetch<MasterItem>(`/api/masters/${masterKey}`, {
        method: 'POST',
        body: JSON.stringify({ name: trimmed })
      })
      onChange([...itemsRef.current, created])
      setDrafts((prev) => ({ ...prev, [created.id]: created.name }))
      setNewName('')
    } catch (e) {
      onError(e instanceof Error ? e.message : `${label} の追加に失敗しました`)
    } finally {
      setAdding(false)
    }
  }

  async function deactivate (id: string) {
    onError(null)
    setDeleting(true)
    try {
      await apiFetch(`/api/masters/${masterKey}/${id}/deactivate`, { method: 'POST' })
      clearTimeout(timersRef.current[id])
      onChange(itemsRef.current.filter((item) => item.id !== id))
      setPendingDelete(null)
    } catch (e) {
      onError(e instanceof Error ? e.message : `${label} の無効化に失敗しました`)
    } finally {
      setDeleting(false)
    }
  }

  function requestDeactivate (id: string) {
    const name = (drafts[id] ?? itemsRef.current.find((item) => item.id === id)?.name ?? '').trim()
    if (!name) return
    setPendingDelete({ id, name })
  }

  function statusLabel (id: string): string {
    switch (statusById[id]) {
      case 'saving': return '保存中…'
      case 'saved': return '保存済'
      case 'error': return 'エラー'
      default: return ''
    }
  }

  return (
    <div className="master-field-block">
      <div className="master-field-header">
        <h4>{label}</h4>
        <span className="master-field-meta">{items.length} 件</span>
      </div>
      <ul className="master-value-list">
        {items.map((item) => (
          <li key={item.id} className="master-value-row">
            <input
              type="text"
              className="master-value-input"
              value={drafts[item.id] ?? item.name}
              aria-label={`${label} ${item.name}`}
              onChange={(e) => handleNameChange(item.id, e.target.value)}
              onBlur={() => handleBlur(item.id)}
            />
            <span
              className={`master-value-status master-value-status--${statusById[item.id] ?? 'idle'}`}
              aria-live="polite"
            >
              {statusLabel(item.id)}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-danger master-value-remove"
              title="候補を無効化（確認ダイアログが表示されます）"
              onClick={() => requestDeactivate(item.id)}
            >
              削除
            </button>
          </li>
        ))}
      </ul>
      <div className="master-value-add-row">
        <input
          type="text"
          className="master-value-input"
          value={newName}
          placeholder={`${label} を追加…`}
          disabled={adding}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addValue()
          }}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={adding || !newName.trim()}
          onClick={() => void addValue()}
        >
          + 追加
        </button>
      </div>

      <MasterDeactivateDialog
        open={pendingDelete != null}
        fieldLabel={label}
        valueName={pendingDelete?.name ?? ''}
        pending={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
        onConfirm={() => {
          if (pendingDelete) void deactivate(pendingDelete.id)
        }}
      />
    </div>
  )
}
