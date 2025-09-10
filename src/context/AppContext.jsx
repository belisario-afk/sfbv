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
    const id = (uri.startsWith('spotify:track:') ? uri.split(':').pop() : uri)
    const entry = {
      id,
      uri: uri.startsWith('spotify:') ? uri : `spotify:track:${id}`,
      title: `Requested track ${id}`,
      image: '',
      duration_ms: 0
    }
    addToQueue(entry, evt)
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

        // If not authed, still allow spotify URLs/URIs as placeholders
        const trackId = parseSpotifyIdFromText(q)
        if (!spotifyAuthed && !trackId) {
          sendSystemMessage('Spotify not connected. Open Settings → Connect Spotify to enable search. You can still send a Spotify track link.')
          return
        }

        try {
          if (trackId && !spotifyAuthed) {
            // Add placeholder immediately
            addManualUri(`spotify:track:${trackId}`, evt)
            sendSystemMessage(`Queued by ${evt.username}: spotify:track:${trackId}`)
            return
          }

          // We are authed: resolve to real track metadata
          let track
          if (trackId) {
            track = await getTrackMeta(`spotify:track:${trackId}`, getAccessToken)
          } else {
            const results = await searchTracks(q, undefined, 1)
            track = results?.[0]
          }
          if (track) {
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
            if (seeds?.length) {
              seeds.slice(0,2).forEach(t => addToQueue(t, evt))
              sendSystemMessage('Demo pair queued from Spotify search.')
              return
            }
          }
        } catch {}
        // Fallback to two known URIs as placeholders
        addManualUri('spotify:track:4uLU6hMCjMI75M1A2tKUQC', { username: 'demo', displayName: 'Demo' }) // NGGYU
        addManualUri('spotify:track:3n3Ppam7vgaVa1iaRUc9Lp', { username: 'demo', displayName: 'Demo' }) // Mr. Brightside
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
                seeds.slice(0,2).forEach(t => addToQueue(t, { username: 'local', displayName: 'Local' }))
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