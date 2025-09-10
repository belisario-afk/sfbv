import React from 'react'

export default function WinnerFocus({ winner }) {
  if (!winner) return null
  return (
    <div style={{position:'absolute', left:12, bottom:12, display:'flex', gap:8, alignItems:'center',
      background:'rgba(17,24,39,0.5)', border:'1px solid #243057', padding:8, borderRadius:10}}>
      <img src={winner.image} width="48" height="48" style={{borderRadius:8}}/>
      <div style={{display:'flex', flexDirection:'column'}}>
        <div style={{fontWeight:600}}>{winner.title}</div>
        <div style={{fontSize:12, color:'var(--muted)'}}>{winner.username}</div>
      </div>
    </div>
  )
}