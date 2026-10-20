// Who may call the functions that spend credit or touch backups: the app's own pages. A browser
// sends the page's Origin with a POST from fetch(), so a request from another site (or none at
// all, a script) is turned away before anything is spent. A forged header is possible, which is
// why the per-IP and daily limits (_limit.js) and the credit cap on the OpenRouter key stay; this
// stops the casual case, someone pasting the URL into their own page or a loop.
// ALLOWED_ORIGINS (comma-separated) adds hosts, for a custom domain or a preview deployment.
// Files starting with "_" in api/ are not deployed as routes of their own.

const DEFAULT_ORIGINS = ['https://isora-six.vercel.app', 'https://nchaudry123.github.io']

export function allowedOrigins(env = process.env) {
  const extra = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean)
  const list = [...DEFAULT_ORIGINS, ...extra]
  // the project's own deployment URL, whatever its hash, and local development
  if (env.VERCEL_URL) list.push('https://' + env.VERCEL_URL)
  if (env.VERCEL_ENV !== 'production') list.push('http://localhost:5199', 'http://localhost:5173', 'http://localhost:3000')
  return list
}

/** True when the request's Origin (or, failing that, Referer) is one of the app's own pages. */
export function originAllowed(headers, env = process.env) {
  const h = k => String(headers?.[k] || '')
  let origin = h('origin')
  if (!origin && h('referer')) { try { origin = new URL(h('referer')).origin } catch { origin = '' } }
  if (!origin) return false
  return allowedOrigins(env).includes(origin.replace(/\/+$/, ''))
}

/** The 403 for a request from elsewhere; returns true when the handler should stop. */
export function rejectForeign(req, res) {
  if (originAllowed(req.headers)) return false
  res.status(403).json({ error: 'forbidden' })
  return true
}
