import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch, downloadAttachment, type CaseDetail } from '../lib/api'

const bodySections: Array<[string, keyof CaseDetail]> = [
  ['1 要約', 'body_summary'],
  ['2 記事', 'body_article'],
  ['3 所見（分析・評価）', 'body_assessment'],
  ['4 その他参考事項', 'body_reference']
]

export function CaseDetailPage () {
  const { displayId } = useParams<{ displayId: string }>()
  const [item, setItem] = useState<CaseDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (!displayId) return
    void apiFetch<CaseDetail>(`/api/cases/by-display-id/${displayId}`)
      .then(setItem)
      .catch((e: Error) => setError(e.message))
  }, [displayId])

  if (error) return <p className="error">{error}</p>
  if (!item) return <p>読み込み中…</p>

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h1>{item.title}</h1>
          <span className="mono">{item.display_id} · {item.material_number ?? '—'}</span>
        </div>
        <div className="header-actions">
          <Link className="btn btn-sm" to="/search">← 検索に戻る</Link>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => window.open(`/cases/${item.display_id}`, '_blank')}
          >
            別タブで開く
          </button>
          <Link className="btn btn-sm btn-primary" to={`/register?edit=${item.display_id}`}>
            編集
          </Link>
        </div>
        <div className="label-row">
          {item.rank_name && <span className="label label-purple">{item.rank_name}</span>}
          {item.viewing_ranges?.map((v) => (
            <span key={v.id} className="label label-default">{v.name}</span>
          ))}
        </div>
      </div>
      <div className="panel-body">
        <dl className="detail-meta">
          <dt>資料区分</dt><dd>{item.material_type_name ?? '—'}</dd>
          <dt>登録部署</dt><dd>{item.department_name ?? '—'}</dd>
          <dt>事象発生</dt>
          <dd>
            {item.event_start_date?.slice(0, 10) ?? '—'}
            {item.event_end_date ? ` 〜 ${item.event_end_date.slice(0, 10)}` : ''}
          </dd>
          <dt>閲覧範囲</dt>
          <dd>{item.viewing_ranges?.map((v) => v.name).join(', ') || '—'}</dd>
        </dl>

        <h3 className="section-title">本文（結合表示）</h3>
        <div>
          {bodySections.map(([heading, key]) => {
            const text = item[key] as string | undefined
            if (!text?.trim()) return null
            return (
              <div key={heading} className="body-block">
                <h4>{heading}</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
              </div>
            )
          })}
        </div>

        <h3 className="section-title">添付ファイル</h3>
        <ul className="attach-list">
          {(item.attachments ?? []).length === 0 && (
            <li><span className="meta">添付なし</span></li>
          )}
          {(item.attachments ?? []).map((att) => (
            <li key={att.id}>
              <span>{att.file_name}</span>
              <span>
                <span className="label label-info">{att.extraction_status}</span>
                {' '}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setDownloadError(null)
                    void downloadAttachment(att.id, att.file_name).catch((e: Error) => setDownloadError(e.message))
                  }}
                >
                  ダウンロード
                </button>
              </span>
            </li>
          ))}
        </ul>
        {downloadError && <p className="error">{downloadError}</p>}

        <p className="compare-hint">
          2件比較: 検索画面に戻り、別の表題を開く。別タブが使えない環境では Ctrl+クリック（Mac: ⌘+クリック）をお試しください。
        </p>
      </div>
    </div>
  )
}
