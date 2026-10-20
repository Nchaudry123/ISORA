import { describe, it, expect } from 'vitest'
import { isStandalone, deviceOf, shouldOfferInstall, putOffNow, putOff, installState } from './install.js'

const win = (standalone, nav = {}) => ({ navigator: nav, matchMedia: q => ({ matches: standalone && q.includes('standalone') }) })
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }

describe('where ISORA runs', () => {
  it('knows the home-screen app from a tab', () => {
    expect(isStandalone(win(true))).toBe(true)
    expect(isStandalone(win(false))).toBe(false)
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true)
    expect(isStandalone(null)).toBe(false)
  })
  it('tells iPhone, iPad, Android and the rest apart, and Safari from the other iOS browsers', () => {
    expect(deviceOf({ userAgent: IPHONE_SAFARI })).toEqual({ os: 'ios', safari: true })
    expect(deviceOf({ userAgent: IPHONE_CHROME })).toEqual({ os: 'ios', safari: false })
    expect(deviceOf({ userAgent: IPAD, maxTouchPoints: 5 })).toEqual({ os: 'ios', safari: true })
    expect(deviceOf({ userAgent: MAC, maxTouchPoints: 0 }).os).toBe('other')
    expect(deviceOf({ userAgent: ANDROID })).toEqual({ os: 'android', safari: false })
    expect(deviceOf(null).os).toBe('other')
  })
  it('offers the install in a phone’s tab, never in the installed app or on a desktop, and not again for a week', () => {
    const store = mem()
    const nav = { userAgent: IPHONE_SAFARI }
    expect(shouldOfferInstall({ win: win(false, nav), nav, store })).toBe(true)
    expect(shouldOfferInstall({ win: win(true, nav), nav, store })).toBe(false)
    expect(shouldOfferInstall({ win: win(false), nav: { userAgent: MAC }, store })).toBe(false)
    putOffNow(store)
    expect(shouldOfferInstall({ win: win(false, nav), nav, store })).toBe(false)
  })
})

describe('where ISORA runs, and an old Later', () => {
  const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', maxTouchPoints: 5 }
  const mq = m => ({ matches: m === '(display-mode: standalone)' })
  it('tells a tab from the icon from a desktop', () => {
    expect(installState({ win: { navigator: {}, matchMedia: () => ({ matches: false }) }, nav: iphone })).toBe('tab')
    expect(installState({ win: { navigator: { standalone: true }, matchMedia: () => ({ matches: false }) }, nav: iphone })).toBe('standalone')
    expect(installState({ win: { navigator: {}, matchMedia: mq }, nav: iphone })).toBe('standalone')
    expect(installState({ win: { navigator: {}, matchMedia: () => ({ matches: false }) }, nav: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130' } })).toBe('desktop')
    expect(installState({ win: null })).toBe('desktop')
  })
  it('forgets a Later tapped before the pill existed, keeps a recent one for a week', () => {
    const store = new Map(); const st = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
    st.setItem('isora_install_later', String(Date.now()))   // the old key, from before the pill
    expect(putOff(st)).toBe(false)
    putOffNow(st)
    expect(putOff(st)).toBe(true)
  })
})
