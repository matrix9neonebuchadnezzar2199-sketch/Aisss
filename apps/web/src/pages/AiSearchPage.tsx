import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AiChatComposer } from '../components/ai/AiChatComposer'
import { AiHistorySidebar } from '../components/ai/AiHistorySidebar'
import { AiMessageList } from '../components/ai/AiMessageList'
import { useAiChatHistory } from '../hooks/useAiChatHistory'
import { useMe } from '../hooks/useMe'
import {
  fetchAuditLogByQueryId,
  fetchOllamaHealth,
  fetchOllamaModels,
  sendAiChat,
  type AiChatResponse,
  type AuditLogEntry
} from '../lib/api'
import type { AiChatMessage } from '../types/ai-chat'

export function AiSearchPage () {
  const [searchParams] = useSearchParams()
  const queryIdParam = searchParams.get('query_id')
  const me = useMe()
  const {
    sessions,
    activeSession,
    activeSessionId,
    ensureActiveSession,
    startNewSession,
    selectSession,
    deleteSession,
    appendToActiveSession
  } = useAiChatHistory(me?.user_id)

  const [message, setMessage] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [ollamaStatus, setOllamaStatus] = useState('unknown')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPolicies, setLastPolicies] = useState<AiChatResponse['effective_policies'] | null>(null)
  const [copied, setCopied] = useState(false)
  const [auditRef, setAuditRef] = useState<AuditLogEntry | null>(null)
  const [auditRefError, setAuditRefError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  useEffect(() => {
    void Promise.all([fetchOllamaModels(), fetchOllamaHealth()]).then(([m, h]) => {
      const enabled = m.defaults.enabled_chat_models.length
        ? m.defaults.enabled_chat_models
        : m.models.map((x) => x.name)
      setModels(enabled)
      setModel(m.defaults.chat_model ?? enabled[0] ?? '')
      setOllamaStatus(h.status)
    }).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!me?.user_id) return
    if (sessions.length === 0) startNewSession()
  }, [me?.user_id, sessions.length, startNewSession])

  useEffect(() => {
    if (!queryIdParam) {
      setAuditRef(null)
      setAuditRefError(null)
      return
    }
    void fetchAuditLogByQueryId(queryIdParam)
      .then((row) => {
        setAuditRef(row)
        setAuditRefError(row ? null : '該当する監査ログが見つかりません')
      })
      .catch((e: Error) => {
        setAuditRef(null)
        setAuditRefError(e.message)
      })
  }, [queryIdParam])

  const messages = activeSession?.messages ?? []
  const auditModel = auditRef?.details_json?.model as string | undefined
  const chatDisabled = ollamaStatus === 'down'

  async function onSubmit () {
    const text = message.trim()
    if (!text || chatDisabled) return

    ensureActiveSession()
    setLoading(true)
    setError(null)

    const userMsg: AiChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      model,
      attachments: pendingFiles.map((f) => ({ name: f.name, size: f.size }))
    }
    appendToActiveSession([userMsg])
    setMessage('')
    setPendingFiles([])

    try {
      const res = await sendAiChat(text, model || undefined)
      setLastPolicies(res.effective_policies)
      const assistantMsg: AiChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.answer,
        createdAt: new Date().toISOString(),
        queryId: res.query_id,
        citations: res.citations
      }
      appendToActiveSession([assistantMsg])
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function copyAnswer (text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('クリップボードへのコピーに失敗しました')
    }
  }

  function onFilesSelected (files: FileList | null) {
    if (!files?.length) return
    setPendingFiles((prev) => [...prev, ...Array.from(files)])
  }

  return (
    <section className="view active ai-page" id="view-ai">
      <div className="ai-page-grid">
        <AiHistorySidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={selectSession}
          onNewChat={() => {
            startNewSession()
            setMessage('')
            setPendingFiles([])
            setError(null)
          }}
          onDelete={deleteSession}
        />

        <div className="ai-chat-shell">
          <header className="ai-chat-header">
            <div>
              <h2>AI 検索</h2>
              <p className="ai-chat-sub">権限フィルタ ON · 取扱条件を適用</p>
            </div>
            <span className={`label label-${ollamaStatus === 'ok' ? 'success' : 'danger'}`}>
              Ollama: {ollamaStatus}
            </span>
          </header>

          {queryIdParam && (
            <div className="policy-banner ai-audit-banner">
              監査参照: クエリ ID <span className="mono">{queryIdParam}</span>
              {auditRef && (
                <>
                  {' · '}{auditRef.action} · {auditRef.created_at?.slice(0, 19).replace('T', ' ')}
                  {auditModel ? ` · model: ${auditModel}` : ''}
                  {' · '}
                  <Link to={`/audit?query_id=${encodeURIComponent(queryIdParam)}`}>監査ログで開く</Link>
                </>
              )}
              {auditRefError && <span className="error"> — {auditRefError}</span>}
            </div>
          )}

          {chatDisabled && (
            <p className="error">Ollama が利用できません。チャット入力は無効です。</p>
          )}

          {lastPolicies && (
            <div className="policy-banner ai-policy-banner">
              出力制限: 引用={lastPolicies.quote_policy} / エクスポート={lastPolicies.export_policy}
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <AiMessageList
            messages={messages}
            effectivePolicies={lastPolicies}
            copied={copied}
            onCopyAnswer={(text) => void copyAnswer(text)}
          />

          <AiChatComposer
            message={message}
            model={model}
            models={models}
            pendingFiles={pendingFiles}
            loading={loading}
            disabled={chatDisabled}
            onMessageChange={setMessage}
            onModelChange={setModel}
            onFilesSelected={onFilesSelected}
            onRemoveFile={(index) => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
            onSubmit={() => void onSubmit()}
          />
        </div>
      </div>
    </section>
  )
}
