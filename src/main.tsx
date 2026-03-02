import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Suppress non-critical SDK/Zod internal unhandled rejections
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message ?? String(e.reason ?? '')
  if (msg.includes('payload') || msg.includes('Cannot read properties of')) {
    e.preventDefault()
    if (import.meta.env.DEV) console.warn('[SDK internal]', e.reason)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
