import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

type AuditRow = {
  id: string
  action: string
  case_display_id?: string
  user_name?: string
  created_at: string
}

export function AuditPage () {
  const [items, setItems] = useState<AuditRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void apiFetch<{ items: AuditRow[] }>('/api/audit-logs')
      .then((d) => setItems(d.items))
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <section className="page">
      <h2>監査ログ</h2>
      {error && <p className="error">{error}</p>}
      <table className="data-table">
        <thead>
          <tr><th>日時</th><th>ユーザー</th><th>アクション</th><th>ケース</th></tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>{row.created_at?.slice(0, 19).replace('T', ' ')}</td>
              <td>{row.user_name ?? '—'}</td>
              <td>{row.action}</td>
              <td>{row.case_display_id ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
