import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AttachmentPanel } from '../components/AttachmentPanel'
import { apiFetch, type CaseDetail } from '../lib/api'

function joinedBody (c: CaseDetail): string {
  const sections = [
    ['1 要約', c.body_summary],
    ['2 記事', c.body_article],
    ['3 所見（分析・評価）', c.body_assessment],
    ['4 その他参考事項', c.body_reference]
  ]
  return sections
    .filter(([, text]) => text?.trim())
    .map(([heading, text]) => `## ${heading}\n\n${text}`)
    .join('\n\n')
}

export function CaseDetailPage () {
  const { displayId } = useParams<{ displayId: string }>()
  const [item, setItem] = useState<CaseDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!displayId) return
    void apiFetch<CaseDetail>(`/api/cases/by-display-id/${displayId}`)
      .then(setItem)
      .catch((e: Error) => setError(e.message))
  }, [displayId])

  if (error) return <p className="error">{error}</p>
  if (!item) return <p>読み込み中…</p>

  return (
    <section className="page case-detail">
      <div className="detail-header">
        <h2>{item.title}</h2>
        <div className="detail-actions">
          <Link to={`/register?edit=${item.display_id}`}>編集</Link>
        </div>
      </div>
      <dl className="meta-grid">
        <dt>表示 ID</dt><dd>{item.display_id}</dd>
        <dt>資料番号</dt><dd>{item.material_number ?? '—'}</dd>
        <dt>資料区分</dt><dd>{item.material_type_name ?? '—'}</dd>
        <dt>登録部署</dt><dd>{item.department_name ?? '—'}</dd>
        <dt>ランク</dt><dd>{item.rank_name ?? '—'}</dd>
        <dt>閲覧範囲</dt>
        <dd>{item.viewing_ranges?.map((v) => v.name).join(', ') || '—'}</dd>
      </dl>
      <h3>本文</h3>
      <pre className="joined-body">{joinedBody(item)}</pre>
      <AttachmentPanel caseId={item.id} initial={item.attachments} />
    </section>
  )
}
