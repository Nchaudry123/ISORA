import { useId, useState, useRef, useEffect } from 'react'
import { KIND_COLOR, gearFor } from '../lib/buddy.js'
import * as iso from '../lib/iso-motion.js'

// Iso, drawn (lib/buddy.js): a glossy toy block in the app's blue, with a face for its mood, little
// arms and feet, and the gear its level has earned. Plain SVG lit by gradients: the body is the
// accent colour, light and shade are white and black laid over it, so any accent still looks lit.
// It moves by simulation, not keyframes (lib/iso-motion.js): a jelly body on springs, arms that
// lag and flap, real jumps and landings, blinks, a wandering gaze that follows your finger, a wobble
// when the page scrolls, and little things it does by itself for its mood (dance, wave, spin, tilt,
// stretch, yawn …). `interactive` lets a tap poke it; a new `bump` value pokes it from outside (a
// cleared line in Rest Blast); `talking` moves its mouth and it glances at what it says
// (`talkSide`); a new `react` {kind, id} plays a reaction (surprise, love, laugh, dizzy, oops);
// `enter` drops it in; `mood="cheer"` throws both arms up. Its eyebrows, eye size and smile come
// from the simulation too. Under reduced motion, or `still`, it stands still.

const INK = '#0b1736'      // eyes and mouth: a deep navy that reads on any blue, in both themes
const BLUSH = '#ff7aa8'
const TONGUE = '#ff6b8f'

// the block: its back (the depth you see below the face) and its face, each a rounded square
const BACK = { x: 18, y: 30, w: 84, h: 72, r: 24 }
const FRONT = { x: 18, y: 24, w: 84, h: 72, r: 24 }

function Eyes({ mood, id }) {
  // glossy eyes: a navy oval, a big catchlight and a small one
  // the white of the eye, then the pupil with its catchlights: the pupil moves a little more than
  // the face does (bd-pupil, moved per frame), which is what makes a look read as a look
  const eye = (cx, cy = 58, ry = 9) => <g key={cx}>
    <ellipse cx={cx} cy={cy} rx={6.8 + 2.4} ry={ry + 2.4} fill="#fff" opacity=".92" />
    <g className="bd-pupil">
      <ellipse cx={cx} cy={cy} rx="6.8" ry={ry} fill={INK} />
      <ellipse cx={cx + 2.2} cy={cy - 3.4} rx="2.6" ry="3" fill="#fff" />
      <circle cx={cx - 2.2} cy={cy + 3.6} r="1.3" fill="#fff" opacity=".85" />
    </g>
  </g>
  const arc = (cx, up = true) => <path key={cx} d={up ? `M${cx - 7} 61q7-9 14 0` : `M${cx - 7} 57q7 7 14 0`}
    stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
  switch (mood) {
    case 'proud': return <g>{arc(46)}{arc(74)}</g>
    case 'sleepy': return <g>{arc(46, false)}{arc(74, false)}</g>
    case 'chill': // relaxed: eyes a little smaller, softly lidded
      return <g>
        <clipPath id={id + 'lid'}><path d="M30 56q16-5 32 0q16-5 32 0V72H30Z" /></clipPath>
        <g clipPath={`url(#${id}lid)`}>{eye(46, 60, 7.6)}{eye(74, 60, 7.6)}</g>
      </g>
    case 'missing':
      return <g>
        <g>{eye(46, 60)}{eye(74, 60)}</g>
        <ellipse cx="47" cy="68.5" rx="4.5" ry="1.6" fill="#fff" opacity=".55" />
        <path d="M37 47.5l10-3.5M83 47.5l-10-3.5" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      </g>
    case 'active':
      return <g>
        <g>{eye(46, 59, 8)}{eye(74, 59, 8)}</g>
        <path d="M37 46.5l12 4.5M83 46.5l-12 4.5" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
      </g>
    case 'new': return <g>{eye(46, 58, 9.6)}{eye(74, 58, 9.6)}</g>
    default: return <g>{eye(46)}{eye(74)}</g> // hyped
  }
}

function Mouth({ mood }) {
  const line = d => <path d={d} stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  switch (mood) {
    case 'proud': case 'hyped':
      return <g>
        <path d="M49 72h22a11 11 0 0 1-22 0Z" fill={INK} />
        <path d="M53.5 79.4a7 5 0 0 1 13 0a11 11 0 0 1-13 0Z" fill={TONGUE} />
      </g>
    case 'sleepy': return <ellipse cx="60" cy="77" rx="3.6" ry="4.4" fill={INK} />
    case 'chill': return line('M53 75q7 5 14 0')
    case 'missing': return line('M53 79q3.5-4 7-1.5t7-1.5')
    case 'active': return <g>
      <rect x="51" y="72" width="18" height="8" rx="4" fill={INK} />
      <path d="M53 76h14" stroke="#fff" strokeWidth="1.6" opacity=".9" />
    </g>
    case 'new': return <ellipse cx="60" cy="77" rx="4.2" ry="4.8" fill={INK} />
    case 'talk': return <g>
      <path d="M51 73h18a9 8 0 0 1-18 0Z" fill={INK} />
      <path d="M55 79a5 3.4 0 0 1 10 0a9 7 0 0 1-10 0Z" fill={TONGUE} />
    </g>
    default: return line('M53 75q7 5 14 0')
  }
}

function Extras({ mood }) {
  const spark = (x, y, s, cls) => <path className={'bd-spark ' + cls}
    d={`M${x} ${y - s}q${s * .18} ${s * .82} ${s} ${s}q-${s * .82} ${s * .18}-${s} ${s}q-${s * .18}-${s * .82}-${s}-${s}q${s * .82}-${s * .18} ${s}-${s}Z`} fill="#ffd23f" />
  switch (mood) {
    case 'hyped': return <g>{spark(14, 34, 6, '')}{spark(106, 26, 4.5, 'bd-d2')}</g>
    case 'proud': return <g>{spark(12, 40, 5, '')}{spark(108, 30, 6, 'bd-d2')}{spark(100, 10, 3.5, 'bd-d3')}</g>
    case 'sleepy': return <g fill="var(--label-2)" fontWeight="800" fontFamily="system-ui, sans-serif">
      <text x="92" y="30" className="bd-z" fontSize="15">z</text>
      <text x="103" y="16" className="bd-z bd-d2" fontSize="11">z</text>
    </g>
    case 'active': return <path className="bd-sweat" d="M95 38c4 6 4.5 9.5 0 11-4.5-1.5-4-5 0-11Z" fill="#cfe8ff" stroke="#fff" strokeWidth="1" />
    default: return null
  }
}

function Gear({ level, id }) {
  const g = gearFor(level)
  return <g>
    {g.band && <g>
      <rect x="19" y="35" width="82" height="9" fill="#fff" clipPath={`url(#${id}face)`} />
      <rect x="19" y="38.5" width="82" height="2.2" fill="#ff4d6d" clipPath={`url(#${id}face)`} />
    </g>}
    {g.phones && <g>
      <path d="M22 54a38 34 0 0 1 76 0" fill="none" stroke="#e9eef5" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 54a38 34 0 0 1 76 0" fill="none" stroke={INK} strokeWidth="1.4" opacity=".25" transform="translate(0 2.4)" />
      {[[9, 'L'], [99, 'R']].map(([x, k]) => <g key={k}>
        <rect x={x} y="48" width="12" height="22" rx="6" fill={`url(#${id}cup)`} stroke={INK} strokeWidth="1.8" />
        <rect x={x + 3} y="52" width="3" height="10" rx="1.5" fill="#fff" opacity=".8" />
      </g>)}
    </g>}
    {g.crown && <g transform="rotate(-8 60 22)">
      <path d="M44 26l-3-16 10 8 9-12 9 12 10-8-3 16Z" fill={`url(#${id}gold)`} stroke="#9a6200" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="60" cy="19" r="2.6" fill="#ff4d6d" /><circle cx="50" cy="21" r="1.8" fill="#5ad1ff" /><circle cx="70" cy="21" r="1.8" fill="#5ad1ff" />
      <path d="M45 24h30" stroke="#fff" strokeWidth="1.4" opacity=".6" strokeLinecap="round" />
    </g>}
  </g>
}

const calm = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// one pointer listener for every Iso on screen
const followers = new Set()
const onPointer = e => { const p = { x: e.clientX, y: e.clientY }; followers.forEach(f => f(p)) }
function follow(fn) {
  if (!followers.size) { window.addEventListener('pointermove', onPointer, { passive: true }); window.addEventListener('pointerdown', onPointer, { passive: true }) }
  followers.add(fn)
  return () => {
    followers.delete(fn)
    if (!followers.size) { window.removeEventListener('pointermove', onPointer); window.removeEventListener('pointerdown', onPointer) }
  }
}

const f2 = n => (Math.round(n * 1000) / 1000)

const HEART = 'M0 3.2c-2.6-5.2-8-2.4-6 1.6 1.2 2.4 4.2 4.4 6 5.8 1.8-1.4 4.8-3.4 6-5.8 2-4-3.4-6.8-6-1.6Z'

export default function Buddy({ mood = 'chill', level = 1, size = 96, still = false, interactive = false, bump, react, talking = false, talkSide = 1, point = null, enter = false, eyesFollow, className = '' }) {
  const id = 'bd' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const [poked, setPoked] = useState(0)
  const timer = useRef(null)
  const R = { svg: useRef(null), shadow: useRef(null), jump: useRef(null), lean: useRef(null), body: useRef(null),
    armL: useRef(null), armR: useRef(null), face: useRef(null), eyes: useRef(null), mouth: useRef(null),
    browL: useRef(null), browR: useRef(null), o: useRef(null), hearts: useRef(null) }
  const sim = useRef(null)
  const live = useRef({ mood, talking, talkSide, point })
  const cheer = mood === 'cheer'
  live.current = { mood: poked ? 'proud' : mood, talking, talkSide, point }
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(timer.face) }, [])

  // the happy face comes once the surprise has passed (lib/iso-motion.js REACTIONS.surprise)
  const poke = (buzz = true) => {
    clearTimeout(timer.current); clearTimeout(timer.face)
    timer.face = setTimeout(() => setPoked(n => n + 1), 420)
    timer.current = setTimeout(() => setPoked(0), 1500)
    if (sim.current) iso.poke(sim.current)
    if (buzz) try { navigator.vibrate?.(12) } catch { /* no haptics */ }
  }
  // poked from outside: any new truthy `bump`
  const firstBump = useRef(true)
  useEffect(() => { if (firstBump.current) { firstBump.current = false; return } if (bump) poke(false) }, [bump])
  // a reaction asked for from outside: any new id
  const firstRx = useRef(true)
  useEffect(() => { if (firstRx.current) { firstRx.current = false; return } if (react?.kind && sim.current) iso.react(sim.current, react.kind) }, [react?.id])

  // the body, simulated every frame while it is on screen (lib/iso-motion.js)
  const small = size < 48
  const followOn = eyesFollow ?? !small
  useEffect(() => {
    if (still || calm()) return
    const st = sim.current = iso.initialState()
    if (enter) { st.jy = -70; st.air = true; st.jv = 0; st.airT = 0; st.airTotal = 1 }
    let pointer = null, pointerAt = -1e9, raf = 0, last = 0, visible = true, lastY = window.scrollY
    const set = (ref, v) => ref.current?.setAttribute('transform', v)
    const frame = now => {
      raf = 0
      const dt = last ? (now - last) / 1000 : 1 / 60
      last = now
      const p = iso.step(st, { dt, mood: live.current.mood, talking: live.current.talking, talkSide: live.current.talkSide, small,
        point: live.current.point, pointer: now - pointerAt < 2500 ? pointer : null })
      set(R.jump, `translate(0 ${f2(p.jy)})`)
      set(R.lean, `rotate(${f2(p.rot)} 60 106)`)
      set(R.body, `translate(60 104) scale(${f2(p.sx)} ${f2(p.sy)}) translate(-60 -104)`)
      set(R.armL, `rotate(${f2(p.al)} 24 72)`)
      set(R.armR, `rotate(${f2(p.ar)} 96 72)`)
      set(R.face, `translate(${f2(p.lx * 5)} ${f2(p.ly * 3.6)})`)
      if (R.eyes.current) for (const pu of R.eyes.current.querySelectorAll('.bd-pupil')) pu.setAttribute('transform', `translate(${f2(p.lx * 2.4)} ${f2(p.ly * 2)})`)
      set(R.eyes, `translate(0 59) scale(${f2(1 + (p.wide - 1) * 0.35)} ${f2(p.blink * p.wide)}) translate(0 -59)`)
      set(R.mouth, `translate(60 77) scale(${f2((0.85 + 0.3 * p.smile) * (0.9 + 0.1 * p.mouth))} ${f2(p.mouth * (1 - p.o))}) translate(-60 -77)`)
      // eyebrows: raised or drooping with `brow`, knitted with `browIn` (inner ends down)
      const knit = 16 * p.browIn + 12 * Math.min(0, p.brow), lift = -5 * p.brow
      set(R.browL, `translate(0 ${f2(lift)}) rotate(${f2(knit)} 46 44)`)
      set(R.browR, `translate(0 ${f2(lift)}) rotate(${f2(-knit)} 74 44)`)
      if (R.o.current) { R.o.current.style.opacity = f2(p.o); R.o.current.setAttribute('ry', f2(1.5 + 5 * p.o)) }
      if (R.hearts.current) [...R.hearts.current.children].forEach((h, i) => {
        const hh = p.hearts[i]
        if (!hh) { h.style.opacity = 0; return }
        h.style.opacity = f2(1 - hh.k * hh.k)
        h.setAttribute('transform', `translate(${f2(60 + hh.x + Math.sin(hh.k * 6) * 3)} ${f2(26 - 40 * hh.k)}) scale(${f2(0.55 + 0.6 * Math.min(1, hh.k * 4))})`)
      })
      set(R.shadow, `translate(60 110) scale(${f2(p.shadow)} ${f2(p.shadow)}) translate(-60 -110)`)
      if (R.shadow.current) R.shadow.current.style.opacity = f2(0.35 + 0.65 * p.shadow)
      go()
    }
    const go = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame) }
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0 }
    const onVis = () => (document.hidden ? stop() : go())
    document.addEventListener('visibilitychange', onVis)
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? go() : stop() }) : null
    if (io && R.svg.current) io.observe(R.svg.current)
    // the page scrolling under it gives it a wobble
    const onScroll = () => { const y = window.scrollY; iso.nudge(st, (y - lastY) / 60); lastY = y }
    window.addEventListener('scroll', onScroll, { passive: true })
    // it looks at your finger (and leans toward it)
    const off = followOn ? follow(pt => {
      const el = R.svg.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const dx = pt.x - (r.left + r.width / 2), dy = pt.y - (r.top + r.height * 0.45)
      const reach = Math.max(260, r.width * 3)
      const d = Math.hypot(dx, dy)
      if (d > reach * 2.5) return
      const k = Math.min(1, d / 120) / (d || 1)
      pointer = { dx: dx * k, dy: dy * k * 0.8 }
      pointerAt = performance.now()
    }) : null
    go()
    return () => {
      stop(); off?.(); io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('scroll', onScroll)
      sim.current = null
    }
  }, [still, small, followOn])

  const face = poked || cheer ? 'proud' : mood
  const f = FRONT, b = BACK
  const cls = ['buddy', still ? '' : 'alive', 'm-' + face, interactive ? 'tappable' : '', className].filter(Boolean).join(' ')
  const props = interactive
    ? { role: 'button', tabIndex: 0, 'aria-label': 'Iso', onClick: e => { e.stopPropagation(); poke() }, onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke() } } }
    : { 'aria-hidden': true, focusable: 'false' }
  return (
    <svg ref={R.svg} className={cls} viewBox="0 0 120 120" width={size} height={size} style={{ color: KIND_COLOR }} {...props}>
      <defs>
        <radialGradient id={id + 'sh'}><stop offset="0" stopColor="#000" stopOpacity=".42" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <linearGradient id={id + 'lit'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".42" /><stop offset=".45" stopColor="#fff" stopOpacity=".06" />
          <stop offset=".7" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".16" />
        </linearGradient>
        <linearGradient id={id + 'side'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".14" /><stop offset=".22" stopColor="#fff" stopOpacity="0" />
          <stop offset=".78" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
        <linearGradient id={id + 'gloss'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id + 'blush'}><stop offset="0" stopColor={BLUSH} stopOpacity=".75" /><stop offset="1" stopColor={BLUSH} stopOpacity="0" /></radialGradient>
        <linearGradient id={id + 'gold'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe27a" /><stop offset="1" stopColor="#f4a100" /></linearGradient>
        <linearGradient id={id + 'cup'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c9d3e0" /></linearGradient>
        <clipPath id={id + 'face'}><rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} /></clipPath>
      </defs>

      <ellipse ref={R.shadow} className="bd-shadow" cx="60" cy="110" rx="34" ry="5" fill={`url(#${id}sh)`} />
      <g ref={R.jump}><g ref={R.lean}>
        {/* feet stay on the ground while the body squashes above them */}
        {[36, 66].map(x => <g key={x}>
          <rect x={x} y="96" width="18" height="12" rx="6" fill="currentColor" />
          <rect x={x} y="96" width="18" height="12" rx="6" fill="#000" opacity=".3" />
        </g>)}
        <g ref={R.body}>
          <g ref={R.armL}><g transform="rotate(28 22 74)"><rect x="15" y="70" width="13" height="24" rx="6.5" fill="currentColor" /><rect x="15" y="70" width="13" height="24" rx="6.5" fill="#000" opacity=".22" /></g></g>
          <g ref={R.armR}><g transform="rotate(-28 98 74)"><rect x="92" y="70" width="13" height="24" rx="6.5" fill="currentColor" /><rect x="92" y="70" width="13" height="24" rx="6.5" fill="#000" opacity=".22" /></g></g>
          {/* the block: depth, then the lit face */}
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="currentColor" />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="#000" opacity=".34" />
          <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill="currentColor" />
          <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${id}lit)`} />
          <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${id}side)`} />
          <rect x={f.x + .75} y={f.y + .75} width={f.w - 1.5} height={f.h - 1.5} rx={f.r - .75} fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="1.5" />
          <path d="M30 34q2-5 10-5h18q4 0 3 3-1 3-6 3H40q-6 0-9 4-2 1-1-5Z" fill={`url(#${id}gloss)`} />
          <circle cx="88" cy="33" r="2.4" fill="#fff" opacity=".55" />
          <g ref={R.face}>
            <ellipse className="bd-blush" cx="33" cy="70" rx="8.5" ry="5.2" fill={`url(#${id}blush)`} />
            <ellipse className="bd-blush" cx="87" cy="70" rx="8.5" ry="5.2" fill={`url(#${id}blush)`} />
            <g ref={R.browL}><path d="M39.5 44q6.5-3 13 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" opacity=".85" /></g>
            <g ref={R.browR}><path d="M67.5 44q6.5-3 13 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" opacity=".85" /></g>
            <g ref={R.eyes}><Eyes mood={face} id={id} /></g>
            <g ref={R.mouth}><Mouth mood={talking && !poked ? 'talk' : face} /></g>
            <ellipse ref={R.o} cx="60" cy="77" rx="4.6" ry="1.5" fill={INK} style={{ opacity: 0 }} />
          </g>
          <Gear level={level} id={id} />
        </g>
      </g></g>
      <Extras mood={face} />
      <g ref={R.hearts} fill="#ff5d8a" stroke="#fff" strokeWidth=".8">
        {[0, 1, 2, 3, 4].map(i => <path key={i} d={HEART} style={{ opacity: 0 }} />)}
      </g>
    </svg>
  )
}
