import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'skyshield.theme'

function resolve(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'light' || choice === 'dark') return choice
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

function readStored(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable — fall through to default */
  }
  return 'dark'
}

/**
 * Theme state: light / dark / system (default follows the OS, resolves to
 * light when unknown). Persists to localStorage and mirrors the resolved
 * value onto `<html data-theme>` so CSS tokens switch without a flash.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(() =>
    typeof window === 'undefined' ? 'system' : readStored(),
  )
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolve(readStored()))

  const apply = useCallback((c: ThemeChoice) => {
    const r = resolve(c)
    setResolved(r)
    document.documentElement.dataset.theme = r
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', r === 'dark' ? '#0F1114' : '#F3F4F5')
  }, [])

  useEffect(() => {
    apply(choice)
    try {
      window.localStorage.setItem(KEY, choice)
    } catch {
      /* ignore */
    }
  }, [choice, apply])

  // Follow the OS while the user has "system" selected.
  useEffect(() => {
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => apply('system')
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [choice, apply])

  return { choice, setChoice, resolved }
}
