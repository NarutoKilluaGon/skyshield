import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { readPref, PREF_KEYS } from '@/lib/prefs'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans-condensed/latin-500.css'
import '@fontsource/ibm-plex-sans-condensed/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './index.css'

// Apply the persisted table-density preference before first paint.
// Comfortable is the default — compact is opt-in (owner feedback: dense
// tables read as cluttered).
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
document.documentElement.dataset.density = readPref(PREF_KEYS.uiCompactTables, false, isBool)
  ? 'compact'
  : 'comfortable'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// App-shell service worker (PWA). Production only — the dev server's HMR
// traffic must not be intercepted; registration failures are non-fatal.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline caching unavailable — the app works normally without it */
    })
  })
}
