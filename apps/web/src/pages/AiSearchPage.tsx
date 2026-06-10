import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchOllamaHealth,
  fetchOllamaModels,
  sendAiChat,
  type AiChatResponse
} from '../lib/api'

export function AiSearchPage () {
  const [message, setMessage] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [ollamaStatus, setOllamaStatus] = useState('unknown')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiChatResponse | null>(null)
  const [copied, setCopied] = useState(false)

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

  async function onSubmit () {
    if (!message.trim() || ollamaStatus === 'down') return
    setLoading(true)
    setError(null)
    try {
      const res = await sendAiChat(message.trim(), model || undefined)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : '送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const printDisabled = result?.effective_policies.export_policy === 'deny_print' ||
    result?.effective_policies.export_policy === 'deny_all'
  const copyDisabled = result?.effective_policies.export_policy === 'deny_copy' ||
    result?.effective_policies.export_policy === 'deny_all'

  async function copyAnswer () {
    if (!result || copyDisabled) return
    try {
      await navigator.clipboard.writeText(result.answer)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('クリップボードへのコピーに失敗しました')
    }
  }

  function printAnswer () {
    if (printDisabled) return
    window.print()
  }

  return (
    <section className="view active ai-page" id="view-ai">
      <div className="panel">
        <div className="panel-header">
          <h2>AI 検索</h2>
          <span className={`label label-${ollamaStatus === 'ok' ? 'success' : 'danger'}`} data-status={ollamaStatus}>
            Ollama: {ollamaStatus}
          </span>
        </div>
        <div className="panel-body">
          {ollamaStatus === 'down' && (
            <p className="error">Ollama が利用できません。チャット入力は無効です。</p>
          )}

          <div className="chat-panel">
            <label>
              モデル
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={models.length === 0}>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            {result && (
              <div className="policy-banner">
                出力制限: 引用={result.effective_policies.quote_policy} /
                エクスポート={result.effective_policies.export_policy}
                {printDisabled && ' · 印刷禁止'}
                {copyDisabled && ' · 複製禁止'}
              </div>
            )}

            <label>
              質問
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={ollamaStatus === 'down'}
                placeholder="ケース内容について質問してください"
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onSubmit()}
              disabled={loading || ollamaStatus === 'down'}
            >
              {loading ? '生成中…' : '送信'}
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {result && (
            <div className="chat-result">
              <div className="panel-header">
                <h3>回答</h3>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={copyDisabled}
                    title={copyDisabled ? '複製禁止のためコピーできません' : '回答をコピー'}
                    onClick={() => void copyAnswer()}
                  >
                    {copied ? 'コピーしました' : 'コピー'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={printDisabled}
                    title={printDisabled ? '印刷禁止のため印刷できません' : '回答を印刷'}
                    onClick={printAnswer}
                  >
                    印刷
                  </button>
                </div>
              </div>
              <div className="chat-bubble chat-bubble-assistant">{result.answer}</div>
              <h4>引用</h4>
              <ul className="citation-list">
                {result.citations.map((c, i) => (
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
                {result.citations.length === 0 && <li className="meta">許可済み引用なし</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
