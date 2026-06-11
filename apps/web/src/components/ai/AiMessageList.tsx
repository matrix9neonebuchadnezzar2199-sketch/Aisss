import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { AiChatMessage } from '../../types/ai-chat'
import type { AiChatResponse } from '../../lib/api'

type AiMessageListProps = {
  messages: AiChatMessage[]
  loading?: boolean
  effectivePolicies?: AiChatResponse['effective_policies'] | null
  onCopyAnswer?: (text: string) => void
  copied: boolean
}

export function AiMessageList ({
  messages,
  loading = false,
  effectivePolicies,
  onCopyAnswer,
  copied
}: AiMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const printDisabled = effectivePolicies?.export_policy === 'deny_print' ||
    effectivePolicies?.export_policy === 'deny_all'
  const copyDisabled = effectivePolicies?.export_policy === 'deny_copy' ||
    effectivePolicies?.export_policy === 'deny_all'

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')

  if (messages.length === 0 && !loading) {
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
          <div className="chat-msg-role">{msg.role === 'user' ? 'あなた' : 'AI'}</div>
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

      {loading && (
        <article className="chat-msg chat-ai chat-thinking" aria-live="polite" aria-busy="true">
          <div className="chat-msg-role">AI</div>
          <div className="ai-thinking-row">
            <span className="ai-thinking-spinner" aria-hidden="true" />
            <span>考え中…</span>
          </div>
        </article>
      )}

      {lastAssistant && onCopyAnswer && !loading && (
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

      <div ref={bottomRef} className="ai-chat-scroll-anchor" aria-hidden="true" />
    </div>
  )
}
