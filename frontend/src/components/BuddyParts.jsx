import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, getLang } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { setsDone, streakWeeks } from '../lib/history.js'
import { PERSONAL } from '../lib/demo.js'
import { cleanProfile } from '../lib/profile.js'
import { KIND, DEFAULT_NAME, cleanBuddy, totalXP, levelOf, gearFor, moodOf, daysBetween, fallbackLine, lineKey } from '../lib/buddy.js'
import Buddy from './Buddy.jsx'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'
import { confetti } from './confetti.js'

// Iso's screens (lib/buddy.js, components/Buddy.jsx): meeting it, its card on Home with the line of
// the day, its sheet, and the level-up moment.

const update = fn => useStore.getState().update(fn)
// the level the workouts so far are worth: a new buddy starts there, so meeting it is no level-up
export const currentLevel = () => levelOf(totalXP(useStore.getState().S.workouts, setsDone)).level
const setBuddy = patch => update(s => { s.buddy = { ...cleanBuddy(s.buddy), ...patch } })

/** Meet Iso: Iso waves (tap to poke), then `onDone()` after "Meet Iso". */
export function BuddyPicker({ onDone, cta }) {
  return <div className="bpick">
    <div className="bpick-stage"><Buddy mood="hyped" size={190} interactive /></div>
    <Button variant="primary" onClick={() => onDone()}>{cta || t('Meet {0}', DEFAULT_NAME)}</Button>
  </div>
}

const SR = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }
/** Text that types itself out, once per text, with a caret while it runs. */
export function Typewriter({ text, speed = 22, onTyping }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return }
    setN(0)
    let i = 0, timer
    const start = setTimeout(function tick() {
      i++; setN(i)
      onTyping?.(i < text.length)
      if (i < text.length) timer = setTimeout(tick, /[.,!?]/.test(text[i - 1]) ? speed * 6 : speed)
    }, 650)
    return () => { clearTimeout(start); clearTimeout(timer) }
  }, [text])
  // the full text, invisible, holds the bubble at its final size while the typed part grows
  return <span className="tw"><span className="tw-ghost" aria-hidden="true">{text}</span>
    <span aria-hidden="true">{text.slice(0, n)}{n < text.length && <span className="tw-caret" />}</span><span style={SR}>{text}</span></span>
}

/** Everything the card and the sheet show, worked out once from the profile. */
export function useBuddyState({ doneToday = false, plannedToday = false } = {}) {
  const S = useStore(s => s.S)
  const bud = cleanBuddy(S.buddy)
  const xp = totalXP(S.workouts, setsDone)
  const lv = levelOf(xp)
  const last = S.workouts.reduce((m, w) => (w?.d && w.d > m ? w.d : m), '')
  const daysSinceLast = last ? daysBetween(last, todayISO()) : null
  const mood = moodOf({
    active: !!S.active && !S.active.editingWorkoutId, doneToday, plannedToday,
    hour: new Date().getHours(), daysSinceLast, everTrained: S.workouts.length > 0,
  })
  return { S, bud, xp, lv, mood, daysSinceLast }
}

// Lines asked for this session and not answered: not asked again until the app is opened anew,
// so an offline phone or a busy server does not get a request on every visit to Home.
const tried = new Set()

/** The buddy on Home: it, its line of the day, and its level. Tap for its sheet. */
export function BuddyCard({ doneToday, plannedToday, todayName, facts = {} }) {
  const { S, bud, lv, mood, daysSinceLast } = useBuddyState({ doneToday, plannedToday })
  const prof = cleanProfile(S.profile)
  const today = todayISO()
  const key = lineKey(mood, today)
  const [talking, setTalking] = useState(false)
  const line = bud.line?.key === key ? bud.line.text : t(fallbackLine(mood, today), prof.name || t('friend'), todayName || t('Training'))

  // the line of the day, written for this mood by the server (api/buddy-line.js)
  useEffect(() => {
    if (!PERSONAL || !bud.kind || bud.line?.key === key || tried.has(key)) return
    tried.add(key)
    fetch('/api/buddy-line', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buddyName: bud.name, kind: bud.kind, level: lv.level, userName: prof.name, mood, lang: getLang(),
        today: todayName || (plannedToday ? '' : 'rest day'), goal: prof.goal, weekTarget: prof.weekTarget || null,
        streak: streakWeeks(S), hour: new Date().getHours(), daysSinceLast, ...facts,
      }),
    }).then(r => (r.ok ? r.json() : null)).then(d => { if (d?.line) setBuddy({ line: { key, text: d.line } }) }).catch(() => {})
  }, [key, bud.kind])

  // a new level: celebrate once, then remember it
  useEffect(() => {
    if (!bud.kind || lv.level <= bud.level) return
    const from = bud.level
    setBuddy({ level: lv.level })
    if (lv.level > from) levelUpSheet(bud.name, lv.level)
  }, [lv.level, bud.kind])

  if (!bud.kind) return <button type="button" className="bcard meet" onClick={() => meetSheet()}>
    <Buddy mood="new" size={64} />
    <div className="bcard-body"><div className="bcard-name">{t('Meet your buddy')}</div><div className="bcard-line">{t('A companion that cheers you on and grows as you train.')}</div></div>
    <Icon name="chevronRight" className="chev" />
  </button>

  return <button type="button" className="bcard" onClick={buddySheet} aria-label={t('{0}, level {1}', bud.name, lv.level)}>
    <Buddy mood={mood} level={lv.level} size={80} talking={talking} />
    <div className="bcard-body">
      <div className="bcard-bubble"><Typewriter text={line} onTyping={setTalking} /></div>
      <div className="bcard-meta"><b>{bud.name}</b><span>{t('Level {0}', lv.level)}</span></div>
      <div className="bcard-bar" aria-hidden="true"><i style={{ width: lv.pct + '%' }} /></div>
    </div>
  </button>
}

function BuddySheet({ close }) {
  const { S, bud, xp, lv, mood } = useBuddyState()
  const gear = gearFor(lv.level)
  const prs = S.workouts.reduce((n, w) => n + ((w?.prs || []).length), 0)
  return <div className="bsheet">
    <div className="row between" style={{ marginBottom: 4 }}>
      <h3 style={{ margin: 0 }}>{bud.name}</h3>
      <Button size="sm" variant="ghost" onClick={close}>{t('Done')}</Button>
    </div>
    <div className="bsheet-stage"><Buddy mood={mood === 'missing' ? 'missing' : mood === 'sleepy' ? 'sleepy' : 'hyped'} level={lv.level} size={180} interactive /></div>
    <div className="bsheet-level">
      <div className="row between"><b>{t('Level {0}', lv.level)}</b><span className="muted small">{t('{0} / {1} XP', lv.into, lv.need)}</span></div>
      <div className="bcard-bar big"><i style={{ width: lv.pct + '%' }} /></div>
      <p className="sect-f" style={{ padding: '6px 0 0' }}>{t('Every workout, set and record earns XP.')}</p>
    </div>
    <div className="bsheet-stats">
      <div><b>{S.workouts.length}</b><span>{t('Workouts')}</span></div>
      <div><b>{prs}</b><span>{t('Records')}</span></div>
      <div><b>{xp}</b><span>XP</span></div>
    </div>
    <h2 className="sect-t" style={{ marginTop: 16 }}>{t('Gear')}</h2>
    <div className="bsheet-gear">
      {[['band', 3, t('Sweatband')], ['phones', 6, t('Headphones')], ['crown', 10, t('Crown')]].map(([k, at, label]) =>
        <div key={k} className={gear[k] ? 'on' : ''}><Icon name={gear[k] ? 'checkCircle' : 'lock'} /><span>{label}</span><small>{t('Level {0}', at)}</small></div>)}
    </div>
  </div>
}
export const buddySheet = () => useUI.getState().openSheet(close => <BuddySheet close={close} />)

function MeetSheet({ close }) {
  return <>
    <h3>{t('Meet your buddy')}</h3>
    <BuddyPicker onDone={() => { setBuddy({ kind: KIND, name: DEFAULT_NAME, born: todayISO(), level: currentLevel() }); close() }} />
  </>
}
export const meetSheet = () => useUI.getState().openSheet(close => <MeetSheet close={close} />)

function LevelUp({ close, name, level }) {
  useEffect(() => { const a = setTimeout(() => confetti({ count: 120 }), 250); return () => clearTimeout(a) }, [])
  const g = gearFor(level), before = gearFor(level - 1)
  const unlocked = g.crown && !before.crown ? t('Crown') : g.phones && !before.phones ? t('Headphones') : g.band && !before.band ? t('Sweatband') : null
  return <div className="lvlup">
    <div className="lvlup-burst" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--a': i * 30 + 'deg' }} />)}</div>
    <Buddy mood="cheer" level={level} size={150} interactive />
    <div className="lvlup-t">{t('Level {0}!', level)}</div>
    <p className="muted">{unlocked ? t('New gear for {0}: {1}', name, unlocked) : t('{0} is growing with you.', name)}</p>
    <Button variant="primary" onClick={close}>{t('Nice!')}</Button>
  </div>
}
export const levelUpSheet = (name, level) => useUI.getState().openSheet(close => <LevelUp close={close} name={name} level={level} />, { kind: 'center' })
