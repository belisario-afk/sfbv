import React, { useEffect, useState } from 'react'
import { useAppStore } from '../context/AppContext.jsx'

export default function SettingsPanel() {
  const { settings, setSettings, spotifyAuthed, connectSpotify } = useAppStore()
  const [local, setLocal] = useState(settings)

  useEffect(() => setLocal(settings), [settings])

  function apply() {
    setSettings(local)
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
        <a href="https://belisario-afk.github.io/sfbv/callback" target="_blank" rel="noreferrer" className="badge">Callback URL</a>
      </div>
    </div>
  )
}