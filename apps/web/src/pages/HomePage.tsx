import { Link } from 'react-router-dom'
import { getUserId, setUserId } from '../lib/api'
import { useState } from 'react'

export function HomePage () {
  const [userId, setUserIdState] = useState(getUserId())

  return (
    <section className="page">
      <h2>ホーム</h2>
      <p>AISSS M7 実装 — ケース管理、添付・抽出、Excel、RAG、運用監視、パイロット準備まで接続済みです。</p>
      <ul className="home-links">
        <li><Link to="/search">ケース検索</Link></li>
        <li><Link to="/register">ケース登録</Link></li>
        <li><Link to="/masters">マスタ管理</Link></li>
        <li><Link to="/audit">監査ログ</Link>（管理者）</li>
        <li><Link to="/jobs">ジョブ状態</Link>（運用者）</li>
        <li><Link to="/admin">管理ダッシュボード</Link></li>
        <li><Link to="/pilot">本番パイロット</Link></li>
        <li><a href="/mockups/webui.html" target="_blank" rel="noopener noreferrer">HTML モック</a></li>
      </ul>
      <div className="dev-user">
        <label>開発ユーザー ID（X-AISSS-User-Id）
          <input
            value={userId}
            onChange={(e) => setUserIdState(e.target.value)}
            onBlur={() => setUserId(userId)}
          />
        </label>
        <p className="hint">管理者: 00000000-0000-4000-8000-000000000001 / 分析担当: …000002 / パイロット: …000003</p>
      </div>
    </section>
  )
}
