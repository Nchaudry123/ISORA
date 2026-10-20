import { describe, it, expect } from 'vitest'
import { originAllowed, allowedOrigins } from './_origin.js'

describe('who may call the functions', () => {
  const prod = { VERCEL_ENV: 'production', VERCEL_URL: 'isora-abc123.vercel.app' }
  it('lets the app’s own pages in, by Origin or by Referer, and nobody else', () => {
    expect(originAllowed({ origin: 'https://isora-six.vercel.app' }, prod)).toBe(true)
    expect(originAllowed({ origin: 'https://nchaudry123.github.io' }, prod)).toBe(true)
    expect(originAllowed({ referer: 'https://nchaudry123.github.io/ISORA/#/home' }, prod)).toBe(true)
    expect(originAllowed({ origin: 'https://isora-abc123.vercel.app' }, prod)).toBe(true)
    expect(originAllowed({ origin: 'https://evil.example' }, prod)).toBe(false)
    expect(originAllowed({ referer: 'not a url' }, prod)).toBe(false)
    expect(originAllowed({}, prod)).toBe(false)
    expect(originAllowed({ origin: 'http://localhost:5199' }, prod)).toBe(false)
  })
  it('allows localhost outside production, and extra hosts from ALLOWED_ORIGINS', () => {
    expect(originAllowed({ origin: 'http://localhost:5199' }, { VERCEL_ENV: 'development' })).toBe(true)
    expect(originAllowed({ origin: 'https://isora.app' }, { ...prod, ALLOWED_ORIGINS: 'https://isora.app/, https://www.isora.app' })).toBe(true)
    expect(allowedOrigins({ ...prod, ALLOWED_ORIGINS: '' })).toContain('https://isora-six.vercel.app')
  })
})
