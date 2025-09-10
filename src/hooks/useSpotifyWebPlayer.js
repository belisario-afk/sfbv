import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureTokens, refreshIfNeeded, searchTracksByQuery, playUrisOnUser, transferPlaybackIfNeeded } from '../lib/spotify.js'

export function useSpotifyWebPlayer(getClientId) {
  const [ready, setReady] = useState(false)
  const [deviceId, setDeviceId] = useState(null)
  const tokenRef = useRef(null)
  const playerRef = useRef(null)
  const sdkReadyRef = useRef(false)

  const getAccessToken = useCallback(async () => {
    let t = await refreshIfNeeded()
    tokenRef.current = t?.access_token || null
    return tokenRef.current
  }, [])

  async function ensureAuth() {
    await ensureTokens(() => getClientId())
  }

  useEffect(() => {
    (async () => {
      // Define handler BEFORE loading SDK to avoid AnthemError
      if (!sdkReadyRef.current) {
        window.onSpotifyWebPlaybackSDKReady = async () => {
          const player = new window.Spotify.Player({
            name: 'SFBV Web Player',
            getOAuthToken: async cb => {
              const t = await getAccessToken()
              cb(t || '')
            },
            volume: 0.8
          })
          playerRef.current = player
          player.addListener('ready', ({ device_id }) => {
            setDeviceId(device_id)
            setReady(true)
          })
          player.addListener('not_ready', () => setReady(false))
          player.connect()
        }
        sdkReadyRef.current = true
      }

      // Load SDK script if not present
      if (!('Spotify' in window)) {
        await new Promise((resolve) => {
          const s = document.createElement('script')
          s.src = 'https://sdk.scdn.co/spotify-player.js'
          s.async = true
          s.onload = resolve
          document.body.appendChild(s)
        })
      } else {
        // If SDK is already present and we set the handler late, call it
        if (typeof window.onSpotifyWebPlaybackSDKReady === 'function') {
          window.onSpotifyWebPlaybackSDKReady()
        }
      }
    })()
  }, [getAccessToken])

  const playUri = useCallback(async (uri) => {
    const token = await getAccessToken()
    if (!token) return // no-op if not authenticated yet
    await transferPlaybackIfNeeded(token, deviceId)
    await playUrisOnUser(token, deviceId, [uri], 0)
  }, [deviceId, getAccessToken])

  const resumeUriAt = useCallback(async (uri, position_ms=40000) => {
    const token = await getAccessToken()
    if (!token) return // no-op if not authenticated
    await transferPlaybackIfNeeded(token, deviceId)
    await playUrisOnUser(token, deviceId, [uri], position_ms)
  }, [deviceId, getAccessToken])

  const searchTracks = useCallback(async (q, _ignored, limit=5) => {
    const token = await getAccessToken()
    if (!token) return [] // no search until authed
    return searchTracksByQuery(q, () => token, limit)
  }, [getAccessToken])

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