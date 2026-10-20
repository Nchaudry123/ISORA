// A small per-IP rate limit for the functions that spend OpenRouter credit. Vercel keeps a warm
// function instance between requests, so a Map in module scope holds recent hits; it is
// best-effort (each instance counts on its own, and a cold start forgets), which is enough to stop
// a script hammering the endpoint. The hard cap is the credit limit set on the OpenRouter key.
// Files starting with "_" in api/ are not deployed as routes of their own.
const hits = new Map()

// A ceiling for the whole instance per UTC day, whoever is asking: the brake if many addresses
// hit at once. Best-effort like the rest (per instance); the credit cap on the key is the wall.
const daily = { day: '', n: 0 }
export function dailyCapReached(max) {
  const day = new Date().toISOString().slice(0, 10)
  if (daily.day !== day) { daily.day = day; daily.n = 0 }
  if (daily.n >= max) return true
  daily.n++
  return false
}

export function limited(req, { max, windowMs }) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter(t => now - t < windowMs)
  if (recent.length >= max) { hits.set(ip, recent); return true }
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k)
  return false
}
