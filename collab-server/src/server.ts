/**
 * CodeSync Collaboration Server
 *
 * Wire protocol: y-websocket format — MESSAGE_SYNC=0, MESSAGE_AWARENESS=1.
 * Rooms are keyed by session ID (UUID from the Spring Boot sessions table).
 * Redis pub/sub enables cross-instance document synchronisation.
 *
 * Sync sequence (both parties execute the same handshake):
 *   A → B: [MSG_SYNC][step1=0][state_vector]     "here's what I have"
 *   A → B: [MSG_SYNC][step2=1][full_doc_dump]     immediate content push
 *   B → A: [MSG_SYNC][step2=1][updates_A_lacks]  B fills A's gaps
 *   then ongoing: [MSG_SYNC][update=2][update]     incremental deltas
 */

import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as enc from 'lib0/encoding'
import * as dec from 'lib0/decoding'
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import { Redis } from 'ioredis'

// ── Config ───────────────────────────────────────────────────────────────────

const PORT      = parseInt(process.env.PORT      ?? '1234', 10)
const REDIS_URL = process.env.REDIS_URL          ?? 'redis://localhost:6379'
const redisChan = (room: string) => `collab:${room}`

const MSG_SYNC      = 0
const MSG_AWARENESS = 1

// ── Room ─────────────────────────────────────────────────────────────────────

class Room {
  readonly name: string
  readonly doc: Y.Doc
  readonly awareness: awarenessProtocol.Awareness
  readonly connections = new Map<WebSocket, number>()
  /** True while we apply a Redis-sourced update (prevents re-publishing). */
  fromRedis = false

  constructor(name: string) {
    this.name      = name
    this.doc       = new Y.Doc({ gc: true })
    this.awareness = new awarenessProtocol.Awareness(this.doc)
    this.awareness.setLocalState(null)  // server has no presence of its own
  }

  broadcast(msg: Uint8Array, skip?: WebSocket): void {
    for (const [ws] of this.connections) {
      if (ws !== skip && ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
  }

  isEmpty(): boolean { return this.connections.size === 0 }
}

const rooms = new Map<string, Room>()

function getRoom(name: string): Room {
  let room = rooms.get(name)
  if (!room) {
    room = new Room(name)
    rooms.set(name, room)
    wireToRedis(room)
  }
  return room
}

// ── Message helpers ───────────────────────────────────────────────────────────

function syncUpdateMsg(update: Uint8Array): Uint8Array {
  const e = enc.createEncoder()
  enc.writeVarUint(e, MSG_SYNC)
  syncProtocol.writeUpdate(e, update)
  return enc.toUint8Array(e)
}

function awarenessMsg(awareness: awarenessProtocol.Awareness, clients: number[]): Uint8Array {
  const e = enc.createEncoder()
  enc.writeVarUint(e, MSG_AWARENESS)
  enc.writeVarUint8Array(e, awarenessProtocol.encodeAwarenessUpdate(awareness, clients))
  return enc.toUint8Array(e)
}

function ship(ws: WebSocket, msg: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(msg)
}

// ── Redis pub/sub ─────────────────────────────────────────────────────────────

// Subscriber uses returnBuffers so binary Yjs updates arrive intact.
const pub = new Redis(REDIS_URL, { lazyConnect: true })
// returnBuffers works at runtime in ioredis v5 but was dropped from the types
const sub = new Redis(REDIS_URL, { lazyConnect: true, returnBuffers: true } as any)

async function connectRedis(): Promise<void> {
  try {
    await pub.connect()
    await sub.connect()
    console.log('[Redis] connected')
  } catch (err) {
    // Degrade gracefully — collab still works single-instance without Redis.
    console.warn('[Redis] unavailable, single-instance mode:', (err as Error).message)
  }
}

function wireToRedis(room: Room): void {
  const channel = redisChan(room.name)

  // doc updates from LOCAL clients → publish to Redis
  room.doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (room.fromRedis) return  // came from Redis — skip to avoid echo loop
    pub.publish(channel, Buffer.from(update)).catch(() => {})

    // Broadcast to local peers, skipping the originating socket.
    const msg = syncUpdateMsg(update)
    room.broadcast(msg, origin instanceof WebSocket ? origin : undefined)
  })

  // awareness changes → broadcast to local peers
  room.awareness.on('update', (delta: { added: number[], updated: number[], removed: number[] }) => {
    const clients = [...delta.added, ...delta.updated, ...delta.removed]
    room.broadcast(awarenessMsg(room.awareness, clients))
  })

  // subscribe: updates from OTHER instances
  sub.subscribe(channel).catch((err: Error) => {
    console.warn('[Redis] subscribe error:', err.message)
  })
}

// Redis message → apply to local doc + broadcast to local clients
sub.on('messageBuffer', (channelBuf: Buffer, dataBuf: Buffer) => {
  try {
    const channel  = channelBuf.toString()
    const roomName = channel.replace(/^collab:/, '')
    const room     = rooms.get(roomName)
    if (!room) return

    const update = new Uint8Array(dataBuf)
    room.fromRedis = true
    Y.applyUpdate(room.doc, update, 'redis')  // Yjs deduplicates; safe to re-apply
    room.fromRedis = false
    room.broadcast(syncUpdateMsg(update))
  } catch (err) {
    console.error('[Redis] messageBuffer error:', (err as Error).message)
  }
})

// ── Connection handler ────────────────────────────────────────────────────────

function handleConnection(ws: WebSocket, req: IncomingMessage): void {
  const rawPath  = req.url ?? '/'
  const roomName = decodeURIComponent(rawPath.startsWith('/') ? rawPath.slice(1) : rawPath) || 'default'
  const room     = getRoom(roomName)
  const clientId = room.doc.clientID  // unique per Y.Doc instance (one per room)

  room.connections.set(ws, clientId)
  console.log(`[${roomName}] +conn  peers=${room.connections.size}`)

  // ── Handshake: sync step 1 (our state vector) ─────────────────────────────
  {
    const e = enc.createEncoder()
    enc.writeVarUint(e, MSG_SYNC)
    syncProtocol.writeSyncStep1(e, room.doc)
    ship(ws, enc.toUint8Array(e))
  }

  // ── Handshake: sync step 2 (full doc dump) ────────────────────────────────
  // Push all existing content immediately so the client doesn't need to wait
  // for our syncStep1 → client's syncStep2 round-trip.
  {
    const e = enc.createEncoder()
    enc.writeVarUint(e, MSG_SYNC)
    syncProtocol.writeSyncStep2(e, room.doc, undefined)  // undefined = send full doc state
    if (enc.length(e) > 1) ship(ws, enc.toUint8Array(e))
  }

  // ── Push current awareness so the new peer sees existing cursors ───────────
  const awarenessStates = room.awareness.getStates()
  if (awarenessStates.size > 0) {
    ship(ws, awarenessMsg(room.awareness, Array.from(awarenessStates.keys())))
  }

  // ── Incoming messages ─────────────────────────────────────────────────────
  ws.on('message', (raw: Buffer) => {
    try {
      const decoder = dec.createDecoder(new Uint8Array(raw))
      const msgType = dec.readVarUint(decoder)

      switch (msgType) {
        case MSG_SYNC: {
          const encoder = enc.createEncoder()
          enc.writeVarUint(encoder, MSG_SYNC)
          // readSyncMessage:
          //   step1 → writes syncStep2(what-this-client-is-missing) into encoder
          //   step2 → applies updates to room.doc; doc.on('update') fires → broadcast+Redis
          //   update→ same as step2
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws)

          if (enc.length(encoder) > 1) {
            ship(ws, enc.toUint8Array(encoder))
          }
          break
        }

        case MSG_AWARENESS: {
          const update = dec.readVarUint8Array(decoder)
          // awareness.on('update') fires → broadcast to local peers
          awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws)
          break
        }

        default:
          console.warn(`[${roomName}] unknown message type ${msgType}`)
      }
    } catch (err) {
      console.error(`[${roomName}] message error:`, (err as Error).message)
    }
  })

  // ── Disconnect ─────────────────────────────────────────────────────────────
  ws.on('close', () => {
    awarenessProtocol.removeAwarenessStates(room.awareness, [clientId], 'disconnect')
    room.connections.delete(ws)
    console.log(`[${roomName}] -conn  peers=${room.connections.size}`)

    if (room.isEmpty()) {
      // 30 s grace period in case of page refresh before destroying the room.
      setTimeout(() => {
        if (room.isEmpty()) {
          room.doc.destroy()
          rooms.delete(roomName)
          sub.unsubscribe(redisChan(roomName)).catch(() => {})
          console.log(`[${roomName}] room destroyed`)
        }
      }, 30_000)
    }
  })

  ws.on('error', (err) => {
    console.error(`[${roomName}] ws error:`, err.message)
  })
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await connectRedis()

  const wss = new WebSocketServer({ port: PORT })
  wss.on('connection', handleConnection)
  wss.on('error', (err) => console.error('[WSS] error:', err))

  console.log(`[Collab] ws://0.0.0.0:${PORT}`)
}

main().catch(console.error)
