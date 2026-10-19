import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import {
  SIZE, JUNK, emptyBoard, place, linesAfter, anyMove, dealTray, dealOne, doomBoard, doomTray,
  bestSpot, bestMove, snapSpot, cleanStats, recordRound,
} from '../lib/blockblast.js'
import { Button } from './ui.jsx'
import Buddy from './Buddy.jsx'
import { confettiFrom } from './confetti.js'
import { cleanBuddy } from '../lib/buddy.js'

// Rest Blast: the block puzzle that fills a rest between sets. It opens with every rest (not
// the short switch-sides pause) while Settings → Rest Blast is on, plays over the page with the
// rest bar still on top of it, and closes with the rest. What it deals follows the rest clock
// (lib/blockblast.js): good pieces for the first half, worse ones after, and nothing that fits
// at 0:00 — the game is over exactly when the next set is due.
//
// Touch: a lifted piece rides just above the fingertip, at board size, and drops onto the valid
// cell nearest to where it is (snapSpot), so a thumb a little off still lands it. While it is
// lifted its best spot pulses on the board; left alone for a moment, the game points at the
// best move itself (bestMove). The drag moves the ghost on the DOM directly, and the board only
// re-renders when the cell under the piece changes.

// The best score lived in this browser's storage before the record moved into the profile
// (S.restBlast); read once so nobody's best goes back to zero.
const OLD_BEST_KEY = 'og_restblast_best'
const oldBest = () => { try { return Number(localStorage.getItem(OLD_BEST_KEY)) || 0 } catch { return 0 } }
const LIFT = 0.55      // a lifted piece's bottom edge sits this many cells above the fingertip
const IDLE_HINT_MS = 2600
// A tap of the phone for a piece put down, a longer one for a clear, a flourish for a perfect
// clear; only where the phone vibrates and the Vibrate setting is on.
const buzz = pattern => { try { if (useStore.getState().S.vibrate !== false && navigator.vibrate) navigator.vibrate(pattern) } catch {} }
const sameSpot = (a, b) => (!a && !b) || (a && b && a.r === b.r && a.c === b.c)

function Cells({ shape, color, cell, className = '' }) {
  return (
    <div className={'rb-piece ' + className} style={{ width: shape.w * cell, height: shape.h * cell }}>
      {shape.cells.map(([r, c], i) => (
        <i key={i} className={'rb-c rb-k' + color} style={{ width: cell, height: cell, top: r * cell, left: c * cell, '--i': i }} />
      ))}
    </div>
  )
}

/** A number that counts up to its value, for the score. */
function useCountUp(value) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current, delta = value - start
    if (!delta) return
    const t0 = performance.now(), dur = Math.min(700, 250 + Math.abs(delta) * 2)
    let raf
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3
      setShown(Math.round(start + delta * e))
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value])
  return shown
}

function Game({ secondsLeft, total, hidden, onNextSet, onHide, onScore }) {
  const [board, setBoard] = useState(emptyBoard)
  const [tray, setTray] = useState(() => dealTray(emptyBoard(), secondsLeft))
  const [score, setScore] = useState(0)
  const saved = useStore(s => s.S.restBlast)
  const bud = cleanBuddy(useStore(s => s.S.buddy))
  const update = useStore(s => s.update)
  const best = Math.max(cleanStats(saved).best, oldBest())
  const [combo, setCombo] = useState(0)
  const [over, setOver] = useState(null)        // null | 'stuck' | 'time'
  const [lifted, setLifted] = useState(null)    // the tray index in hand
  const [target, setTarget] = useState(null)    // { r, c } the lifted piece would land on
  const [hint, setHint] = useState(null)        // { idx, r, c }: the best move, shown while idle
  const [pop, setPop] = useState(null)          // { text, id }: the floating score of the last clear
  const [flash, setFlash] = useState(null)      // { rows, cols, id }: lines just cleared
  const [landed, setLanded] = useState(null)    // { cells, id }: the piece just placed, which lands with a bounce
  const [cheer, setCheer] = useState(0)         // a clear: Iso hops
  const [shake, setShake] = useState(0)         // stuck: the board shakes once
  const boardRef = useRef(null)
  const ghostRef = useRef(null)
  const drag = useRef(null)                     // { idx, x, y, cell, rect, pad, pointerId } while a piece is in hand
  const secsRef = useRef(secondsLeft)
  secsRef.current = secondsLeft
  const shownScore = useCountUp(score)

  // 0:00: whatever is left in the tray is swapped for pieces that fit nowhere.
  useEffect(() => {
    if (secondsLeft > 0 || over === 'time') return
    const doomed = doomBoard(board)
    setBoard(doomed)
    setTray(doomTray(doomed))
    setOver('time')
    drag.current = null; setLifted(null); setTarget(null); setHint(null)
  }, [secondsLeft > 0])

  // This round, for the record: counted once, when it ends (no moves, 0:00) or when the rest
  // closes under it (Skip), whichever comes first.
  const round = useRef({ score: 0, lines: 0, done: false })
  const record = () => {
    const r = round.current
    if (r.done) return
    r.done = true
    if (r.score > 0) update(s => { s.restBlast = recordRound(s.restBlast, r) })
  }
  useEffect(() => { if (over) record() }, [over])
  useEffect(() => record, [])
  useEffect(() => { onScore?.(score) }, [score])

  // Left alone for a moment: the best move lights up, until the next touch. Not in the last
  // half minute, when the squeeze is the point.
  const squeeze = secondsLeft <= 30
  useEffect(() => {
    if (over || lifted != null || hidden || squeeze) { setHint(null); return }
    const id = setTimeout(() => setHint(bestMove(board, tray)), IDLE_HINT_MS)
    return () => clearTimeout(id)
  }, [board, tray, over, lifted, hidden, squeeze])

  const cellSize = () => {
    const el = boardRef.current
    if (!el) return 36
    return (el.clientWidth - 2 * (parseFloat(getComputedStyle(el).paddingLeft) || 0)) / SIZE
  }

  // the ghost's top-left, from the finger: centred under it, its bottom edge LIFT cells above
  const ghostAt = (d, p) => ({ left: d.x - (p.shape.w * d.cell) / 2, top: d.y - (p.shape.h + LIFT) * d.cell })
  const moveGhost = d => {
    const p = tray[d.idx]
    const g = ghostRef.current
    if (!p || !g) return
    const { left, top } = ghostAt(d, p)
    g.style.transform = `translate3d(${left}px, ${top}px, 0)`
    // the board cell under the piece, in fractions, snapped to the nearest valid spot
    const fr = (top - d.rect.top - d.pad) / d.cell, fc = (left - d.rect.left - d.pad) / d.cell
    const spot = fr > -1.5 && fc > -1.5 && fr < SIZE + 0.5 && fc < SIZE + 0.5 ? snapSpot(board, p.shape, fr, fc) : null
    setTarget(prev => (sameSpot(prev, spot) ? prev : spot))
  }

  const lift = (idx, e) => {
    const p = tray[idx]
    if (!p || over || !boardRef.current) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    const el = boardRef.current
    const rect = el.getBoundingClientRect()
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0
    const cell = (rect.width - 2 * pad) / SIZE
    drag.current = { idx, x: e.clientX, y: e.clientY, cell, rect, pad, pointerId: e.pointerId }
    setHint(null)
    setLifted(idx)
    buzz(6)
  }
  const move = e => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    d.x = e.clientX; d.y = e.clientY
    moveGhost(d)
  }
  const drop = e => {
    const d = drag.current
    if (!d || (e && e.pointerId !== d.pointerId)) return
    drag.current = null
    const p = tray[d.idx]
    const spot = target
    setLifted(null); setTarget(null)
    if (!spot || !p) return
    const res = place(board, p.shape, spot.r, spot.c, p.color, combo)
    // Every turn the slot just played is dealt again from a fresh scan of the board, with the two
    // pieces still in hand (lib/blockblast.js dealOne): the most obvious piece early in the rest.
    const held = tray.map((x, i) => (i === d.idx ? null : x))
    const next = held.map((x, i) => (i === d.idx ? dealOne(res.board, held, secsRef.current) : x))
    buzz(res.perfect ? [30, 40, 60] : res.lines ? [14, 30, 14] : 8)
    setLanded({ id: Date.now(), cells: new Set(p.shape.cells.map(([dr, dc]) => (spot.r + dr) * SIZE + spot.c + dc)) })
    setBoard(res.board)
    setTray(next)
    setScore(s => s + res.points)
    round.current.score += res.points
    round.current.lines += res.lines
    setCombo(res.combo)
    if (res.lines) {
      const id = Date.now()
      setCheer(id)
      if (res.perfect) confettiFrom(boardRef.current, { count: 140 })
      else if (res.lines > 1 || res.combo > 2) confettiFrom(boardRef.current, { count: 40 + 20 * res.lines, spread: 50, power: .8 })
      setFlash({ rows: res.rows, cols: res.cols, id })
      setPop({ text: (res.perfect ? t('Perfect clear!') + ' ' : '') + '+' + res.points + (res.combo > 1 ? ' · ' + t('Combo') + ' ×' + res.combo : ''), id, perfect: res.perfect })
      setTimeout(() => setFlash(f => (f?.id === id ? null : f)), 420)
      setTimeout(() => setPop(x => (x?.id === id ? null : x)), 900)
    }
    if (!anyMove(res.board, next)) { setOver(secsRef.current > 0 ? 'stuck' : 'time'); if (secsRef.current > 0) setShake(Date.now()) }
  }
  // the ghost appears where the finger already is
  useEffect(() => { if (lifted != null && drag.current) moveGhost(drag.current) }, [lifted])

  const restart = () => {
    const b = emptyBoard()
    round.current = { score: 0, lines: 0, done: false }
    setBoard(b); setTray(dealTray(b, secsRef.current)); setScore(0); setCombo(0); setOver(null); setHint(null)
  }

  // what the board shows over its cells: the landing preview, the lines it would clear, the hint
  const inHand = lifted != null ? tray[lifted] : null
  const preview = new Set(), clearing = new Set(), hinted = new Set()
  if (inHand && target) {
    for (const [dr, dc] of inHand.shape.cells) preview.add((target.r + dr) * SIZE + target.c + dc)
    const { rows, cols } = linesAfter(board, inHand.shape, target.r, target.c)
    for (const r of rows) for (let c = 0; c < SIZE; c++) clearing.add(r * SIZE + c)
    for (const c of cols) for (let r = 0; r < SIZE; r++) clearing.add(r * SIZE + c)
  }
  const hintFor = inHand && !squeeze ? (() => { const s = bestSpot(board, inHand.shape); return s && { piece: inHand, r: s.r, c: s.c } })()
    : hint && tray[hint.idx] ? { piece: tray[hint.idx], r: hint.r, c: hint.c } : null
  if (hintFor && !(target && sameSpot(target, hintFor))) for (const [dr, dc] of hintFor.piece.shape.cells) hinted.add((hintFor.r + dr) * SIZE + hintFor.c + dc)
  const flashed = new Set()
  if (flash) {
    for (const r of flash.rows) for (let c = 0; c < SIZE; c++) flashed.add(r * SIZE + c)
    for (const c of flash.cols) for (let r = 0; r < SIZE; r++) flashed.add(r * SIZE + c)
  }
  const cell = cellSize()
  const ph = secondsLeft > total / 2 ? 'good' : squeeze ? 'end' : 'mid'

  return (
    <div id="rest-game" className={over ? 'is-over over-' + over : ''} role="dialog" aria-label={t('Rest Blast')} hidden={hidden}>
      <div className="rb-head">
        <div className="rb-scorebox">
          <div className="rb-score">{shownScore}</div>
          <div className="rb-best">{t('Best')} {Math.max(best, score)}</div>
        </div>
        {/* your buddy watches the round with you (components/Buddy.jsx) */}
        <div className="rb-title">{bud.kind && <Buddy mood={over ? (over === 'time' ? 'proud' : 'missing') : 'active'} level={bud.level} size={38} bump={cheer} />}<span>{t('Rest Blast')}</span></div>
        <div className="rb-head-end">
          {combo > 1 && !over && <span key={combo} className="rb-combo">{t('Combo')} ×{combo}</span>}
          <Button size="sm" variant="ghost" onClick={onHide}>{t('Hide')}</Button>
        </div>
      </div>

      {/* how far the rest has run, and what the dealer hands out now (lib/blockblast.js dealOne) */}
      {total > 0 && <div className={'rb-phase p-' + ph}>
        <div className="rb-phase-bar"><i style={{ width: Math.max(0, Math.min(100, secondsLeft / total * 100)) + '%' }} /></div>
        <div className="rb-phase-lbl"><b>{over === 'time' ? t('Time’s up') : ph === 'good' ? t('Easy pieces') : ph === 'mid' ? t('Getting harder') : t('Last chance')}</b><span>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span></div>
      </div>}

      <div key={'b' + shake} className={'rb-board' + (shake ? ' shake' : '')} ref={boardRef}>
        {board.flatMap((row, r) => row.map((v, c) => {
          const k = r * SIZE + c
          let cls = v === JUNK ? ' rb-junk'
            : v ? ' rb-k' + v + (clearing.has(k) ? ' rb-glow' : '')
              : preview.has(k) ? ' rb-prev rb-k' + inHand.color
                : flashed.has(k) ? ' rb-flash' : ''
          if (!v && !preview.has(k) && hinted.has(k)) cls += ' rb-hint rb-k' + hintFor.piece.color
          const land = v && v !== JUNK && landed?.cells.has(k) ? ' rb-land' : ''
          return <i key={k + (land ? '-' + landed.id : '')} className={'rb-cell' + cls + land} style={over === 'time' ? { '--d': ((r + c) * 35) + 'ms' } : undefined} />
        }))}
        {pop && <div key={pop.id} className={'rb-pop' + (pop.perfect ? ' perfect' : '')}>{pop.text}</div>}
        {over && (
          <div className="rb-over">
            <div className="rb-over-t">{over === 'time' ? t('Time’s up. Next set!') : t('No moves left')}</div>
            <div className="rb-over-s">{t('Score')} {score}{score >= best && score > 0 ? ' · ' + t('New best!') : ''}</div>
            {over === 'time'
              ? <Button variant="primary" onClick={onNextSet}>{t('Back to lifting')}</Button>
              : <Button variant="primary" onClick={restart}>{t('Play again')}</Button>}
          </div>
        )}
      </div>

      <div className="rb-tray">
        {tray.map((p, i) => (
          <div key={p ? p.key : 'x' + i} className={'rb-slot' + (hint && hint.idx === i && lifted == null ? ' rb-slot-hint' : '')}
            onPointerDown={p && !over ? e => lift(i, e) : undefined} onPointerMove={move} onPointerUp={drop} onPointerCancel={drop}>
            {p && <Cells shape={p.shape} color={p.color} cell={Math.min(22, cell * 0.55)}
              className={(lifted === i ? 'rb-lifted' : '') + (!over && !anyMove(board, [p]) ? ' rb-dead' : '')} />}
          </div>
        ))}
      </div>

      {inHand && (
        <div className="rb-ghost" ref={ghostRef}>
          <Cells shape={inHand.shape} color={inHand.color} cell={cell} className={target ? 'rb-can' : ''} />
        </div>
      )}
    </div>
  )
}

// The way back in while the game is tucked away: a handle on the rest bar's top edge, with Iso
// and this round's score. It measures the bar, which stands higher when the tab bar is under it.
function Handle({ score, onOpen }) {
  const bud = cleanBuddy(useStore(s => s.S.buddy))
  const [dock, setDock] = useState(null)
  useEffect(() => {
    const bar = document.getElementById('timer')
    if (!bar) return
    const measure = () => setDock(Math.round(window.innerHeight - bar.getBoundingClientRect().top - 16))
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(bar)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  return <button type="button" className="rb-reopen" onClick={onOpen} style={dock != null ? { bottom: dock } : undefined}>
    {bud.kind ? <Buddy mood="active" size={30} /> : null}{t('Rest Blast')}{score > 0 && <b>{score}</b>}
  </button>
}

export default function RestGame() {
  const timer = useUI(s => s.timer)
  const stopRest = useUI(s => s.stopRest)
  const enabled = useStore(s => s.S.restGame !== false)
  const active = !!timer && timer.kind !== 'switch' && enabled
  const [round, setRound] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [score, setScore] = useState(0)   // the round's score, for the handle while it is hidden
  // A new rest is a new game, shown again even if the last one was hidden.
  useEffect(() => { if (active) { setRound(n => n + 1); setHidden(false) } }, [active])
  useEffect(() => {
    document.body.classList.toggle('rest-game', active && !hidden)
    return () => document.body.classList.remove('rest-game')
  }, [active, hidden])
  if (!active) return null
  // Hidden keeps the round going underneath (the board and score stay), just out of the way.
  const secondsLeft = timer.ready ? 0 : timer.left
  return <>
    <Game key={round} secondsLeft={secondsLeft} total={timer.total} hidden={hidden} onNextSet={stopRest} onHide={() => setHidden(true)} onScore={setScore} />
    {hidden && <Handle score={score} onOpen={() => setHidden(false)} />}
  </>
}
