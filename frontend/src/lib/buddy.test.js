import { describe, it, expect } from 'vitest'
import { cleanBuddy, emptyBuddy, totalXP, levelOf, xpForLevel, gearFor, moodOf, daysBetween, fallbackLine, lineKey, LINES } from './buddy.js'

describe('the buddy', () => {
  it('keeps a valid buddy and names an unnamed one after its kind', () => {
    expect(cleanBuddy({ kind: 'block', name: '  Momo ', born: '2026-10-18', level: 3 })).toEqual({ kind: 'block', name: 'Momo', born: '2026-10-18', level: 3, line: null })
    // one buddy now: an earlier choice of another shape keeps its name and level, as Iso's shape
    expect(cleanBuddy({ kind: 'drop', name: 'Remi', level: 4 })).toMatchObject({ kind: 'block', name: 'Remi', level: 4 })
    expect(cleanBuddy({ kind: 'block' }).name).toBe('Iso')
    expect(cleanBuddy({ level: -2 })).toEqual(emptyBuddy())
    expect(cleanBuddy({ kind: 'block', line: { key: 'k', text: 'hi' } }).line).toEqual({ key: 'k', text: 'hi' })
  })

  it('earns XP for workouts, sets (capped) and records', () => {
    const sets = w => w.n
    expect(totalXP([{ n: 10 }], sets)).toBe(40 + 20)
    expect(totalXP([{ n: 100 }], sets)).toBe(40 + 60)
    expect(totalXP([{ n: 0, prs: ['a', 'b'] }], sets)).toBe(40 + 50)
    expect(totalXP(undefined, sets)).toBe(0)
  })

  it('levels up on a widening ladder', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000])
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: 100, pct: 0 })
    expect(levelOf(150)).toEqual({ level: 2, into: 50, need: 200, pct: 25 })
    expect(levelOf(1000).level).toBe(5)
  })

  it('earns its gear by level', () => {
    expect(gearFor(1)).toEqual({ band: false, phones: false, crown: false })
    expect(gearFor(6)).toEqual({ band: true, phones: true, crown: false })
    expect(gearFor(12).crown).toBe(true)
  })

  it('reads its mood from the day, most pressing first', () => {
    const base = { active: false, doneToday: false, plannedToday: false, hour: 14, daysSinceLast: 1, everTrained: true }
    expect(moodOf({ ...base, active: true, doneToday: true })).toBe('active')
    expect(moodOf({ ...base, doneToday: true, plannedToday: true })).toBe('proud')
    expect(moodOf({ ...base, plannedToday: true, hour: 23 })).toBe('hyped')
    expect(moodOf({ ...base, hour: 1 })).toBe('sleepy')
    expect(moodOf({ ...base, everTrained: false })).toBe('new')
    expect(moodOf({ ...base, daysSinceLast: 5 })).toBe('missing')
    expect(moodOf(base)).toBe('chill')
  })

  it('counts days and keeps the same fallback line all day', () => {
    expect(daysBetween('2026-10-14', '2026-10-18')).toBe(4)
    expect(fallbackLine('chill', '2026-10-18')).toBe(fallbackLine('chill', '2026-10-18'))
    expect(LINES.chill).toContain(fallbackLine('chill', '2026-10-18'))
    expect(LINES.chill).toContain(fallbackLine('nonsense', '2026-10-18'))
    expect(lineKey('proud', '2026-10-18')).toBe('2026-10-18:proud')
  })
})
