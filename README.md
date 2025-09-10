# SFBV — TikTok-controlled Song Fight Battle (Spotify + GitHub Pages + Render relay)

A production-ready, deployable web application for running a TikTok-controlled song battle game powered by Spotify.

- Frontend: React + Vite SPA
- Hosting: GitHub Pages (base path `/sfbv/`)
- Spotify Auth: Authorization Code with PKCE (no client secret)
- Relay: Node/Express + WebSocket on Render (normalizes TikTok events and forwards to clients)
- TikTok Chat Modes:
  - Relay (default): connects to your Render relay over WebSocket
  - Direct: experimental browser mode
  - Simulation: local events generator for testing

Live base path: https://belisario-afk.github.io/sfbv/

## Features

- Stage machine with version guard:
  - intro → r1A_play → r1B_play → vote1 → r2A_play → r2B_play → vote2 → winner → victory_play → finished → auto-next
  - All timers are guarded by `stageVersion`; stale timers are discarded.
- Voting:
  - One vote per viewer per battle, persistent across vote windows.
  - Votes reset at next battle.
- Queue:
  - Dedup by trackId/URI, 8s recent-add protection.
  - `!battle` rate-limited to once every 5s per user.
  - Gifts (value ≥ 10) boost the sender’s last requested song forward in the queue.
- Victory Play:
  - Winner resumes at 40s position (fallback handled by SDK).
- UI/UX for TikTok Live:
  - Queue panel with art + usernames
  - Chat column with large text and auto-scroll
  - Arena: react-three-fiber “battle ring”, pulsing rings, health bars
  - Winner overlay with glow and crown
  - Hype meter (gifts fill it)
  - Settings panel for chat mode, TikTok room, relay URL, Spotify client id, FX quality
  - Hotkeys: n (next/start), s (skip stage), p (pause/resume), q (demo)
- Stability/Performance:
  - FX throttled options
  - Timers auto-cleared on stage changes
  - InstancedMesh for 3D points

## Repo Structure

```
/ (client app)
  public/
    index.html
    callback.html
  src/
    main.jsx
    App.jsx
    context/AppContext.jsx
    hooks/
      useBattleEngine.js
      useChat.js
      useSpotifyWebPlayer.js
    lib/
      spotify.js
      audioManager.js
    components/
      arena/NeoArena.jsx
      WinnerOverlay.jsx
      WinnerFocus.jsx
      HypeMeter.jsx
      VoteOverlay.jsx
      ChatTicker.jsx
      SettingsPanel.jsx
      SpotifyTrackSearchModal.jsx
      FX/ThreeBackdrop.jsx
    config/
      playbackConfig.js
      uiConfig.js
  index.css
  vite.config.js
  package.json
  README.md
  LICENSE
  .github/workflows/pages.yml

/server (Render-ready relay)
  package.json
  index.js
  ws.js
  normalize.js
  render.yaml
  README.md
```

## GitHub Pages Deployment

This repo is pre-configured for Pages. On every push to `main`, the workflow deploys the built `dist/` to GitHub Pages.

- Ensure Pages is enabled for the repository in Settings → Pages.
- Base path is `/sfbv/`.
- `vite.config.js` sets `base: '/sfbv/'`.
- `package.json` includes `"homepage": "https://belisario-afk.github.io/sfbv/"`.

Local:
```bash
npm install
npm run dev
# build
npm run build
# optional local deploy via gh-pages
npm run deploy
```

The workflow file `.github/workflows/pages.yml` will build and deploy automatically.

## Spotify Configuration

- Spotify Client ID: `927fda6918514f96903e828fcd6bb576` (default; override in Settings panel if needed)
- Redirect/callback URLs (add to your Spotify app):
  - https://belisario-afk.github.io/sfbv/callback
  - https://belisario-afk.github.io/sfbv/

This app uses Authorization Code with PKCE. No client secret is required; token exchange happens from the browser to `https://accounts.spotify.com/api/token`.

Playback uses the Spotify Web Playback SDK:
- The user needs a Premium account and to have the app origin allowed (Spotify generally supports it via OAuth).
- The SDK device is created client-side; we transfer playback before playing URIs.

## TikTok Relay (Render) — Default Chat Mode

The relay normalizes TikTok events and broadcasts them over WebSocket.

Unified schema:
```json
{
  "type": "chat" | "gift" | "like" | "subscribed" | "room_info",
  "userId": "secUid or stable id",
  "username": "@handle",
  "displayName": "nickname",
  "avatarUrl": "profilePic",
  "text": "chat text (if type=chat)",
  "value": "coins (if type=gift)",
  "giftName": "optional",
  "ts": "timestamp ms"
}
```

### One-click Render Deploy

- Go to the `/server` folder for details: [server/README.md](server/README.md)
- Deploy the relay with `render.yaml`.
- Set environment variable `TIKTOK_USERNAME` (defaults to `lmohss`).
- The relay exposes:
  - HTTP: `GET /healthz`
  - WS: `/ws?room=<uniqueId>`

In the client Settings panel, set `Relay WS URL` to your Render URL, e.g. `wss://sfbv-relay.onrender.com/ws`.

## Chat Modes

- Relay (default): Reliable method via Render WS.
- Direct: Experimental note; browser TikTok SDK isn’t guaranteed. Prefer relay.
- Simulation: Generates mock chat, votes, and gifts locally.

## Commands

- Voting: `!a` or `!b` (case-insensitive). One vote per viewer per battle; vote persists across both windows.
- Queue song: `!battle <search terms | spotify:track:ID | https://open.spotify.com/track/...>`
  - Rate-limited to once per 5s per user
  - Deduped by trackId/URI
  - Recent-add protection (8s)
- Demo pair: `!pair`, `!demo`, or press `q`

## Hotkeys

- `n`: start/next battle
- `s`: skip current stage
- `p`: pause/resume timers (guards still active)
- `q`: demo pair hint

## Known Limitations

- Spotify Playback SDK requires a Premium account, and user interaction may be needed to fully initialize audio in some browsers.
- Direct TikTok browser SDK support is experimental; relay mode is default and recommended.
- Render free instances may spin down; client auto-reconnects the WebSocket.

## License

MIT — see [LICENSE](LICENSE).