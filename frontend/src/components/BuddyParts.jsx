import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, getLang } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { setsDone, streakWeeks } from '../lib/history.js'
import { PERSONAL } from '../lib/demo.js'
import { cleanProfile } from '../lib/profile.js'
import { KINDS, KIND_NAME, DEFAULT_NAMES, cleanBuddy, totalXP, levelOf, gearFor, moodOf, daysBetween, fallbackLine, lineKey } from '../lib/buddy.js'
import Buddy from './Buddy.jsx'
import { Button, TextField } from './ui.jsx'
import Icon from './Icon.jsx'

// The buddy's screens (lib/buddy.js, components/Buddy.jsx): choosing and naming it, its card on
// Home with the line of the day, its sheet, and the level-up moment.

const update = fn => useStore.getState().update(fn)
// the level the workouts so far are worth: a new buddy starts there, so meeting it is no level-up
export const currentLevel = () => levelOf(totalXP(useStore.getState().S.workouts, setsDone)).level
const setBuddy = patch => update(s => { s.buddy = { ...cleanBuddy(s.buddy), ...patch } })

/** Choose one of the four and name it. `onDone(kind, name)` after "Meet …". */
export function BuddyPicker({ initialKind = 'block', initialName = '', onDone, cta }) {
  const [kind, setKind] = useState(initialKind)
  const [name, setName] = useState(initialName)
  const shown = name.trim() || DEFAULT_NAMES[kind]
  return <div className="bpick">
    <div className="bpick-stage"><Buddy kind={kind} mood="hyped" size={150} /></div>
    <div className="bpick-grid" role="radiogroup" aria-label={t('Choose your buddy')}>
      {KINDS.map(k => <button type="button" key={k} role="radio" aria-checked={kind === k} className={'bpick-opt' + (kind === k ? ' on' : '')}
        onClick={() => { setKind(k); if (!name.trim() || Object.values(DEFAULT_NAMES).includes(name.trim())) setName('') }}>
        <Buddy kind={k} mood={kind === k ? 'proud' : 'chill'} size={58} still />
        <span>{t(KIND_NAME[k])}</span>
      </button>)}
    </div>
    <TextField value={name} maxLength={20} placeholder={DEFAULT_NAMES[kind]} aria-label={t('Name your buddy')} onChange={e => setName(e.target.value)} />
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={() => onDone(kind, shown)}>{cta || t('Meet {0}', shown)}</Button>
  </div>
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
    if (lv.level > from) levelUpSheet(bud.kind, bud.name, lv.level)
  }, [lv.level, bud.kind])

  if (!bud.kind) return <button type="button" className="bcard meet" onClick={() => meetSheet()}>
    <Buddy kind="block" mood="new" size={64} />
    <div className="bcard-body"><div className="bcard-name">{t('Meet your buddy')}</div><div className="bcard-line">{t('A companion that cheers you on and grows as you train.')}</div></div>
    <Icon name="chevronRight" className="chev" />
  </button>

  return <button type="button" className="bcard" onClick={buddySheet} aria-label={t('{0}, level {1}', bud.name, lv.level)}>
    <Buddy kind={bud.kind} mood={mood} level={lv.level} size={76} />
    <div className="bcard-body">
      <div className="bcard-bubble">{line}</div>
      <div className="bcard-meta"><b>{bud.name}</b><span>{t('Level {0}', lv.level)}</span></div>
      <div className="bcard-bar" aria-hidden="true"><i style={{ width: lv.pct + '%' }} /></div>
    </div>
  </button>
}

function BuddySheet({ close }) {
  const { S, bud, xp, lv, mood } = useBuddyState()
  const [name, setName] = useState(bud.name)
  const gear = gearFor(lv.level)
  const prs = S.workouts.reduce((n, w) => n + ((w?.prs || []).length), 0)
  return <div className="bsheet">
    <div className="row between" style={{ marginBottom: 4 }}>
      <h3 style={{ margin: 0 }}>{t('Your buddy')}</h3>
      <Button size="sm" variant="ghost" onClick={() => { setBuddy({ name: name.trim() || DEFAULT_NAMES[bud.kind] }); close() }}>{t('Done')}</Button>
    </div>
    <div className="bsheet-stage"><Buddy kind={bud.kind} mood={mood === 'missing' ? 'missing' : 'proud'} level={lv.level} size={160} /></div>
    <TextField value={name} maxLength={20} aria-label={t('Name your buddy')} onChange={e => setName(e.target.value)} onBlur={() => setBuddy({ name: name.trim() || DEFAULT_NAMES[bud.kind] })} />
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
    <div style={{ height: 14 }} />
    <Button icon="swap" onClick={() => { close(); meetSheet(true) }}>{t('Change buddy')}</Button>
  </div>
}
export const buddySheet = () => useUI.getState().openSheet(close => <BuddySheet close={close} />)

function MeetSheet({ close, change }) {
  const bud = cleanBuddy(useStore.getState().S.buddy)
  return <>
    <h3>{change ? t('Change buddy') : t('Meet your buddy')}</h3>
    <BuddyPicker initialKind={bud.kind || 'block'} initialName={change ? bud.name : ''}
      onDone={(kind, name) => { setBuddy({ kind, name, born: bud.born || todayISO(), level: Math.max(bud.level, currentLevel()) }); close() }} cta={change ? t('Save') : undefined} />
  </>
}
export const meetSheet = (change = false) => useUI.getState().openSheet(close => <MeetSheet close={close} change={change} />)

function LevelUp({ close, kind, name, level }) {
  const g = gearFor(level), before = gearFor(level - 1)
  const unlocked = g.crown && !before.crown ? t('Crown') : g.phones && !before.phones ? t('Headphones') : g.band && !before.band ? t('Sweatband') : null
  return <div className="lvlup">
    <div className="lvlup-burst" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--a': i * 30 + 'deg' }} />)}</div>
    <Buddy kind={kind} mood="proud" level={level} size={150} />
    <div className="lvlup-t">{t('Level {0}!', level)}</div>
    <p className="muted">{unlocked ? t('New gear for {0}: {1}', name, unlocked) : t('{0} is growing with you.', name)}</p>
    <Button variant="primary" onClick={close}>{t('Nice!')}</Button>
  </div>
}
export const levelUpSheet = (kind, name, level) => useUI.getState().openSheet(close => <LevelUp close={close} kind={kind} name={name} level={level} />, { kind: 'center' })
