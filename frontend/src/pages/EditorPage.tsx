import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import MonacoEditor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { getProject } from '../api/projects'
import { listFiles, getFile, createFile, updateFile, deleteFile } from '../api/files'
import { runCode } from '../api/execution'
import { listActiveSessions, startSession, closeSession } from '../api/sessions'
import type { Project, CodeFile, ExecutionResult } from '../api/types'
import { useAuth } from '../contexts/AuthContext'
import { useCollab } from '../hooks/useCollab'
import FileTree from '../components/FileTree'
import RunOutput from '../components/RunOutput'
import AiPanel from '../components/AiPanel'

// Maps file extension → Monaco language id
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python',
    java: 'java',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'cpp',
    c: 'c',
    rs: 'rust',
    go: 'go',
    php: 'php',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yaml', yml: 'yaml',
    md: 'markdown',
    sh: 'shell',
    sql: 'sql',
    rb: 'ruby',
  }
  return map[ext] ?? 'plaintext'
}

// Maps project language → execution language accepted by the API
function toRunnerLang(lang: string | undefined): string {
  switch (lang?.toLowerCase()) {
    case 'python':     return 'python'
    case 'javascript': return 'javascript'
    case 'cpp': case 'c++': return 'cpp'
    default:           return 'python'
  }
}

// ── Presence dot for a single collaborator ────────────────────────────────────
function CollabDot({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="collab-dot"
      title={name}
      style={{ background: color }}
    >
      {name[0].toUpperCase()}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { username } = useAuth()

  const id = Number(projectId)

  // ── Core state ────────────────────────────────────────────────────────────
  const [project, setProject]       = useState<Project | null>(null)
  const [files, setFiles]           = useState<CodeFile[]>([])
  const [activeFile, setActiveFile] = useState<CodeFile | null>(null)
  const [editorContent, setEditorContent]   = useState('')
  const [savedContent, setSavedContent]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<ExecutionResult | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const [showAi, setShowAi]         = useState(false)
  const [selectedCode, setSelectedCode] = useState('')
  const [error, setError] = useState('')

  // ── Collab state ──────────────────────────────────────────────────────────
  // sessionId comes from ?session= URL param; this makes collab sessions shareable by URL.
  const sessionId = searchParams.get('session')
  const [collabDirty, setCollabDirty] = useState(false)
  const [collabLoading, setCollabLoading] = useState(false)

  const editorRef    = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  sessionIdRef.current = sessionId

  const isDirty = sessionId ? collabDirty : editorContent !== savedContent

  // ── Collab hook ───────────────────────────────────────────────────────────
  const { collaborators, isConnected, bindToEditor } = useCollab(sessionId, username ?? 'anonymous')

  // ── Project load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    Promise.all([getProject(id), listFiles(id)])
      .then(([proj, fileList]) => {
        setProject(proj)
        setFiles(fileList)
        if (fileList.length > 0) loadFile(fileList[0])
      })
      .catch(() => setError('Failed to load project.'))
  }, [id])

  async function loadFile(file: CodeFile) {
    const full = await getFile(id, file.id)
    setActiveFile(full)
    setEditorContent(full.content ?? '')
    setSavedContent(full.content ?? '')
    setCollabDirty(false)
  }

  // ── File operations ───────────────────────────────────────────────────────
  async function handleSelectFile(file: CodeFile) {
    if (isDirty && !confirm('You have unsaved changes. Discard and switch files?')) return
    await loadFile(file)
  }

  // Get current editor content, respecting collab mode
  function getCurrentContent(): string {
    if (sessionId && editorRef.current) {
      return editorRef.current.getModel()?.getValue() ?? editorContent
    }
    return editorContent
  }

  async function handleSave() {
    if (!activeFile) return
    const content = getCurrentContent()
    setSaving(true)
    try {
      const updated = await updateFile(id, activeFile.id, activeFile.name, content)
      setSavedContent(content)
      setActiveFile(updated)
      setFiles((prev) => prev.map((f) => f.id === updated.id ? updated : f))
      if (sessionId) setCollabDirty(false)
    } catch {
      alert('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateFile(name: string) {
    const file = await createFile(id, name, '')
    setFiles((prev) => [...prev, file])
    await loadFile(file)
  }

  async function handleDeleteFile(file: CodeFile) {
    await deleteFile(id, file.id)
    setFiles((prev) => prev.filter((f) => f.id !== file.id))
    if (activeFile?.id === file.id) {
      const remaining = files.filter((f) => f.id !== file.id)
      if (remaining.length > 0) await loadFile(remaining[0])
      else { setActiveFile(null); setEditorContent(''); setSavedContent('') }
    }
  }

  async function handleRun() {
    if (!activeFile) return
    const lang = detectLanguage(activeFile.name)
    const runnerLang = lang === 'python'     ? 'python'
                     : lang === 'javascript' ? 'javascript'
                     : lang === 'cpp'        ? 'cpp'
                     : toRunnerLang(project?.language)

    if (!['python', 'javascript', 'cpp'].includes(runnerLang)) {
      setError(`Execution not supported for "${runnerLang}" yet.`)
      return
    }

    setRunning(true)
    setShowOutput(true)
    setRunResult(null)
    try {
      const result = await runCode(runnerLang, getCurrentContent())
      setRunResult(result)
    } catch {
      setRunResult({ stdout: '', stderr: 'Execution request failed. Is the API running?', exitCode: -1, durationMs: 0 })
    } finally {
      setRunning(false)
    }
  }

  // ── Collab session management ─────────────────────────────────────────────
  async function handleStartCollab() {
    setCollabLoading(true)
    try {
      // Prefer an existing active session for this project if one exists
      const active = await listActiveSessions(id)
      const existing = active.find((s) => s.active)
      const session  = existing ?? await startSession(id)
      setSearchParams({ session: session.id })
    } catch {
      setError('Could not start collaboration session.')
    } finally {
      setCollabLoading(false)
    }
  }

  async function handleEndCollab() {
    if (!sessionId) return
    try {
      await closeSession(sessionId)
    } catch {
      // Ignore — may already be closed
    }
    setSearchParams({})
    setCollabDirty(false)
  }

  // ── Monaco mount ──────────────────────────────────────────────────────────
  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor

    // Ctrl+S / Cmd+S → save
    editor.addCommand(2048 | 49, () => handleSave())

    // Track selected code for AI panel
    editor.onDidChangeCursorSelection(() => {
      const sel = editor.getSelection()
      if (sel && !sel.isEmpty()) {
        setSelectedCode(editor.getModel()?.getValueInRange(sel) ?? '')
      } else {
        setSelectedCode('')
      }
    })

    // Collab mode: mark dirty on any edit (remote edits don't count — the hook
    // sets remoteRef.current before applying, so Yjs-driven changes via
    // model.applyEdits do NOT trigger our manual dirty tracking because
    // onDidChangeModelContent fires synchronously during applyEdits, and
    // remoteRef guards are inside the hook's own listener, not here.
    // We track dirty separately so the Save button activates on local edits only.
    editor.onDidChangeModelContent(() => {
      if (sessionIdRef.current) setCollabDirty(true)
    })

    // Wire the editor into the Yjs collab layer
    bindToEditor(editor)
  }, [bindToEditor])

  // ── Render ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="editor-layout">
        <div style={{ padding: 32, color: 'var(--error)' }}>{error}</div>
      </div>
    )
  }

  if (!project) {
    return <div className="loading-screen"><span className="spinner" /> Loading project…</div>
  }

  const monacoLanguage = activeFile ? detectLanguage(activeFile.name) : 'plaintext'

  return (
    <div className="editor-layout">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="editor-toolbar">
        <button className="btn-ghost" onClick={() => navigate('/dashboard')} title="Back">
          ← Dashboard
        </button>
        <span className="editor-toolbar-title">{project.name}</span>
        {activeFile && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span className="editor-toolbar-file">{activeFile.name}</span>
            {isDirty && <span className="dirty-dot" title="Unsaved changes" />}
          </>
        )}

        {/* Presence avatars */}
        {collaborators.length > 0 && (
          <div className="collab-presence" title={`${collaborators.length} collaborator(s) online`}>
            {collaborators.map((c) => (
              <CollabDot key={c.clientId} name={c.name} color={c.color} />
            ))}
          </div>
        )}

        <div className="editor-toolbar-spacer" />

        <div className="editor-toolbar-actions">
          {/* Collab toggle */}
          {sessionId ? (
            <div className="collab-status">
              <span
                className="collab-indicator"
                style={{
                  background: isConnected ? 'var(--success)' : 'var(--text-muted)',
                  animation: isConnected ? 'pulse 2s infinite' : 'none',
                }}
                title={isConnected ? 'Connected to collab server' : 'Connecting…'}
              />
              <span className="collab-label">Live</span>
              <button
                className="btn btn-ghost"
                onClick={handleEndCollab}
                title="End collaboration session"
                style={{ marginLeft: 4, fontSize: 11 }}
              >
                ✕ End
              </button>
            </div>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={handleStartCollab}
              disabled={collabLoading}
              title="Start a real-time collaboration session"
            >
              {collabLoading ? <><span className="spinner" /> Starting…</> : '⟳ Collaborate'}
            </button>
          )}

          <button
            className="btn btn-secondary"
            disabled={!isDirty || saving}
            onClick={handleSave}
            title="Save (Ctrl+S)"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            className="btn btn-run"
            disabled={!activeFile || running}
            onClick={handleRun}
            title="Run"
          >
            {running ? <><span className="spinner" /> Running…</> : '▶ Run'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowAi((v) => !v)}
            title="Toggle AI panel"
            style={showAi ? {
              background: 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.18))',
              borderColor: 'rgba(139,92,246,.45)',
              color: '#c4b5fd',
            } : undefined}
          >
            ✦ AI
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="editor-body">
        {/* File tree */}
        <FileTree
          files={files}
          activeFileId={activeFile?.id ?? null}
          onSelect={handleSelectFile}
          onCreate={handleCreateFile}
          onDelete={handleDeleteFile}
        />

        {/* Editor + output */}
        <div className="editor-center">
          {activeFile ? (
            <div className="monaco-wrapper">
              <MonacoEditor
                /*
                 * Re-key when:
                 *   • activeFile changes (different file loaded)
                 *   • sessionId appears/disappears (switch controlled↔uncontrolled)
                 * Keying forces a full remount which resets the Monaco model.
                 */
                key={`${activeFile.id}-${sessionId ?? 'local'}`}
                language={monacoLanguage}
                theme="vs-dark"
                /*
                 * Collab mode: uncontrolled — Yjs drives the content via model.applyEdits.
                 * Passing `value` (controlled) would fight Yjs because every state update
                 * would call model.setValue(), which is a full replace that destroys undo history.
                 * Using `defaultValue` gives Monaco the initial content once and then
                 * lets Yjs maintain it incrementally.
                 *
                 * Non-collab: controlled — React state is the source of truth.
                 */
                {...(sessionId
                  ? { defaultValue: editorContent }
                  : { value: editorContent, onChange: (val) => setEditorContent(val ?? '') }
                )}
                onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
                  fontLigatures: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  tabSize: 2,
                  insertSpaces: true,
                  padding: { top: 12 },
                  renderLineHighlight: 'line',
                  cursorBlinking: 'smooth',
                  smoothScrolling: true,
                }}
              />
            </div>
          ) : (
            <div className="no-file-selected">
              <span style={{ fontSize: 32 }}>📄</span>
              <span>Create or select a file to start editing</span>
            </div>
          )}

          {showOutput && (
            <RunOutput
              result={runResult}
              running={running}
              onClose={() => setShowOutput(false)}
            />
          )}
        </div>

        {/* AI panel */}
        {showAi && (
          <AiPanel
            selectedCode={selectedCode}
            language={monacoLanguage}
            onClose={() => setShowAi(false)}
          />
        )}
      </div>
    </div>
  )
}
