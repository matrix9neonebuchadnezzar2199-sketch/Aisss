import type { RagStorageBreakdown, RagStorageCategory } from '../../lib/api'

const CATEGORY_COLORS: Record<RagStorageCategory['id'], string> = {
  case_text: '#388bfd',
  office: '#3fb950',
  pdf: '#f85149',
  audio: '#a371f7',
  image: '#39c5cf'
}

function formatBytes (bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exp
  return `${value >= 100 || exp === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exp]}`
}

function pct (part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

function buildConicGradient (breakdown: RagStorageBreakdown): string {
  if (breakdown.total_bytes <= 0) return 'var(--border-muted)'
  let cursor = 0
  const stops: string[] = []
  for (const c of breakdown.categories) {
    if (c.bytes <= 0) continue
    const deg = (c.bytes / breakdown.total_bytes) * 360
    stops.push(`${CATEGORY_COLORS[c.id]} ${cursor}deg ${cursor + deg}deg`)
    cursor += deg
  }
  if (stops.length === 0) return 'var(--border-muted)'
  return `conic-gradient(${stops.join(', ')})`
}

function StorageDonut ({ breakdown }: { breakdown: RagStorageBreakdown }) {
  const gradient = buildConicGradient(breakdown)

  return (
    <div className="rag-storage-donut">
      <div
        className="rag-storage-donut-ring"
        style={{ background: gradient }}
        role="img"
        aria-label="データ領域の容量内訳"
      />
      <div className="rag-storage-donut-center">
        <span className="rag-storage-donut-total">{formatBytes(breakdown.total_bytes)}</span>
        <span className="rag-storage-donut-lbl">総容量</span>
      </div>
      <ul className="rag-storage-legend">
        {breakdown.categories.map((c) => (
          <li key={c.id}>
            <span className="rag-storage-legend-swatch" style={{ background: CATEGORY_COLORS[c.id] }} />
            <span>{c.label}</span>
            <span className="rag-storage-legend-pct">{pct(c.bytes, breakdown.total_bytes)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CategoryCard ({ category, totalBytes }: { category: RagStorageCategory; totalBytes: number }) {
  const share = pct(category.bytes, totalBytes)
  const indexedShare = category.bytes > 0
    ? Math.min(100, Math.round((category.indexed_bytes / category.bytes) * 100))
    : category.chunk_count > 0
      ? 100
      : 0

  return (
    <article className="rag-storage-category-card">
      <header className="rag-storage-category-head">
        <span
          className="rag-storage-category-dot"
          style={{ background: CATEGORY_COLORS[category.id] }}
          aria-hidden="true"
        />
        <h3>{category.label}</h3>
        <span className="rag-storage-category-bytes">{formatBytes(category.bytes)}</span>
      </header>
      <div className="rag-storage-bar-track" title={`全体に占める割合 ${share}%`}>
        <div
          className="rag-storage-bar-fill rag-storage-bar-capacity"
          style={{ width: `${share}%`, background: CATEGORY_COLORS[category.id] }}
        />
      </div>
      <div className="rag-storage-bar-track rag-storage-bar-indexed" title={`索引済みテキスト ${formatBytes(category.indexed_bytes)}`}>
        <div
          className="rag-storage-bar-fill"
          style={{ width: `${indexedShare}%`, background: CATEGORY_COLORS[category.id], opacity: 0.45 }}
        />
      </div>
      <dl className="rag-storage-category-meta">
        <div>
          <dt>ファイル / ケース</dt>
          <dd>{category.file_count}</dd>
        </div>
        <div>
          <dt>チャンク</dt>
          <dd>{category.chunk_count}</dd>
        </div>
        <div>
          <dt>索引テキスト</dt>
          <dd>{formatBytes(category.indexed_bytes)}</dd>
        </div>
      </dl>
    </article>
  )
}

export function RagStorageDashboard ({ breakdown }: { breakdown: RagStorageBreakdown }) {
  return (
    <section className="rag-storage-dashboard" aria-labelledby="rag-storage-dashboard-title">
      <div className="rag-storage-dashboard-head">
        <h2 id="rag-storage-dashboard-title">データ領域</h2>
        <p className="rag-storage-dashboard-sub">
          上段: ファイル容量の内訳 / 下段の薄いバー: RAG 索引済みテキスト量（chunk）
        </p>
      </div>
      <div className="rag-storage-dashboard-body">
        <StorageDonut breakdown={breakdown} />
        <div className="rag-storage-category-grid">
          {breakdown.categories.map((c) => (
            <CategoryCard key={c.id} category={c} totalBytes={breakdown.total_bytes} />
          ))}
        </div>
      </div>
      <footer className="rag-storage-dashboard-foot">
        <span>登録ファイル {breakdown.total_files} 件</span>
        <span>索引チャンク {breakdown.total_chunks} 件</span>
      </footer>
    </section>
  )
}
