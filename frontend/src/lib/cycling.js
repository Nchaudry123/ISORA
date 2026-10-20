// Variation Cycling: three variations of each of six movement patterns, trained one at a time.
// You stay on a variation for as long as it moves; three trained weeks in a row without a new
// best is a plateau, and only then does the pattern rotate to its next variation, which starts
// at 85% of the stalled one's peak. After all three the cycle comes back round to the first,
// stronger. Isolation work (curls, raises) is never rotated: it has no pattern here.
//
// The weekly +weight / +rep inside a variation is the ordinary progression rule of the routine
// (lib/progression.js); this file is the layer above it: which variation sits in the slot, and
// when it changes. Pure, apart from `applySwitch`, which edits a store draft the caller holds.
import { EXIDX, allExercises, defaultIncrement, isBodyweightEq } from './exercises.js'
import { todayISO } from './format.js'
import { exAvailable } from './equipment.js'
import { isWarmupRow } from './workout-model.js'
import { replaceSlotExercise } from './routines.js'
import { snapWeight } from './progression.js'

export const PATTERNS = ['hpress', 'hpull', 'vpress', 'vpull', 'squat', 'hinge']
// English keys for t()
export const PATTERN_NAME = {
  hpress: 'Horizontal press', hpull: 'Horizontal pull', vpress: 'Vertical press', vpull: 'Vertical pull', squat: 'Squat', hinge: 'Hinge',
}
export const PATTERN_ICON = { hpress: 'dumbbell', hpull: 'pullup', vpress: 'arrowUp', vpull: 'arrowDown', squat: 'legs', hinge: 'figureStrength' }
export const VARIATIONS = 3
export const STALL_WEEKS = 3     // trained weeks in a row without a new best: a full-blown plateau
export const CARRY = 0.85        // the next variation starts at this share of the stalled one's peak
export const STATUS = ['active', 'pending', 'stalled', 'done']

// --- which pattern an exercise belongs to ------------------------------------------------------
const RX = {
  vpull: /\b(pull[- ]?ups?|chin[- ]?ups?|pulldowns?|lat pull|pull[- ]?down)\b/,
  vpress: /\b(overhead|shoulder press|military|landmine press|arnold|push press|seated .*press|z press|pike push)\b/,
  hpull: /\b(rows?|rowing|face pull|inverted|kroc|pendlay|t[- ]bar)\b/,
  hpress: /\b(bench|chest press|incline|decline|push[- ]?ups?|dips?|floor press|chest fly|flys?|press[- ]up)\b/,
  squat: /\b(squat|leg press|lunges?|split squat|hack|step[- ]?ups?|bulgarian|pistol|box jump)\b/,
  hinge: /\b(deadlift|rdl|romanian|hip thrust|good morning|hinge|swing|glute bridge|back extension|hyperextension|clean|snatch|rack pull)\b/,
}
/** The movement pattern of an exercise, or null for isolation work (and anything unknown). */
export function patternOf(ex) {
  const e = typeof ex === 'string' ? EXIDX[ex] : ex
  if (!e) return null
  const n = String(e.n || e.name || '').toLowerCase()
  if (!n || e.bp === 'cardio') return null
  // the pulls are checked before the presses: "chest supported row" is a row, not a chest press
  for (const p of ['vpull', 'hpull', 'vpress', 'squat', 'hinge', 'hpress']) if (RX[p].test(n)) {
    // a press named after the shoulders with no bench or incline is vertical
    if (p === 'hpress' && /shoulder|overhead|military/.test(n) && !/bench|incline|decline/.test(n)) return 'vpress'
    return p
  }
  if (/\bpress\b/.test(n)) return e.bp === 'shoulders' ? 'vpress' : e.bp === 'chest' ? 'hpress' : null
  return null
}

// --- the state kept in the profile (S.cycling) -------------------------------------------------
export const emptyCycling = () => ({ on: false, patterns: {} })
const cleanVar = v => (v && typeof v === 'object' && typeof v.id === 'string' ? {
  id: v.id, status: STATUS.includes(v.status) ? v.status : 'pending',
  peakW: Number.isFinite(v.peakW) ? v.peakW : null, peakR: Number.isFinite(v.peakR) ? v.peakR : null,
  weeksStalled: Number.isInteger(v.weeksStalled) && v.weeksStalled >= 0 ? v.weeksStalled : 0,
  // the day it became the active one: only weeks from then on can count as its stall
  since: typeof v.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.since) ? v.since : null,
} : null)
export function cleanCycling(c) {
  const o = c && typeof c === 'object' ? c : {}
  const patterns = {}
  for (const p of PATTERNS) {
    const vars = (Array.isArray(o.patterns?.[p]?.vars) ? o.patterns[p].vars : []).map(cleanVar).filter(Boolean).slice(0, VARIATIONS)
    if (vars.length && !vars.some(v => v.status === 'active')) vars[0].status = 'active'
    patterns[p] = { vars }
  }
  return { on: o.on === true, patterns }
}

/** The exercise ids in the week's routines, in plan order, once each. */
const plannedIds = S => {
  const out = []
  for (const r of S.routines || []) for (const e of r.ex || []) if (e?.id && !out.includes(e.id)) out.push(e.id)
  return out
}

/**
 * Three variations for a pattern: what the plan already trains in it first, then alternates from
 * the library the person's equipment allows (barbell and dumbbell lifts before machines), never
 * the same exercise twice. Spec: start with the weakest; the app cannot know that, so the plan's
 * own lift leads and the sheet says so.
 */
export function suggestVariations(S, pattern, keep = []) {
  const picked = [...keep.filter(id => patternOf(id) === pattern)]
  for (const id of plannedIds(S)) if (picked.length < VARIATIONS && patternOf(id) === pattern && !picked.includes(id)) picked.push(id)
  if (picked.length < VARIATIONS) {
    const rank = e => (e.eq === 'barbell' ? 0 : e.eq === 'dumbbell' ? 1 : e.eq === 'body weight' ? 2 : e.eq === 'cable' ? 3 : 4)
    const pool = allExercises(S).filter(e => patternOf(e) === pattern && !picked.includes(e.id) && exAvailable(S, e))
      .sort((a, b) => rank(a) - rank(b) || String(a.n || '').length - String(b.n || '').length)
    for (const e of pool) { if (picked.length >= VARIATIONS) break; picked.push(e.id) }
  }
  return picked
}

/** A cycling state for this profile: every pattern filled, the plan's lift active. */
export function seedCycling(S, on = true, today = todayISO()) {
  const c = emptyCycling(); c.on = on
  for (const p of PATTERNS) {
    const ids = suggestVariations(S, p)
    c.patterns[p] = { vars: ids.map((id, i) => ({ id, status: i === 0 ? 'active' : 'pending', peakW: null, peakR: null, weeksStalled: 0, since: i === 0 ? today : null })) }
  }
  return c
}

// --- progress, week by week --------------------------------------------------------------------
/** Monday of the week a YYYY-MM-DD falls in, as YYYY-MM-DD. */
export function weekOf(iso) {
  const d = new Date(iso + 'T12:00:00')
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
const topSet = entry => {
  let best = null
  for (const s of entry?.sets || []) {
    if (!s?.done || isWarmupRow(s) || !(s.r > 0)) continue
    const w = Number(s.w) || 0
    if (!best || w > best.w || (w === best.w && s.r > best.r)) best = { w, r: s.r }
  }
  return best
}
/** The best set of each trained week, oldest first: [{ week, w, r }]. */
export function weeklyBests(S, exId) {
  const byWeek = new Map()
  for (const w of S.workouts || []) {
    const entry = (w.entries || []).find(e => e && e.id === exId)
    const top = entry && topSet(entry)
    if (!top) continue
    const k = weekOf(w.d)
    const cur = byWeek.get(k)
    if (!cur || top.w > cur.w || (top.w === cur.w && top.r > cur.r)) byWeek.set(k, top)
  }
  return [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([week, t]) => ({ week, ...t }))
}
const beats = (a, b) => !b || a.w > b.w || (a.w === b.w && a.r > b.r)
/** The best ever: { w, r } or null. */
export function peakOf(S, exId) {
  let peak = null
  for (const b of weeklyBests(S, exId)) if (beats(b, peak)) peak = { w: b.w, r: b.r }
  return peak
}
/**
 * Trained weeks in a row, up to the latest, without a new best (heavier, or more reps at the
 * same weight). The first week trained is the baseline and never counts as a stall. With `since`
 * (the day the variation became active) only the weeks from then on are read: what it did in an
 * earlier turn, or in history imported from elsewhere, is not this turn's plateau.
 */
export function stallWeeks(S, exId, since = null) {
  const from = since ? weekOf(since) : null
  const weeks = weeklyBests(S, exId).filter(b => !from || b.week >= from)
  let peak = null, run = 0
  weeks.forEach((b, i) => {
    if (i === 0) { peak = { w: b.w, r: b.r }; return }
    if (beats(b, peak)) { peak = { w: b.w, r: b.r }; run = 0 } else run++
  })
  return run
}

// --- the review after a workout ----------------------------------------------------------------
/**
 * The state brought up to date with the history, and the switches a plateau calls for:
 * [{ pattern, from, to, carryW }]. Only the pattern that stalled moves; the others stand.
 */
export function reviewCycling(S, today = todayISO()) {
  const c = cleanCycling(S.cycling)
  const switches = []
  for (const p of PATTERNS) {
    const vars = c.patterns[p].vars
    const i = vars.findIndex(v => v.status === 'active')
    if (i < 0) continue
    const v = vars[i]
    const peak = peakOf(S, v.id)
    v.peakW = peak ? peak.w : v.peakW; v.peakR = peak ? peak.r : v.peakR
    v.weeksStalled = stallWeeks(S, v.id, v.since)
    if (v.weeksStalled < STALL_WEEKS || vars.length < 2) continue
    // a full-blown plateau: this one is done, the next starts at 85% of its peak
    v.status = 'done'
    const j = (i + 1) % vars.length
    const next = vars[j]
    next.status = 'active'; next.weeksStalled = 0; next.since = today
    // round trip through every variation: the ones done come back as pending
    vars.forEach((x, k) => { if (k !== j && x.status !== 'active') x.status = k < j && j > 0 ? 'done' : x.status })
    if (j === 0) vars.forEach((x, k) => { if (k !== 0) x.status = 'pending' })
    const unit = S.unit || 'kg'
    // bodyweight work takes no carried load: its "weight" would be plates on a belt
    const carryW = v.peakW > 0 && !isBodyweightEq(next.id) ? snapWeight(v.peakW * CARRY, defaultIncrement(next.id, unit) / 2) : 0
    switches.push({ pattern: p, from: v.id, to: next.id, carryW, peakW: v.peakW, peakR: v.peakR })
  }
  return { cycling: c, switches }
}

/** One switch written into a store draft: every routine slot on the old lift takes the new one. */
export function applySwitch(s, sw) {
  for (const r of s.routines || []) {
    for (let k = 0; k < (r.ex || []).length; k++) {
      if (r.ex[k]?.id !== sw.from) continue
      const slot = replaceSlotExercise(r.ex[k], sw.to, s, r.id)
      if (sw.carryW > 0 && !isBodyweightEq(sw.to)) slot.weight = sw.carryW
      r.ex[k] = slot
    }
  }
}

/** The pattern a variation belongs to in this state, for the workout screen's line. */
export function cyclingSlotOf(cycling, exId) {
  const c = cleanCycling(cycling)
  if (!c.on) return null
  for (const p of PATTERNS) {
    const i = c.patterns[p].vars.findIndex(v => v.id === exId)
    if (i >= 0) return { pattern: p, index: i, vars: c.patterns[p].vars }
  }
  return null
}
