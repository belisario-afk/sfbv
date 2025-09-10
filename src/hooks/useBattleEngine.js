import { useCallback, useMemo, useRef, useState } from 'react'
import playbackConfig from '../config/playbackConfig.js'
import uiConfig from '../config/uiConfig.js'

function nowMs() { return Date.now() }

export function useBattleEngine() {
  const [stage, setStage] = useState('intro')
  const [stageVersion, setStageVersion] = useState(1)
  const timersRef = useRef(new Set()) // { id, version, cancel() }

  // Voting
  const [votesA, setVotesA] = useState(0)
  const [votesB, setVotesB] = useState(0)
  const votesMapRef = useRef(new Map()) // userId -> 'A' | 'B'
  const [votingEnabled, setVotingEnabled] = useState(false)

  // Queue and pairing
  const [queue, setQueue] = useState([])
  const recentAddRef = useRef(new Map()) // trackId -> ts
  const perUserAddTsRef = useRef(new Map()) // userId -> ts
  const requesterLatestTrackRef = useRef(new Map()) // userId -> trackId
  const queuedTrackIdsRef = useRef(new Set())

  const [nowPair, setNowPair] = useState({ A: null, B: null })
  const [winner, setWinner] = useState(null)
  const [hype, setHype] = useState(0)
  const pausedRef = useRef(false)

  const percentA = useMemo(() => {
    const total = votesA + votesB
    return total === 0 ? 50 : Math.round((votesA / total) * 100)
  }, [votesA, votesB])
  const percentB = 100 - percentA

  function clearTimers() {
    for (const t of timersRef.current) {
      try { t.cancel?.() } catch {}
    }
    timersRef.current.clear()
  }

  function stageGuardedTimeout(ms, fn) {
    const myVersion = stageVersion
    let active = true
    const id = setTimeout(() => {
      if (active && myVersion === stageVersion && !pausedRef.current) fn()
    }, ms)
    const cancel = () => { active = false; clearTimeout(id) }
    const rec = { id, version: myVersion, cancel }
    timersRef.current.add(rec)
    return rec
  }

  function bumpVersion() {
    setStageVersion(v => v + 1)
    clearTimers()
  }

  const resetVotes = useCallback(() => {
    votesMapRef.current.clear()
    setVotesA(0)
    setVotesB(0)
  }, [])

  const processVoteFromUser = useCallback((userId, choiceRaw) => {
    if (!votingEnabled) return
    const choice = (choiceRaw || '').toUpperCase()
    if (choice !== 'A' && choice !== 'B') return
    if (votesMapRef.current.has(userId)) return
    votesMapRef.current.set(userId, choice)
    if (choice === 'A') setVotesA(v => v + 1)
    else setVotesB(v => v + 1)
  }, [votingEnabled])

  const addToQueue = useCallback((track, evt) => {
    const userId = evt?.userId || evt?.username || 'anon'
    const now = nowMs()
    const lastAdd = perUserAddTsRef.current.get(userId) || 0
    if (now - lastAdd < 5000) return // per-user rate limit 5s

    // Dedup by trackId/uri
    const trackId = track.id || track.trackId || track.uri
    if (!trackId) return
    if (queuedTrackIdsRef.current.has(trackId)) return

    // recent-add 8s protection
    const rts = recentAddRef.current.get(trackId) || 0
    if (now - rts < 8000) return

    const entry = {
      trackId,
      uri: track.uri,
      title: track.title || track.name,
      image: track.image,
      artists: track.artists || '',
      duration_ms: track.duration_ms,
      username: '@' + (evt?.username || 'unknown'),
      requesterId: userId,
      requesterDisplay: evt?.displayName || evt?.username || 'unknown',
      addedAt: now
    }
    setQueue(q => [...q, entry])
    queuedTrackIdsRef.current.add(trackId)
    recentAddRef.current.set(trackId, now)
    perUserAddTsRef.current.set(userId, now)
    requesterLatestTrackRef.current.set(userId, trackId)
  }, [])

  const boostRequester = useCallback((userId) => {
    const lastTrackId = requesterLatestTrackRef.current.get(userId)
    if (!lastTrackId) return
    setQueue(q => {
      const idx = q.findIndex(e => e.trackId === lastTrackId)
      if (idx <= 0) return q
      const copy = q.slice()
      const [item] = copy.splice(idx, 1)
      copy.unshift(item)
      return copy
    })
  }, [])

  // Prepare the pair without removing from queue
  const popPairForBattle = useCallback(() => {
    const A = queue[0] || null
    const B = queue[1] || null
    if (A && B) {
      setNowPair({ A, B })
      return { A, B }
    }
    return { A: null, B: null }
  }, [queue])

  const startIntro = useCallback(() => {
    bumpVersion()
    setStage('intro')
    resetVotes()
    setWinner(null)
  }, [])

  const go = useCallback((next) => {
    setStage(next)
  }, [])

  const ensureAutoLoop = useCallback(({ onPlay, onVictoryPlay }) => {
    const schedule = (ms, fn) => stageGuardedTimeout(ms, fn)

    const sequence = async () => {
      if (stage === 'intro') {
        // Prepare pair (non-destructive)
        if (!nowPair.A || !nowPair.B) {
          const pair = popPairForBattle()
          if (!pair.A || !pair.B) {
            // Not enough songs; wait and retry
            schedule(2000, () => ensureAutoLoop({ onPlay, onVictoryPlay }))
            return
          }
        }
        go('r1A_play')
        schedule(playbackConfig.playMs, () => go('r1B_play'))
        schedule(playbackConfig.playMs * 2 + 100, () => {
          setVotingEnabled(true)
          go('vote1')
        })
      } else if (stage === 'r1A_play') {
        // Consume the prepared pair now that the battle starts
        if (nowPair.A && nowPair.B) {
          setQueue(q => {
            const copy = q.slice()
            if (copy[0]?.trackId === nowPair.A.trackId && copy[1]?.trackId === nowPair.B.trackId) {
              return copy.slice(2)
            }
            return q
          })
        }
        if (nowPair.A) onPlay?.(nowPair.A, 'A1')
      } else if (stage === 'r1B_play') {
        if (nowPair.B) onPlay?.(nowPair.B, 'B1')
      } else if (stage === 'vote1') {
        schedule(playbackConfig.voteMs, () => {
          go('r2A_play')
          setVotingEnabled(false)
        })
      } else if (stage === 'r2A_play') {
        if (nowPair.A) onPlay?.(nowPair.A, 'A2')
        schedule(playbackConfig.playMs, () => go('r2B_play'))
      } else if (stage === 'r2B_play') {
        if (nowPair.B) onPlay?.(nowPair.B, 'B2')
        schedule(playbackConfig.playMs, () => {
          setVotingEnabled(true)
          go('vote2')
        })
      } else if (stage === 'vote2') {
        schedule(playbackConfig.voteMs, () => {
          setVotingEnabled(false)
          const w = votesA >= votesB ? nowPair.A : nowPair.B
          setWinner(w)
          go('winner')
        })
      } else if (stage === 'winner') {
        schedule(1000, () => {
          go('victory_play')
        })
      } else if (stage === 'victory_play') {
        if (winner) onVictoryPlay?.(winner)
        schedule(playbackConfig.victoryMs, () => {
          go('finished')
        })
      } else if (stage === 'finished') {
        resetVotes()
        setNowPair({ A: null, B: null })
        bumpVersion()
        go('intro')
        schedule(500, () => ensureAutoLoop({ onPlay, onVictoryPlay }))
      }
    }
    sequence()
  }, [stage, stageVersion, nowPair.A, nowPair.B, winner, votesA, votesB, popPairForBattle])

  const addHype = useCallback((value) => {
    setHype(h => {
      const next = Math.min(100, h + Math.min(20, Math.max(1, Math.floor(value/2))))
      return next
    })
    stageGuardedTimeout(3000, () => setHype(h => Math.max(0, h - 5)))
  }, [])

  const startIfIdle = useCallback(() => {
    if (stage === 'intro' && (!nowPair.A || !nowPair.B)) {
      popPairForBattle() // non-destructive; leaves songs visible
    }
    ensureAutoLoop({})
  }, [stage, nowPair.A, nowPair.B, popPairForBattle])

  const pauseResume = useCallback(() => {
    pausedRef.current = !pausedRef.current
  }, [])

  function isWinnerStage() {
    return stage === 'winner' || stage === 'victory_play'
  }

  const onGiftFrom = useCallback((userId, value) => {
    addHype(value || 1)
    if ((value || 0) >= 10) boostRequester(userId)
  }, [])

  return {
    stage, stageVersion, isWinnerStage,
    votesA, votesB, percentA, percentB, votingEnabled, setVotingEnabled,
    queue, addToQueue, popPairForBattle,
    nowPair, winner, setWinner,
    hype, addHype, setHype,
    processVoteFromUser, resetVotes,
    startIntro,
    nextStage: () => {
      if (stage === 'intro') {
        if (!nowPair.A || !nowPair.B) popPairForBattle()
        return
      }
      bumpVersion()
      const order = ['intro','r1A_play','r1B_play','vote1','r2A_play','r2B_play','vote2','winner','victory_play','finished']
      const idx = order.indexOf(stage)
      const next = order[(idx + 1) % order.length]
      setStage(next)
    },
    ensureAutoLoop,
    startIfIdle,
    pauseResume,
    onGiftFrom
  }
}