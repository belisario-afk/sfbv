import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/sfbv/',
  plugins: [react()],
  build: {
    target: 'es2018'
  },
  server: {
    port: 5173,
    host: true
  }
})