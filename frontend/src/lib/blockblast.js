// Rest Blast: the block puzzle that fills the rest between sets. Pure and framework-free, like
// the rest of lib/, so the part that decides what you are dealt is testable without a screen.
//
// The game is rigged by the rest clock, on purpose: it exists to make the rest fun and then end
// it. For the first half (GOOD_UNTIL seconds of rest left or more) every tray is picked to fit
// and to clear lines. From there to 0:00 the dealer drifts towards the pieces that fit worst,
// and at 0:00 it deals only pieces that fit nowhere, so the round ends exactly when the set
// should start.

export const SIZE = 8
export const REST_GAME_SEC = 180
export const GOOD_UNTIL = 90   // seconds left: above this, only helpful pieces
export const COLORS = 7        // colour indices 1..COLORS; JUNK marks the doom fill
export const JUNK = 99

// Each shape is a list of [row, col] cells, normalised to start at 0,0.
const RAW = [
  // lines
  [[0, 0], [0, 1]], [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  // squares and rectangles
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  // small corners
  [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]],
  // big corners
  [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]],
  // L tetrominoes
  [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 1], [1, 1], [2, 1], [2, 0]],
  [[0, 0], [0, 1], [1, 0], [2, 0]], [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0]], [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [1, 2]], [[0, 2], [1, 0], [1, 1], [1, 2]],
  // T
  [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 1], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 1], [1, 1], [2, 1], [1, 0]],
  // S / Z
  [[0, 1], [0, 2], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 1], [1, 1], [1, 0], [2, 0]],
]

export const SHAPES = RAW.map((cells, id) => {
  const h = Math.max(...cells.map(c => c[0])) + 1
  const w = Math.max(...cells.map(c => c[1])) + 1
  return { id, cells, h, w }
})

export const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0))

export function canPlace(board, shape, r, c) {
  for (const [dr, dc] of shape.cells) {
    const rr = r + dr, cc = c + dc
    if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE || board[rr][cc]) return false
  }
  return true
}

export function placements(board, shape) {
  const out = []
  for (let r = 0; r <= SIZE - shape.h; r++)
    for (let c = 0; c <= SIZE - shape.w; c++)
      if (canPlace(board, shape, r, c)) out.push([r, c])
  return out
}

export const fitsAnywhere = (board, shape) => placements(board, shape).length > 0
export const anyMove = (board, tray) => tray.some(p => p && fitsAnywhere(board, p.shape))

// Which rows and columns would be full after putting `shape` at r,c (without clearing them).
export function linesAfter(board, shape, r, c) {
  const b = board.map(row => row.slice())
  for (const [dr, dc] of shape.cells) b[r + dr][c + dc] = 1
  const rows = [], cols = []
  for (let i = 0; i < SIZE; i++) {
    if (b[i].every(Boolean)) rows.push(i)
    if (b.every(row => row[i])) cols.push(i)
  }
  return { rows, cols }
}

// Puts a piece down and clears every full row and column at once. Returns the new board and
// what the move scored: one point per cell, plus a line bonus that grows with the lines cleared
// together and with the combo (moves in a row that cleared something).
export function place(board, shape, r, c, color, combo = 0) {
  if (!canPlace(board, shape, r, c)) return null
  const b = board.map(row => row.slice())
  for (const [dr, dc] of shape.cells) b[r + dr][c + dc] = color
  const { rows, cols } = linesAfter(board, shape, r, c)
  for (const i of rows) for (let j = 0; j < SIZE; j++) b[i][j] = 0
  for (const j of cols) for (let i = 0; i < SIZE; i++) b[i][j] = 0
  const lines = rows.length + cols.length
  const nextCombo = lines ? combo + 1 : 0
  const points = shape.cells.length + (lines ? lines * lines * 10 * nextCombo : 0)
  return { board: b, lines, rows, cols, points, combo: nextCombo }
}

// 0 while the rest is in its good half, rising to 1 at 0:00.
export function badness(secondsLeft) {
  if (secondsLeft >= GOOD_UNTIL) return 0
  if (secondsLeft <= 0) return 1
  return (GOOD_UNTIL - secondsLeft) / GOOD_UNTIL
}

// How helpful one shape is on a board: its best spot's line clears, then how snugly it sits
// (filled neighbours), so the good half also builds towards clears rather than scattering.
function bestSpot(board, shape) {
  let best = null
  for (const [r, c] of placements(board, shape)) {
    const { rows, cols } = linesAfter(board, shape, r, c)
    let snug = 0
    for (const [dr, dc] of shape.cells) {
      for (const [nr, nc] of [[r + dr - 1, c + dc], [r + dr + 1, c + dc], [r + dr, c + dc - 1], [r + dr, c + dc + 1]]) {
        if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE || board[nr][nc]) snug++
      }
    }
    const value = (rows.length + cols.length) * 100 + snug + shape.cells.length
    if (!best || value > best.value) best = { r, c, value }
  }
  return best
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length]
let pieceSeq = 0
const piece = (shape, rng) => ({ key: ++pieceSeq, shape, color: 1 + Math.floor(rng() * COLORS) % COLORS })

// A good tray: chosen one by one on a board that already holds the earlier picks at their best
// spots, so the three fit together (in that order at least) and lean towards clearing lines.
function goodTray(board, rng, slack) {
  let sim = board
  const tray = []
  for (let k = 0; k < 3; k++) {
    const scored = SHAPES.map(shape => ({ shape, spot: bestSpot(sim, shape) })).filter(x => x.spot)
    if (!scored.length) { tray.push(piece(pick(SHAPES, rng), rng)); continue }
    scored.sort((a, b) => b.spot.value - a.spot.value)
    // slack widens the pool as the rest goes on: from the top few to most of the fitting shapes
    const top = scored.slice(0, Math.max(3, Math.round(3 + slack * scored.length)))
    const { shape, spot } = pick(top, rng)
    tray.push(piece(shape, rng))
    sim = place(sim, shape, spot.r, spot.c, 1).board
  }
  return tray
}

// The worst fitting shape: fewest places it can go, largest first, never one that clears.
function worstFitting(board, rng) {
  const fit = SHAPES.map(shape => ({ shape, n: placements(board, shape) }))
    .filter(x => x.n.length)
    .map(x => ({ ...x, clears: x.n.some(([r, c]) => { const l = linesAfter(board, x.shape, r, c); return l.rows.length + l.cols.length > 0 }) }))
  if (!fit.length) return null
  const pool = fit.filter(x => !x.clears)
  const list = (pool.length ? pool : fit).sort((a, b) => a.n.length - b.n.length || b.shape.cells.length - a.shape.cells.length)
  return pick(list.slice(0, 3), rng).shape
}

const unfitting = board => SHAPES.filter(shape => !fitsAnywhere(board, shape))

// The doom fill, for a board so open that every shape still fits somewhere at 0:00: junk on
// every other cell (a checkerboard), so no two free cells touch and no shape of two or more
// cells has anywhere to go. Returns the board unchanged when some shape already fails to fit.
export function doomBoard(board) {
  if (unfitting(board).some(s => s.cells.length > 1)) return board
  return board.map((row, r) => row.map((v, c) => v || ((r + c) % 2 === 0 ? JUNK : 0)))
}

// Three pieces that fit nowhere on `board` (call doomBoard first).
export function doomTray(board, rng = Math.random) {
  const pool = unfitting(board).filter(s => s.cells.length > 1)
  const src = pool.length ? pool : SHAPES.filter(s => s.cells.length > 1)
  return [0, 1, 2].map(() => piece(pick(src, rng), rng))
}

// The dealer. `secondsLeft` is the rest time remaining when the tray is dealt.
export function dealTray(board, secondsLeft, rng = Math.random) {
  if (secondsLeft <= 0) return doomTray(board, rng)
  const bad = badness(secondsLeft)
  if (bad === 0) return goodTray(board, rng, 0)
  const tray = goodTray(board, rng, bad)
  for (let k = 0; k < 3; k++) {
    if (rng() >= bad) continue
    // past the halfway mark of the bad half, a bad slot may be a piece that fits nowhere
    const dead = bad > 0.5 && rng() < (bad - 0.5) * 2 ? unfitting(board) : []
    const shape = dead.length ? pick(dead, rng) : worstFitting(board, rng)
    if (shape) tray[k] = piece(shape, rng)
  }
  return tray
}
