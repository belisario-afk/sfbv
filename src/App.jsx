import React, { useEffect } from 'react'
import { useAppStore } from './context/AppContext.jsx'
import NeoArena from './components/arena/NeoArena.jsx'
import WinnerOverlay from './components/WinnerOverlay.jsx'
import ChatTicker from './components/ChatTicker.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import HypeMeter from './components/HypeMeter.jsx'
import SpotifyTrackSearchModal from './components/SpotifyTrackSearchModal.jsx'
import VoteOverlay from './components/VoteOverlay.jsx'

export default function App() {
  const {
    stage, stageVersion, votesA, votesB, percentA, percentB,
    queue, nowPair, winner, hype, connectChatDefault, initShortcuts,
    isWinnerStage, settings, startIfIdle, nextStage, pauseResume
  } = useAppStore()

  useEffect(() => {
    connectChatDefault()
    initShortcuts()
    // Auto-start intro if idle
    const t = setTimeout(() => startIfIdle(), 800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="layout">
      <header className="header">
        <div className="brand">SFBV • Song Fight Battle via TikTok + Spotify</div>
        <div className="badge">
          Stage: {stage} • v{stageVersion} • Mode: {settings.chatMode}
        </div>
      </header>

      <main className="main">
        <div className="leftCol">
          <div className="panel">
            <div className="panel-header">Queue</div>
            <div className="panel-body">
              {queue.length === 0 && (
                <div style={{ color: 'var(--muted)' }}>
                  Queue empty. Viewers add with "!battle &lt;song or Spotify URL&gt;" in TikTok chat.
                </div>
              )}
              {queue.map((q, i) => (
                <div key={q.trackId} className="queue-item">
                  <img src={q.image} alt="" width="56" height="56" style={{ borderRadius: 8 }} />
                  <div className="meta">
                    <div className="title">{q.title}</div>
                    <div className="by">from {q.requesterDisplay} • {q.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>#{i + 1} • {q.uri}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">Settings</div>
            <div className="panel-body">
              <SettingsPanel />
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button onClick={startIfIdle}><span className="kbd">n</span> Start/Next</button>
                <button onClick={() => nextStage()}><span className="kbd">s</span> Skip Stage</button>
                <button onClick={() => pauseResume()}><span className="kbd">p</span> Pause/Resume</button>
              </div>
            </div>
          </div>
        </div>

        <div className="centerCol panel" style={{ position: 'relative' }}>
          <div className="panel-header">Arena</div>
          <div className="panel-body" style={{ padding: 0, position: 'relative' }}>
            <div className="health-bars">
              <div className="health-bar"><div className="fillA" style={{ width: `${percentA}%` }} /></div>
              <div className="health-bar"><div className="fillB" style={{ width: `${percentB}%` }} /></div>
            </div>
            <NeoArena percentA={percentA} percentB={percentB} stage={stage} />
            {isWinnerStage() && <WinnerOverlay winner={winner} />}
            <VoteOverlay stage={stage} votesA={votesA} votesB={votesB} />
            <div className="footer">
              TikTok: @lmohss • Spotify powered • Relay default • Hotkeys: n,s,p,q
            </div>
          </div>
        </div>

        <div className="rightCol">
          <div className="panel" style={{ gridArea: 'chat' }}>
            <div className="panel-header">Chat</div>
            <div className="panel-body">
              <ChatTicker />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">Hype Meter</div>
            <div className="panel-body">
              <HypeMeter value={hype} />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Gifts fill the hype meter and can boost requesters’ songs.</div>
            </div>
          </div>
        </div>
      </main>

      <SpotifyTrackSearchModal />
    </div>
  )
}