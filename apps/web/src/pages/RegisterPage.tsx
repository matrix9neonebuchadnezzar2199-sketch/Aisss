import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AttachmentPanel } from '../components/AttachmentPanel'
import { ExcelImportPanel } from '../components/ExcelImportPanel'
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
    })
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
          event_end_date: (c as CaseDetail & { event_end_date?: string }).event_end_date?.slice(0, 10) ?? '',
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
        navigate(`/cases/${updated.display_id}`)
      } else {
        const created = await apiFetch<CaseDetail>('/api/cases', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        navigate(`/cases/${created.display_id}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page">
      <h2>{caseId ? 'ケース編集' : 'ケース登録'}</h2>
      {!caseId && <ExcelImportPanel />}
      {error && <p className="error">{error}</p>}

      <div className="form-grid">
        <label>表題 *
          <input value={form.title} onChange={(e) => update('title', e.target.value)} required />
        </label>
        <label>資料番号
          <input value={form.material_number} onChange={(e) => update('material_number', e.target.value)} />
        </label>
        <label>資料区分
          <select value={form.material_type_id} onChange={(e) => update('material_type_id', e.target.value)}>
            <option value="">—</option>
            {materialTypes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label>登録部署
          <select value={form.registering_department_id} onChange={(e) => update('registering_department_id', e.target.value)}>
            <option value="">—</option>
            {departments.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label>ランク
          <select value={form.rank_id} onChange={(e) => update('rank_id', e.target.value)}>
            <option value="">—</option>
            {ranks.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label>事象開始日
          <input type="date" value={form.event_start_date} onChange={(e) => update('event_start_date', e.target.value)} />
        </label>
        <label>事象終了日
          <input type="date" value={form.event_end_date} onChange={(e) => update('event_end_date', e.target.value)} />
        </label>
        <label>閲覧範囲 *
          <select
            multiple
            required
            value={form.viewing_range_ids}
            onChange={(e) => update('viewing_range_ids', Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {viewingRanges.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <span className="hint">必ず1つ以上選択してください。「全員」「管理者のみ」も閲覧範囲として選択します。</span>
        </label>
        <label className="full">要約
          <textarea rows={3} value={form.summary} onChange={(e) => update('summary', e.target.value)} />
        </label>
      </div>

      <div className="form-body-stack">
        <label>1 要約
          <textarea rows={3} value={form.body_summary} onChange={(e) => update('body_summary', e.target.value)} />
        </label>
        <label className="body-article">2 記事
          <textarea rows={8} value={form.body_article} onChange={(e) => update('body_article', e.target.value)} />
        </label>
        <label>3 所見
          <textarea rows={3} value={form.body_assessment} onChange={(e) => update('body_assessment', e.target.value)} />
        </label>
        <label>4 その他参考事項
          <textarea rows={3} value={form.body_reference} onChange={(e) => update('body_reference', e.target.value)} />
        </label>
      </div>

      <button type="button" className="primary" onClick={() => void submit()} disabled={saving}>
        {caseId ? '更新する' : '登録する'}
      </button>

      {caseId && (
        <AttachmentPanel caseId={caseId} />
      )}
      {!caseId && (
        <p className="hint">添付ファイルは登録後（編集モード）または詳細画面からアップロードできます。</p>
      )}
    </section>
  )
}
