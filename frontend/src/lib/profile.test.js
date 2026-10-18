import { describe, it, expect } from 'vitest'
import { cleanProfile, emptyProfile, initialOf, greetingFor, personalRecords } from './profile.js'

describe('the profile', () => {
  it('keeps what is valid and drops the rest', () => {
    expect(cleanProfile({ name: '  Namir  ', avatar: '🔥', goal: 'strength', weekTarget: 4 })).toEqual({ name: 'Namir', avatar: '🔥', goal: 'strength', weekTarget: 4 })
    expect(cleanProfile({ name: 42, avatar: '<img>', goal: 'fly', weekTarget: 9 })).toEqual(emptyProfile())
    expect(cleanProfile(null)).toEqual(emptyProfile())
    expect(cleanProfile({ name: 'x'.repeat(80) }).name).toHaveLength(40)
  })

  it('takes the initial of the first name', () => {
    expect(initialOf('namir pad')).toBe('N')
    expect(initialOf('  ')).toBe('')
    expect(initialOf('Émile')).toBe('É')
  })

  it('greets by the hour', () => {
    expect(greetingFor(7)).toBe('Good morning, {0}')
    expect(greetingFor(13)).toBe('Good afternoon, {0}')
    expect(greetingFor(20)).toBe('Good evening, {0}')
    expect(greetingFor(2)).toBe('Up late, {0}')
  })

  it('lists records newest first, one per exercise, from the workouts that set them', () => {
    const workouts = [{ prs: ['bench'] }, { prs: ['squat', 'bench'] }, { prs: [] }, {}]
    const best = { bench: { d: '2026-10-10', set: { w: 100, r: 5 } }, squat: { d: '2026-10-15', set: { w: 140, r: 3 } } }
    const out = personalRecords(workouts, id => best[id] || null)
    expect(out.map(r => r.exId)).toEqual(['squat', 'bench'])
    expect(personalRecords(workouts, id => best[id], 1)).toHaveLength(1)
    expect(personalRecords(undefined, () => null)).toEqual([])
  })
})
