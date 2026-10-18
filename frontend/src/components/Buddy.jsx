import { KIND_COLOR, gearFor } from '../lib/buddy.js'

// Your buddy, drawn (lib/buddy.js): a block creature in the app's blue, with a face for
// its mood and the gear its level has earned. Plain SVG; it bobs and blinks through CSS
// (isora.css), still under reduced motion. The face and gear are drawn in the page background so
// they read on every body colour and both themes.

// The buddy's body: a rounded block, like the blocks of the logo and of Rest Blast.
const BODY = { d: 'M40 28h40a20 20 0 0 1 20 20v32a20 20 0 0 1-20 20H40a20 20 0 0 1-20-20V48a20 20 0 0 1 20-20Z', top: 28 }
const INK = 'var(--bg)'

function Face({ mood }) {
  const eye = (cx, extra = {}) => <g className="bd-eye" style={{ transformOrigin: `${cx}px 64px` }} {...extra}>
    <circle cx={cx} cy="64" r="8" fill="#fff" /><circle cx={cx + 1} cy={mood === 'missing' ? 67 : 62} r="4.2" fill={INK} />
    <circle cx={cx + 2.6} cy={mood === 'missing' ? 65.4 : 60.4} r="1.4" fill="#fff" />
  </g>
  switch (mood) {
    case 'proud':
      return <g>
        <path d="M40 64q6-7 12 0M68 64q6-7 12 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <ellipse cx="38" cy="74" rx="5" ry="3" fill="#fff" opacity=".35" /><ellipse cx="82" cy="74" rx="5" ry="3" fill="#fff" opacity=".35" />
        <path d="M50 76q10 10 20 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </g>
    case 'sleepy':
      return <g>
        <path d="M40 65h12M68 65h12" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        <ellipse cx="60" cy="79" rx="4" ry="3.2" fill={INK} />
        <text x="88" y="40" className="bd-z" fill="currentColor" fontSize="14" fontWeight="800">z</text>
        <text x="98" y="28" className="bd-z bd-z2" fill="currentColor" fontSize="10" fontWeight="800">z</text>
      </g>
    case 'chill':
      return <g>
        <path d="M40 66q6-5 12 0M68 66q6-5 12 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M52 77q8 5 16 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </g>
    case 'missing':
      return <g>{eye(46)}{eye(74)}<path d="M52 82q8-6 16 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" /></g>
    case 'active':
      return <g>
        {eye(46)}{eye(74)}
        <path d="M38 52l12 4M82 52l-12 4" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M52 78h16" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M92 46c3 5 3 8 0 9-3-1-3-4 0-9Z" fill="#fff" opacity=".8" />
      </g>
    case 'new':
      return <g>{eye(46)}{eye(74)}<ellipse cx="60" cy="79" rx="4.5" ry="4" fill={INK} /></g>
    default: // hyped
      return <g>
        {eye(46)}{eye(74)}
        <path d="M49 74h22a11 11 0 0 1-22 0Z" fill={INK} />
        <path d="M24 34l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fff" className="bd-spark" />
      </g>
  }
}

function Gear({ level, top }) {
  const g = gearFor(level)
  return <g>
    {g.band && <rect x="26" y={top + 8} width="68" height="7" rx="3.5" fill="#fff" opacity=".9" />}
    {g.phones && <g fill="none" stroke="#e8edf3" strokeWidth="4" strokeLinecap="round">
      <path d={`M24 ${top + 26}a36 30 0 0 1 72 0`} />
      <rect x="15" y={top + 21} width="12" height="20" rx="6" fill="#e8edf3" stroke={INK} strokeWidth="2" />
      <rect x="93" y={top + 21} width="12" height="20" rx="6" fill="#e8edf3" stroke={INK} strokeWidth="2" />
    </g>}
    {g.crown && <path d={`M46 ${top - 2}l4-14 10 9 10-9 4 14Z`} fill="var(--yellow)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
  </g>
}

export default function Buddy({ mood = 'chill', level = 1, size = 96, still = false, className = '' }) {
  const b = BODY
  return (
    <svg className={'buddy' + (still ? '' : ' alive') + ' ' + className} viewBox="0 0 120 120" width={size} height={size}
      style={{ color: KIND_COLOR }} aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="110" rx="30" ry="4" fill="currentColor" opacity=".18" className="bd-shadow" />
      <g className="bd-body">
        <path d={b.d} fill="currentColor" />
        <rect x="38" y="98" width="14" height="8" rx="4" fill="currentColor" /><rect x="68" y="98" width="14" height="8" rx="4" fill="currentColor" />
        <path d={b.d} fill="#fff" opacity=".08" transform="translate(4 -4) scale(.93)" style={{ transformOrigin: '60px 60px' }} />
        <Face mood={mood} />
        <Gear level={level} top={b.top} />
      </g>
    </svg>
  )
}
