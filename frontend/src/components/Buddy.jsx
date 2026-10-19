import { useId, useState, useRef, useEffect } from 'react'
import { KIND_COLOR, gearFor } from '../lib/buddy.js'

// Iso, drawn (lib/buddy.js): a glossy toy block in the app's blue, with a face for its mood, little
// arms and feet, and the gear its level has earned. Plain SVG lit by gradients: the body is the
// accent colour, light and shade are white and black laid over it, so any accent still looks lit.
// It breathes, blinks, glances around and waves through CSS (isora.css, motion.css), and now and
// then does a trick of its own (a jump, a spin, a wiggle, a stretch). A big Iso follows your finger
// with its eyes. `interactive` lets a tap poke it: it squishes, hops and beams for a moment; a new
// `bump` value does the same from outside (a cleared line in Rest Blast). `mood="cheer"` throws
// both arms up. Under reduced motion it stands still.

const INK = '#0b1736'      // eyes and mouth: a deep navy that reads on any blue, in both themes
const BLUSH = '#ff7aa8'
const TONGUE = '#ff6b8f'

// the block: its back (the depth you see below the face) and its face, each a rounded square
const BACK = { x: 18, y: 30, w: 84, h: 72, r: 24 }
const FRONT = { x: 18, y: 24, w: 84, h: 72, r: 24 }

function Eyes({ mood, id }) {
  // glossy eyes: a navy oval, a big catchlight and a small one
  const eye = (cx, cy = 58, ry = 9) => <g key={cx}>
    <ellipse cx={cx} cy={cy} rx="6.8" ry={ry} fill={INK} />
    <ellipse cx={cx + 2.2} cy={cy - 3.4} rx="2.6" ry="3" fill="#fff" />
    <circle cx={cx - 2.2} cy={cy + 3.6} r="1.3" fill="#fff" opacity=".85" />
  </g>
  const arc = (cx, up = true) => <path key={cx} d={up ? `M${cx - 7} 61q7-9 14 0` : `M${cx - 7} 57q7 7 14 0`}
    stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
  switch (mood) {
    case 'proud': return <g>{arc(46)}{arc(74)}</g>
    case 'sleepy': return <g>{arc(46, false)}{arc(74, false)}</g>
    case 'chill': // relaxed: eyes a little smaller, softly lidded
      return <g>
        <clipPath id={id + 'lid'}><path d="M30 56q16-5 32 0q16-5 32 0V72H30Z" /></clipPath>
        <g className="bd-eyes" clipPath={`url(#${id}lid)`}>{eye(46, 60, 7.6)}{eye(74, 60, 7.6)}</g>
      </g>
    case 'missing':
      return <g>
        <g className="bd-eyes">{eye(46, 60)}{eye(74, 60)}</g>
        <ellipse cx="47" cy="68.5" rx="4.5" ry="1.6" fill="#fff" opacity=".55" />
        <path d="M37 47.5l10-3.5M83 47.5l-10-3.5" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      </g>
    case 'active':
      return <g>
        <g className="bd-eyes">{eye(46, 59, 8)}{eye(74, 59, 8)}</g>
        <path d="M37 46.5l12 4.5M83 46.5l-12 4.5" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
      </g>
    case 'new': return <g className="bd-eyes">{eye(46, 58, 9.6)}{eye(74, 58, 9.6)}</g>
    default: return <g className="bd-eyes">{eye(46)}{eye(74)}</g> // hyped
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

const WAVES = new Set(['hyped', 'new', 'proud'])
const TRICKS = ['jump', 'spin', 'wiggle', 'stretch', 'jump', 'wiggle']
const calm = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// one pointer listener for every Iso on screen that follows it
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

export default function Buddy({ mood = 'chill', level = 1, size = 96, still = false, interactive = false, bump, tricks, eyesFollow, className = '' }) {
  const id = 'bd' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const [poked, setPoked] = useState(0)
  const [trick, setTrick] = useState(null)
  const [looking, setLooking] = useState(false)
  const timer = useRef(null)
  const svg = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const poke = (buzz = true) => {
    setPoked(n => n + 1)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPoked(0), 900)
    if (buzz) try { navigator.vibrate?.(12) } catch { /* no haptics */ }
  }
  // poked from outside: any new truthy `bump`
  const firstBump = useRef(true)
  useEffect(() => { if (firstBump.current) { firstBump.current = false; return } if (bump) poke(false) }, [bump])

  // a trick now and then, while it is on screen and big enough to see one
  const doTricks = !still && (tricks ?? size >= 56)
  useEffect(() => {
    if (!doTricks || calm()) return
    let t1, t2
    const next = () => {
      t1 = setTimeout(() => {
        if (!document.hidden) { setTrick(TRICKS[(Math.random() * TRICKS.length) | 0]); t2 = setTimeout(() => setTrick(null), 1100) }
        next()
      }, 6000 + Math.random() * 8000)
    }
    next()
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [doTricks])

  // a big Iso watches your finger: its face turns toward it, and back once you stop
  const doFollow = !still && (eyesFollow ?? (interactive || size >= 120))
  useEffect(() => {
    if (!doFollow || calm()) return
    let idle
    const off = follow(p => {
      const el = svg.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const dx = p.x - (r.left + r.width / 2), dy = p.y - (r.top + r.height * 0.45)
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 220)
      el.style.setProperty('--fx', (dx / d * 5 * k).toFixed(2) + 'px')
      el.style.setProperty('--fy', (dy / d * 4 * k).toFixed(2) + 'px')
      setLooking(true)
      clearTimeout(idle)
      idle = setTimeout(() => setLooking(false), 2500)
    })
    return () => { off(); clearTimeout(idle) }
  }, [doFollow])

  const cheer = mood === 'cheer'
  const face = poked || cheer ? 'proud' : mood
  const f = FRONT, b = BACK
  const cls = ['buddy', still ? '' : 'alive', 'm-' + face, cheer ? 'm-cheer' : '', WAVES.has(face) && !cheer ? 'waving' : '', poked ? 'poked' : '',
    trick && !poked ? 'trick-' + trick : '', looking ? 'looking' : '', interactive ? 'tappable' : '', className].filter(Boolean).join(' ')
  const props = interactive
    ? { role: 'button', tabIndex: 0, 'aria-label': 'Iso', onClick: e => { e.stopPropagation(); poke() }, onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke() } } }
    : { 'aria-hidden': true, focusable: 'false' }
  return (
    <svg ref={svg} className={cls} viewBox="0 0 120 120" width={size} height={size} style={{ color: KIND_COLOR }} {...props}>
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

      <ellipse className="bd-shadow" cx="60" cy="110" rx="34" ry="5" fill={`url(#${id}sh)`} />
      <g className="bd-hop"><g className="bd-body">
        {/* feet */}
        {[36, 66].map(x => <g key={x}>
          <rect x={x} y="96" width="18" height="12" rx="6" fill="currentColor" />
          <rect x={x} y="96" width="18" height="12" rx="6" fill="#000" opacity=".3" />
        </g>)}
        {/* arms: the right one waves when Iso is happy */}
        <g className="bd-arm bd-arm-l"><g transform="rotate(28 22 74)"><rect x="15" y="70" width="13" height="24" rx="6.5" fill="currentColor" /><rect x="15" y="70" width="13" height="24" rx="6.5" fill="#000" opacity=".22" /></g></g>
        <g className="bd-arm bd-arm-r"><g transform="rotate(-28 98 74)"><rect x="92" y="70" width="13" height="24" rx="6.5" fill="currentColor" /><rect x="92" y="70" width="13" height="24" rx="6.5" fill="#000" opacity=".22" /></g></g>
        {/* the block: depth, then the lit face */}
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="currentColor" />
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="#000" opacity=".34" />
        <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill="currentColor" />
        <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${id}lit)`} />
        <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill={`url(#${id}side)`} />
        <rect x={f.x + .75} y={f.y + .75} width={f.w - 1.5} height={f.h - 1.5} rx={f.r - .75} fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="1.5" />
        {/* gloss */}
        <path d="M30 34q2-5 10-5h18q4 0 3 3-1 3-6 3H40q-6 0-9 4-2 1-1-5Z" fill={`url(#${id}gloss)`} />
        <circle cx="88" cy="33" r="2.4" fill="#fff" opacity=".55" />
        {/* cheeks, face */}
        <ellipse className="bd-blush" cx="33" cy="70" rx="8.5" ry="5.2" fill={`url(#${id}blush)`} />
        <ellipse className="bd-blush" cx="87" cy="70" rx="8.5" ry="5.2" fill={`url(#${id}blush)`} />
        <g className="bd-face"><g className="bd-blink"><Eyes mood={face} id={id} /></g><Mouth mood={face} /></g>
        <Gear level={level} id={id} />
      </g></g>
      <Extras mood={face} />
    </svg>
  )
}
