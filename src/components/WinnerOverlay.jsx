import React from 'react'

export default function WinnerOverlay({ winner }) {
  if (!winner) return null
  return (
    <div className="winner-overlay">
      <div style={{
        display:'flex', gap:16, alignItems:'center',
        background: 'rgba(17, 24, 39, 0.75)',
        border: '1px solid #253057',
        padding: 16,
        borderRadius: 12,
        boxShadow: '0 0 40px rgba(167,139,250,0.35), inset 0 0 50px rgba(125,211,252,0.15)'
      }}>
        <img src={winner.image} width="92" height="92" style={{borderRadius:12, boxShadow:'0 0 20px rgba(125,211,252,0.3)'}} />
        <div>
          <div style={{fontSize:12, color:'var(--muted)'}}>Winner</div>
          <div style={{fontSize:20, fontWeight:700}}>{winner.title}</div>
          <div style={{fontSize:13, color:'var(--muted)'}}>Requested by <span style={{color:'#fbbf24', fontWeight:700}}>{winner.requesterDisplay}</span> 👑</div>
        </div>
      </div>
    </div>
  )
}