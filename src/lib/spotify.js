// PKCE OAuth + minimal Web API helpers

function randString(len=64) {
  const ab = new Uint8Array(len)
  crypto.getRandomValues(ab)
  return btoa(String.fromCharCode(...ab)).replace(/[^a-zA-Z0-9]/g,'').slice(0, len)
}

async function sha256(input) {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function ensureTokens(getClientId) {
  // If no tokens, start auth
  let tokens = JSON.parse(localStorage.getItem('spotify_tokens') || 'null')
  if (!tokens) {
    const clientId = getClientId()
    const state = randString(16)
    const verifier = randString(64)
    const challenge = await sha256(verifier)
    localStorage.setItem('spotify_auth_state', state)
    localStorage.setItem('spotify_code_verifier', verifier)

    const redirectUri = `${location.origin}/sfbv/callback`
    const url = new URL('https://accounts.spotify.com/authorize')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-modify-playback-state',
      'user-read-playback-state'
    ].join(' '))
    url.searchParams.set('state', state)
    window.location.assign(url.toString())
    throw new Error('Redirecting for Spotify auth')
  }
  return tokens
}

export async function refreshIfNeeded() {
  let tokens = JSON.parse(localStorage.getItem('spotify_tokens') || 'null')
  if (!tokens) return null
  const now = Date.now()
  if (tokens.expires_at - 60000 > now) return tokens
  if (!tokens.refresh_token) return tokens
  const clientId = localStorage.getItem('spotify_client_id') || '927fda6918514f96903e828fcd6bb576'
  const body = new URLSearchParams()
  body.set('client_id', clientId)
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', tokens.refresh_token)
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const json = await res.json()
  if (!res.ok) throw new Error('Refresh failed: ' + JSON.stringify(json))
  const updated = {
    ...tokens,
    ...json,
    obtained_at: now,
    expires_at: now + (json.expires_in * 1000)
  }
  localStorage.setItem('spotify_tokens', JSON.stringify(updated))
  return updated
}

export async function searchTracksByQuery(q, getToken, limit=5) {
  const token = await getToken()
  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', q)
  url.searchParams.set('type', 'track')
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  const json = await res.json()
  const items = json?.tracks?.items || []
  return items.map(toSimpleTrack)
}

export async function getTrackMeta(urlOrUri, getToken) {
  if (urlOrUri.startsWith('spotify:track:')) {
    const id = urlOrUri.split(':').pop()
    return getTrackById(id, getToken)
  }
  const match = urlOrUri.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/)
  if (match) {
    return getTrackById(match[1], getToken)
  }
  // fallback search
  const arr = await searchTracksByQuery(urlOrUri, getToken, 1)
  return arr?.[0]
}

async function getTrackById(id, getToken) {
  const token = await getToken()
  const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const json = await res.json()
  if (!res.ok) throw new Error('Track fetch failed')
  return toSimpleTrack(json)
}

function toSimpleTrack(t) {
  return {
    id: t.id,
    uri: t.uri,
    title: t.name,
    image: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
    duration_ms: t.duration_ms,
    artists: (t.artists || []).map(a => a.name).join(', ')
  }
}

export async function transferPlaybackIfNeeded(token, deviceId) {
  if (!deviceId) return
  try {
    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ device_ids: [deviceId], play: false })
    })
  } catch {}
}

export async function playUrisOnUser(token, deviceId, uris, position_ms=0) {
  const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uris, position_ms })
  })
  if (!res.ok) {
    const t = await res.text()
    console.warn('playUrisOnUser failed', t)
  }
}