import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Buddy from './Buddy.jsx'

// The app intro, once each time ISORA is opened (not on every tab switch or reload of a sheet):
// the speech bubble pops up, the three blocks of the I drop into it like Rest Blast pieces, the
// name rises, and the app zooms in through the bubble. The very first time, before you have met
// Iso, it is longer: Iso hops on and waves. A tap skips it; under reduced motion there is none.

const SEEN = 'isora_intro'
const FULL_MS = 3300, SHORT_MS = 1750

// decided once per page load (StrictMode runs state initialisers twice; the second would see the mark)
let decided = null
const shouldShow = () => decided ??= decide()
const decide = () => {
  if (import.meta.env.MODE === 'test') return false
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
    if (sessionStorage.getItem(SEEN)) return false
    sessionStorage.setItem(SEEN, '1')
  } catch { /* storage blocked: show it */ }
  return true
}

export default function Intro() {
  const [show] = useState(shouldShow)
  const full = useState(() => !useStore.getState().S.onboarded)[0]
  const [phase, setPhase] = useState(show ? 'play' : 'gone')
  const total = full ? FULL_MS : SHORT_MS

  useEffect(() => {
    if (phase !== 'play') return
    const a = setTimeout(() => setPhase('exit'), total - 520)
    return () => clearTimeout(a)
  }, [phase])
  useEffect(() => {
    if (phase !== 'exit') return
    const b = setTimeout(() => setPhase('gone'), 560)
    return () => clearTimeout(b)
  }, [phase])

  if (phase === 'gone') return null
  return (
    <div className={'intro ' + (full ? 'full' : 'short') + (phase === 'exit' ? ' exit' : '')} aria-hidden="true"
      onClick={() => setPhase('exit')}>
      <div className="intro-glow" />
      <div className="intro-stage">
        <div className="intro-markwrap">
          <span className="intro-ring" /><span className="intro-ring r2" />
          <svg className="intro-mark" viewBox="96 92 320 336">
            <path className="in-bubble" fill="var(--acc)" d="M184 92h144a88 88 0 0 1 88 88v120a88 88 0 0 1-88 88H226l-70 40 10-48a88 88 0 0 1-70-86V180a88 88 0 0 1 88-88Z" />
            <path className="in-shine" fill="#fff" opacity=".18" d="M184 112h144a68 68 0 0 1 68 68v8H116v-8a68 68 0 0 1 68-68Z" />
            <g fill="#fff">
              <rect className="in-b in-b1" x="190" y="150" width="132" height="38" rx="11" />
              <rect className="in-b in-b2" x="237" y="199" width="38" height="82" rx="10" />
              <rect className="in-b in-b3" x="190" y="292" width="132" height="38" rx="11" />
            </g>
          </svg>
        </div>
        <div className="intro-word">{'ISORA'.split('').map((ch, i) => <span key={i} style={{ '--i': i }}>{ch}</span>)}</div>
        <div className="intro-tag">{t('Find your balance.')}</div>
      </div>
      {full && <div className="intro-iso"><div className="intro-iso-hop"><Buddy mood="hyped" size={96} /></div></div>}
    </div>
  )
}
