import { Link } from 'react-router-dom'
import { getUserId, setUserId } from '../lib/api'
import { useState } from 'react'

export function HomePage () {
  const [userId, setUserIdState] = useState(getUserId())

  return (
    <section className="page">
      <h2>ホーム</h2>
      <p>AISSS M2 実装 — ケース登録・検索・マスタ・監査 API に接続済みです。</p>
      <ul className="home-links">
        <li><Link to="/search">ケース検索</Link></li>
        <li><Link to="/register">ケース登録</Link></li>
        <li><Link to="/masters">マスタ管理</Link></li>
        <li><Link to="/audit">監査ログ</Link>（管理者）</li>
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
        <p className="hint">管理者: 00000000-0000-4000-8000-000000000001 / 分析担当: …000002</p>
      </div>
    </section>
  )
}
