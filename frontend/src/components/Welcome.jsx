import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { t } from '../lib/i18n.js'
import Buddy from './Buddy.jsx'
import IsoraMark from './IsoraMark.jsx'
import { Button } from './ui.jsx'

// The welcome: four short screens the very first time ISORA opens, before Iso's setup chat.
// Iso introduces itself, a round of Rest Blast plays by itself, a lift climbs week by week, and
// the ring closes on "Find your balance". Swipe or tap Next; Skip jumps straight to the chat.
// Settings → Look & Home plays it again (useWelcome), so it is also the app's "what is this".

const useWelcome = create(set => ({ open: false, show: () => set({ open: true }), hide: () => set({ open: false }) }))
/** Play the welcome again, over whatever is on screen. */
export const showWelcome = () => useWelcome.getState().show()

export function WelcomeHost() {
  const open = useWelcome(s => s.open)
  const hide = useWelcome(s => s.hide)
  return open ? <Welcome onDone={hide} replay /> : null
}

const SLIDES = () => [
  { key: 'meet', mood: 'new', react: null, title: t('Hi, I’m Iso.'), body: t('Your ISORA buddy. I cheer you on, keep an eye on your week and grow as you train. Go on, tap me.') },
  { key: 'blast', mood: 'hyped', react: 'surprise', title: t('Every rest is a round of Rest Blast.'), body: t('Three minutes of puzzle while you rest. Easy pieces early, harder later. Clear lines, beat your best, then back to the bar.') },
  { key: 'plan', mood: 'active', react: 'nod', title: t('A plan that keeps up.'), body: t('Tell me your goal and I build the plan. When you’re ready I add weight, and when a lift stalls I switch the variation.') },
  { key: 'balance', mood: 'cheer', react: 'love', title: t('Find your balance.'), body: t('Train, rest, repeat. Let’s set you up. It takes about a minute.') },
]

export default function Welcome({ onDone, replay = false }) {
  const slides = SLIDES()
  const [i, setI] = useState(0)
  const [dir, setDir] = useState('fwd')
  const [rx, setRx] = useState(null)
  const drag = useRef(null)
  const root = useRef(null)
  const last = i === slides.length - 1
  const s = slides[i]

  const go = n => {
    if (n < 0 || n >= slides.length) return
    setDir(n > i ? 'fwd' : 'back')
    setI(n)
    const kind = slides[n].react
    if (kind) setRx({ kind, id: Date.now() })
  }
  const next = () => last ? onDone() : go(i + 1)

  // a swipe moves a screen; the keyboard too
  const down = e => { if (e.button === 0 || e.pointerType !== 'mouse') drag.current = { x: e.clientX, y: e.clientY } }
  const up = e => {
    const d = drag.current; drag.current = null
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? go(i + 1) : go(i - 1))
  }
  useEffect(() => {
    const key = e => { if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === 'Escape') onDone() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  // the page under it stays put
  useEffect(() => {
    if (!replay) return
    document.body.classList.add('ob-open')
    return () => document.body.classList.remove('ob-open')
  }, [replay])

  return <div className={'wel' + (replay ? ' replay' : '')} ref={root} role="dialog" aria-label={t('Welcome to ISORA')}
    onPointerDown={down} onPointerUp={up} onPointerCancel={() => { drag.current = null }}>
    <div className="wel-top">
      <span className="wel-brand"><IsoraMark size={22} /><b>ISORA</b></span>
      <button type="button" className="wel-skip" onClick={onDone}>{last ? '' : t('Skip')}</button>
    </div>
    <div className={'wel-slide ' + dir + ' is-' + s.key} key={s.key}>
      <div className="wel-scene">
        {s.key === 'meet' ? <MeetScene /> : <div className="wel-stage">
          {s.key === 'blast' && <BlastScene />}
          {s.key === 'plan' && <PlanScene />}
          {s.key === 'balance' && <BalanceScene />}
          <div className="wel-iso"><Buddy mood={s.mood} size={s.key === 'balance' ? 84 : 72} react={rx} point={s.key === 'balance' ? null : 'left'} eyesFollow /></div>
        </div>}
      </div>
      <h1 className="wel-title">{s.title}</h1>
      <p className="wel-body">{s.body}</p>
    </div>
    <div className="wel-foot">
      <div className="wel-dots" aria-hidden="true">{slides.map((x, k) => <i key={x.key} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</div>
      <Button variant="primary" className="wel-next" onClick={next}>{last ? (replay ? t('Done') : t('Let’s go')) : t('Next')}</Button>
    </div>
  </div>
}

// --- the scenes -----------------------------------------------------------

function MeetScene() {
  return <div className="wel-meet">
    <span className="wel-halo" /><span className="wel-halo h2" />
    <Buddy mood="new" size={168} enter interactive eyesFollow />
  </div>
}

// a 6×6 board that plays itself: a block drops into the gap of the bottom row, the row lights and
// clears, a tall piece slots into the column above, then again
const BOARD = [
  '......',
  '......',
  '..5...',
  '.55..4',
  '666.44',
  '21.137',
]
function BlastScene() {
  return <div className="wel-blast" aria-hidden="true">
    <div className="wel-board">
      {BOARD.flatMap((row, r) => row.split('').map((c, col) => {
        const filled = c !== '.'
        const bottom = r === 5
        return <i key={r + '-' + col} className={'wel-cell' + (filled ? ' rb-k' + c : '') + (bottom && filled ? ' row' : '')} />
      }))}
      <div className="wel-piece"><i className="rb-k3" /></div>
      <div className="wel-piece p2"><i className="rb-k6" /><i className="rb-k6" /></div>
      <div className="wel-pop">+180</div>
    </div>
    <div className="wel-blast-bar"><i /></div>
  </div>
}

// a lift, week by week: the bars grow in, the last one is a record
function PlanScene() {
  const W = [40, 42.5, 45, 45, 47.5, 50]
  return <div className="wel-plan" aria-hidden="true">
    <div className="wel-bars">
      {W.map((w, k) => <div key={k} className={'wel-bar' + (k === W.length - 1 ? ' pr' : '')} style={{ '--i': k, '--h': (w - 30) / 22 }}>
        <b>{k === W.length - 1 ? '50' : ''}</b><i /><span>{t('W{0}', k + 1)}</span>
      </div>)}
    </div>
    <div className="wel-note"><span className="wel-note-dot" />{t('Time to add weight')}</div>
  </div>
}

// the ring closes around the mark; the week fills in
function BalanceScene() {
  const R = 54, C = 2 * Math.PI * R
  return <div className="wel-balance" aria-hidden="true">
    <div className="wel-ringwrap">
      <svg viewBox="0 0 124 124" width="124" height="124">
        <circle cx="62" cy="62" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="5" />
        <circle className="wel-ring" cx="62" cy="62" r={R} fill="none" stroke="var(--acc)" strokeWidth="5" strokeLinecap="round" transform="rotate(-90 62 62)" strokeDasharray={C} style={{ '--c': C }} />
      </svg>
      <IsoraMark size={58} />
    </div>
    <div className="wel-week">{[1, 1, 0, 1, 1, 0, 0].map((d, k) => <i key={k} className={d ? 'on' : ''} style={{ '--i': k }} />)}</div>
  </div>
}
