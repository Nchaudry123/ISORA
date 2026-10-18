// First run (components/Onboarding.jsx): a short chat that learns what someone trains for, their
// weight, height, experience, days and equipment, then sets the app up for them. The chat comes
// from an LLM through /api/coach-chat when the server has a key, and from SCRIPT below when it
// does not (or the phone is offline) — both end in the same profile, applied the same way.

export const GOALS = ['strength', 'muscle', 'fitness', 'active']
export const LEVELS = ['beginner', 'intermediate', 'advanced']
// What the equipment answers mean in the exercise library's own names (lib/equipment.js).
export const GEAR = {
  gym: ['dumbbell', 'barbell', 'cable', 'leverage machine', 'smith machine', 'kettlebell', 'band', 'ez barbell', 'trap bar', 'medicine ball', 'stability ball', 'stationary bike', 'bench', 'pull-up bar'],
  dumbbells: ['dumbbell', 'bench'],
  barbell: ['barbell', 'dumbbell', 'bench', 'pull-up bar'],
  minimal: ['band', 'pull-up bar'],
}
const KNOWN_GEAR = new Set(GEAR.gym.concat('suspension trainer'))

/** Which starter plan (lib/starter.js) fits a goal, a number of days and a level. */
export function pickPlan({ goal, daysPerWeek, experience } = {}) {
  const days = Number(daysPerWeek) || 3
  if (days >= 5) return 'ppl'
  if (days === 4) return 'upper-lower'
  if (goal === 'strength' && experience !== 'advanced') return '5x5'
  return 'full-body'
}

/** An answer from the model (or the script) made safe to apply. */
export function normalizeProfile(p) {
  const o = p && typeof p === 'object' ? p : {}
  const num = (v, lo, hi) => (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Math.round(Number(v) * 10) / 10 : null)
  const days = Math.round(Number(o.daysPerWeek))
  return {
    name: typeof o.name === 'string' ? o.name.trim().slice(0, 40) : '',
    goal: GOALS.includes(o.goal) ? o.goal : 'fitness',
    weightKg: num(o.weightKg, 25, 350),
    heightCm: num(o.heightCm, 100, 250),
    experience: LEVELS.includes(o.experience) ? o.experience : 'beginner',
    daysPerWeek: days >= 1 && days <= 7 ? days : 3,
    equipment: [...new Set((Array.isArray(o.equipment) ? o.equipment : []).filter(e => KNOWN_GEAR.has(e)))],
    focus: typeof o.focus === 'string' ? o.focus.trim().slice(0, 600) : '',
    focusAreas: (Array.isArray(o.focusAreas) ? o.focusAreas : []).filter(a => typeof a === 'string' && a.trim()).map(a => a.trim().slice(0, 30)).slice(0, 4),
  }
}

/** A typed weight in kg: "80", "80 kg", "176 lb", "176lbs". Plain numbers are in `unit`. */
export function parseWeight(text, unit = 'kg') {
  const m = String(text || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|lb|lbs|pound)?/i)
  if (!m) return null
  const n = parseFloat(m[1])
  const u = (m[2] || unit).toLowerCase()
  const kg = u.startsWith('lb') || u.startsWith('pound') ? n / 2.20462 : n
  return kg >= 25 && kg <= 350 ? Math.round(kg * 10) / 10 : null
}

/** A typed height in cm: "180", "180 cm", "1.80 m", "5'11", "5 ft 11", "71 in". */
export function parseHeight(text) {
  const s = String(text || '').toLowerCase().replace(',', '.')
  const ftIn = s.match(/(\d)\s*(?:'|ft|feet|foot)\s*(\d{1,2})?/)
  if (ftIn) return Math.round((parseInt(ftIn[1]) * 12 + (parseInt(ftIn[2] || '0'))) * 2.54)
  const m = s.match(/(\d+(?:\.\d+)?)\s*(cm|m|in|inch|inches)?/)
  if (!m) return null
  const n = parseFloat(m[1])
  const u = m[2] || (n < 3 ? 'm' : 'cm')
  const cm = u === 'm' ? n * 100 : u.startsWith('in') ? n * 2.54 : n
  return cm >= 100 && cm <= 250 ? Math.round(cm) : null
}

/**
 * The scripted chat: one question per step, with quick replies and how to read the answer.
 * Question and reply texts are English keys for t(); `read(answer, unit)` returns the value, or
 * undefined to ask again. Skipping weight or height is allowed (null).
 */
export const SCRIPT = [
  { key: 'name', ask: 'Hi, I’m your ISORA coach. What should I call you?', quick: [],
    read: a => (a.trim() ? a.trim().split(/\s+/)[0].slice(0, 40) : undefined) },
  { key: 'goal', ask: 'Nice to meet you, {0}. What do you want from training?', quick: ['Build strength', 'Build muscle', 'Get fitter', 'Stay active'],
    read: a => ({ 'build strength': 'strength', 'build muscle': 'muscle', 'get fitter': 'fitness', 'stay active': 'active' })[a.trim().toLowerCase()] ?? matchGoal(a) },
  { key: 'weightKg', ask: 'What do you weigh? Any unit works.', quick: ['Skip'],
    read: (a, unit) => (/skip/i.test(a) ? null : parseWeight(a, unit) ?? undefined) },
  { key: 'heightCm', ask: 'And how tall are you?', quick: ['Skip'],
    read: a => (/skip/i.test(a) ? null : parseHeight(a) ?? undefined) },
  { key: 'experience', ask: 'How long have you been training?', quick: ['Just starting', 'A year or two', 'Many years'],
    read: a => ({ 'just starting': 'beginner', 'a year or two': 'intermediate', 'many years': 'advanced' })[a.trim().toLowerCase()] ?? matchLevel(a) },
  { key: 'daysPerWeek', ask: 'How many days a week can you train?', quick: ['2', '3', '4', '5', '6'],
    read: a => { const n = parseInt(a, 10); return n >= 1 && n <= 7 ? n : undefined } },
  { key: 'equipment', ask: 'Last one: what can you train with?', quick: ['Full gym', 'Home with dumbbells', 'Barbell and rack', 'Bands and bodyweight'],
    read: a => ({ 'full gym': GEAR.gym, 'home with dumbbells': GEAR.dumbbells, 'barbell and rack': GEAR.barbell, 'bands and bodyweight': GEAR.minimal })[a.trim().toLowerCase()] ?? matchGear(a) },
]
function matchGoal(a) {
  const s = a.toLowerCase()
  if (/strong|strength|power|lift/.test(s)) return 'strength'
  if (/muscle|bulk|size|hypertroph/.test(s)) return 'muscle'
  if (/fit|cardio|endur|lose|lean|tone/.test(s)) return 'fitness'
  if (/active|health|move|maintain/.test(s)) return 'active'
  return undefined
}
function matchLevel(a) {
  const s = a.toLowerCase()
  if (/new|start|begin|never|first/.test(s)) return 'beginner'
  if (/year|some|while|intermediate/.test(s)) return 'intermediate'
  if (/many|long|advanced|decade|years/.test(s)) return 'advanced'
  return undefined
}
function matchGear(a) {
  const s = a.toLowerCase()
  if (/gym/.test(s)) return GEAR.gym
  const out = new Set()
  if (/dumb/.test(s)) out.add('dumbbell')
  if (/barbell|rack/.test(s)) { out.add('barbell'); out.add('bench') }
  if (/bench/.test(s)) out.add('bench')
  if (/kettle/.test(s)) out.add('kettlebell')
  if (/band/.test(s)) out.add('band')
  if (/pull|bar\b/.test(s)) out.add('pull-up bar')
  if (/cable/.test(s)) out.add('cable')
  if (/bike/.test(s)) out.add('stationary bike')
  if (/nothing|none|body ?weight|no equipment/.test(s)) return []
  return out.size ? [...out] : undefined
}

const PLAN_REASON = {
  ppl: 'a push, pull and legs split, each muscle group twice a week',
  'upper-lower': 'an upper/lower split, four days, every muscle twice a week',
  '5x5': 'a 5×5 programme built on the big barbell lifts',
  'full-body': 'full-body sessions, so every workout counts for everything',
}
const GOAL_FOCUS = {
  strength: 'heavy compound lifts and adding weight steadily',
  muscle: 'moderate weights for 8 to 12 reps, close to failure, with steady volume',
  fitness: 'full-body work with short rests to build fitness and consistency',
  active: 'moving well and staying consistent, without grinding',
}
/** The scripted chat's closing words: what to focus on, in the same shape the model writes. */
export function scriptedFocus(p) {
  const plan = pickPlan(p)
  return {
    focus: `${p.name ? p.name + ', ' : ''}with ${p.daysPerWeek} days a week I'd focus on ${GOAL_FOCUS[p.goal] || GOAL_FOCUS.fitness}. ISORA has set you up with ${PLAN_REASON[plan]}${p.equipment.length ? ', fitted to your equipment' : ''}. ${p.experience === 'beginner' ? 'Start light and learn the movements; the weights will come.' : 'Log every set and let progression do the work.'}`,
    focusAreas: p.goal === 'strength' ? ['compound lifts', 'progressive overload'] : p.goal === 'muscle' ? ['volume', 'mind-muscle connection'] : p.goal === 'fitness' ? ['conditioning', 'consistency'] : ['mobility', 'consistency'],
  }
}
