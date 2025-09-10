import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useBattleEngine } from '../hooks/useBattleEngine.js'
import { useChat } from '../hooks/useChat.js'
import { useSpotifyWebPlayer } from '../hooks/useSpotifyWebPlayer.js'
import { getTrackMeta } from '../lib/spotify.js'

const AppContext = createContext(null)
export const useAppStore = () => useContext(AppContext)

function isSpotifyAuthedNow() {
  try {
    const t = JSON.parse(localStorage.getItem('spotify_tokens') || 'null')
    return !!(t && t.expires_at && t.expires_at > Date.now() + 15000)
  } catch { return false }
}

function parseSpotifyIdFromText(q) {
  if (!q) return null
  if (q.startsWith('spotify:track:')) return q.split(':').pop()
  const m = q.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/)
  return m ? m[1] : null
}

// Ensure any track we add has the fields the engine/UI expect
function normalizeTrack(track) {
  if (!track) return null
  const uri = track.uri || (track.id ? `spotify:track:${track.id}` : '')
  const trackId =
    track.trackId ||
    track.id ||
    (uri && uri.startsWith('spotify:track:') ? uri.split(':').pop() : null)

  if (!trackId) return null

  return {
    ...track,
    trackId,
    uri: uri || `spotify:track:${trackId}`,
    title: track.title || track.name || `Track ${trackId}`,
    image: track.image || track.albumArt || track.albumImage || ''
  }
}

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const s = JSON.parse(localStorage.getItem('sfbv_settings') || '{}')
    return {
      chatMode: s.chatMode || 'relay',
      relayUrl: s.relayUrl || 'wss://sfbv-relay.onrender.com/ws',
      tiktokRoom: s.tiktokRoom || 'lmohss',
      spotifyClientId: s.spotifyClientId || '927fda6918514f96903e828fcd6bb576',
      fxQuality: s.fxQuality || 'high'
    }
  })
  useEffect(() => {
    localStorage.setItem('sfbv_settings', JSON.stringify(settings))
    if (settings.spotifyClientId) {
      localStorage.setItem('spotify_client_id', settings.spotifyClientId)
    }
  }, [settings])

  const spotifyAuthed = isSpotifyAuthedNow()

  const {
    stage, stageVersion, startIntro, nextStage, isWinnerStage, setWinner,
    setVotingEnabled, processVoteFromUser, resetVotes, votesA, votesB, percentA, percentB,
    queue, addToQueue, popPairForBattle, ensureAutoLoop, hype, addHype, setHype,
    nowPair, winner, startIfIdle, pauseResume, onGiftFrom
  } = useBattleEngine()

  const {
    events, connectDefault, sendSystemMessage, setVoteHandler, setCommandHandler, setGiftHandler
  } = useChat(settings)

  const {
    ensureAuth, playUri, resumeUriAt, getAccessToken, searchTracks
  } = useSpotifyWebPlayer(() => settings.spotifyClientId)

  // Helper: add placeholder track when only a Spotify URI/URL is provided and we're not authed yet
  const addManualUri = (uri, evt) => {
    const id = parseSpotifyIdFromText(uri) || uri
    const entry = normalizeTrack({
      id,
      uri: `spotify:track:${id}`,
      title: `Requested track ${id}`,
      image: '',
      duration_ms: 0,
      requesterDisplay: evt?.displayName || evt?.username || 'viewer',
      username: evt?.username || ''
    })
    if (entry) addToQueue(entry, evt)
  }

  // Try to auth shortly after load
  useEffect(() => {
    const id = setTimeout(() => {
      ensureAuth().catch(() => {})
    }, 800)
    return () => clearTimeout(id)
  }, [ensureAuth])

  // Command wiring
  useEffect(() => {
    setVoteHandler((userId, choice) => {
      processVoteFromUser(userId, choice)
    })

    setCommandHandler(async (cmd, args, evt) => {
      if (cmd === 'battle') {
        const q = args.join(' ').trim()
        if (!q) return

        const trackIdFromText = parseSpotifyIdFromText(q)
        if (!spotifyAuthed && !trackIdFromText) {
          sendSystemMessage('Spotify not connected. Connect in Settings, or send a Spotify track link.')
          return
        }

        try {
          if (trackIdFromText && !spotifyAuthed) {
            // Add placeholder immediately when not authed
            addManualUri(`spotify:track:${trackIdFromText}`, evt)
            sendSystemMessage(`Queued by ${evt.username}: spotify:track:${trackIdFromText}`)
            return
          }

          // We are authed: resolve to real track metadata or search by text
          let track
          if (trackIdFromText) {
            const raw = await getTrackMeta(`spotify:track:${trackIdFromText}`, getAccessToken)
            track = normalizeTrack(raw)
          } else {
            const results = await searchTracks(q, undefined, 1)
            track = normalizeTrack(results?.[0])
          }
          if (track) {
            // stamp requester for UI
            track.requesterDisplay = evt?.displayName || evt?.username || 'viewer'
            track.username = evt?.username || ''
            addToQueue(track, evt)
            sendSystemMessage(`Queued: ${track.title} — requested by ${evt.username}`)
          } else {
            sendSystemMessage('No track found for your query.')
          }
        } catch (e) {
          sendSystemMessage('Search failed. Ensure Spotify is connected in Settings.')
        }
      }

      if (cmd === 'pair' || cmd === 'q' || cmd === 'demo') {
        try {
          if (spotifyAuthed) {
            const seeds = await searchTracks('genre:party OR genre:dance', undefined, 4)
            const picks = (seeds || []).slice(0, 2).map(normalizeTrack).filter(Boolean)
            if (picks.length) {
              picks.forEach(t => {
                t.requesterDisplay = evt?.displayName || evt?.username || 'demo'
                t.username = evt?.username || 'demo'
                addToQueue(t, evt)
              })
              sendSystemMessage('Demo pair queued from Spotify search.')
              return
            }
          }
        } catch {}
        // Fallback to two known URIs as placeholders
        addManualUri('spotify:track:4uLU6hMCjMI75M1A2tKUQC', { username: 'demo', displayName: 'Demo' })
        addManualUri('spotify:track:3n3Ppam7vgaVa1iaRUc9Lp', { username: 'demo', displayName: 'Demo' })
        sendSystemMessage('Demo pair queued (placeholder URIs).')
      }
    })

    setGiftHandler((evt) => {
      const value = Number(evt.value || 0)
      addHype(value)
      onGiftFrom(evt.userId || evt.username, value)
    })
  }, [setVoteHandler, setCommandHandler, setGiftHandler, addToQueue, addHype, searchTracks, getAccessToken, spotifyAuthed, onGiftFrom])

  // Auto loop playback handlers
  useEffect(() => {
    ensureAutoLoop({
      onPlay: async (entry) => {
        if (!entry?.uri) return
        await playUri(entry.uri)
      },
      onVictoryPlay: async (winning) => {
        if (!winning?.uri) return
        const pos = (winning.duration_ms && winning.duration_ms < 40000) ? 5000 : 40000
        await resumeUriAt(winning.uri, pos)
      }
    })
  }, [ensureAutoLoop, playUri, resumeUriAt])

  const value = {
    settings, setSettings,
    stage, stageVersion, votesA, votesB, percentA, percentB,
    isWinnerStage, nextStage, startIfIdle, pauseResume,
    queue, nowPair, winner, hype,
    connectChatDefault: connectDefault,
    initShortcuts: () => {
      const handler = (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.isComposing)) return
        if (e.key === 'n') startIfIdle()
        if (e.key === 's') nextStage()
        if (e.key === 'p') pauseResume()
        if (e.key === 'q') {
          // trigger demo pair
          ;(async () => {
            try {
              if (spotifyAuthed) {
                const seeds = await searchTracks('genre:party OR genre:dance', undefined, 4)
                ;(seeds || []).slice(0,2).map(normalizeTrack).filter(Boolean).forEach(t =>
                  addToQueue({ ...t, requesterDisplay: 'Local', username: 'local' }, { username: 'local' })
                )
              } else {
                addManualUri('spotify:track:4uLU6hMCjMI75M1A2tKUQC', { username: 'demo', displayName: 'Demo' })
                addManualUri('spotify:track:3n3Ppam7vgaVa1iaRUc9Lp', { username: 'demo', displayName: 'Demo' })
              }
            } catch {}
          })()
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    },
    events,
    spotifyAuthed,
    connectSpotify: () => ensureAuth().catch(()=>{})
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}