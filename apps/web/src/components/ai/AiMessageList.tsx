import { Link } from 'react-router-dom'
import type { AiChatMessage } from '../../types/ai-chat'
import type { AiChatResponse } from '../../lib/api'

type AiMessageListProps = {
  messages: AiChatMessage[]
  effectivePolicies?: AiChatResponse['effective_policies'] | null
  onCopyAnswer?: (text: string) => void
  copied: boolean
}

export function AiMessageList ({
  messages,
  effectivePolicies,
  onCopyAnswer,
  copied
}: AiMessageListProps) {
  const printDisabled = effectivePolicies?.export_policy === 'deny_print' ||
    effectivePolicies?.export_policy === 'deny_all'
  const copyDisabled = effectivePolicies?.export_policy === 'deny_copy' ||
    effectivePolicies?.export_policy === 'deny_all'

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')

  if (messages.length === 0) {
    return (
      <div className="ai-chat-empty">
        <h3>AI 検索</h3>
        <p>閲覧権限内のケース・添付をもとに回答します。下の入力欄から質問してください。</p>
      </div>
    )
  }

  return (
    <div className="ai-chat-messages">
      {messages.map((msg) => (
        <article
          key={msg.id}
          className={`chat-msg ${msg.role === 'user' ? 'chat-user' : 'chat-ai'}`}
        >
          {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
            <ul className="ai-msg-attachments">
              {msg.attachments.map((a) => (
                <li key={a.name}>{a.name}</li>
              ))}
            </ul>
          )}
          <div className="ai-msg-body">{msg.content}</div>
          {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
            <div className="chat-cite">
              引用:
              <ul className="citation-list">
                {msg.citations.map((c, i) => (
                  <li key={`${c.title}-${i}`}>
                    {c.display_id
                      ? (
                          <Link to={`/cases/${c.display_id}`} target="_blank" rel="noopener noreferrer">
                            {c.display_id}
                          </Link>
                        )
                      : null}
                    {' '}{c.title}
                    <span className="meta"> ({c.source_type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}

      {lastAssistant && onCopyAnswer && (
        <div className="ai-chat-actions">
          <button
            type="button"
            className="btn btn-sm"
            disabled={copyDisabled}
            onClick={() => onCopyAnswer(lastAssistant.content)}
          >
            {copied ? 'コピーしました' : '回答をコピー'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={printDisabled}
            onClick={() => window.print()}
          >
            印刷
          </button>
        </div>
      )}
    </div>
  )
}
