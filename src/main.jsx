import React from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css' // fix: index.css is at repo root
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
)