/**
 * Headless render harness. Bundled to a classic IIFE by scripts/smoke.mjs so
 * jsdom (which cannot execute `type="module"`) can mount the real app — using
 * the same route table as production — and we can assert on the DOM.
 */
import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/primitives'
import { routes } from '@/routes'
import { AuthProvider } from '@/lib/auth'
import { ErrorBoundary } from '@/lib/error-boundary'
import { createIncident, getAllIncidents } from '@/services/incidents'
import { resetDemoData, STORE_KEY } from '@/services/store'
import * as offlineQueue from '@/lib/offline-queue'

/** Deliberately crashing child used by the smoke boundary-fallback test. */
function BoundaryBomb() {
  throw new Error('__boundary_test__ deliberate crash for the error-boundary check')
}

export function mount(el: HTMLElement, initialPath = '/dashboard') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  createRoot(el).render(
    <StrictMode>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </TooltipProvider>
    </StrictMode>,
  )
  return router
}

// Self-mount so the bundle is a runnable classic script under jsdom, and
// expose the router so the smoke runner can drive real navigation.
if (typeof document !== 'undefined') {
  const boot = () => {
    const el = document.getElementById('root')
    if (!el) return
    const router = mount(el, (location.hash.replace(/^#/, '') || '/dashboard'))
    ;(window as unknown as { __router?: typeof router }).__router = router
    const w = window as unknown as {
      __renderBoundaryTest?: (el: HTMLElement) => void
      __expectBoundaryError?: boolean
      __store?: unknown
    }
    // Service-level handles so the smoke suite can assert the stateful store
    // (create → persist → reset) without driving the full wizard in jsdom.
    w.__store = { createIncident, getAllIncidents, resetDemoData, STORE_KEY }
    // Offline-queue handles for the PWA section of the smoke suite.
    ;(w as unknown as { __offline?: unknown }).__offline = offlineQueue
    // Renders <ErrorBoundary><BoundaryBomb/></ErrorBoundary> into `el` so the
    // smoke suite can assert the fallback. Sets a flag the console filter
    // allow-lists, because React reports caught errors loudly by design.
    w.__renderBoundaryTest = (el: HTMLElement) => {
      w.__expectBoundaryError = true
      createRoot(el).render(
        createElement(ErrorBoundary, { scope: 'the test' }, createElement(BoundaryBomb)),
      )
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
}
