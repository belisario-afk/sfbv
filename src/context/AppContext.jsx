import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { useBattleEngine } from '../hooks/useBattleEngine.js'
import { useChat } from '../hooks/useChat.js'
import { useSpotifyWebPlayer } from '../hooks/useSpotifyWebPlayer.js'
import { searchTracksByQuery, getTrackMeta } from '../lib/spotify.js'
import playbackConfig from '../config/playbackConfig.js'

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
    nowPair, winner, startIfIdle, pauseResume
  } = useBattleEngine()

  const {
    events, connectDefault, sendSystemMessage, setVoteHandler, setCommandHandler, setGiftHandler
  } = useChat(settings)

  // Spotify
  const {
    ensureAuth, playUri, resumeUriAt, currentlyPlaying, ready, getAccessToken, searchTracks
  } = useSpotifyWebPlayer(() => settings.spotifyClientId)

  // Process incoming chat for votes and commands
  useEffect(() => {
    setVoteHandler((userId, choice) => {
      processVoteFromUser(userId, choice)
    })
    setCommandHandler(async (cmd, args, evt) => {
      // rate limit, dedupe inside battle engine queue layer
      if (cmd === 'battle') {
        const q = args.join(' ').trim()
        if (!q) return
        try {
          let track
          if (q.startsWith('spotify:track:') || q.includes('open.spotify.com/track/')) {
            track = await getTrackMeta(q, getAccessToken)
          } else {
            const res = await searchTracks(q || '', getAccessToken, 1)
            track = res?.[0]
          }
          if (track) {
            addToQueue(track, evt)
            sendSystemMessage(`Queued: ${track.title} — requested by @${evt.username}`)
          } else {
            sendSystemMessage('No track found for your query.')
          }
        } catch (e) {
          sendSystemMessage('Search failed: ' + e.message)
        }
      }
      if (cmd === 'demo' || cmd === 'pair' || cmd === 'q') {
        // pick two from queue or recent search fallback
        if (queue.length >= 2) {
          // handled automatically on start
          sendSystemMessage('Next pair prepared.')
        } else {
          try {
            const seeds = await searchTracks('genre:bass OR genre:party', getAccessToken, 4)
            seeds?.forEach(t => addToQueue(t, evt))
          } catch {}
        }
      }
    })
    setGiftHandler((evt) => {
      // Hype and queue boost
      const value = Number(evt.value || 0)
      addHype(value)
    })
  }, [setVoteHandler, setCommandHandler, setGiftHandler, addToQueue, addHype, queue.length])

  // Battle loop: start -> play A -> play B -> vote1 -> play A -> play B -> vote2 -> winner -> victory_play -> finished -> next
  useEffect(() => {
    ensureAutoLoop({
      onPlay: async (entry, label) => {
        if (!entry?.uri) return
        await ensureAuth()
        await playUri(entry.uri)
      },
      onVictoryPlay: async (winning) => {
        if (!winning?.uri) return
        await ensureAuth()
        // Fallback: if duration < 40s, start at 5s
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
        // quick demo pair
        sendSystemMessage('Shortcut: demo pair requested.')
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
    events // expose chat events to UI
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}