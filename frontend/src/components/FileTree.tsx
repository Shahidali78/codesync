import { useState } from 'react'
import type { CodeFile } from '../api/types'

interface Props {
  files: CodeFile[]
  activeFileId: number | null
  onSelect: (file: CodeFile) => void
  onCreate: (name: string) => Promise<void>
  onDelete: (file: CodeFile) => Promise<void>
}

export default function FileTree({ files, activeFileId, onSelect, onCreate, onDelete }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    try {
      await onCreate(newName.trim())
      setNewName('')
      setCreating(false)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, file: CodeFile) {
    e.stopPropagation()
    if (!confirm(`Delete "${file.name}"?`)) return
    await onDelete(file)
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span>Files</span>
        <button className="btn-icon" title="New file" onClick={() => setCreating(true)}>＋</button>
      </div>

      <div className="file-tree-list">
        {files.map((f) => (
          <div
            key={f.id}
            className={`file-item${f.id === activeFileId ? ' active' : ''}`}
            onClick={() => onSelect(f)}
          >
            <span className="file-item-name" title={f.name}>{f.name}</span>
            <button
              className="btn-danger file-item-del"
              title="Delete file"
              onClick={(e) => handleDelete(e, f)}
            >×</button>
          </div>
        ))}

        {files.length === 0 && !creating && (
          <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            No files yet
          </div>
        )}

        {creating && (
          <form onSubmit={handleCreate} style={{ padding: '6px 8px' }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="filename.py"
              onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
              style={{ fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ fontSize: 11, padding: '4px 10px' }}>
                Create
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setCreating(false)} style={{ fontSize: 11 }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
