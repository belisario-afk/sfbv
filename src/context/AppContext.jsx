import React, { createContext, useContext, useEffect, useState } from 'react'
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

// Normalize track to ensure trackId/uri/image/title/artists exist
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
    image: track.image || track.albumArt || track.albumImage || '',
    artists: track.artists || ''
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

  const spotifyAuthed = isSpotifyAuthedNow()

  // Helper: add placeholder from URI/URL when not authed
  const addManualUri = (uri, evt) => {
    const id = parseSpotifyIdFromText(uri) || uri
    const entry = normalizeTrack({
      id,
      uri: `spotify:track:${id}`,
      title: `Requested track ${id}`,
      image: '',
      duration_ms: 0,
      artists: ''
    })
    if (entry) addToQueue(entry, evt)
  }

  // Expose manual add/search helpers
  async function addTrackByQuery(q, evt) {
    if (!q) return
    const id = parseSpotifyIdFromText(q)
    try {
      if (id) {
        if (spotifyAuthed) {
          const t = await getTrackMeta(`spotify:track:${id}`, getAccessToken)
          const entry = normalizeTrack(t)
          if (entry) addToQueue(entry, evt)
        } else {
          addManualUri(`spotify:track:${id}`, evt)
        }
        return
      }
      // Text query
      if (!spotifyAuthed) {
        sendSystemMessage('Connect Spotify to search by text, or paste a Spotify track link.')
        return
      }
      const results = await searchTracks(q, undefined, 1)
      const entry = normalizeTrack(results?.[0])
      if (entry) addToQueue(entry, evt)
      else sendSystemMessage('No track found for your query.')
    } catch {
      sendSystemMessage('Search failed. Ensure Spotify is connected.')
    }
  }

  async function addTrackByUri(uri, evt) {
    await addTrackByQuery(uri, evt)
  }

  // Kick off Spotify auth shortly after load (optional)
  useEffect(() => {
    const id = setTimeout(() => {
      ensureAuth().catch(() => {})
    }, 800)
    return () => clearTimeout(id)
  }, [ensureAuth])

  // Wire chat commands
  useEffect(() => {
    setVoteHandler((userId, choice) => {
      processVoteFromUser(userId, choice)
    })

    setCommandHandler(async (cmd, args, evt) => {
      if (cmd === 'battle') {
        const q = args.join(' ').trim()
        if (!q) return
        await addTrackByQuery(q, evt)
      }
      if (cmd === 'pair' || cmd === 'q' || cmd === 'demo') {
        try {
          if (spotifyAuthed) {
            const seeds = await searchTracks('genre:party OR genre:dance', undefined, 4)
            const picks = (seeds || []).slice(0, 2).map(normalizeTrack).filter(Boolean)
            if (picks.length) {
              picks.forEach(t => addToQueue(t, evt))
              sendSystemMessage('Demo pair queued from Spotify search.')
              return
            }
          }
        } catch {}
        // Fallback URIs
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

  // Orchestrate playback; victory resume at 20s
  useEffect(() => {
    ensureAutoLoop({
      onPlay: async (entry) => {
        if (!entry?.uri) return
        await playUri(entry.uri)
      },
      onVictoryPlay: async (winning) => {
        if (!winning?.uri) return
        const pos = (winning.duration_ms && winning.duration_ms < 20000) ? 5000 : 20000
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
    connectSpotify: () => ensureAuth().catch(()=>{}),
    addTrackByQuery,
    addTrackByUri
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}