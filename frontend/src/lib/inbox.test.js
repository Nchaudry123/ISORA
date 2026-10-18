import { describe, it, expect } from 'vitest'
import { previewOf, comingUp, recentDone, dayDistance, setsLeft } from './inbox.js'

const names = { a: 'Bench press', b: 'Overhead press', c: 'Dips', d: 'Lateral raise' }
const nameOf = id => names[id]

describe('inbox rows', () => {
  it('previews the first exercises and counts the rest', () => {
    expect(previewOf({ ex: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] }, nameOf)).toEqual({ text: 'Bench press, Overhead press, Dips', more: 1 })
    expect(previewOf({ ex: [{ id: 'a' }] }, nameOf)).toEqual({ text: 'Bench press', more: 0 })
    expect(previewOf(null, nameOf)).toEqual({ text: '', more: 0 })
  })

  it('lists the next planned days after today, nearest first, skipping empty ones', () => {
    const plan = { '2026-10-20': ['push'], '2026-10-22': ['pull'], '2026-10-24': ['legs'], '2026-10-26': ['push'], '2026-10-28': ['pull'] }
    const on = iso => plan[iso] || []
    const out = comingUp('2026-10-19', on, { count: 3 })
    expect(out.map(x => x.iso)).toEqual(['2026-10-20', '2026-10-22', '2026-10-24'])
    expect(comingUp('2026-10-19', () => [])).toEqual([])
    // today itself is never "coming up"
    expect(comingUp('2026-10-20', on, { count: 1 })[0].iso).toBe('2026-10-22')
  })

  it('takes the latest workouts, newest first, the later one first on the same day', () => {
    const w = [{ id: 1, d: '2026-10-10' }, { id: 2, d: '2026-10-15', start: 1 }, { id: 3, d: '2026-10-15', start: 5 }, { id: 4, d: '2026-10-12' }]
    expect(recentDone(w, 3).map(x => x.id)).toEqual([3, 2, 4])
    expect(recentDone(undefined)).toEqual([])
  })

  it('names the distance of a date from today', () => {
    expect(dayDistance('2026-10-18', '2026-10-18')).toBe('today')
    expect(dayDistance('2026-10-19', '2026-10-18')).toBe('tomorrow')
    expect(dayDistance('2026-10-17', '2026-10-18')).toBe('yesterday')
    expect(dayDistance('2026-10-22', '2026-10-18')).toBe('week')
    expect(dayDistance('2026-10-01', '2026-10-18')).toBe('date')
  })

  it('counts the open sets of a running session', () => {
    expect(setsLeft({ entries: [{ sets: [{ done: true }, {}, {}] }, { sets: [{}] }] })).toBe(3)
    expect(setsLeft(null)).toBe(0)
  })
})
