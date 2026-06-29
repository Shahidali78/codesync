/**
 * useCollab — Yjs + y-websocket collaborative editing hook.
 *
 * Responsibilities:
 *   • Opens a WebSocket to the collab-server for the given sessionId
 *   • Keeps the Monaco editor and a Y.Text in sync (bidirectional, loop-free)
 *   • Shares cursor positions via the Awareness protocol
 *   • Returns the list of connected collaborators for the presence UI
 *
 * Usage:
 *   const { collaborators, isConnected, bindToEditor } = useCollab(sessionId, username)
 *
 *   // In EditorPage, pass bindToEditor to the Monaco onMount callback.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type * as Monaco from 'monaco-editor'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Collaborator {
  clientId: number
  name: string
  color: string
  lineNumber?: number
  column?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deterministic HSL color from a username string. */
function colorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 65%, 60%)`
}

function hslToHex(hsl: string): string {
  // Parse hsl(H, S%, L%) → #rrggbb for Monaco decoration CSS
  const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!m) return '#007acc'
  const h = parseInt(m[1]) / 360
  const s = parseInt(m[2]) / 100
  const l = parseInt(m[3]) / 100
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const toRgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  const r = Math.round(toRgb(h + 1/3) * 255)
  const g = Math.round(toRgb(h) * 255)
  const b = Math.round(toRgb(h - 1/3) * 255)
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCollab(sessionId: string | null, username: string) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [isConnected, setIsConnected]     = useState(false)

  // Stable refs that survive re-renders
  const ydocRef     = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const editorRef   = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorRef    = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  // True while we are applying a remote Yjs change to Monaco (prevents echo)
  const remoteRef   = useRef(false)

  // Tear down any previous session and build a fresh one
  useEffect(() => {
    if (!sessionId) return

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const ytext = ydoc.getText('monaco')

    const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:1234'
    const provider = new WebsocketProvider(wsUrl, sessionId, ydoc, { connect: true })
    providerRef.current = provider

    const myColor = colorFromName(username)
    provider.awareness.setLocalState({
      user: { name: username, color: myColor },
      cursor: null,
    })

    // ── Status ───────────────────────────────────────────────────────────────

    provider.on('status', ({ status }: { status: string }) => {
      setIsConnected(status === 'connected')
    })

    // ── Initial sync: populate ytext ↔ Monaco ────────────────────────────────

    provider.on('sync', (isSynced: boolean) => {
      if (!isSynced) return
      const editor = editorRef.current
      const model  = editor?.getModel()
      if (!model) return

      if (ytext.length === 0) {
        // New session — seed Yjs with the current file content
        ydoc.transact(() => ytext.insert(0, model.getValue()))
      } else {
        // Existing session — update Monaco with the collaborative state
        remoteRef.current = true
        model.setValue(ytext.toString())
        remoteRef.current = false
      }
    })

    // ── Yjs → Monaco (remote edits) ──────────────────────────────────────────

    const ytextObserver = (event: Y.YTextEvent) => {
      const editor = editorRef.current
      const model  = editor?.getModel()
      if (!model) return

      remoteRef.current = true
      // Convert Yjs delta into Monaco IIdentifiedSingleEditOperation[]
      const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = []
      let index = 0
      for (const delta of event.delta) {
        if ('retain' in delta && delta.retain) {
          index += delta.retain
        } else if ('insert' in delta && typeof delta.insert === 'string') {
          const pos = model.getPositionAt(index)
          edits.push({
            range: { startLineNumber: pos.lineNumber, startColumn: pos.column,
                     endLineNumber:   pos.lineNumber, endColumn:   pos.column },
            text: delta.insert,
            forceMoveMarkers: true,
          })
          index += delta.insert.length
        } else if ('delete' in delta && delta.delete) {
          const start = model.getPositionAt(index)
          const end   = model.getPositionAt(index + delta.delete)
          edits.push({
            range: { startLineNumber: start.lineNumber, startColumn: start.column,
                     endLineNumber:   end.lineNumber,   endColumn:   end.column },
            text: '',
            forceMoveMarkers: true,
          })
          // index does not advance — deleted characters are removed
        }
      }
      if (edits.length > 0) model.applyEdits(edits)
      remoteRef.current = false
    }
    ytext.observe(ytextObserver)

    // ── Awareness → collaborator list + cursors ───────────────────────────────

    const updateCollaborators = () => {
      const states = provider.awareness.getStates() as Map<number, Record<string, unknown>>
      const me     = ydoc.clientID
      const collabs: Collaborator[] = []

      states.forEach((state, clientId) => {
        if (clientId === me) return
        const user   = state.user as { name: string; color: string } | undefined
        const cursor = state.cursor as { lineNumber: number; column: number } | null | undefined
        if (!user) return
        collabs.push({
          clientId,
          name:       user.name,
          color:      user.color,
          lineNumber: cursor?.lineNumber,
          column:     cursor?.column,
        })
      })

      setCollaborators(collabs)
      renderRemoteCursors(collabs)
    }

    provider.awareness.on('change', updateCollaborators)

    // ── Cleanup ───────────────────────────────────────────────────────────────

    return () => {
      ytext.unobserve(ytextObserver)
      provider.awareness.off('change', updateCollaborators)
      provider.disconnect()
      ydoc.destroy()
      ydocRef.current   = null
      providerRef.current = null
      decorRef.current?.clear()
      setCollaborators([])
      setIsConnected(false)
    }
  }, [sessionId, username])

  // ── Monaco cursor decoration renderer ────────────────────────────────────────

  function renderRemoteCursors(collabs: Collaborator[]) {
    const editor = editorRef.current
    if (!editor) return

    if (!decorRef.current) {
      decorRef.current = editor.createDecorationsCollection([])
    }

    const decorations: Monaco.editor.IModelDeltaDecoration[] = collabs
      .filter(c => c.lineNumber != null)
      .map(c => ({
        range: {
          startLineNumber: c.lineNumber!, startColumn: c.column ?? 1,
          endLineNumber:   c.lineNumber!, endColumn:   c.column ?? 1,
        },
        options: {
          className:              `remote-cursor-${c.clientId}`,
          beforeContentClassName: `remote-cursor-label-${c.clientId}`,
          stickiness: 1,
          zIndex: 10,
        },
      }))

    // Inject per-collaborator CSS if not already present
    collabs.forEach(c => {
      const id  = `collab-cursor-style-${c.clientId}`
      if (document.getElementById(id)) return
      const hex = hslToHex(c.color)
      const el  = document.createElement('style')
      el.id = id
      el.textContent = `
        .remote-cursor-${c.clientId} {
          border-left: 2px solid ${hex};
          margin-left: -1px;
        }
        .remote-cursor-label-${c.clientId}::before {
          content: '${c.name.replace(/'/g, "\\'")}';
          background: ${hex};
          color: #fff;
          font-size: 10px;
          padding: 1px 4px;
          border-radius: 2px 2px 2px 0;
          position: absolute;
          top: -18px;
          white-space: nowrap;
          pointer-events: none;
        }
      `
      document.head.appendChild(el)
    })

    decorRef.current.set(decorations)
  }

  // ── Callbacks returned to EditorPage ─────────────────────────────────────────

  /** Call from Monaco onMount. */
  const bindToEditor = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    decorRef.current  = editor.createDecorationsCollection([])

    // Monaco → Yjs: local edits
    editor.onDidChangeModelContent((event) => {
      if (remoteRef.current) return
      const ydoc  = ydocRef.current
      const provider = providerRef.current
      if (!ydoc || !provider) return

      const ytext = ydoc.getText('monaco')
      ydoc.transact(() => {
        // Apply changes in reverse offset order to maintain correct positions
        const sorted = [...event.changes].sort((a, b) => b.rangeOffset - a.rangeOffset)
        for (const ch of sorted) {
          if (ch.rangeLength > 0) ytext.delete(ch.rangeOffset, ch.rangeLength)
          if (ch.text)            ytext.insert(ch.rangeOffset, ch.text)
        }
      }, 'local')
    })

    // Cursor → awareness
    editor.onDidChangeCursorPosition((e) => {
      const provider = providerRef.current
      if (!provider) return
      const prev = provider.awareness.getLocalState() as Record<string, unknown> | null
      provider.awareness.setLocalState({
        ...prev,
        cursor: { lineNumber: e.position.lineNumber, column: e.position.column },
      })
    })
  }, [])

  return { collaborators, isConnected, bindToEditor, ydocRef }
}
