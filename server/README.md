# SFBV Relay (Render)

Node/Express + WebSocket relay that connects to TikTok live chat, normalizes events, and forwards them to connected clients.

- WebSocket endpoint: `/ws?room=<tiktok-uniqueId>`
- Health check: `/healthz`

This relay uses [`tiktok-live-connector`](https://www.npmjs.com/package/tiktok-live-connector) to connect to a TikTok live room and emits a unified event schema.

## One-click Deploy on Render

1. Fork this repository or import it into your GitHub.
2. In Render, create a "Web Service" from the `/server` directory.
   - Render will detect `render.yaml`, or you can point to this folder manually.
3. Set environment variable:
   - `TIKTOK_USERNAME`: default `lmohss`. You can override via WebSocket query param.
4. Deploy. After deploy you’ll have a URL like:
   - `https://sfbv-relay.onrender.com`
5. Client configuration:
   - In the app Settings panel, set `Relay WS URL` to `wss://sfbv-relay.onrender.com/ws`
   - Set TikTok room to your `uniqueId` (e.g., `lmohss`).

## Unified Schema

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

## Local Development

```bash
cd server
npm install
npm run dev
# WS: ws://localhost:10000/ws?room=lmohss
```

The relay will auto-connect to the specified room on first client connection, and broadcast normalized events to all connected clients for that room.

## Notes

- The relay maintains one live connection per room. All connected clients to that room receive the same event stream.
- Gifts with a `value` (or diamond count) ≥ 10 are treated as "medium/large" in the client and can boost the sender’s last requested song in the queue.