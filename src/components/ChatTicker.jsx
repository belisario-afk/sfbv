import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../context/AppContext.jsx'

export default function ChatTicker() {
  const { events } = useAppStore()
  const containerRef = useRef(null)

  // Auto-scroll
  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events.length])

  return (
    <div ref={containerRef} style={{height:'100%', overflow:'auto'}}>
      {events.map((e, i) => (
        <div key={i} className="chat-line">
          {e.type === 'chat' && (<>
            <span className="chat-user">{e.displayName || e.username}:</span>
            <span>{e.text}</span>
          </>)}
          {e.type === 'gift' && (<>
            <span className="chat-gift">🎁 {e.displayName || e.username}</span>
            <span> sent {e.giftName || 'a gift'} ({e.value || 1})</span>
          </>)}
          {e.type === 'room_info' && (<span style={{color:'var(--muted)'}}>{e.text}</span>)}
          {e.type === 'like' && (<span style={{color:'var(--muted)'}}>❤️ {e.displayName || e.username} liked the stream</span>)}
        </div>
      ))}
    </div>
  )
}