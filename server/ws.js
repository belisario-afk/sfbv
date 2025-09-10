import { WebSocketServer } from 'ws'
import { TikTokLiveConnection } from 'tiktok-live-connector'
import { normalizeEvent } from './normalize.js'

const rooms = new Map() // roomId -> { conn, clients:Set<ws>, lastActive:number }

function ensureRoom(roomId) {
  roomId = (roomId || process.env.TIKTOK_USERNAME || 'lmohss').replace(/^@/,'')
  let entry = rooms.get(roomId)
  if (entry) return entry
  const conn = new TikTokLiveConnection(roomId, {
    // You can put options here. Library will discover live availability.
  })
  const clients = new Set()
  entry = { conn, clients, lastActive: Date.now() }
  rooms.set(roomId, entry)

  const sendAll = (payload) => {
    const data = JSON.stringify(payload)
    for (const ws of [...clients]) {
      try { ws.send(data) } catch (e) {
        try { ws.close() } catch {}
        clients.delete(ws)
      }
    }
  }

  conn.on('streamEnd', () => {
    sendAll({ type: 'room_info', text: `[${roomId}] stream ended`, ts: Date.now() })
  })

  conn.on('chat', (data) => {
    sendAll(normalizeEvent('chat', data))
  })

  conn.on('gift', (data) => {
    sendAll(normalizeEvent('gift', data))
  })

  conn.on('like', (data) => {
    sendAll(normalizeEvent('like', data))
  })

  conn.on('subscribe', (data) => {
    sendAll(normalizeEvent('subscribed', data))
  })

  conn.on('connected', () => {
    sendAll({ type:'room_info', text:`[${roomId}] connected`, ts: Date.now() })
  })

  conn.on('disconnected', () => {
    sendAll({ type:'room_info', text:`[${roomId}] disconnected`, ts: Date.now() })
  })

  conn.connect().catch((e) => {
    sendAll({ type:'room_info', text:`[${roomId}] connect error: ${e.message}`, ts: Date.now() })
  })

  return entry
}

export function setupWs(server) {
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    const { url } = req
    if (!url.startsWith('/ws')) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  })

  wss.on('connection', (ws, req) => {
    try {
      const u = new URL(req.url, 'http://localhost')
      const room = (u.searchParams.get('room') || process.env.TIKTOK_USERNAME || 'lmohss').replace(/^@/,'')
      const entry = ensureRoom(room)
      entry.clients.add(ws)
      entry.lastActive = Date.now()
      ws.send(JSON.stringify({ type:'room_info', text:`Connected to relay room ${room}`, ts: Date.now() }))

      ws.on('message', (msg) => {
        // reserved for future control messages
      })

      ws.on('close', () => {
        entry.clients.delete(ws)
        entry.lastActive = Date.now()
      })
    } catch {
      try { ws.close() } catch {}
    }
  })

  // housekeeping: optional cleanup of inactive rooms (not removing connections – library handles)
  setInterval(() => {
    const now = Date.now()
    for (const [room, entry] of rooms) {
      // If no clients for 10 minutes, we could disconnect. For stability, keep connections alive.
      if (entry.clients.size === 0 && now - entry.lastActive > 10 * 60 * 1000) {
        // noop: keep connection
      }
    }
  }, 60000)
}