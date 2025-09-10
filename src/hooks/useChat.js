import { useEffect, useRef, useState } from 'react'

/**
 * Unified events:
 * {
 *  type: "chat" | "gift" | "like" | "subscribed" | "room_info",
 *  userId, username, displayName, avatarUrl, text?, value?, giftName?, ts
 * }
 */

const SIM_USERS = ['nova','lyra','kai','zen','mira','zed','luna','juno']
function randPick(arr){ return arr[Math.floor(Math.random()*arr.length)] }

export function useChat(settings) {
  const [events, setEvents] = useState([])
  const wsRef = useRef(null)
  const voteHandlerRef = useRef(null)
  const commandHandlerRef = useRef(null)
  const giftHandlerRef = useRef(null)

  function append(evt) {
    setEvents(e => [...e.slice(-400), evt])
    // vote parse
    if (evt.type === 'chat' && evt.text) {
      const t = evt.text.trim().toLowerCase()
      if (t === 'a' || t === '!a' || t.includes(' vote a')) voteHandlerRef.current?.(evt.userId || evt.username, 'A')
      if (t === 'b' || t === '!b' || t.includes(' vote b')) voteHandlerRef.current?.(evt.userId || evt.username, 'B')

      if (t.startsWith('!battle')) {
        const args = t.replace('!battle','').trim().split(/\s+/).filter(Boolean)
        commandHandlerRef.current?.('battle', args, evt)
      }
      if (t.startsWith('!pair') || t.startsWith('!demo') || t === 'q') {
        const args = t.replace(/^!(pair|demo)/,'').trim().split(/\s+/).filter(Boolean)
        commandHandlerRef.current?.('pair', args, evt)
      }
    }
    if (evt.type === 'gift') {
      giftHandlerRef.current?.(evt)
    }
  }

  function connectRelay() {
    const url = new URL(settings.relayUrl)
    if (!url.searchParams.has('room')) {
      url.searchParams.set('room', settings.tiktokRoom || 'lmohss')
    }
    const ws = new WebSocket(url.toString())
    wsRef.current = ws
    ws.addEventListener('open', () => {
      append({type:'room_info', text:`[relay connected ${url.toString()}]`, ts: Date.now()})
    })
    ws.addEventListener('message', (msg) => {
      try {
        const evt = JSON.parse(msg.data)
        append(evt)
      } catch {}
    })
    ws.addEventListener('close', () => {
      append({type:'room_info', text:'[relay disconnected]', ts: Date.now()})
      // reconnect
      setTimeout(() => connectRelay(), 2000)
    })
  }

  function connectDirect() {
    append({type:'room_info', text:'[direct mode] TikTok direct browser SDK not guaranteed; use relay for reliability.', ts: Date.now()})
  }

  function connectSim() {
    append({type:'room_info', text:'[simulation mode active]', ts: Date.now()})
    const emit = () => {
      const kind = Math.random()
      const user = randPick(SIM_USERS)
      if (kind < 0.65) {
        const vote = Math.random() < 0.5 ? '!a' : '!b'
        append({
          type: 'chat',
          userId: 'sim:'+user,
          username: '@'+user,
          displayName: user.toUpperCase(),
          avatarUrl: '',
          text: Math.random() < 0.2 ? `!battle ${Math.random()<0.5?'spotify:track:4uLU6hMCjMI75M1A2tKUQC':'Sandstorm'}` : vote,
          ts: Date.now()
        })
      } else if (kind < 0.85) {
        append({
          type: 'gift',
          userId: 'sim:'+user,
          username: '@'+user,
          displayName: user,
          value: Math.random()<0.5?10:1,
          giftName: 'Rose',
          ts: Date.now()
        })
      } else {
        append({ type:'like', userId:'sim:'+user, username:'@'+user, ts: Date.now() })
      }
    }
    const id = setInterval(emit, 1000)
    wsRef.current = { close: () => clearInterval(id) }
  }

  function connectDefault() {
    if (wsRef.current) try { wsRef.current.close() } catch {}
    if (settings.chatMode === 'relay') connectRelay()
    else if (settings.chatMode === 'direct') connectDirect()
    else connectSim()
  }

  useEffect(() => {
    return () => { if (wsRef.current) try { wsRef.current.close() } catch {} }
  }, [])

  return {
    events,
    connectDefault,
    sendSystemMessage: (text) => append({type:'room_info', text, ts: Date.now()}),
    setVoteHandler: fn => voteHandlerRef.current = fn,
    setCommandHandler: fn => commandHandlerRef.current = fn,
    setGiftHandler: fn => giftHandlerRef.current = fn
  }
}