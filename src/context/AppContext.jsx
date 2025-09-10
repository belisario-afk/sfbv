import React, { createContext, useContext, useEffect, useState } from 'react'
import { useBattleEngine } from '../hooks/useBattleEngine.js'
import { useChat } from '../hooks/useChat.js'
import { useSpotifyWebPlayer } from '../hooks/useSpotifyWebPlayer.js'
import { getTrackMeta } from '../lib/spotify.js'

const AppContext = createContext(null)
export const useAppStore = () => useContext(AppContext)

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const s = JSON.parse(localStorage.getItem('sfbv_settings') || '{}')
    return {
      chatMode: s.chatMode || 'relay', // relay | direct | sim
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

  // Spotify
  const {
    ensureAuth, playUri, resumeUriAt, ready, getAccessToken, searchTracks
  } = useSpotifyWebPlayer(() => settings.spotifyClientId)

  // Kick off Spotify auth once (so !battle works even before first playback)
  useEffect(() => {
    const id = setTimeout(() => {
      ensureAuth().catch(() => {
        // user will be redirected for auth; ignore here
      })
    }, 800)
    return () => clearTimeout(id)
  }, [ensureAuth])

  // Process incoming chat for votes and commands
  useEffect(() => {
    setVoteHandler((userId, choice) => {
      processVoteFromUser(userId, choice)
    })
    setCommandHandler(async (cmd, args, evt) => {
      if (cmd === 'battle') {
        const q = args.join(' ').trim()
        if (!q) return
        try {
          await ensureAuth()
          let track
          if (q.startsWith('spotify:track:') || q.includes('open.spotify.com/track/')) {
            track = await getTrackMeta(q, getAccessToken)
          } else {
            const res = await searchTracks(q, undefined, 1)
            track = res?.[0]
          }
          if (track) {
            addToQueue(track, evt)
            sendSystemMessage(`Queued: ${track.title} — requested by ${evt.username}`)
          } else {
            sendSystemMessage('No track found for your query.')
          }
        } catch (e) {
          sendSystemMessage('Search failed, check Spotify auth. ' + (e?.message || e))
        }
      }
      if (cmd === 'pair' || cmd === 'q' || cmd === 'demo') {
        try {
          await ensureAuth()
          const seeds = await searchTracks('genre:party OR genre:dance', undefined, 4)
          seeds.slice(0,2).forEach(t => addToQueue(t, evt))
          sendSystemMessage('Demo pair queued.')
        } catch {}
      }
    })
    setGiftHandler((evt) => {
      const value = Number(evt.value || 0)
      addHype(value)
      onGiftFrom(evt.userId || evt.username, value)
    })
  }, [setVoteHandler, setCommandHandler, setGiftHandler, addToQueue, addHype, searchTracks, ensureAuth, getAccessToken, onGiftFrom])

  // Battle loop orchestration
  useEffect(() => {
    ensureAutoLoop({
      onPlay: async (entry) => {
        if (!entry?.uri) return
        await ensureAuth()
        await playUri(entry.uri)
      },
      onVictoryPlay: async (winning) => {
        if (!winning?.uri) return
        await ensureAuth()
        const pos = (winning.duration_ms && winning.duration_ms < 40000) ? 5000 : 40000
        await resumeUriAt(winning.uri, pos)
      }
    })
  }, [ensureAutoLoop, ensureAuth, playUri, resumeUriAt])

  function connectChatDefault() {
    connectDefault()
  }

  function initShortcuts() {
    const handler = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.isComposing)) return
      if (e.key === 'n') startIfIdle()
      if (e.key === 's') nextStage()
      if (e.key === 'p') pauseResume()
      if (e.key === 'q') {
        // enqueue a demo pair
        sendSystemMessage('Shortcut: demo pair requested.')
        ;(async () => {
          try {
            await ensureAuth()
            const seeds = await searchTracks('genre:party OR genre:dance', undefined, 4)
            seeds.slice(0,2).forEach(t => addToQueue(t, { username: 'local', displayName: 'Local' }))
          } catch {}
        })()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }

  const value = {
    settings, setSettings,
    stage, stageVersion, votesA, votesB, percentA, percentB,
    isWinnerStage, nextStage, startIfIdle, pauseResume,
    queue, nowPair, winner, hype,
    connectChatDefault, initShortcuts,
    events
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}