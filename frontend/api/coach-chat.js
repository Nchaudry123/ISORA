// ISORA's first-run greeter (Vercel function, POST /api/coach-chat). The app sends the chat so far;
// the model answers with the next line of the conversation, a few quick replies, and — once it
// knows enough — the person's training profile and a short focus. The app builds the plan itself
// from that profile (lib/onboarding.js), so the model only talks and decides the focus.
//
// The model does not have to remember: every turn it returns what it knows so far (`known`),
// the app sends that back with the next message, and this function tells the model, in a
// system note, exactly what is known, what was declined and what is still missing — so it
// never asks the same thing twice, whichever cheap model is answering.
//
// Runs through OpenRouter (one key, many models, fallback between them). The key stays here, in
// the OPENROUTER_API_KEY environment variable of the Vercel project; without it this answers 503
// and the app runs the scripted version of the same chat. OPENROUTER_MODELS (comma-separated)
// overrides the model list without a code change.

import { limited } from './_limit.js'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
// Tried in order: DeepSeek V4.1 Flash (about a twentieth of the cost of the others), Gemini Flash if
// it is down or busy, then a second cheap provider. Every one supports strict JSON-schema output
// (checked against openrouter.ai/api/v1/models).
const DEFAULT_MODELS = ['deepseek/deepseek-v4.1-flash', 'google/gemini-3.8-flash', 'qwen/qwen3.8-flash']
const MAX_TURNS = 24          // messages per conversation, both sides
const MAX_CHARS = 600         // per message from the app
const GOALS = ['strength', 'muscle', 'fitness', 'active']
const LEVELS = ['beginner', 'intermediate', 'advanced']
// The equipment names the app's exercise library uses (lib/equipment.js ALL_EQUIPMENT, the ones
// a person is likely to own or find at a gym).
const EQUIPMENT = ['dumbbell', 'barbell', 'cable', 'leverage machine', 'smith machine', 'kettlebell', 'band',
  'ez barbell', 'trap bar', 'medicine ball', 'stability ball', 'suspension trainer', 'stationary bike', 'bench', 'pull-up bar']

const SYSTEM = `You are ISORA's coach: the friendly voice that greets someone the first time they open ISORA, a gym tracker. ISORA means balance (Greek isorropia): effort and recovery.

Your job in this short chat is to get to know the person so the app can set up their training. Find out, in a natural order, one or two things per message:
1. their first name
2. what they want from training (map it to one goal: strength, muscle, fitness, or active)
3. their body weight and height (accept any units; convert to kg and cm yourself)
4. how experienced they are (beginner, intermediate, advanced)
5. how many days a week they can train (1 to 7)
6. what equipment they have access to (a full gym counts as everything)

Style: warm, brief, plain words, like a message from a good coach. At most two short sentences per message, then the question. No lists, no markdown. Write in the language the person writes in (the app's language is given in the first message).

Quick replies: offer 2 to 5 short tap-able answers that fit your question (e.g. "Build muscle", "3 days", "Home with dumbbells", "Full gym"). Empty when the answer is free text like a name or a number.

When you know all six, set done to true and fill profile. In profile.focus write two or three sentences, addressed to them by name, on what their training should focus on and why, grounded in their goal, experience, days and equipment (and their weight and height only in general terms - no diet, medical or weight-loss advice). focusAreas lists two to four short areas (e.g. "compound lifts", "progressive overload", "core", "mobility"). Until then, done is false and profile is null.

Every turn, fill \`known\` with everything learned so far in this whole chat (keep earlier values; null for what is not known yet) and list in \`declined\` any of weightKg/heightCm the person would rather not give. Never ask again for anything already known or declined; move to the next missing item. If they ask something unrelated, answer in one sentence and come back to the question.`

const FIELDS = ['name', 'goal', 'weightKg', 'heightCm', 'experience', 'daysPerWeek', 'equipment']

const nullable = schema => ({ anyOf: [schema, { type: 'null' }] })
const OUTPUT = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'quickReplies', 'done', 'known', 'declined', 'profile'],
  properties: {
    reply: { type: 'string' },
    quickReplies: { type: 'array', items: { type: 'string' } },
    done: { type: 'boolean' },
    known: {
      type: 'object',
      additionalProperties: false,
      required: FIELDS,
      properties: {
        name: nullable({ type: 'string' }),
        goal: nullable({ type: 'string', enum: GOALS }),
        weightKg: nullable({ type: 'number' }),
        heightCm: nullable({ type: 'number' }),
        experience: nullable({ type: 'string', enum: LEVELS }),
        daysPerWeek: nullable({ type: 'integer' }),
        equipment: nullable({ type: 'array', items: { type: 'string', enum: EQUIPMENT } }),
      },
    },
    declined: { type: 'array', items: { type: 'string', enum: ['weightKg', 'heightCm'] } },
    profile: nullable({
      type: 'object',
      additionalProperties: false,
      required: ['name', 'goal', 'weightKg', 'heightCm', 'experience', 'daysPerWeek', 'equipment', 'focus', 'focusAreas'],
      properties: {
        name: { type: 'string' },
        goal: { type: 'string', enum: GOALS },
        weightKg: nullable({ type: 'number' }),
        heightCm: nullable({ type: 'number' }),
        experience: { type: 'string', enum: LEVELS },
        daysPerWeek: { type: 'integer' },
        equipment: { type: 'array', items: { type: 'string', enum: EQUIPMENT } },
        focus: { type: 'string' },
        focusAreas: { type: 'array', items: { type: 'string' } },
      },
    }),
  },
}

const clean = body => {
  const msgs = Array.isArray(body?.messages) ? body.messages : null
  if (!msgs || !msgs.length || msgs.length > MAX_TURNS) return null
  const out = []
  for (const m of msgs) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return null
    const content = m.content.trim().slice(0, MAX_CHARS)
    if (!content) return null
    out.push({ role: m.role, content })
  }
  return out[0].role === 'user' ? out : null
}

// What the app says is known already (from earlier turns), checked field by field.
const cleanKnown = k => {
  const o = k && typeof k === 'object' ? k : {}
  const out = {}
  if (typeof o.name === 'string' && o.name.trim()) out.name = o.name.trim().slice(0, 40)
  if (GOALS.includes(o.goal)) out.goal = o.goal
  if (Number.isFinite(o.weightKg) && o.weightKg > 20 && o.weightKg < 400) out.weightKg = o.weightKg
  if (Number.isFinite(o.heightCm) && o.heightCm > 90 && o.heightCm < 260) out.heightCm = o.heightCm
  if (LEVELS.includes(o.experience)) out.experience = o.experience
  if (Number.isInteger(o.daysPerWeek) && o.daysPerWeek >= 1 && o.daysPerWeek <= 7) out.daysPerWeek = o.daysPerWeek
  if (Array.isArray(o.equipment)) out.equipment = o.equipment.filter(e => EQUIPMENT.includes(e))
  return out
}
const cleanDeclined = d => (Array.isArray(d) ? d.filter(x => x === 'weightKg' || x === 'heightCm') : [])
// The note the model reads before answering: what it has, what it still needs.
const stateNote = (known, declined) => {
  const have = FIELDS.filter(f => known[f] !== undefined).map(f => f + '=' + JSON.stringify(known[f]))
  const missing = FIELDS.filter(f => known[f] === undefined && !declined.includes(f))
  if (!missing.length) return `[State: everything is known (${have.join(', ')}). Do not ask anything more: set done to true now, fill profile from these values and write the focus.]`
  return `[State: known so far: ${have.length ? have.join(', ') : 'nothing yet'}.${declined.length ? ' Declined: ' + declined.join(', ') + '.' : ''} Still missing: ${missing.join(', ')}. Ask only for the next missing item(s); do not ask again for anything known or declined.]`
}

const modelList = () => {
  const env = (process.env.OPENROUTER_MODELS || '').split(',').map(s => s.trim()).filter(Boolean)
  return env.length ? env : DEFAULT_MODELS
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method' }) }
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return res.status(503).json({ error: 'not-configured' })
  // a whole onboarding is about ten requests; forty in ten minutes is someone scripting it
  if (limited(req, { max: 40, windowMs: 10 * 60 * 1000 })) return res.status(429).json({ error: 'busy' })
  const messages = clean(req.body)
  if (!messages) return res.status(400).json({ error: 'bad-request' })
  const knownIn = cleanKnown(req.body?.known)
  const declinedIn = cleanDeclined(req.body?.declined)
  // the state note sits right before the person's latest message, where the model reads it last
  const withState = [...messages.slice(0, -1), { role: 'system', content: stateNote(knownIn, declinedIn) }, messages[messages.length - 1]]

  let r
  try {
    r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://isora-six.vercel.app',
        'X-Title': 'ISORA',
      },
      body: JSON.stringify({
        models: modelList(),
        messages: [{ role: 'system', content: SYSTEM }, ...withState],
        response_format: { type: 'json_schema', json_schema: { name: 'coach_turn', strict: true, schema: OUTPUT } },
        // only providers that honour the schema, and none that keep or train on what is sent
        provider: { require_parameters: true, data_collection: 'deny' },
        // the final turn carries the whole profile and the focus; a reasoning model's thinking
        // must not eat into that room (api/buddy-line.js learnt the same lesson)
        max_tokens: 2500,
        reasoning: { effort: 'low', exclude: true },
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(25000),
    })
  } catch {
    return res.status(504).json({ error: 'timeout' })
  }
  if (r.status === 401 || r.status === 402) return res.status(503).json({ error: 'not-configured' })
  if (r.status === 429) return res.status(429).json({ error: 'busy' })
  if (!r.ok) return res.status(502).json({ error: 'upstream', status: r.status })

  let data, model = null, why = null
  try {
    const body = await r.json()
    model = typeof body?.model === 'string' ? body.model : null
    const choice = body?.choices?.[0]
    const text = choice?.message?.content
    // what went wrong, for the error only: how the answer ended and its first characters
    why = { finish: choice?.finish_reason || choice?.native_finish_reason || null, len: typeof text === 'string' ? text.length : -1, head: typeof text === 'string' ? text.slice(0, 240) : String(body?.error?.message || '').slice(0, 240) }
    data = JSON.parse(typeof text === 'string' ? text.replace(/^```(?:json)?\s*|\s*```$/g, '') : '')
  } catch {
    return res.status(502).json({ error: 'bad-output', model, why })
  }
  if (typeof data?.reply !== 'string' || typeof data?.done !== 'boolean') return res.status(502).json({ error: 'bad-output', model, why })
  // what is known now: what the app sent, with what this turn added on top (a value, once given, stays)
  const known = { ...knownIn, ...cleanKnown(data.known) }
  const declined = [...new Set([...declinedIn, ...cleanDeclined(data.declined)])]
  const complete = FIELDS.every(f => known[f] !== undefined || declined.includes(f))
  const profile = data.done && data.profile && typeof data.profile === 'object' ? { ...data.profile } : null
  // the profile is built on what was actually said, never on a field the model made up at the end
  if (profile) for (const f of FIELDS) if (known[f] !== undefined) profile[f] = known[f]
  return res.status(200).json({
    reply: data.reply,
    quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies.filter(q => typeof q === 'string').slice(0, 5) : [],
    done: data.done && !!profile,
    known, declined, complete,
    profile,
    model,   // which model in the list answered (OpenRouter's own report)
  })
}
