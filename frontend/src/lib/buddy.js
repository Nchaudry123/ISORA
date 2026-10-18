// Your buddy (components/Buddy.jsx): a small block creature that lives in ISORA, greets you, reads
// how your training is going and grows with it. Pure helpers here — who it is, its mood, its level
// and the words it falls back on when the line of the day cannot come from the server.

// One buddy: a square block creature in the app's blue (the accent), like the blocks of the logo
// and of Rest Blast. Earlier versions offered four; any of them now reads as this one.
export const KIND = 'block'
export const KIND_COLOR = 'var(--acc)'
export const DEFAULT_NAME = 'Iso'

export const emptyBuddy = () => ({ kind: null, name: '', born: null, level: 1, line: null })

/** A stored buddy made safe. `kind` null means it has not been met yet (onboarding names it). */
export function cleanBuddy(b) {
  const o = b && typeof b === 'object' ? b : {}
  const kind = typeof o.kind === 'string' && o.kind ? KIND : null
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 20) : (kind ? DEFAULT_NAME : '')
  const lvl = Number(o.level)
  const line = o.line && typeof o.line === 'object' && typeof o.line.text === 'string' && typeof o.line.key === 'string'
    ? { key: o.line.key.slice(0, 40), text: o.line.text.slice(0, 200) } : null
  return { kind, name, born: typeof o.born === 'string' ? o.born : null, level: Number.isInteger(lvl) && lvl >= 1 ? lvl : 1, line }
}

// ---------------------------------------------------------------- experience --
// A workout is worth 40 XP plus 2 per set done (up to 60 more), and every personal record 25.
export const XP_WORKOUT = 40
export const XP_PER_SET = 2
export const XP_SET_CAP = 60
export const XP_PR = 25

/** XP from a list of finished workouts; `setsOf(w)` counts a workout's done sets. */
export function totalXP(workouts, setsOf) {
  let xp = 0
  for (const w of workouts || []) {
    if (!w) continue
    xp += XP_WORKOUT + Math.min(XP_SET_CAP, XP_PER_SET * (setsOf(w) || 0)) + XP_PR * ((w.prs || []).length)
  }
  return xp
}

// Level n starts at 50·n·(n−1) XP: 0, 100, 300, 600, 1000, 1500 …, so each level asks a little more.
export const xpForLevel = n => 50 * n * (n - 1)

/** { level, into, need, pct } — the level for an XP total and how far into it. */
export function levelOf(xp) {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const into = xp - xpForLevel(level)
  const need = xpForLevel(level + 1) - xpForLevel(level)
  return { level, into, need, pct: Math.round((into / need) * 100) }
}

// What it has earned by level: a sweatband, then headphones, then a crown.
export function gearFor(level) {
  return { band: level >= 3, phones: level >= 6, crown: level >= 10 }
}

// --------------------------------------------------------------------- mood --
/**
 * The buddy's mood right now, from what the day holds:
 *   active   a session is running
 *   proud    today's training is done
 *   hyped    something is planned today and not done yet
 *   sleepy   late at night (23:00–05:00) with nothing left to do
 *   missing  nothing logged for 4+ days (and nothing on today)
 *   new      no workout ever logged
 *   chill    a rest day
 */
export function moodOf({ active, doneToday, plannedToday, hour, daysSinceLast, everTrained }) {
  if (active) return 'active'
  if (doneToday) return 'proud'
  if (plannedToday) return 'hyped'
  if (hour >= 23 || hour < 5) return 'sleepy'
  if (!everTrained) return 'new'
  if (daysSinceLast != null && daysSinceLast >= 4) return 'missing'
  return 'chill'
}

/** Whole days between two YYYY-MM-DD dates (b − a). */
export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5)

// Lines it falls back on (English keys for t(); {0} is your name, {1} today's session).
export const LINES = {
  active: ['You’ve got this, {0}. One set at a time.', 'Locked in. I’m right here, {0}.'],
  proud: ['That’s today done, {0}. I’m proud of you.', 'Workout logged. Now we recover, {0}.'],
  hyped: ['{1} today, {0}. Ready when you are.', 'It’s {1} day, {0}. Let’s make it count.'],
  sleepy: ['It’s late, {0}. Sleep is training too.', 'Rest up, {0}. Big things tomorrow.'],
  missing: ['Haven’t seen you in a while, {0}. Even a short session counts.', 'I missed you, {0}. Shall we ease back in?'],
  new: ['Hi {0}! Start your first workout and I’ll start growing.', 'Your first workout is the hardest one, {0}. Let’s do it.'],
  chill: ['Rest day, {0}. Muscles grow while you recover.', 'Take it easy today, {0}. You’ve earned it.'],
}

/** A fallback line for a mood: the same one all day (picked by the date), so it doesn't flicker. */
export function fallbackLine(mood, isoDate) {
  const list = LINES[mood] || LINES.chill
  const n = [...String(isoDate || '')].reduce((a, c) => a + c.charCodeAt(0), 0)
  return list[n % list.length]
}

/** The cache key for the line of the day: one line per mood per day. */
export const lineKey = (mood, isoDate) => `${isoDate}:${mood}`
