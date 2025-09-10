import React from 'react'

export default function VoteOverlay({ stage, votesA, votesB }) {
  const voting = stage === 'vote1' || stage === 'vote2'
  if (!voting) return null
  return (
    <div style={{
      position: 'absolute', top: 50, right: 20,
      background: 'rgba(14,20,40,0.6)', border: '1px solid #243057', padding: 10,
      borderRadius: 10
    }}>
      <div style={{fontSize:12, color:'var(--muted)'}}>Voting open</div>
      <div><span className="kbd">A</span> {votesA} | <span className="kbd">B</span> {votesB}</div>
    </div>
  )
}