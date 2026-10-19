import { describe, it, expect } from 'vitest'
import { initialState, step, jump, poke, nudge, BEHAVIORS } from './iso-motion.js'

// a seeded random source, so a run is the same every time
const seeded = (n = 1) => () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646 }
const run = (st, secs, o = {}, rng = seeded()) => { let p; for (let i = 0; i < secs * 60; i++) p = step(st, { dt: 1 / 60, ...o }, rng); return p }

describe('Iso in motion', () => {
  it('stays on its feet and in shape whatever it gets up to', () => {
    for (const mood of Object.keys(BEHAVIORS)) {
      const st = initialState(seeded(7))
      const rng = seeded(3)
      for (let i = 0; i < 60 * 30; i++) {
        const p = step(st, { dt: 1 / 60, mood }, rng)
        expect(p.jy).toBeLessThanOrEqual(0)
        expect(p.jy).toBeGreaterThan(-60)
        expect(p.sy).toBeGreaterThanOrEqual(0.7); expect(p.sy).toBeLessThanOrEqual(1.3)
        expect(Math.abs(p.lx)).toBeLessThan(1.6)
        expect(Number.isFinite(p.rot) && Number.isFinite(p.al) && Number.isFinite(p.ar)).toBe(true)
      }
    }
  })

  it('jumps, falls back and squashes on landing', () => {
    const st = initialState(seeded())
    jump(st, 12)
    let top = 0, landed = false, squash = 1
    for (let i = 0; i < 120; i++) {
      const p = step(st, { dt: 1 / 60, small: true }, seeded())
      top = Math.min(top, p.jy)
      if (top < -5 && p.jy === 0) { landed = true; squash = Math.min(squash, p.sy) }
    }
    expect(top).toBeLessThan(-8)
    expect(landed).toBe(true)
    expect(squash).toBeLessThan(0.97)
  })

  it('a spin comes all the way round', () => {
    const st = initialState(seeded())
    jump(st, 20, true)
    run(st, 2, { small: true })
    expect(Math.abs(((st.spin % 360) + 360) % 360)).toBeLessThan(1e-6)
    expect(st.spinning).toBe(false)
  })

  it('blinks every few seconds, and settles after a poke or a nudge', () => {
    const st = initialState(seeded())
    let shut = 0
    for (let i = 0; i < 60 * 10; i++) if (step(st, { dt: 1 / 60, small: true }, seeded(i + 2)).blink < 0.5) shut++
    expect(shut).toBeGreaterThan(0)
    poke(st, seeded()); nudge(st, 5)
    const p = run(st, 3, { small: true })
    expect(Math.abs(p.sy - 1)).toBeLessThan(0.05)
    expect(p.jy).toBe(0)
  })

  it('looks where the finger is and moves its mouth when talking', () => {
    const st = initialState(seeded())
    const p = run(st, 1.5, { pointer: { dx: 1, dy: 0 }, small: true })
    expect(p.lx).toBeGreaterThan(0.8)
    const mouths = new Set()
    for (let i = 0; i < 30; i++) mouths.add(step(st, { dt: 1 / 60, talking: true, small: true }, seeded()).mouth.toFixed(2))
    expect(mouths.size).toBeGreaterThan(5)
  })
})
