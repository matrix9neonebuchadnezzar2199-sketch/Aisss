import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, uploadStandaloneFile, type MasterItem } from '../lib/api'

export function StandaloneFilePage () {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [viewingRangeIds, setViewingRangeIds] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [viewingRanges, setViewingRanges] = useState<MasterItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void apiFetch<{ items: MasterItem[] }>('/api/masters/viewing-ranges')
      .then((d) => setViewingRanges(d.items))
      .catch((e: Error) => setError(e.message))
  }, [])

  async function onSubmit () {
    if (!title.trim() || viewingRangeIds.length === 0 || !file) {
      setError('表題、閲覧範囲、ファイルは必須です')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await uploadStandaloneFile({
        title: title.trim(),
        viewingRangeIds,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        file
      })
      navigate('/rag')
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="view active" id="view-standalone-file">
      <div className="panel">
        <div className="panel-header">
          <h2>単独ファイル登録</h2>
          <Link className="btn btn-sm" to="/rag">← RAG 管理</Link>
        </div>
        <div className="panel-body">
          <div className="form-grid">
            <label className="full">細部 / 表題
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="full">タグ（カンマ区切り）
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="参考, 条例" />
            </label>
            <label className="full">閲覧範囲（複数選択可）
              <select
                multiple
                value={viewingRangeIds}
                onChange={(e) => setViewingRangeIds(Array.from(e.target.selectedOptions, (o) => o.value))}
              >
                {viewingRanges.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label className="full upload-zone">
              ファイル
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn btn-primary" onClick={() => void onSubmit()} disabled={loading}>
            {loading ? '登録中…' : '登録する'}
          </button>
        </div>
      </div>
    </section>
  )
}
