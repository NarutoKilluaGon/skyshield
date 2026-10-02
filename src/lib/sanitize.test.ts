import { describe, expect, it } from 'vitest'
import { escapeHtml, escapeRow } from './sanitize'

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('xss')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;',
    )
  })

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Runway excursion on landing roll')).toBe('Runway excursion on landing roll')
  })

  it('stringifies numbers and survives null/undefined', () => {
    expect(escapeHtml(16)).toBe('16')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('is idempotent-safe for already-escaped input markers', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;') // escaping is not decoding
  })

  it('escapes rows elementwise', () => {
    expect(escapeRow(['a<b', 2, null])).toEqual(['a&lt;b', '2', ''])
  })
})
