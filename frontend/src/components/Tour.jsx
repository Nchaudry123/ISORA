import { useEffect, useLayoutEffect, useState } from 'react'
import { create } from 'zustand'
import { t } from '../lib/i18n.js'
import Buddy from './Buddy.jsx'
import { Button } from './ui.jsx'
import { Typewriter } from './BuddyParts.jsx'

// Iso's guide: a few steps that spotlight a part of the screen while Iso stands beside it,
// points at it and says what it is. One tour for Home after the first setup, one for the first
// workout; Settings → Look & Home offers them again. Which ones are still owed is kept in local
// storage (isora_tour), not in the profile: it is this phone's first time, not the account's.

const OWED_KEY = 'isora_tour'
export const owedTours = () => { try { return new Set((localStorage.getItem(OWED_KEY) || '').split(',').filter(Boolean)) } catch { return new Set() } }
export const oweTours = names => { try { localStorage.setItem(OWED_KEY, [...new Set(names)].join(',')) } catch {} }
export const settleTour = name => { const s = owedTours(); s.delete(name); oweTours([...s]) }

// The steps: the element (first one found wins), what Iso says, and where Iso stands.
const STEPS = {
  home: () => [
    { sel: ['.today-hero'], say: t('This is today. One tap starts the workout, or opens what you did.') },
    { sel: ['.week', '.queue'], say: t('Your week. A ring is a planned day, a filled one is done. Tap a day to change it.') },
    { sel: ['.bcard'], say: t('That’s me. I leave you a line every day and grow as you train. Tap me any time.') },
    { sel: ['#tabbar button.start'], say: t('Start always lives here. Hold it to pick a different routine.') },
    { sel: ['#tabbar'], say: t('Plan, Stats and Exercises sit along the bottom. That’s the tour. Let’s train!'), cheer: true },
  ],
  workout: () => [
    { sel: ['.setrow.next', '.setrow'], say: t('Set the weight and reps, then tick the circle when the set is done.') },
    { sel: ['.progline'], say: t('I’ll tell you here when it’s time to add weight, and why.') },
    { sel: ['.whdr-finish'], say: t('Every rest is a round of Rest Blast. When you’re done, Finish is up here.'), cheer: true },
  ],
}

const useTour = create(set => ({ name: null, start: name => set({ name }), end: () => set({ name: null }) }))
/** Open a tour by name; nothing if it has no steps on this screen. */
export const startTour = name => { if (STEPS[name]) useTour.getState().start(name) }

const PAD = 8
function findTarget(sels) {
  for (const s of sels) { const el = document.querySelector(s); if (el && el.getBoundingClientRect().width > 0) return el }
  return null
}

function TourOverlay({ name }) {
  const end = useTour(s => s.end)
  const [steps] = useState(() => STEPS[name]().filter(st => findTarget(st.sel)))
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const [talking, setTalking] = useState(false)
  const [react, setReact] = useState(null)
  const step = steps[i]

  // where the target is now, after it has been scrolled into the middle of the screen
  const measure = () => {
    const el = step && findTarget(step.sel)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD })
  }
  useLayoutEffect(() => {
    const el = step && findTarget(step.sel)
    if (!el) { if (step) next(); return }
    const fixed = el.closest('#tabbar, .whdr.stick, [style*="position: fixed"]')
    if (!fixed) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const id = setTimeout(measure, fixed ? 0 : 380)
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    return () => { clearTimeout(id); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [i])
  useEffect(() => { try { navigator.vibrate?.(6) } catch {} }, [i])

  const finish = () => { settleTour(name); end() }
  const next = () => { if (i + 1 >= steps.length) finish(); else { setReact({ kind: 'nod', id: Date.now() }); setI(i + 1) } }
  if (!step) return null

  // Iso and the bubble stand below the target when there is room, above it otherwise
  const vh = window.innerHeight
  const below = rect ? rect.top + rect.height + 230 < vh : true
  const point = rect ? (below ? 'up' : 'down') : null
  const bubbleStyle = rect
    ? (below ? { top: rect.top + rect.height + 14 } : { bottom: vh - rect.top + 14 })
    : { bottom: '20%' }
  const last = i + 1 >= steps.length
  return (
    <div className={'tour' + (rect ? ' has-spot' : '')} role="dialog" aria-label={t('Iso’s guide')} onClick={next}>
      {rect && <div className="tour-spot" style={rect} />}
      <div className={'tour-card ' + (below ? 'is-below' : 'is-above')} style={bubbleStyle} onClick={e => e.stopPropagation()}>
        <div className="tour-iso"><Buddy mood={step.cheer ? 'cheer' : 'hyped'} size={92} point={point} talking={talking} react={react} /></div>
        <div className="tour-bubble">
          <div className="tour-say"><Typewriter key={i} text={step.say} speed={16} onTyping={setTalking} /></div>
          <div className="tour-acts">
            <span className="tour-dots" aria-label={t('Step {0} of {1}', i + 1, steps.length)}>{steps.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</span>
            {!last && <button type="button" className="tour-skip" onClick={finish}>{t('Skip')}</button>}
            <Button size="sm" variant="primary" onClick={next}>{last ? t('Let’s go') : t('Next')}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Mounted once in App: shows whichever tour is running. */
export default function TourHost() {
  const name = useTour(s => s.name)
  return name ? <TourOverlay key={name} name={name} /> : null
}

/** Starts an owed tour once its screen is ready; the caller says which and when. */
export function useOwedTour(name, ready, delay = 900) {
  // no "already scheduled" guard: React's development double-mount would set it and then cancel
  // the timer; the tour marks itself done (settleTour), so a second schedule is harmless
  useEffect(() => {
    if (!ready || !owedTours().has(name)) return
    const id = setTimeout(() => { if (owedTours().has(name)) startTour(name) }, delay)
    return () => clearTimeout(id)
  }, [ready])
}
