import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Semi-transparent variant of a colour, which may itself be a CSS variable.
 * Never concatenate a hex alpha suffix onto `var(--x)` — `var(--color-ok)40`
 * is invalid CSS and silently drops the declaration; go through color-mix.
 */
export function alpha(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}
