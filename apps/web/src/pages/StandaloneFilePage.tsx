import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ViewingRangeCheckboxGroup } from '../components/ViewingRangeCheckboxGroup'
import { FormGroup } from '../components/form/FormGroup'
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
      <div className="panel register-panel">
        <div className="panel-header">
          <div className="panel-header-title-row">
            <h2>単独ファイル登録</h2>
            <Link className="btn btn-sm" to="/rag">← RAG 管理</Link>
          </div>
          <div className="label-row">
            <span className="label label-default">参照資料</span>
          </div>
        </div>
        <div className="panel-body">
          <p className="rag-register-note">
            ケースに紐づけない参照資料を登録します。登録後は RAG 管理で抽出・有効化を行います。
          </p>

          {error && <p className="error">{error}</p>}

          <div className="form-section">
            <h3>基本情報</h3>
            <div className="form-grid">
              <FormGroup label="細部 / 表題" required wide>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="資料の表題" />
              </FormGroup>
              <FormGroup label="タグ（カンマ区切り）" wide>
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="参考, 条例" />
              </FormGroup>
            </div>
          </div>

          <div className="form-section">
            <h3>取扱・閲覧</h3>
            <FormGroup label="閲覧範囲" required wide>
              <ViewingRangeCheckboxGroup
                options={viewingRanges}
                value={viewingRangeIds}
                onChange={setViewingRangeIds}
                disabled={loading}
              />
            </FormGroup>
          </div>

          <div className="form-section">
            <h3>ファイル</h3>
            <FormGroup label="アップロード" required wide>
              <label className="upload-zone">
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {file ? file.name : 'クリックまたはドラッグでファイルを選択'}
              </label>
            </FormGroup>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => void onSubmit()} disabled={loading}>
              {loading ? '登録中…' : '登録する'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
