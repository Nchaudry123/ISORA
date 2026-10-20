import { describe, it, expect } from 'vitest'
import { patternOf, weeklyBests, stallWeeks, peakOf, reviewCycling, applySwitch, cleanCycling, seedCycling, suggestVariations, weekOf, PATTERNS } from './cycling.js'
import { allExercises, isBodyweightEq } from './exercises.js'

const wk = (d, id, sets) => ({ id: 'w' + d, d, start: 0, end: 0, entries: [{ id, sets: sets.map(([w, r]) => ({ w, r, done: true })) }] })
const S = (workouts, extra = {}) => ({ unit: 'kg', workouts, routines: [], exWeights: {}, ...extra })

describe('movement patterns', () => {
  it('reads the six patterns off an exercise, and leaves isolation work out', () => {
    expect(patternOf({ n: 'barbell bench press', bp: 'chest' })).toBe('hpress')
    expect(patternOf({ n: 'incline dumbbell press', bp: 'chest' })).toBe('hpress')
    expect(patternOf({ n: 'chest supported row', bp: 'back' })).toBe('hpull')
    expect(patternOf({ n: 'barbell overhead press', bp: 'shoulders' })).toBe('vpress')
    expect(patternOf({ n: 'dumbbell shoulder press', bp: 'shoulders' })).toBe('vpress')
    expect(patternOf({ n: 'lat pulldown', bp: 'back' })).toBe('vpull')
    expect(patternOf({ n: 'pull up', bp: 'back' })).toBe('vpull')
    expect(patternOf({ n: 'barbell squat', bp: 'upper legs' })).toBe('squat')
    expect(patternOf({ n: 'leg press', bp: 'upper legs' })).toBe('squat')
    expect(patternOf({ n: 'barbell romanian deadlift', bp: 'upper legs' })).toBe('hinge')
    expect(patternOf({ n: 'kettlebell swing', bp: 'full body' })).toBe('hinge')
    expect(patternOf({ n: 'dumbbell biceps curl', bp: 'upper arms' })).toBeNull()
    expect(patternOf({ n: 'dumbbell lateral raise', bp: 'shoulders' })).toBeNull()
    expect(patternOf({ n: 'run', bp: 'cardio' })).toBeNull()
    expect(patternOf(null)).toBeNull()
  })
})

describe('progress week by week', () => {
  it('keeps the best set of each week and counts the weeks without a new best', () => {
    const s = S([
      wk('2026-09-01', 'a', [[60, 8], [60, 8]]), wk('2026-09-03', 'a', [[60, 9]]),   // week 1: 60×9
      wk('2026-09-08', 'a', [[62.5, 8]]),                                          // week 2: heavier
      wk('2026-09-15', 'a', [[62.5, 8]]),                                          // week 3: same
      wk('2026-09-22', 'a', [[62.5, 7]]),                                          // week 4: worse
    ])
    expect(weekOf('2026-09-03')).toBe('2026-08-31')
    expect(weeklyBests(s, 'a').map(b => [b.w, b.r])).toEqual([[60, 9], [62.5, 8], [62.5, 8], [62.5, 7]])
    expect(peakOf(s, 'a')).toEqual({ w: 62.5, r: 8 })
    expect(stallWeeks(s, 'a')).toBe(2)
    s.workouts.push(wk('2026-09-29', 'a', [[62.5, 8]]))
    expect(stallWeeks(s, 'a')).toBe(3)
    s.workouts.push(wk('2026-10-06', 'a', [[62.5, 9]]))   // more reps at the same weight: progress
    expect(stallWeeks(s, 'a')).toBe(0)
    expect(stallWeeks(S([wk('2026-09-01', 'a', [[60, 8]])]), 'a')).toBe(0)   // one week is a baseline
  })
})

describe('the rotation', () => {
  const cycling = { on: true, patterns: { hpress: { vars: [{ id: 'a', status: 'active' }, { id: 'b', status: 'pending' }, { id: 'c', status: 'pending' }] } } }
  const stalled = () => S([
    wk('2026-09-01', 'a', [[80, 5]]), wk('2026-09-08', 'a', [[82.5, 5]]),
    wk('2026-09-15', 'a', [[82.5, 5]]), wk('2026-09-22', 'a', [[82.5, 5]]), wk('2026-09-29', 'a', [[82.5, 4]]),
  ], { cycling, routines: [{ id: 'r', name: 'Push', ex: [{ id: 'a', sets: 4, reps: 5, weight: 82.5 }, { id: 'curl', sets: 3, reps: 12, weight: 10 }] }] })

  it('switches only the stalled pattern, to the next variation at 85% of the peak, on the load grid', () => {
    const s = stalled()
    const { cycling: c, switches } = reviewCycling(s, '2026-10-01')
    expect(switches).toEqual([{ pattern: 'hpress', from: 'a', to: 'b', carryW: 70, peakW: 82.5, peakR: 5 }])
    expect(c.patterns.hpress.vars.map(v => v.status)).toEqual(['done', 'active', 'pending'])
    expect(c.patterns.hpress.vars[1].since).toBe('2026-10-01')
    expect(c.patterns.hpress.vars[0]).toMatchObject({ peakW: 82.5, peakR: 5, weeksStalled: 3 })
    for (const p of PATTERNS.filter(p => p !== 'hpress')) expect(c.patterns[p].vars).toEqual([])
    applySwitch(s, switches[0])
    expect(s.routines[0].ex[0]).toMatchObject({ id: 'b', weight: 70, sets: 4, reps: 5 })
    expect(s.routines[0].ex[1].id).toBe('curl')
  })

  it('holds while the lift still moves, and comes back round to the first variation after the third', () => {
    const moving = S([wk('2026-09-01', 'a', [[80, 5]]), wk('2026-09-08', 'a', [[82.5, 5]])], { cycling })
    expect(reviewCycling(moving).switches).toEqual([])
    const last = { on: true, patterns: { hpress: { vars: [{ id: 'a', status: 'done' }, { id: 'b', status: 'done' }, { id: 'c', status: 'active' }] } } }
    const s = S([wk('2026-09-01', 'c', [[90, 5]]), wk('2026-09-08', 'c', [[90, 5]]), wk('2026-09-15', 'c', [[90, 5]]), wk('2026-09-22', 'c', [[90, 5]])], { cycling: last })
    const { cycling: c, switches } = reviewCycling(s)
    expect(switches[0]).toMatchObject({ from: 'c', to: 'a' })
    expect(c.patterns.hpress.vars.map(v => v.status)).toEqual(['active', 'pending', 'pending'])
  })

  it('counts a stall only from the day the variation took over, so a round trip does not rotate every workout', () => {
    // b stalled in an earlier turn (and in history before the plan); it has just come back round
    const back = { on: true, patterns: { hpress: { vars: [{ id: 'a', status: 'done' }, { id: 'b', status: 'active', since: '2026-10-05' }, { id: 'c', status: 'pending' }] } } }
    const s = S([
      wk('2026-09-01', 'b', [[60, 8]]), wk('2026-09-08', 'b', [[60, 8]]), wk('2026-09-15', 'b', [[60, 8]]), wk('2026-09-22', 'b', [[60, 8]]),
      wk('2026-10-06', 'b', [[50, 8]]),
    ], { cycling: back })
    expect(stallWeeks(s, 'b')).toBe(4)
    expect(stallWeeks(s, 'b', '2026-10-05')).toBe(0)
    const r = reviewCycling(s, '2026-10-06')
    expect(r.switches).toEqual([])
    expect(r.cycling.patterns.hpress.vars[1]).toMatchObject({ status: 'active', weeksStalled: 0, since: '2026-10-05' })
    // the same workouts reviewed again (the next finished session) still switch nothing
    expect(reviewCycling({ ...s, cycling: r.cycling }, '2026-10-07').switches).toEqual([])
  })

  it('carries no load into a bodyweight variation', () => {
    const bw = allExercises({}).find(e => isBodyweightEq(e) && patternOf(e) === 'hpress')
    expect(bw).toBeTruthy()
    const c = { on: true, patterns: { hpress: { vars: [{ id: 'a', status: 'active' }, { id: bw.id, status: 'pending' }] } } }
    const s = stalled(); s.cycling = c
    const { switches } = reviewCycling(s)
    expect(switches[0]).toMatchObject({ from: 'a', to: bw.id, carryW: 0 })
    applySwitch(s, switches[0])
    expect(s.routines[0].ex[0]).toMatchObject({ id: bw.id, weight: 0 })
  })

  it('cleans a stored state and seeds one from the plan', () => {
    expect(cleanCycling(undefined)).toMatchObject({ on: false })
    const c = cleanCycling({ on: true, patterns: { squat: { vars: [{ id: 'x', status: 'nonsense', weeksStalled: -1 }, { id: 'y' }] } } })
    expect(c.patterns.squat.vars).toEqual([{ id: 'x', status: 'active', peakW: null, peakR: null, weeksStalled: 0, since: null }, { id: 'y', status: 'pending', peakW: null, peakR: null, weeksStalled: 0, since: null }])
    // the real library: the plan's bench leads the horizontal press, two alternates follow
    const s = S([], { routines: [{ id: 'r', name: 'Push', ex: [{ id: '0025', sets: 4, reps: 5, weight: 0 }] }], equipProfiles: [], equipFilterOn: false })
    const ids = suggestVariations(s, 'hpress')
    expect(ids[0]).toBe('0025'); expect(ids).toHaveLength(3); expect(new Set(ids).size).toBe(3)
    const seeded = seedCycling(s, true, '2026-10-20')
    expect(seeded.on).toBe(true)
    for (const p of PATTERNS) expect(seeded.patterns[p].vars.length).toBe(3)
    expect(seeded.patterns.hpress.vars[0]).toMatchObject({ id: '0025', status: 'active', since: '2026-10-20' })
    expect(seeded.patterns.hpress.vars[1].since).toBeNull()
  })
})
