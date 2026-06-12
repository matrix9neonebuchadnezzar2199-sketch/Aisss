import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AttachmentPanel } from '../components/AttachmentPanel'
import { ExcelImportPanel } from '../components/ExcelImportPanel'
import { FormGroup } from '../components/form/FormGroup'
import { MasterSelect } from '../components/form/MasterSelect'
import { ViewingRangeCheckboxGroup } from '../components/ViewingRangeCheckboxGroup'
import {
  caseDetailToForm,
  caseFormToPayload,
  emptyCaseForm,
  isFormFieldEmpty,
  type CaseFormState
} from '../lib/case-form'
import { apiFetch, type CaseDetail, type MasterItem } from '../lib/api'
import { caseMasterKeys } from '../lib/master-catalog'

export function RegisterPage () {
  const [params] = useSearchParams()
  const editDisplayId = params.get('edit')
  const navigate = useNavigate()
  const [form, setForm] = useState<CaseFormState>(emptyCaseForm)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [masters, setMasters] = useState<Record<string, MasterItem[]>>({})

  useEffect(() => {
    const paths = caseMasterKeys()
    void Promise.all(
      paths.map((p) => apiFetch<{ items: MasterItem[] }>(`/api/masters/${p}`).then((d) => [p, d.items] as const))
    ).then((entries) => {
      setMasters(Object.fromEntries(entries))
    }).catch((e: Error) => setError(`マスタの取得に失敗しました: ${e.message}`))
  }, [])

  useEffect(() => {
    if (!editDisplayId) return
    void apiFetch<CaseDetail>(`/api/cases/by-display-id/${editDisplayId}`)
      .then((c) => {
        setCaseId(c.id)
        setForm(caseDetailToForm(c as unknown as Record<string, unknown>))
      })
      .catch((e: Error) => setError(e.message))
  }, [editDisplayId])

  function update<K extends keyof CaseFormState> (key: K, value: CaseFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit () {
    setSaving(true)
    setError(null)
    try {
      if (form.viewing_range_ids.length === 0) {
        setError('閲覧範囲を1つ以上選択してください。')
        return
      }
      const payload = caseFormToPayload(form)
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

  const m = (key: string) => masters[key] ?? []

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
              <FormGroup label="表題" required empty={isFormFieldEmpty(form.title)}>
                <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="資料の表題" required />
              </FormGroup>
              <FormGroup label="資料番号" empty={isFormFieldEmpty(form.material_number)}>
                <input value={form.material_number} onChange={(e) => update('material_number', e.target.value)} />
              </FormGroup>
              <FormGroup label="分類番号" empty={isFormFieldEmpty(form.classification_number)}>
                <input value={form.classification_number} onChange={(e) => update('classification_number', e.target.value)} />
              </FormGroup>
              <FormGroup label="資料区分" empty={isFormFieldEmpty(form.material_type_id)}>
                <MasterSelect value={form.material_type_id} options={m('material-types')} onChange={(v) => update('material_type_id', v)} />
              </FormGroup>
            </div>
            <FormGroup label="要約" wide empty={isFormFieldEmpty(form.summary)}>
              <textarea rows={2} value={form.summary} onChange={(e) => update('summary', e.target.value)} />
            </FormGroup>
            <FormGroup label="キーワード（カンマ区切り）" wide empty={isFormFieldEmpty(form.keyword_names_text)}>
              <input value={form.keyword_names_text} onChange={(e) => update('keyword_names_text', e.target.value)} placeholder="例: 東アジア, 貿易" />
            </FormGroup>
          </div>

          <div className="form-section">
            <h3>事象・出所</h3>
            <div className="form-grid">
              <FormGroup label="事象発生（開始）" empty={isFormFieldEmpty(form.event_start_date)}>
                <input type="date" value={form.event_start_date} onChange={(e) => update('event_start_date', e.target.value)} />
              </FormGroup>
              <FormGroup label="事象発生（終了）" empty={isFormFieldEmpty(form.event_end_date)}>
                <input type="date" value={form.event_end_date} onChange={(e) => update('event_end_date', e.target.value)} />
              </FormGroup>
              <FormGroup label="分類" empty={isFormFieldEmpty(form.category_id)}>
                <MasterSelect value={form.category_id} options={m('categories')} onChange={(v) => update('category_id', v)} />
              </FormGroup>
              <FormGroup label="地域" empty={isFormFieldEmpty(form.region_id)}>
                <MasterSelect value={form.region_id} options={m('regions')} onChange={(v) => update('region_id', v)} />
              </FormGroup>
              <FormGroup label="資料源" empty={isFormFieldEmpty(form.source_id)}>
                <MasterSelect value={form.source_id} options={m('sources')} onChange={(v) => update('source_id', v)} />
              </FormGroup>
              <FormGroup label="登録部署" empty={isFormFieldEmpty(form.registering_department_id)}>
                <MasterSelect value={form.registering_department_id} options={m('departments')} onChange={(v) => update('registering_department_id', v)} />
              </FormGroup>
              <FormGroup label="資料登録者" empty={isFormFieldEmpty(form.registrant_id)}>
                <MasterSelect value={form.registrant_id} options={m('persons')} onChange={(v) => update('registrant_id', v)} />
              </FormGroup>
              <FormGroup label="情報入手場所" empty={isFormFieldEmpty(form.acquisition_location_id)}>
                <MasterSelect value={form.acquisition_location_id} options={m('acquisition-locations')} onChange={(v) => update('acquisition_location_id', v)} />
              </FormGroup>
              <FormGroup label="対応情報要求" empty={isFormFieldEmpty(form.information_request_id)}>
                <MasterSelect value={form.information_request_id} options={m('information-requests')} onChange={(v) => update('information_request_id', v)} />
              </FormGroup>
            </div>
            <FormGroup label="情報収集者" wide empty={isFormFieldEmpty(form.collector_person_ids)}>
              <ViewingRangeCheckboxGroup
                options={m('persons')}
                value={form.collector_person_ids}
                onChange={(ids) => update('collector_person_ids', ids)}
                disabled={saving}
              />
            </FormGroup>
          </div>

          <div className="form-section">
            <h3>取扱・閲覧・評価</h3>
            <div className="form-grid">
              <FormGroup label="取扱区分" empty={isFormFieldEmpty(form.handling_type_id)}>
                <MasterSelect value={form.handling_type_id} options={m('handling-types')} onChange={(v) => update('handling_type_id', v)} />
              </FormGroup>
              <FormGroup label="信頼性" empty={isFormFieldEmpty(form.reliability_id)}>
                <MasterSelect value={form.reliability_id} options={m('reliability-levels')} onChange={(v) => update('reliability_id', v)} />
              </FormGroup>
              <FormGroup label="正確性" empty={isFormFieldEmpty(form.accuracy_id)}>
                <MasterSelect value={form.accuracy_id} options={m('accuracy-levels')} onChange={(v) => update('accuracy_id', v)} />
              </FormGroup>
              <FormGroup label="ランク" empty={isFormFieldEmpty(form.rank_id)}>
                <MasterSelect value={form.rank_id} options={m('rank-levels')} onChange={(v) => update('rank_id', v)} />
              </FormGroup>
              <FormGroup label="保存期間" empty={isFormFieldEmpty(form.retention_policy_id)}>
                <MasterSelect value={form.retention_policy_id} options={m('retention-policies')} onChange={(v) => update('retention_policy_id', v)} />
              </FormGroup>
            </div>
            <FormGroup label="閲覧範囲" required wide empty={isFormFieldEmpty(form.viewing_range_ids)}>
              <ViewingRangeCheckboxGroup
                options={m('viewing-ranges')}
                value={form.viewing_range_ids}
                onChange={(ids) => update('viewing_range_ids', ids)}
                disabled={saving}
              />
            </FormGroup>
            <FormGroup label="閲覧範囲（直接入力）" wide empty={isFormFieldEmpty(form.viewing_range_note)}>
              <input value={form.viewing_range_note} onChange={(e) => update('viewing_range_note', e.target.value)} />
            </FormGroup>
            <FormGroup label="条件" wide empty={isFormFieldEmpty(form.condition_ids)}>
              <ViewingRangeCheckboxGroup
                options={m('conditions')}
                value={form.condition_ids}
                onChange={(ids) => update('condition_ids', ids)}
                disabled={saving}
              />
            </FormGroup>
            <FormGroup label="条件（その他）" wide empty={isFormFieldEmpty(form.condition_notes)}>
              <textarea rows={2} value={form.condition_notes} onChange={(e) => update('condition_notes', e.target.value)} />
            </FormGroup>
            <FormGroup label="処置" wide empty={isFormFieldEmpty(form.action_taken)}>
              <textarea rows={2} value={form.action_taken} onChange={(e) => update('action_taken', e.target.value)} />
            </FormGroup>
          </div>

          <div className="form-section">
            <h3>備考</h3>
            <div className="form-grid">
              {([1, 2, 3, 4, 5, 6] as const).map((n) => {
                const key = `note_${n}` as keyof CaseFormState
                return (
                  <FormGroup key={n} label={`備考${n}`} empty={isFormFieldEmpty(form[key] as string)}>
                    <input value={form[key] as string} onChange={(e) => update(key, e.target.value)} />
                  </FormGroup>
                )
              })}
            </div>
          </div>

          <div className="form-section">
            <h3>本文（登録時は分割、表示時は結合）</h3>
            <div className="form-body-stack">
              <FormGroup label="1 要約" empty={isFormFieldEmpty(form.body_summary)}>
                <textarea rows={3} value={form.body_summary} onChange={(e) => update('body_summary', e.target.value)} />
              </FormGroup>
              <FormGroup label="2 記事" empty={isFormFieldEmpty(form.body_article)}>
                <textarea rows={8} value={form.body_article} onChange={(e) => update('body_article', e.target.value)} />
              </FormGroup>
              <FormGroup label="3 所見" empty={isFormFieldEmpty(form.body_assessment)}>
                <textarea rows={3} value={form.body_assessment} onChange={(e) => update('body_assessment', e.target.value)} />
              </FormGroup>
              <FormGroup label="4 その他参考事項" empty={isFormFieldEmpty(form.body_reference)}>
                <textarea rows={3} value={form.body_reference} onChange={(e) => update('body_reference', e.target.value)} />
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
              <Link className="btn" to={`/cases/${editDisplayId}`} target="_blank" rel="noopener noreferrer">キャンセル</Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
