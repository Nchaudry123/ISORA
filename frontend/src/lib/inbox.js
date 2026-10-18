// Home as an inbox (views/Home.jsx): what to do now, what is coming up, what is done, laid out
// like a message list. Pure helpers here so the order and the wording of each row are tested
// without a screen.

const isoOfDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOfDate(d) }

/** The preview line of a routine: its first exercises by name, then how many more. */
export function previewOf(routine, nameOf, max = 3) {
  const ex = Array.isArray(routine?.ex) ? routine.ex : []
  const names = ex.slice(0, max).map(e => nameOf(e.id)).filter(Boolean)
  const more = ex.length - names.length
  return { text: names.join(', '), more: more > 0 ? more : 0 }
}

/**
 * The planned days after today, nearest first: [{ iso, routines }] for up to `count` days that
 * have something on them, looking `horizon` days ahead. `routinesOn(iso)` is the app's own
 * reading of a date (lib/history.js effectiveRoutines).
 */
export function comingUp(todayIso, routinesOn, { count = 4, horizon = 14 } = {}) {
  const out = []
  for (let i = 1; i <= horizon && out.length < count; i++) {
    const iso = addDays(todayIso, i)
    const routines = routinesOn(iso)
    if (routines.length) out.push({ iso, routines })
  }
  return out
}

/** The latest finished workouts, newest first. */
export function recentDone(workouts, count = 3) {
  return [...(workouts || [])]
    .filter(w => w && w.d)
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b.start || 0) - (a.start || 0)))
    .slice(0, count)
}

/**
 * How far a date is from today, for the time column of a row: 'today', 'tomorrow',
 * 'yesterday', 'week' (within six days either way: show the weekday) or 'date'.
 */
export function dayDistance(iso, todayIso) {
  const days = Math.round((new Date(iso + 'T12:00:00') - new Date(todayIso + 'T12:00:00')) / 864e5)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (Math.abs(days) <= 6) return 'week'
  return 'date'
}

/** Sets still open in a running session (the badge on its row). */
export function setsLeft(active) {
  let n = 0
  for (const e of active?.entries || []) for (const s of e.sets || []) if (!s.done) n++
  return n
}
