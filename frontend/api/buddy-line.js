// Your buddy's line of the day (Vercel function, POST /api/buddy-line). The app sends who the
// buddy is, who you are, its mood and a few facts about your training; the model writes one short
// line in the buddy's voice. The app caches it per mood per day (lib/buddy.js lineKey), so this
// runs a handful of times a day at most, and it falls back on written lines when this is down.
import { limited } from './_limit.js'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODELS = ['deepseek/deepseek-v4.1-flash', 'google/gemini-3.8-flash', 'qwen/qwen3.8-flash']
const MOODS = ['active', 'proud', 'hyped', 'sleepy', 'missing', 'new', 'chill']
const KINDS = { block: 'a square lime block', drop: 'a round violet drop', bolt: 'a tall blue block with an antenna', ember: 'a little orange flame' }

const SYSTEM = `You are a small, warm companion character living in ISORA, a gym tracking app. You are the user's buddy: encouraging, playful, a bit cheeky, never preachy. You speak in first person as the buddy.

Write ONE line for the app's home screen: at most 18 words, plain text, no emoji, no hashtags, no quotes. React to your mood and the facts given, mention something concrete when there is something (today's session, a record, the streak, days away), and address the user by name when you have it. No medical, diet or weight advice. Write in the language given.`

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const int = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null)

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method' }) }
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return res.status(503).json({ error: 'not-configured' })
  if (limited(req, { max: 30, windowMs: 60 * 60 * 1000 })) return res.status(429).json({ error: 'busy' })
  const b = req.body || {}
  const mood = MOODS.includes(b.mood) ? b.mood : 'chill'
  const facts = {
    buddy: `${str(b.buddyName, 20) || 'Iso'}, ${KINDS[b.kind] || KINDS.block}, level ${int(b.level) ?? 1}`,
    user: str(b.userName, 40) || null,
    mood,
    language: str(b.lang, 10) || 'en',
    today: str(b.today, 80) || null,
    goal: str(b.goal, 20) || null,
    weekDone: int(b.weekDone), weekTarget: int(b.weekTarget),
    streakWeeks: int(b.streak), daysSinceLast: int(b.daysSinceLast),
    lastRecord: str(b.lastRecord, 80) || null,
    hour: int(b.hour),
  }
  const models = (process.env.OPENROUTER_MODELS || '').split(',').map(s => s.trim()).filter(Boolean)
  let r
  try {
    r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://isora-six.vercel.app', 'X-Title': 'ISORA' },
      body: JSON.stringify({
        models: models.length ? models : DEFAULT_MODELS,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(facts) }],
        provider: { data_collection: 'deny' },
        // models that think first spend part of max_tokens on it: room for that, kept short and
        // left out of the reply
        reasoning: { effort: 'low', exclude: true },
        max_tokens: 600,
        temperature: 0.9,
      }),
      signal: AbortSignal.timeout(15000),
    })
  } catch { return res.status(504).json({ error: 'timeout' }) }
  if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: 'upstream' })
  const body = await r.json().catch(() => null)
  const raw = String(body?.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '')
  const line = str(raw, 200).replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ')
  if (!line) return res.status(502).json({ error: 'bad-output', finish: body?.choices?.[0]?.finish_reason || null })
  return res.status(200).json({ line, model: typeof body?.model === 'string' ? body.model : null })
}
