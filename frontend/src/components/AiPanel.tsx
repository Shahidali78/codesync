import { useState } from 'react'
import { callAi, type AiAction } from '../api/ai'

interface Props {
  selectedCode: string
  language: string
  onClose: () => void
}

export default function AiPanel({ selectedCode, language, onClose }: Props) {
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [lastAction, setLastAction] = useState<AiAction | null>(null)

  async function ask(action: AiAction) {
    if (!selectedCode.trim()) {
      setError('Select some code in the editor first.')
      return
    }
    setLoading(true)
    setError('')
    setResponse('')
    setLastAction(action)

    try {
      await callAi(action, selectedCode, language, (chunk) => {
        setResponse((prev) => prev + chunk)
      })
    } catch {
      setError(
        'Could not reach the AI service. Make sure the ai-service is running (Phase 3).'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span>✦ AI Assistant</span>
        <button className="btn-icon" onClick={onClose} title="Close">×</button>
      </div>

      <div className="ai-panel-body">
        {/* Code preview */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            {selectedCode ? 'Selected code:' : 'No code selected — highlight code in the editor.'}
          </div>
          {selectedCode && (
            <div className="ai-code-preview">{selectedCode.slice(0, 500)}{selectedCode.length > 500 ? '…' : ''}</div>
          )}
        </div>

        {/* Action buttons */}
        <div className="ai-actions">
          {(['explain', 'review', 'fix'] as AiAction[]).map((a) => (
            <button
              key={a}
              disabled={loading || !selectedCode.trim()}
              onClick={() => ask(a)}
              style={{ textTransform: 'capitalize' }}
            >
              {loading && lastAction === a ? <span className="spinner" /> : null}
              {a}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ color: 'var(--error)', fontSize: 12, lineHeight: 1.6 }}>{error}</div>
        )}

        {/* Response */}
        {(response || loading) && !error && (
          <div className="ai-response">
            {response || <span style={{ color: 'var(--text-muted)' }}>Thinking…</span>}
          </div>
        )}

        {/* Hint when nothing is happening */}
        {!loading && !response && !error && (
          <div className="ai-stub-notice">
            <div className="ai-stub-icon">✦</div>
            <div>
              <strong>AI Code Assistant</strong>
              Select code in the editor, then choose an action.
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 4 }}>
              Powered by <strong style={{ color: 'var(--text-muted)' }}>qwen2.5-coder</strong> via Ollama
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
