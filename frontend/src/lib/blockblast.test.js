import { describe, it, expect } from 'vitest'
import {
  SIZE, SHAPES, JUNK, emptyBoard, canPlace, place, placements, fitsAnywhere, anyMove,
  badness, dealTray, doomBoard, doomTray, emptyStats, cleanStats, recordRound,
} from './blockblast.js'

// A small deterministic PRNG so the dealer's choices are repeatable.
const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
// Whether the shapes can all be put down, in some order and at some spots.
const solvable = (b, shapes) => !shapes.length || shapes.some((s, i) =>
  placements(b, s).some(([r, c]) => solvable(place(b, s, r, c, 1).board, shapes.filter((_, j) => j !== i))))
const shape = id => SHAPES[id]
const line5 = SHAPES.find(s => s.w === 5)

describe('board and placing', () => {
  it('places a piece and refuses overlaps and the edge', () => {
    const b = emptyBoard()
    const sq = SHAPES.find(s => s.w === 2 && s.h === 2)
    const r = place(b, sq, 0, 0, 3)
    expect(r.board[1][1]).toBe(3)
    expect(r.points).toBe(4)
    expect(place(r.board, sq, 1, 1, 3)).toBeNull()
    expect(canPlace(b, sq, SIZE - 1, 0)).toBe(false)
  })

  it('clears a full row and a full column together, with the combo bonus', () => {
    const b = emptyBoard()
    for (let c = 0; c < SIZE; c++) if (c !== 7) b[7][c] = 1
    for (let r = 0; r < SIZE; r++) if (r !== 7) b[r][7] = 1
    const dot = { cells: [[0, 0]], h: 1, w: 1 }
    const res = place(b, dot, 7, 7, 2, 0)
    expect(res.lines).toBe(2)
    expect(res.combo).toBe(1)
    expect(res.board.flat().every(v => v === 0)).toBe(true)
    expect(res.points).toBe(1 + 2 * 2 * 10)
    expect(place(b, dot, 7, 7, 2, 2).points).toBe(1 + 2 * 2 * 10 * 3)
  })
})

describe('badness ramp', () => {
  it('is zero for the first 90 s, then rises to 1 at 0:00', () => {
    expect(badness(180)).toBe(0)
    expect(badness(90)).toBe(0)
    expect(badness(45)).toBeCloseTo(0.5)
    expect(badness(0)).toBe(1)
    expect(badness(-5)).toBe(1)
  })
})

describe('the dealer', () => {
  it('in the good half deals three pieces that all fit together', () => {
    const rng = seeded(7)
    for (let trial = 0; trial < 40; trial++) {
      const b = emptyBoard()
      // some clutter so it is not trivially open
      for (let i = 0; i < 20; i++) b[Math.floor(rng() * SIZE)][Math.floor(rng() * SIZE)] = 1
      expect(solvable(b, dealTray(b, 150, rng).map(p => p.shape))).toBe(true)
    }
  })

  it('in the good half picks a line-clearing piece when one exists', () => {
    const b = emptyBoard()
    for (let c = 0; c < SIZE - 1; c++) b[0][c] = 1   // a row one cell short
    const tray = dealTray(b, 170, seeded(3))
    const clears = tray[0].shape
    const res = placements(b, clears).map(([r, c]) => place(b, clears, r, c, 1).lines)
    expect(Math.max(...res)).toBeGreaterThan(0)
  })

  it('near 0:00 deals worse pieces than in the good half', () => {
    const rng = seeded(11)
    const fitCount = sec => {
      let n = 0
      for (let trial = 0; trial < 60; trial++) {
        const b = emptyBoard()
        for (let i = 0; i < 28; i++) b[Math.floor(rng() * SIZE)][Math.floor(rng() * SIZE)] = 1
        for (const p of dealTray(b, sec, rng)) n += placements(b, p.shape).length
      }
      return n
    }
    expect(fitCount(5)).toBeLessThan(fitCount(150))
  })

  it('at 0:00 deals nothing that fits, even on an empty board', () => {
    for (const start of [emptyBoard(), (() => { const b = emptyBoard(); b[3][3] = 1; return b })()]) {
      const board = doomBoard(start)
      const tray = dealTray(board, 0, seeded(5))
      expect(tray).toHaveLength(3)
      expect(anyMove(board, tray)).toBe(false)
    }
  })

  it('the doom fill leaves a full board alone when something already does not fit', () => {
    const b = emptyBoard()
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 3) b[r][c] = 1
    expect(fitsAnywhere(b, line5)).toBe(false)
    expect(doomBoard(b)).toBe(b)
    expect(anyMove(b, doomTray(b, seeded(1)))).toBe(false)
    expect(doomBoard(emptyBoard()).flat().filter(v => v === JUNK)).toHaveLength(32)
    expect(shape(0).cells).toHaveLength(2)
  })
})

describe('the Rest Blast record', () => {
  it('counts rounds that scored, keeps the best, adds up lines', () => {
    let s = emptyStats()
    s = recordRound(s, { score: 120, lines: 4 })
    s = recordRound(s, { score: 80, lines: 2 })
    s = recordRound(s, { score: 0, lines: 0 })   // nothing placed: not a round
    expect(s).toEqual({ best: 120, games: 2, lines: 6 })
  })

  it('starts from zero on a missing or malformed record', () => {
    expect(cleanStats(undefined)).toEqual(emptyStats())
    expect(cleanStats({ best: 'x', games: -3, lines: 2.7 })).toEqual({ best: 0, games: 0, lines: 2 })
    expect(recordRound(null, { score: 10, lines: 1 })).toEqual({ best: 10, games: 1, lines: 1 })
  })
})
