import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { listProjects, createProject, deleteProject } from '../api/projects'
import type { Project } from '../api/types'

const LANGUAGES = ['python', 'javascript', 'cpp', 'java', 'go', 'rust', 'php', 'other']

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function DashboardPage() {
  const { username, logout } = useAuth()
  const navigate = useNavigate()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating]   = useState(false)
  const [form, setForm] = useState({ name: '', description: '', language: 'python' })
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const project = await createProject(form.name, form.description || undefined, form.language)
      setProjects((prev) => [project, ...prev])
      setShowModal(false)
      setForm({ name: '', description: '', language: 'python' })
    } catch {
      setCreateError('Failed to create project.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    if (!confirm('Delete this project and all its files?')) return
    await deleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="dashboard">
      {/* Top bar */}
      <header className="topbar">
        <span className="topbar-logo">CodeSync</span>
        <div className="topbar-spacer" />
        <span className="topbar-user">{username}</span>
        <button className="btn-ghost" onClick={logout}>Sign out</button>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>My Projects</h2>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowModal(true)}>
            + New project
          </button>
        </div>

        {loading && (
          <div className="loading-screen"><span className="spinner" /> Loading…</div>
        )}

        {!loading && projects.length === 0 && (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Create your first project to get started.</p>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="project-grid">
            {projects.map((p) => (
              <button
                key={p.id}
                className="project-card"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="project-card-name">{p.name}</span>
                  <button
                    className="btn-danger"
                    onClick={(e) => handleDelete(e, p.id)}
                    title="Delete project"
                    style={{ fontSize: 16, lineHeight: 1 }}
                  >×</button>
                </div>
                {p.description && (
                  <span className="project-card-meta">{p.description}</span>
                )}
                {p.language && <span className="project-card-lang">{p.language}</span>}
                <span className="project-card-meta" style={{ marginTop: 4 }}>
                  Updated {timeAgo(p.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New-project modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New project</h3>

            {createError && <div className="error-banner">{createError}</div>}

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My awesome project"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="form-group">
                <label>Language</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)',
                           border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                           color: 'var(--text-primary)', fontFamily: 'inherit' }}
                >
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={creating} style={{ width: 'auto' }}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
