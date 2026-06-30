import type { ExecutionResult } from '../api/types'

interface Props {
  result: ExecutionResult | null
  running: boolean
  onClose: () => void
}

export default function RunOutput({ result, running, onClose }: Props) {
  return (
    <div className="output-panel">
      <div className="output-panel-header">
        <span style={{ textTransform: 'uppercase', letterSpacing: '.13em', fontSize: 11 }}>Output</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {result && (
            <span className={`exit-badge ${result.exitCode === 0 ? 'exit-0' : 'exit-err'}`}>
              exit {result.exitCode}
            </span>
          )}
          <button className="btn-icon" onClick={onClose} title="Close output">×</button>
        </div>
      </div>

      <div className="output-panel-body">
        {running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
            <span className="spinner" />
            Running…
          </div>
        )}

        {!running && result && (
          <>
            {result.stdout && (
              <div className="output-stdout">{result.stdout}</div>
            )}
            {result.stderr && (
              <div className="output-stderr">{result.stderr}</div>
            )}
            {!result.stdout && !result.stderr && (
              <div className="output-meta">(no output)</div>
            )}
            <div className="output-meta">
              Finished in {result.durationMs}ms · exit {result.exitCode}
            </div>
          </>
        )}

        {!running && !result && (
          <div style={{ color: 'var(--text-muted)' }}>Press Run to execute the current file.</div>
        )}
      </div>
    </div>
  )
}
