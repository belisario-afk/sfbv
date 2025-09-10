import React, { useMemo } from 'react'
import { useAppStore } from '../context/AppContext.jsx'

export default function NowPlayingOverlay() {
  const { stage, nowPair, winner } = useAppStore()

  const current = useMemo(() => {
    if (stage === 'r1A_play' || stage === 'r2A_play') return { side: 'A', t: nowPair.A }
    if (stage === 'r1B_play' || stage === 'r2B_play') return { side: 'B', t: nowPair.B }
    if (stage === 'victory_play') return { side: 'WIN', t: winner }
    return { side: null, t: null }
  }, [stage, nowPair.A, nowPair.B, winner])

  if (!current.t) return null

  const t = current.t
  return (
    <div style={{
      position: 'absolute',
      left: 12,
      bottom: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'rgba(15, 21, 40, 0.65)',
      border: '1px solid #1b2542',
      borderRadius: 10,
      padding: '8px 10px',
      backdropFilter: 'blur(4px)'
    }}>
      <img
        src={t.image || ''}
        alt=""
        width="56"
        height="56"
        style={{ borderRadius: 8, background:'#0a0f20', objectFit: 'cover' }}
      />
      <div style={{ display:'flex', flexDirection:'column' }}>
        <div style={{ fontWeight: 700 }}>
          {current.side ? `[${current.side}] ` : ''}{t.title}
        </div>
        <div style={{ fontSize: 12, color:'var(--muted)' }}>
          {t.artists || ''}
        </div>
      </div>
    </div>
  )
}