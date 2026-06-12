import { useCallback, useEffect, useMemo, useState } from 'react'

import { MasterPageSection } from '../components/masters/MasterPageSection'
import { collectMasterKeys, MASTER_PAGES } from '../lib/master-catalog'
import { apiFetch, type MasterItem } from '../lib/api'

export function MastersPage () {
  const masterKeys = useMemo(() => collectMasterKeys(), [])
  const [masters, setMasters] = useState<Record<string, MasterItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const entries = await Promise.all(
        masterKeys.map(async (key) => {
          const data = await apiFetch<{ items: MasterItem[] }>(`/api/masters/${key}`)
          return [key, data.items] as const
        })
      )
      setMasters(Object.fromEntries(entries))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'マスタの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [masterKeys])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleMasterChange = useCallback((key: string, items: MasterItem[]) => {
    setMasters((prev) => ({ ...prev, [key]: items }))
  }, [])

  const totalItems = useMemo(
    () => masterKeys.reduce((sum, key) => sum + (masters[key]?.length ?? 0), 0),
    [masterKeys, masters]
  )

  return (
    <section className="view active" id="view-masters">
      <div className="stats">
        <div className="stat-card">
          <div className="num">{masterKeys.length}</div>
          <div className="lbl">マスタ種別</div>
        </div>
        <div className="stat-card">
          <div className="num">{loading ? '…' : totalItems}</div>
          <div className="lbl">有効候補（合計）</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>マスタ管理</h2>
          <button type="button" className="btn btn-sm" disabled={loading} onClick={() => void loadAll()}>
            再読み込み
          </button>
        </div>
        <div className="panel-body">
          <p className="rag-register-note">
            各画面の select / チェックボックス候補を編集します。名称の変更は入力後に自動保存されます。
            <strong>閲覧範囲</strong>は参照資料登録・RAG 管理・ユーザー・グループ管理でも同一候補を参照するため、ここで一元管理します。
            既存ケース・参照資料に紐づく値の名称変更は履歴表示に影響する場合があります。
          </p>

          {error && <p className="error">{error}</p>}
          {loading && <p className="meta">読み込み中…</p>}

          {!loading && MASTER_PAGES.map((page) => (
            <MasterPageSection
              key={page.id}
              page={page}
              masters={masters}
              onMasterChange={handleMasterChange}
              onError={setError}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
