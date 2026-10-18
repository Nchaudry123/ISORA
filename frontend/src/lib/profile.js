// The person behind the app (S.profile): a name, an avatar, what they train for and how often
// they mean to. Kept in the profile like every other setting, so it travels with backups. Pure
// helpers here; the sheet is components/ProfileSheet.jsx, the greeting and the records on Home.

export const GOALS = ['strength', 'muscle', 'fitness', 'active']
export const GOAL_NAME = { strength: 'Build strength', muscle: 'Build muscle', fitness: 'Get fitter', active: 'Stay active' }
// Avatars to pick from besides your initial: plain, legible at 40 px, no faces.
export const AVATARS = ['💪', '🏋️', '🔥', '⚡', '🦾', '🏃', '🧘', '🥇', '🐺', '🦁', '🌊', '🌱']

export const emptyProfile = () => ({ name: '', avatar: '', goal: null, weekTarget: 0, heightCm: null, experience: null, focus: '', focusAreas: [] })

/** A stored profile made safe: unknown or malformed fields fall back to empty. */
export function cleanProfile(p) {
  const o = p && typeof p === 'object' ? p : {}
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 40) : ''
  const avatar = typeof o.avatar === 'string' && AVATARS.includes(o.avatar) ? o.avatar : ''
  const goal = GOALS.includes(o.goal) ? o.goal : null
  const wt = Number(o.weekTarget)
  const weekTarget = Number.isInteger(wt) && wt >= 1 && wt <= 7 ? wt : 0
  // from the first-run chat (lib/onboarding.js): height, level, and what to focus on
  const h = Number(o.heightCm)
  const heightCm = Number.isFinite(h) && h >= 100 && h <= 250 ? Math.round(h) : null
  const experience = ['beginner', 'intermediate', 'advanced'].includes(o.experience) ? o.experience : null
  const focus = typeof o.focus === 'string' ? o.focus.trim().slice(0, 600) : ''
  const focusAreas = (Array.isArray(o.focusAreas) ? o.focusAreas : []).filter(a => typeof a === 'string' && a.trim()).map(a => a.trim().slice(0, 30)).slice(0, 4)
  return { name, avatar, goal, weekTarget, heightCm, experience, focus, focusAreas }
}

/** The first letter of the first name, for the avatar when no picture is chosen. */
export function initialOf(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || ''
  return first ? [...first][0].toUpperCase() : ''
}

/** The greeting for the hour: the key of the translated string ('Good morning, {0}' …). */
export function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning, {0}'
  if (hour >= 12 && hour < 18) return 'Good afternoon, {0}'
  if (hour >= 18 && hour < 23) return 'Good evening, {0}'
  return 'Up late, {0}'
}

/**
 * Personal records, newest first: every exercise that ever set a record (the workouts' `prs`),
 * with its best set as `bestOf(exId)` reads it (lib/exercise-history.js bestSetFor).
 * Returns [{ exId, d, set }].
 */
export function personalRecords(workouts, bestOf, limit = Infinity) {
  const ids = new Set()
  for (const w of workouts || []) for (const id of w?.prs || []) if (typeof id === 'string') ids.add(id)
  const out = []
  for (const exId of ids) {
    const b = bestOf(exId)
    if (b && b.set) out.push({ exId, d: b.d, set: b.set })
  }
  out.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0))
  return out.slice(0, limit)
}
