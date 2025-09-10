import { WebSocketServer } from 'ws'
import { normalizeEvent } from './normalize.js'

// Lazy-load the TikTok connector so the app can run even if the package isn't installed/resolvable
let connectorCache = { loaded: false, ok: false, TikTokLiveConnection: null }
async function getConnector() {
  if (connectorCache.loaded) return connectorCache
  connectorCache.loaded = true
  try {
    const mod = await import('tiktok-live-connector')
    const TikTokLiveConnection =
      mod?.TikTokLiveConnection || mod?.default?.TikTokLiveConnection || mod?.default
    if (TikTokLiveConnection) {
      connectorCache.ok = true
      connectorCache.TikTokLiveConnection = TikTokLiveConnection
    } else {
      connectorCache.ok = false
    }
  } catch (e) {
    connectorCache.ok = false
    console.warn('TikTok connector not available:', e?.message || e)
  }
  return connectorCache
}

const rooms = new Map() // roomId -> { conn, clients:Set<ws>, lastActive:number, connected:boolean }

async function ensureRoom(roomId) {
  roomId = (roomId || process.env.TIKTOK_USERNAME || 'lmohss').replace(/^@/, '')
  let entry = rooms.get(roomId)
  if (entry) return entry

  const clients = new Set()
  entry = { conn: null, clients, lastActive: Date.now(), connected: false }
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

  const { ok, TikTokLiveConnection } = await getConnector()
  if (!ok) {
    sendAll({
      type: 'room_info',
      text: `[${roomId}] TikTok connector unavailable on server. Relay running without TikTok source.`,
      ts: Date.now()
    })
    // Keep a heartbeat so clients know relay is alive
    setInterval(() => {
      sendAll({ type: 'room_info', text: `[${roomId}] relay heartbeat`, ts: Date.now() })
    }, 30000)
    return entry
  }

  // Real TikTok connection
  const conn = new TikTokLiveConnection(roomId, {})
  entry.conn = conn

  conn.on('streamEnd', () => {
    sendAll({ type: 'room_info', text: `[${roomId}] stream ended`, ts: Date.now() })
  })

  conn.on('chat', (data) => sendAll(normalizeEvent('chat', data)))
  conn.on('gift', (data) => sendAll(normalizeEvent('gift', data)))
  conn.on('like', (data) => sendAll(normalizeEvent('like', data)))
  conn.on('subscribe', (data) => sendAll(normalizeEvent('subscribed', data)))

  conn.on('connected', () => {
    entry.connected = true
    sendAll({ type: 'room_info', text: `[${roomId}] connected`, ts: Date.now() })
  })
  conn.on('disconnected', () => {
    entry.connected = false
    sendAll({ type: 'room_info', text: `[${roomId}] disconnected`, ts: Date.now() })
  })

  conn.connect().catch((e) => {
    sendAll({ type: 'room_info', text: `[${roomId}] connect error: ${e.message}`, ts: Date.now() })
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
    (async () => {
      try {
        const u = new URL(req.url, 'http://localhost')
        const room = (u.searchParams.get('room') || process.env.TIKTOK_USERNAME || 'lmohss').replace(/^@/, '')
        const entry = await ensureRoom(room)
        entry.clients.add(ws)
        entry.lastActive = Date.now()
        ws.send(JSON.stringify({ type: 'room_info', text: `Connected to relay room ${room}`, ts: Date.now() }))

        ws.on('message', (msg) => {
          // Reserved for future control messages
        })
        ws.on('close', () => {
          entry.clients.delete(ws)
          entry.lastActive = Date.now()
        })
      } catch {
        try { ws.close() } catch {}
      }
    })()
  })

  // Housekeeping (optional, keep TikTok connection alive)
  setInterval(() => {
    const now = Date.now()
    for (const [room, entry] of rooms) {
      if (entry.clients.size === 0) {
        // no-op on free plan; keep connections alive or let library handle
      }
    }
  }, 60000)
}