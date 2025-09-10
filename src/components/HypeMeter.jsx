import React from 'react'

export default function HypeMeter({ value=0 }) {
  return (
    <div className="hype">
      <div className="bar" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}