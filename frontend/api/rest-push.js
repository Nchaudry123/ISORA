// The rest timer on the lock screen, for the personal app (Vercel function, /api/rest-push).
// A phone's web app cannot run a timer while it is locked, so when a rest starts the page books
// a push here: this function waits out the rest and then sends one notification, through the
// browser's push service, to the subscription the page sent along. Nothing is stored: the
// subscription travels with each request and lives only in the phone's browser.
//
// GET answers the VAPID public key the page subscribes with. The keys are the project's
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (and VAPID_SUBJECT, a mailto: or https: URL) environment
// variables; without them this answers 503 and the switch in Settings says so. The function
// needs a maxDuration above the longest rest (frontend/vercel.json: 300 s).
import webpush from 'web-push'
import { limited, dailyCapReached } from './_limit.js'
import { rejectForeign } from './_origin.js'
import { restPushRequest, MAX_WAIT_SEC } from './_restpush.js'

const sleep = ms => new Promise(r => setTimeout(r, ms))

export default async function handler(req, res) {
  if (rejectForeign(req, res)) return
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return res.status(503).json({ error: 'not-configured' })
  if (req.method === 'GET') return res.status(200).json({ key: pub })
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'method' }) }
  // a workout books one per rest; a few hundred an hour is a script
  if (limited(req, { max: 120, windowMs: 60 * 60 * 1000 }) || dailyCapReached(4000)) return res.status(429).json({ error: 'busy' })
  const r = restPushRequest(req.body)
  if (!r) return res.status(400).json({ error: 'bad-request' })

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@isora.app', pub, priv)
  // the push service is told to keep it a minute only: a late delivery of "rest over" is noise
  const payload = JSON.stringify({ title: r.title, body: r.body, tag: 'isora-rest', endsAt: Date.now() + r.seconds * 1000 })
  await sleep(Math.max(0, r.seconds * 1000 - 1200))
  try {
    await webpush.sendNotification(r.subscription, payload, { TTL: 60, urgency: 'high' })
    return res.status(200).json({ ok: true })
  } catch (e) {
    // 404/410: the subscription is dead; the page unsubscribes on that answer
    const status = e?.statusCode === 404 || e?.statusCode === 410 ? 410 : 502
    return res.status(status).json({ error: status === 410 ? 'gone' : 'push-failed' })
  }
}

export { MAX_WAIT_SEC }
