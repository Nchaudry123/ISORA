import { describe, it, expect } from 'vitest'
import { restPushRequest, MAX_WAIT_SEC } from './_restpush.js'

const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' }, expirationTime: null }

describe('a rest-push booking', () => {
  it('takes a subscription, the seconds and the words, clamped, and refuses anything less', () => {
    const r = restPushRequest({ subscription: sub, seconds: 180, title: 'ISORA', body: 'Pause vorbei. Nächster Satz!' })
    expect(r).toEqual({ subscription: { endpoint: sub.endpoint, keys: sub.keys }, seconds: 180, title: 'ISORA', body: 'Pause vorbei. Nächster Satz!' })
    expect(restPushRequest({ subscription: sub, seconds: '90' }).seconds).toBe(90)
    expect(restPushRequest({ subscription: sub, seconds: 90, endsAt: 1792470000123 }).endsAt).toBe(1792470000123)
    expect(restPushRequest({ subscription: sub, seconds: 90, endsAt: 'soon' }).endsAt).toBeUndefined()
    expect(restPushRequest({ subscription: sub, seconds: 9999 }).seconds).toBe(MAX_WAIT_SEC)
    expect(restPushRequest({ subscription: sub, seconds: 30, body: 'x'.repeat(500) }).body).toHaveLength(120)
    expect(restPushRequest({ subscription: sub, seconds: 30 }).body).toBe('Rest’s over. Next set!')
    expect(restPushRequest({ subscription: sub, seconds: 0 })).toBeNull()
    expect(restPushRequest({ subscription: { endpoint: 'http://plain', keys: sub.keys }, seconds: 30 })).toBeNull()
    expect(restPushRequest({ subscription: { endpoint: sub.endpoint }, seconds: 30 })).toBeNull()
    expect(restPushRequest(null)).toBeNull()
  })
})
