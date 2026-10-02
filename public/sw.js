/**
 * SkyShield app-shell service worker (master 5.8).
 *
 * Strategy: precache the shell, network-first for navigations with an
 * offline fallback to the cached index, cache-first for same-origin static
 * assets. API requests are never cached here — the offline report queue
 * (lib/offline-queue.ts) owns write-behind for submissions.
 */
const CACHE = 'skyshield-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/favicon-32x32.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Never serve stale data for API calls; the UI has its own states.
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html').then((hit) => hit || caches.match('/'))),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          })
          .catch(() => hit),
    ),
  )
})
