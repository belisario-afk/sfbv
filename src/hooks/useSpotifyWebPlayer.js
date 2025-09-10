import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureTokens, refreshIfNeeded, searchTracksByQuery, getTrackMetaFromUrl, playUrisOnUser, transferPlaybackIfNeeded } from '../lib/spotify.js'

export function useSpotifyWebPlayer(getClientId) {
  const [ready, setReady] = useState(false)
  const [deviceId, setDeviceId] = useState(null)
  const tokenRef = useRef(null)

  const getAccessToken = useCallback(async () => {
    let t = await refreshIfNeeded()
    tokenRef.current = t?.access_token
    return tokenRef.current
  }, [])

  async function ensureAuth() {
    await ensureTokens(() => getClientId())
  }

  useEffect(() => {
    (async () => {
      await ensureAuth()
      await getAccessToken()
      // Load Spotify Web Playback SDK
      if (!('Spotify' in window)) {
        await new Promise((resolve) => {
          const s = document.createElement('script')
          s.src = 'https://sdk.scdn.co/spotify-player.js'
          s.async = true
          s.onload = resolve
          document.body.appendChild(s)
        })
      }
      window.onSpotifyWebPlaybackSDKReady = async () => {
        const player = new window.Spotify.Player({
          name: 'SFBV Web Player',
          getOAuthToken: async cb => {
            const t = await getAccessToken()
            cb(t)
          },
          volume: 0.8
        })
        player.addListener('ready', ({ device_id }) => {
          setDeviceId(device_id)
          setReady(true)
        })
        player.addListener('not_ready', () => setReady(false))
        player.connect()
      }
    })()
  }, [])

  const playUri = useCallback(async (uri) => {
    const token = await getAccessToken()
    await transferPlaybackIfNeeded(token, deviceId)
    await playUrisOnUser(token, deviceId, [uri], 0)
  }, [deviceId])

  const resumeUriAt = useCallback(async (uri, position_ms=40000) => {
    const token = await getAccessToken()
    await transferPlaybackIfNeeded(token, deviceId)
    await playUrisOnUser(token, deviceId, [uri], position_ms)
  }, [deviceId])

  const searchTracks = useCallback(async (q, getTok, limit=5) => {
    const token = await getAccessToken()
    return searchTracksByQuery(q, () => token, limit)
  }, [])

  return {
    ready,
    deviceId,
    ensureAuth,
    getAccessToken,
    playUri,
    resumeUriAt,
    searchTracks
  }
}