import { describe, it, expect } from 'vitest'
import { pickPlan, normalizeProfile, parseWeight, parseHeight, SCRIPT, GEAR, scriptedFocus, resumeScript, unitHint, planShape, shapeRoutine } from './onboarding.js'

const step = key => SCRIPT.find(s => s.key === key)

describe('first-run setup', () => {
  it('picks a plan from days, goal and level', () => {
    expect(pickPlan({ daysPerWeek: 6, goal: 'muscle' })).toBe('ppl')
    expect(pickPlan({ daysPerWeek: 4, goal: 'strength' })).toBe('upper-lower')
    expect(pickPlan({ daysPerWeek: 3, goal: 'strength', experience: 'beginner' })).toBe('5x5')
    expect(pickPlan({ daysPerWeek: 3, goal: 'strength', experience: 'advanced' })).toBe('full-body')
    expect(pickPlan({ daysPerWeek: 2, goal: 'fitness' })).toBe('full-body')
    expect(pickPlan()).toBe('full-body')
  })

  it('makes a model answer safe', () => {
    const p = normalizeProfile({ name: ' Sam ', goal: 'fly', weightKg: 900, heightCm: 182.04, experience: 'pro', daysPerWeek: 12, equipment: ['dumbbell', 'laser', 'dumbbell'], focus: 'x', focusAreas: ['a', '', 7, 'b', 'c', 'd', 'e'] })
    expect(p).toEqual({ name: 'Sam', goal: 'fitness', weightKg: null, heightCm: 182, experience: 'beginner', daysPerWeek: 3, equipment: ['dumbbell'], focus: 'x', focusAreas: ['a', 'b', 'c', 'd'], unit: null })
    expect(normalizeProfile(null).goal).toBe('fitness')
  })

  it('reads weights in any unit', () => {
    expect(parseWeight('80')).toBe(80)
    expect(parseWeight('176 lb')).toBe(79.83)
    expect(parseWeight('176', 'lb')).toBe(79.83)
    expect(parseWeight('80,5 kg')).toBe(80.5)
    expect(parseWeight('heavy')).toBeNull()
    expect(parseWeight('5')).toBeNull()
  })

  it('reads heights in any unit', () => {
    expect(parseHeight('180')).toBe(180)
    expect(parseHeight('1.80 m')).toBe(180)
    expect(parseHeight("5'11")).toBe(180)
    expect(parseHeight('5 ft 11')).toBe(180)
    expect(parseHeight('71 in')).toBe(180)
    expect(parseHeight('tall')).toBeNull()
  })

  it('understands the scripted answers, tapped or typed', () => {
    expect(step('name').read('namir pad')).toBe('namir')
    expect(step('goal').read('Build muscle')).toBe('muscle')
    expect(step('goal').read('I want to get stronger')).toBe('strength')
    expect(step('goal').read('banana')).toBeUndefined()
    expect(step('weightKg').read('Skip')).toBeNull()
    expect(step('experience').read('A year or two')).toBe('intermediate')
    expect(step('daysPerWeek').read('4')).toBe(4)
    expect(step('daysPerWeek').read('9')).toBeUndefined()
    expect(step('equipment').read('Full gym')).toEqual(GEAR.gym)
    expect(step('equipment').read('some dumbbells and a pull up bar')).toEqual(['dumbbell', 'pull-up bar'])
    expect(step('equipment').read('nothing at all')).toEqual([])
  })

  it('writes a focus that names the plan it chose', () => {
    const f = scriptedFocus(normalizeProfile({ name: 'Sam', goal: 'strength', daysPerWeek: 3, experience: 'beginner', equipment: ['barbell'] }))
    expect(f.focus).toMatch(/^Sam, with 3 days a week/)
    expect(f.focus).toMatch(/5×5/)
    expect(f.focusAreas).toContain('compound lifts')
  })
})

describe('picking the scripted chat up mid-way', () => {
  it('skips what the AI chat already learned and declined, and finishes at once with everything known', () => {
    expect(resumeScript()).toEqual({ i: 0, answers: {} })
    const r = resumeScript({ name: 'Namir', goal: 'muscle', weightKg: 80, heightCm: null }, ['heightCm'])
    expect(r.answers).toEqual({ name: 'Namir', goal: 'muscle', weightKg: 80, heightCm: null })
    expect(SCRIPT[r.i].key).toBe('experience')
    const all = resumeScript({ name: 'N', goal: 'strength', weightKg: 80, heightCm: 180, experience: 'advanced', daysPerWeek: 4, equipment: ['barbell', 'nonsense'] })
    expect(all.i).toBe(SCRIPT.length)
    expect(all.answers.equipment).toEqual(['barbell'])
    // junk from another client is ignored, not trusted
    expect(resumeScript({ name: 7, goal: 'x', daysPerWeek: 9 }).answers).toEqual({})
  })
})

describe('the unit someone writes in', () => {
  it('reads pounds, feet and inches as lb, kilos and centimetres as kg, and a bare number as nothing', () => {
    expect(unitHint('176 lb')).toBe('lb'); expect(unitHint('176lbs')).toBe('lb'); expect(unitHint('about 180 pounds')).toBe('lb')
    expect(unitHint("5'11")).toBe('lb'); expect(unitHint('5 ft 11')).toBe('lb'); expect(unitHint('71 inches')).toBe('lb')
    expect(unitHint('80 kg')).toBe('kg'); expect(unitHint('80kgs')).toBe('kg'); expect(unitHint('1.80 m')).toBe('kg'); expect(unitHint('180cm')).toBe('kg')
    expect(unitHint('80')).toBeNull(); expect(unitHint('skip')).toBeNull(); expect(unitHint('')).toBeNull()
    expect(normalizeProfile({ unit: 'lb' }).unit).toBe('lb'); expect(normalizeProfile({ unit: 'stone' }).unit).toBeNull()
  })
})

describe('the goal shapes the plan', () => {
  const routine = () => ({ id: 'r', name: 'Upper A', ex: [{ id: '0025', sets: 3, reps: 8, weight: 0 }, { id: '0334', sets: 2, reps: 12, weight: 0 }, { id: '0605', sets: 3, reps: 15, weight: 0 }] })
  it('picks the rule and the rep range from goal and level', () => {
    expect(planShape({ goal: 'strength', experience: 'beginner' })).toMatchObject({ prog: 'linear', reps: 5 })
    expect(planShape({ goal: 'strength', experience: 'advanced' })).toMatchObject({ prog: 'double', repsMin: 4, reps: 6 })
    expect(planShape({ goal: 'muscle', experience: 'beginner' })).toMatchObject({ prog: 'linear', reps: 10 })
    expect(planShape({ goal: 'muscle', experience: 'intermediate' })).toMatchObject({ prog: 'double', repsMin: 8, reps: 12 })
    expect(planShape({ goal: 'active', experience: 'advanced' })).toMatchObject({ prog: 'double', repsMin: 12, reps: 15, rest: 75 })
    expect(planShape({})).toMatchObject({ prog: 'linear', reps: 12 })
  })
  it('strength: the big lifts go to 4 sets of 5, accessories keep their reps', () => {
    const r = shapeRoutine(routine(), planShape({ goal: 'strength', experience: 'intermediate' }))
    expect(r.prog).toBe('linear'); expect(r.ex[0].restSec).toBe(180)
    expect(r.ex[0]).toMatchObject({ sets: 4, reps: 5 })
    expect(r.ex[1]).toMatchObject({ sets: 2, reps: 12 })
  })
  it('muscle: everything but the high-rep finishers works 8 to 12 under double progression', () => {
    const r = shapeRoutine(routine(), planShape({ goal: 'muscle', experience: 'intermediate' }))
    expect(r.prog).toBe('double')
    expect(r.ex[0]).toMatchObject({ sets: 3, repsMin: 8, reps: 12 })
    expect(r.ex[1]).toMatchObject({ repsMin: 8, reps: 12 })
    expect(r.ex[2]).toMatchObject({ reps: 15 }); expect(r.ex[2].repsMin).toBeUndefined()
  })
  it('fitness: higher reps everywhere, and a timed hold is left alone', () => {
    const base = routine(); base.ex.push({ id: 'plank', sets: 3, sec: 30, weight: 0 })
    const r = shapeRoutine(base, planShape({ goal: 'fitness', experience: 'beginner' }))
    expect(r.ex.map(e => e.reps)).toEqual([12, 12, 15, undefined])
    expect(shapeRoutine(null, {})).toBeNull()
  })
})
