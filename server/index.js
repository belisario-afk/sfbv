import express from 'express'
import http from 'http'
import cors from 'cors'
import { setupWs } from './ws.js'

const app = express()
app.use(cors())

app.get('/healthz', (req, res) => {
  res.json({ ok: true, ts: Date.now() })
})

app.get('/', (req, res) => {
  res.type('text/plain').send(`SFBV Relay
- WS endpoint: /ws?room=<tiktok-uniqueId>
- Health: /healthz
`)
})

const server = http.createServer(app)
setupWs(server)

const port = process.env.PORT || 10000
server.listen(port, () => {
  console.log('Relay listening on :' + port)
})