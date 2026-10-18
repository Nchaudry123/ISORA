import { describe, it, expect } from 'vitest'
import { pickPlan, normalizeProfile, parseWeight, parseHeight, SCRIPT, GEAR, scriptedFocus } from './onboarding.js'

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
    expect(p).toEqual({ name: 'Sam', goal: 'fitness', weightKg: null, heightCm: 182, experience: 'beginner', daysPerWeek: 3, equipment: ['dumbbell'], focus: 'x', focusAreas: ['a', 'b', 'c', 'd'] })
    expect(normalizeProfile(null).goal).toBe('fitness')
  })

  it('reads weights in any unit', () => {
    expect(parseWeight('80')).toBe(80)
    expect(parseWeight('176 lb')).toBe(79.8)
    expect(parseWeight('176', 'lb')).toBe(79.8)
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
