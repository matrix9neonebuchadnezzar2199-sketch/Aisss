import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AttachmentPanel } from '../components/AttachmentPanel'
import { ExcelImportPanel } from '../components/ExcelImportPanel'
import { ViewingRangeCheckboxGroup } from '../components/ViewingRangeCheckboxGroup'
import { FormGroup } from '../components/form/FormGroup'
import { apiFetch, type CaseDetail, type MasterItem } from '../lib/api'

const emptyForm = {
  title: '',
  material_number: '',
  summary: '',
  body_summary: '',
  body_article: '',
  body_assessment: '',
  body_reference: '',
  event_start_date: '',
  event_end_date: '',
  material_type_id: '',
  registering_department_id: '',
  rank_id: '',
  viewing_range_ids: [] as string[]
}

export function RegisterPage () {
  const [params] = useSearchParams()
  const editDisplayId = params.get('edit')
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [materialTypes, setMaterialTypes] = useState<MasterItem[]>([])
  const [departments, setDepartments] = useState<MasterItem[]>([])
  const [ranks, setRanks] = useState<MasterItem[]>([])
  const [viewingRanges, setViewingRanges] = useState<MasterItem[]>([])

  useEffect(() => {
    void Promise.all([
      apiFetch<{ items: MasterItem[] }>('/api/masters/material-types'),
      apiFetch<{ items: MasterItem[] }>('/api/masters/departments'),
      apiFetch<{ items: MasterItem[] }>('/api/masters/rank-levels'),
      apiFetch<{ items: MasterItem[] }>('/api/masters/viewing-ranges')
    ]).then(([mt, dept, rank, vr]) => {
      setMaterialTypes(mt.items)
      setDepartments(dept.items)
      setRanks(rank.items)
      setViewingRanges(vr.items)
    }).catch((e: Error) => setError(`マスタの取得に失敗しました: ${e.message}`))
  }, [])

  useEffect(() => {
    if (!editDisplayId) return
    void apiFetch<CaseDetail>(`/api/cases/by-display-id/${editDisplayId}`)
      .then((c) => {
        setCaseId(c.id)
        setForm({
          title: c.title ?? '',
          material_number: c.material_number ?? '',
          summary: c.summary ?? '',
          body_summary: c.body_summary ?? '',
          body_article: c.body_article ?? '',
          body_assessment: c.body_assessment ?? '',
          body_reference: c.body_reference ?? '',
          event_start_date: c.event_start_date?.slice(0, 10) ?? '',
          event_end_date: c.event_end_date?.slice(0, 10) ?? '',
          material_type_id: c.material_type_id ?? '',
          registering_department_id: c.registering_department_id ?? '',
          rank_id: c.rank_id ?? '',
          viewing_range_ids: c.viewing_ranges?.map((v) => v.id) ?? []
        })
      })
      .catch((e: Error) => setError(e.message))
  }, [editDisplayId])

  function update (key: keyof typeof form, value: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit () {
    setSaving(true)
    setError(null)
    try {
      if (form.viewing_range_ids.length === 0) {
        setError('閲覧範囲を1つ以上選択してください。全員公開や管理者のみの場合も明示的に選択してください。')
        return
      }
      const payload = {
        ...form,
        material_type_id: form.material_type_id || null,
        registering_department_id: form.registering_department_id || null,
        rank_id: form.rank_id || null,
        event_start_date: form.event_start_date || null,
        event_end_date: form.event_end_date || null
      }
      if (caseId) {
        const updated = await apiFetch<CaseDetail>(`/api/cases/${caseId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        })
        window.open(`/cases/${updated.display_id}`, '_blank')
        navigate('/search')
      } else {
        const created = await apiFetch<CaseDetail>('/api/cases', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        window.open(`/cases/${created.display_id}`, '_blank')
        navigate('/search')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="view active" id="view-register">
      <div className="panel register-panel">
        <div className="panel-header">
          <div className="panel-header-title-row">
            <h2>{caseId ? `ケース（事象）編集 · ${editDisplayId}` : 'ケース（事象）登録'}</h2>
          </div>
          <div className="label-row">
            <span className={`label ${caseId ? 'label-info' : 'label-default'}`}>
              {caseId ? '編集モード' : '新規登録'}
            </span>
          </div>
          {caseId && (
            <p className="rag-register-note register-edit-banner">
              既存ケースの<strong>上書き更新</strong>です。保存後、詳細を新しいタブで開きます。
            </p>
          )}
        </div>

        <div className="panel-body">
          {error && <p className="error">{error}</p>}

          {!caseId && (
            <div className="form-section form-section-excel">
              <h3>Excel 一括取り込み</h3>
              <ExcelImportPanel embedded />
            </div>
          )}

          <div className="form-section">
            <h3>基本情報</h3>
            <div className="form-grid">
              <FormGroup label="表題" required>
                <input
                  id="field-title"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="資料の表題"
                  required
                />
              </FormGroup>
              <FormGroup label="資料番号">
                <input
                  id="field-material-number"
                  value={form.material_number}
                  onChange={(e) => update('material_number', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="資料区分">
                <select
                  id="field-material-type"
                  value={form.material_type_id}
                  onChange={(e) => update('material_type_id', e.target.value)}
                >
                  <option value="">—</option>
                  {materialTypes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </FormGroup>
            </div>
            <FormGroup label="要約" wide>
              <textarea
                id="field-summary"
                rows={2}
                value={form.summary}
                onChange={(e) => update('summary', e.target.value)}
              />
            </FormGroup>
          </div>

          <div className="form-section">
            <h3>事象・出所</h3>
            <div className="form-grid">
              <FormGroup label="事象発生（開始）">
                <input
                  type="date"
                  id="field-event-start"
                  value={form.event_start_date}
                  onChange={(e) => update('event_start_date', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="事象発生（終了）">
                <input
                  type="date"
                  id="field-event-end"
                  value={form.event_end_date}
                  onChange={(e) => update('event_end_date', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="登録部署">
                <select
                  id="field-department"
                  value={form.registering_department_id}
                  onChange={(e) => update('registering_department_id', e.target.value)}
                >
                  <option value="">—</option>
                  {departments.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="ランク">
                <select
                  id="field-rank"
                  value={form.rank_id}
                  onChange={(e) => update('rank_id', e.target.value)}
                >
                  <option value="">—</option>
                  {ranks.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </FormGroup>
            </div>
          </div>

          <div className="form-section">
            <h3>取扱・閲覧</h3>
            <FormGroup label="閲覧範囲" required wide>
              <ViewingRangeCheckboxGroup
                id="field-viewing-range"
                options={viewingRanges}
                value={form.viewing_range_ids}
                onChange={(ids) => update('viewing_range_ids', ids)}
                disabled={saving}
              />
              <p className="rag-register-note">
                1つ以上チェックしてください。「全員」「管理者のみ」も必要に応じて明示的に選びます。
              </p>
            </FormGroup>
          </div>

          <div className="form-section">
            <h3>本文（登録時は分割、表示時は結合）</h3>
            <div className="form-body-stack">
              <FormGroup label="1 要約">
                <textarea
                  id="field-body-summary"
                  rows={3}
                  value={form.body_summary}
                  onChange={(e) => update('body_summary', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="2 記事">
                <textarea
                  id="field-body-article"
                  rows={8}
                  value={form.body_article}
                  onChange={(e) => update('body_article', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="3 所見">
                <textarea
                  id="field-body-assessment"
                  rows={3}
                  value={form.body_assessment}
                  onChange={(e) => update('body_assessment', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="4 その他参考事項">
                <textarea
                  id="field-body-reference"
                  rows={3}
                  value={form.body_reference}
                  onChange={(e) => update('body_reference', e.target.value)}
                />
              </FormGroup>
            </div>
          </div>

          {caseId && (
            <div className="form-section">
              <h3>添付</h3>
              <AttachmentPanel caseId={caseId} />
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
              {caseId ? '更新する' : '登録する'}
            </button>
            {editDisplayId && (
              <Link className="btn" to={`/cases/${editDisplayId}`} target="_blank" rel="noopener noreferrer">
                キャンセル
              </Link>
            )}
          </div>

          {!caseId && (
            <p className="rag-register-note register-attach-hint">
              添付ファイルは登録後（編集モード）または詳細画面からアップロードできます。
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
