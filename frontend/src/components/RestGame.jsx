import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import {
  SIZE, JUNK, emptyBoard, canPlace, place, linesAfter, anyMove, dealTray, dealOne, doomBoard, doomTray,
  cleanStats, recordRound,
} from '../lib/blockblast.js'
import { Button } from './ui.jsx'
import Buddy from './Buddy.jsx'
import { cleanBuddy } from '../lib/buddy.js'

// Rest Blast: the block puzzle that fills a rest between sets. It opens with every rest (not
// the short switch-sides pause) while Settings → Rest Blast is on, plays over the page with the
// rest bar still on top of it, and closes with the rest. What it deals follows the rest clock
// (lib/blockblast.js): good pieces for the first half, worse ones after, and nothing that fits
// at 0:00 — the game is over exactly when the next set is due.

// The best score lived in this browser's storage before the record moved into the profile
// (S.restBlast); read once so nobody's best goes back to zero.
const OLD_BEST_KEY = 'og_restblast_best'
const oldBest = () => { try { return Number(localStorage.getItem(OLD_BEST_KEY)) || 0 } catch { return 0 } }
const LIFT = 1.4   // a dragged piece rides this many of its own cells above the finger
// A tap of the phone for a piece put down, a longer one for a clear, a flourish for a perfect
// clear; only where the phone vibrates and the Vibrate setting is on.
const buzz = pattern => { try { if (useStore.getState().S.vibrate !== false && navigator.vibrate) navigator.vibrate(pattern) } catch {} }

function Cells({ shape, color, cell, className = '' }) {
  return (
    <div className={'rb-piece ' + className} style={{ width: shape.w * cell, height: shape.h * cell }}>
      {shape.cells.map(([r, c], i) => (
        <i key={i} className={'rb-c rb-k' + color} style={{ width: cell, height: cell, top: r * cell, left: c * cell }} />
      ))}
    </div>
  )
}

function Game({ secondsLeft, hidden, onNextSet, onHide }) {
  const [board, setBoard] = useState(emptyBoard)
  const [tray, setTray] = useState(() => dealTray(emptyBoard(), secondsLeft))
  const [score, setScore] = useState(0)
  const saved = useStore(s => s.S.restBlast)
  const bud = cleanBuddy(useStore(s => s.S.buddy))
  const update = useStore(s => s.update)
  const best = Math.max(cleanStats(saved).best, oldBest())
  const [combo, setCombo] = useState(0)
  const [over, setOver] = useState(null)        // null | 'stuck' | 'time'
  const [drag, setDrag] = useState(null)        // { idx, x, y }
  const [pop, setPop] = useState(null)          // { text, id }: the floating score of the last clear
  const [flash, setFlash] = useState(null)      // { rows, cols, id }: lines just cleared
  const boardRef = useRef(null)
  const secsRef = useRef(secondsLeft)
  secsRef.current = secondsLeft

  // 0:00: whatever is left in the tray is swapped for pieces that fit nowhere.
  useEffect(() => {
    if (secondsLeft > 0 || over === 'time') return
    const doomed = doomBoard(board)
    setBoard(doomed)
    setTray(doomTray(doomed))
    setOver('time')
    setDrag(null)
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

  const cellSize = () => (boardRef.current ? boardRef.current.getBoundingClientRect().width / SIZE : 36)

  // Where the dragged piece would land: the board cell under the top-left of its ghost.
  const target = d => {
    if (!d || !boardRef.current) return null
    const p = tray[d.idx]
    const rect = boardRef.current.getBoundingClientRect()
    const cell = rect.width / SIZE
    const left = d.x - (p.shape.w * cell) / 2
    const top = d.y - (p.shape.h + LIFT) * cell
    const r = Math.round((top - rect.top) / cell), c = Math.round((left - rect.left) / cell)
    return canPlace(board, p.shape, r, c) ? { r, c } : null
  }

  const drop = d => {
    const spot = target(d)
    setDrag(null)
    if (!spot) return
    const p = tray[d.idx]
    const res = place(board, p.shape, spot.r, spot.c, p.color, combo)
    // Every turn the slot just played is dealt again from a fresh scan of the board, with the two
    // pieces still in hand (lib/blockblast.js dealOne): the most obvious piece early in the rest.
    const held = tray.map((x, i) => (i === d.idx ? null : x))
    const next = held.map((x, i) => (i === d.idx ? dealOne(res.board, held, secsRef.current) : x))
    buzz(res.perfect ? [30, 40, 60] : res.lines ? [14, 30, 14] : 8)
    setBoard(res.board)
    setTray(next)
    setScore(s => s + res.points)
    round.current.score += res.points
    round.current.lines += res.lines
    setCombo(res.combo)
    if (res.lines) {
      const id = Date.now()
      setFlash({ rows: res.rows, cols: res.cols, id })
      setPop({ text: (res.perfect ? t('Perfect clear!') + ' ' : '') + '+' + res.points + (res.combo > 1 ? ' · ' + t('Combo') + ' ×' + res.combo : ''), id, perfect: res.perfect })
      setTimeout(() => setFlash(f => (f?.id === id ? null : f)), 320)
      setTimeout(() => setPop(x => (x?.id === id ? null : x)), 900)
    }
    if (!anyMove(res.board, next)) setOver(secsRef.current > 0 ? 'stuck' : 'time')
  }

  useEffect(() => {
    if (!drag) return
    const move = e => setDrag(d => d && { ...d, x: e.clientX, y: e.clientY })
    const up = e => drop({ ...drag, x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    const cancel = () => setDrag(null)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [drag?.idx, board, tray, combo])

  const restart = () => {
    const b = emptyBoard()
    round.current = { score: 0, lines: 0, done: false }
    setBoard(b); setTray(dealTray(b, secsRef.current)); setScore(0); setCombo(0); setOver(null)
  }

  const spot = target(drag)
  const preview = new Set(), clearing = new Set()
  if (spot) {
    const p = tray[drag.idx]
    for (const [dr, dc] of p.shape.cells) preview.add((spot.r + dr) * SIZE + spot.c + dc)
    const { rows, cols } = linesAfter(board, p.shape, spot.r, spot.c)
    for (const r of rows) for (let c = 0; c < SIZE; c++) clearing.add(r * SIZE + c)
    for (const c of cols) for (let r = 0; r < SIZE; r++) clearing.add(r * SIZE + c)
  }
  const flashed = new Set()
  if (flash) {
    for (const r of flash.rows) for (let c = 0; c < SIZE; c++) flashed.add(r * SIZE + c)
    for (const c of flash.cols) for (let r = 0; r < SIZE; r++) flashed.add(r * SIZE + c)
  }
  const dragColor = drag ? tray[drag.idx].color : 0
  const cell = cellSize()

  return (
    <div id="rest-game" role="dialog" aria-label={t('Rest Blast')} hidden={hidden}>
      <div className="rb-head">
        <div>
          <div className="rb-score">{score}</div>
          <div className="rb-best">{t('Best')} {Math.max(best, score)}</div>
        </div>
        {/* your buddy watches the round with you (components/Buddy.jsx) */}
        <div className="rb-title">{bud.kind && <Buddy kind={bud.kind} mood={over ? (over === 'time' ? 'proud' : 'missing') : 'active'} level={bud.level} size={34} />}{t('Rest Blast')}</div>
        <Button size="sm" variant="ghost" onClick={onHide}>{t('Hide')}</Button>
      </div>

      <div className="rb-board" ref={boardRef}>
        {board.flatMap((row, r) => row.map((v, c) => {
          const k = r * SIZE + c
          const cls = v === JUNK ? ' rb-junk'
            : v ? ' rb-k' + v + (clearing.has(k) ? ' rb-glow' : '')
              : preview.has(k) ? ' rb-prev rb-k' + dragColor
                : flashed.has(k) ? ' rb-flash' : ''
          return <i key={k} className={'rb-cell' + cls} />
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
          <div key={p ? p.key : 'x' + i} className="rb-slot"
            onPointerDown={p && !over ? e => { e.preventDefault(); setDrag({ idx: i, x: e.clientX, y: e.clientY }) } : undefined}>
            {p && <Cells shape={p.shape} color={p.color} cell={Math.min(22, cell * 0.55)}
              className={(drag?.idx === i ? 'rb-lifted' : '') + (!over && !anyMove(board, [p]) ? ' rb-dead' : '')} />}
          </div>
        ))}
      </div>

      {drag && (
        <div className="rb-ghost" style={{
          left: drag.x - (tray[drag.idx].shape.w * cell) / 2,
          top: drag.y - (tray[drag.idx].shape.h + LIFT) * cell,
        }}>
          <Cells shape={tray[drag.idx].shape} color={dragColor} cell={cell} />
        </div>
      )}
    </div>
  )
}

export default function RestGame() {
  const timer = useUI(s => s.timer)
  const stopRest = useUI(s => s.stopRest)
  const enabled = useStore(s => s.S.restGame !== false)
  const active = !!timer && timer.kind !== 'switch' && enabled
  const [round, setRound] = useState(0)
  const [hidden, setHidden] = useState(false)
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
    <Game key={round} secondsLeft={secondsLeft} hidden={hidden} onNextSet={stopRest} onHide={() => setHidden(true)} />
    {hidden && <button type="button" className="rb-reopen" onClick={() => setHidden(false)}>{t('Rest Blast')}</button>}
  </>
}
