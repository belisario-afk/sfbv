import React, { useEffect, useState } from 'react'
import { useAppStore } from '../context/AppContext.jsx'

export default function SettingsPanel() {
  const {
    settings, setSettings, spotifyAuthed, connectSpotify,
    addTrackByQuery
  } = useAppStore()
  const [local, setLocal] = useState(settings)
  const [manual, setManual] = useState('')

  useEffect(() => setLocal(settings), [settings])

  function apply() {
    setSettings(local)
  }

  async function handleAdd(e) {
    e.preventDefault()
    const q = manual.trim()
    if (!q) return
    await addTrackByQuery(q, { username: 'manual', displayName: 'Manual' })
    setManual('')
  }

  return (
    <div className="settings-grid">
      <div>
        <label className="label">Chat mode</label>
        <select value={local.chatMode} onChange={(e)=>setLocal({...local, chatMode: e.target.value})}>
          <option value="relay">Relay (default)</option>
          <option value="sim">Simulation (local)</option>
          <option value="direct">Direct (experimental)</option>
        </select>
      </div>
      <div>
        <label className="label">TikTok room</label>
        <input className="input" value={local.tiktokRoom} onChange={(e)=>setLocal({...local, tiktokRoom: e.target.value})}/>
      </div>
      <div>
        <label className="label">Relay WS URL</label>
        <input className="input" value={local.relayUrl} onChange={(e)=>setLocal({...local, relayUrl: e.target.value})}/>
      </div>
      <div>
        <label className="label">Spotify Client ID</label>
        <input className="input" value={local.spotifyClientId} onChange={(e)=>setLocal({...local, spotifyClientId: e.target.value})}/>
      </div>
      <div>
        <label className="label">FX Quality</label>
        <select value={local.fxQuality} onChange={(e)=>setLocal({...local, fxQuality: e.target.value})}>
          <option value="low">Low</option>
          <option value="high">High</option>
        </select>
      </div>

      <div style={{display:'flex', alignItems:'end', gap:8}}>
        <button onClick={apply}>Apply</button>
        <span className="badge">Spotify: {spotifyAuthed ? 'Connected' : 'Not connected'}</span>
        <button onClick={connectSpotify}>Connect Spotify</button>
        <a href={`${location.origin}/sfbv/callback`} target="_blank" rel="noreferrer" className="badge">Callback URL</a>
      </div>

      <div style={{ gridColumn: '1 / -1', marginTop: 10 }}>
        <label className="label">Manual add / search (Spotify URL/URI or text)</label>
        <form onSubmit={handleAdd} style={{ display:'flex', gap:8 }}>
          <input
            className="input"
            placeholder="e.g. https://open.spotify.com/track/... or Sandstorm"
            value={manual}
            onChange={(e)=>setManual(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          Tip: Paste a Spotify track link to add immediately; text search requires Spotify to be connected.
        </div>
      </div>
    </div>
  )
}