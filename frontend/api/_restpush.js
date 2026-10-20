// What a rest-push booking must look like (api/rest-push.js), checked field by field: the
// browser's subscription, how long to wait, and the words to show, already in the person's
// language. Files starting with "_" in api/ are not deployed as routes of their own.
export const MAX_WAIT_SEC = 285   // under the function's 300 s ceiling; Rest Blast rests are 180 s
const TEXT_MAX = 120

export function restPushRequest(body) {
  const b = body && typeof body === 'object' ? body : {}
  const sub = b.subscription
  if (!sub || typeof sub !== 'object' || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint)) return null
  const keys = sub.keys && typeof sub.keys === 'object' ? sub.keys : null
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null
  const n = typeof b.seconds === 'number' || typeof b.seconds === 'string' ? Number(b.seconds) : NaN
  if (!(n >= 1)) return null
  const seconds = Math.min(MAX_WAIT_SEC, Math.round(n))
  const text = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, TEXT_MAX) : fallback)
  return {
    subscription: { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, ...(sub.expirationTime ? { expirationTime: sub.expirationTime } : {}) },
    seconds,
    title: text(b.title, 'ISORA'),
    body: text(b.body, 'Rest’s over. Next set!'),
  }
}
