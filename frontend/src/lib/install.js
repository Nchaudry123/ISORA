// Is ISORA running from the home screen, and on what? A page can tell whether *this* session was
// launched as an installed app (standalone display mode; `navigator.standalone` on iOS Safari),
// not whether an icon exists while it runs in a tab — so the install prompt shows in a tab and
// never once the app is opened from its icon. The device comes from the user agent: iPhone and
// iPad (iPadOS calls itself a Mac, but a Mac has no touch points), or Android. Pure, so it can be
// tested with a made-up window.

export function isStandalone(win = globalThis.window) {
  if (!win) return false
  try {
    if (win.navigator?.standalone === true) return true
    return !!win.matchMedia?.('(display-mode: standalone)')?.matches || !!win.matchMedia?.('(display-mode: fullscreen)')?.matches
  } catch { return false }
}

/** 'ios' | 'android' | 'other', and whether the browser is Safari (the only one that can add a web app on iOS). */
export function deviceOf(nav = globalThis.navigator) {
  const ua = String(nav?.userAgent || '')
  const touchMac = /Macintosh/.test(ua) && (nav?.maxTouchPoints || 0) > 1
  if (/iPhone|iPad|iPod/.test(ua) || touchMac) {
    // every iOS browser is WebKit; the others name themselves in the UA (CriOS, FxiOS, EdgiOS …)
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Brave/.test(ua)
    return { os: 'ios', safari }
  }
  if (/Android/.test(ua)) return { os: 'android', safari: false }
  return { os: 'other', safari: false }
}

// a new key: a Later tapped before this build, when the card was the only way, starts over
const KEY = 'isora_install_later_v2'
/** Whether the card was put off, and for how long it stays away (a week). */
export function putOff(store = globalThis.localStorage) {
  try { const at = Number(store?.getItem(KEY)) || 0; return at > 0 && Date.now() - at < 7 * 864e5 } catch { return false }
}
/** Where ISORA is running: from its icon, in a phone's browser tab, or on a desktop. */
export function installState({ win = globalThis.window, nav = globalThis.navigator } = {}) {
  if (!win) return 'desktop'
  if (isStandalone(win)) return 'standalone'
  return deviceOf(nav).os === 'other' ? 'desktop' : 'tab'
}
export function putOffNow(store = globalThis.localStorage) { try { store?.setItem(KEY, String(Date.now())) } catch {} }

/** Show the prompt? In a tab, on a phone, not put off recently. */
export function shouldOfferInstall({ win = globalThis.window, nav = globalThis.navigator, store = globalThis.localStorage } = {}) {
  if (!win || isStandalone(win)) return false
  const d = deviceOf(nav)
  if (d.os === 'other') return false
  return !putOff(store)
}

// Android Chrome (and other Chromium browsers) hand the page an install prompt it may show
// later; it has to be caught early, before any button exists, so the listener lives here.
let deferredPrompt = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e })
  window.addEventListener('appinstalled', () => { deferredPrompt = null })
}
export const canPromptInstall = () => !!deferredPrompt
/** Show the browser's own install dialog; true when the person accepted. */
export async function promptInstall() {
  const e = deferredPrompt
  if (!e) return false
  deferredPrompt = null
  try { e.prompt(); const r = await e.userChoice; return r?.outcome === 'accepted' } catch { return false }
}
