import type { AiChatSession } from '../../types/ai-chat'

type AiHistorySidebarProps = {
  sessions: AiChatSession[]
  activeSessionId: string | null
  onSelect: (sessionId: string) => void
  onNewChat: () => void
  onDelete: (sessionId: string) => void
}

export function AiHistorySidebar ({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onDelete
}: AiHistorySidebarProps) {
  return (
    <aside className="ai-history-sidebar" aria-label="AI チャット履歴">
      <button type="button" className="btn btn-sm ai-history-new" onClick={onNewChat}>
        + 新しいチャット
      </button>
      <p className="ai-history-heading">最近</p>
      <ul className="ai-history-list">
        {sessions.length === 0 && (
          <li className="ai-history-empty">履歴はまだありません</li>
        )}
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              className={`ai-history-item${session.id === activeSessionId ? ' active' : ''}`}
              onClick={() => onSelect(session.id)}
              title={session.title}
            >
              <span className="ai-history-item-title">{session.title}</span>
              <span className="ai-history-item-meta">
                {session.messages.length} 件 · {session.updatedAt.slice(0, 10)}
              </span>
            </button>
            <button
              type="button"
              className="ai-history-delete"
              aria-label="履歴を削除"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(session.id)
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
