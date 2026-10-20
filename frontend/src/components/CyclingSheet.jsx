import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtNum, exerciseNameText, todayISO } from '../lib/format.js'
import { exOr, isBodyweightEq } from '../lib/exercises.js'
import { PATTERNS, PATTERN_NAME, PATTERN_ICON, VARIATIONS, STALL_WEEKS, CARRY, cleanCycling, seedCycling, suggestVariations, applySwitch, peakOf, stallWeeks } from '../lib/cycling.js'
import { exercisePicker } from '../sheets.jsx'
import { Section, Row, Switch, Button } from './ui.jsx'
import Icon from './Icon.jsx'
import Buddy from './Buddy.jsx'

// Variation Cycling on the Plan page (lib/cycling.js): the switch, one row per movement pattern
// with its active variation and how long it has gone without a new best, and a sheet per
// pattern to pick the three variations, see their state, or switch by hand.

const update = fn => useStore.getState().update(fn)
const toast = msg => useUI.getState().toast(msg)
const nameOf = id => exerciseNameText(exOr(id))
const STATUS_LABEL = { active: 'Active', pending: 'Pending', stalled: 'Stalled', done: 'Done' }

/** The toasts for switches a review made; shared with the finish of a workout (sheets.jsx). */
export function announceSwitches(switches, unit) {
  for (const sw of switches) toast(sw.carryW > 0
    ? t('{0} has stalled for {1} weeks. Next up: {2}, starting at {3}.', nameOf(sw.from), STALL_WEEKS, nameOf(sw.to), fmtNum(sw.carryW) + ' ' + unit)
    : t('{0} has stalled for {1} weeks. Next up: {2}.', nameOf(sw.from), STALL_WEEKS, nameOf(sw.to)))
}

export function CyclingSection() {
  const S = useStore(s => s.S)
  const c = cleanCycling(S.cycling)
  const turn = on => update(s => { s.cycling = on ? (cleanCycling(s.cycling).patterns.hpress.vars.length ? { ...cleanCycling(s.cycling), on: true } : seedCycling(s, true)) : { ...cleanCycling(s.cycling), on: false } })
  const sub = p => {
    const vars = c.patterns[p].vars
    const a = vars.find(v => v.status === 'active')
    if (!a || vars.length < VARIATIONS) return t('Pick {0} variations', VARIATIONS)
    const weeks = stallWeeks(S, a.id, a.since)
    const peak = peakOf(S, a.id)
    return [nameOf(a.id), peak && fmtNum(peak.w) + ' ' + S.unit + ' × ' + peak.r, t('{0} of {1} weeks without progress', weeks, STALL_WEEKS)].filter(Boolean).join(' · ')
  }
  return <Section title={t('Variation Cycling')} footer={t('Three variations per movement pattern. You stay on one while it moves; three trained weeks without a new best rotate it to the next, starting at {0}% of your peak. Curls and raises are never rotated.', Math.round(CARRY * 100))}>
    <Row icon="swap" iconTint="var(--rest)" title={t('Variation Cycling')} subtitle={c.on ? t('On · only a true plateau switches') : t('Off')}>
      <Switch aria-label={t('Variation Cycling')} checked={c.on} onChange={turn} />
    </Row>
    {c.on && PATTERNS.map(p => <Row key={p} icon={PATTERN_ICON[p]} iconTint="var(--acc)" title={t(PATTERN_NAME[p])} subtitle={sub(p)} accessory="chevron" onClick={() => cyclingSheet(p)} />)}
  </Section>
}

function PatternSheet({ pattern, close }) {
  const S = useStore(s => s.S)
  const c = cleanCycling(S.cycling)
  const vars = c.patterns[pattern].vars
  const active = vars.find(v => v.status === 'active')
  const setVar = (i, id) => update(s => {
    const cc = cleanCycling(s.cycling)
    const list = cc.patterns[pattern].vars
    if (list.some((v, k) => k !== i && v.id === id)) { toast(t('That one is already in this pattern.')); return }
    if (list[i]) list[i] = { ...list[i], id, peakW: null, peakR: null, weeksStalled: 0 }
    else list[i] = { id, status: list.length ? 'pending' : 'active', peakW: null, peakR: null, weeksStalled: 0 }
    s.cycling = cc
  })
  const pick = i => exercisePicker(ex => setVar(i, ex.id), { title: t('Variation {0}', i + 1), like: vars[i]?.id || vars[0]?.id || suggestVariations(S, pattern)[0] })
  const fill = () => update(s => {
    const cc = cleanCycling(s.cycling)
    const ids = suggestVariations(s, pattern, cc.patterns[pattern].vars.map(v => v.id))
    cc.patterns[pattern].vars = ids.map((id, i) => cc.patterns[pattern].vars.find(v => v.id === id) || { id, status: i === 0 && !cc.patterns[pattern].vars.some(v => v.status === 'active') ? 'active' : 'pending', peakW: null, peakR: null, weeksStalled: 0 })
    s.cycling = cc
  })
  // by hand: the active one is done now, whatever the weeks say
  const switchNow = () => {
    if (!active || vars.length < 2) return
    let switches = []
    update(s => {
      const cc = cleanCycling(s.cycling)
      const list = cc.patterns[pattern].vars
      const i = list.findIndex(v => v.status === 'active')
      const j = (i + 1) % list.length
      const peak = peakOf(s, list[i].id)
      list[i].status = 'done'; list[i].peakW = peak?.w ?? list[i].peakW; list[i].peakR = peak?.r ?? list[i].peakR
      list[j].status = 'active'; list[j].weeksStalled = 0; list[j].since = todayISO()
      if (j === 0) list.forEach((x, k) => { if (k !== 0) x.status = 'pending' })
      const unit = s.unit || 'kg'
      const carryW = peak?.w > 0 && !isBodyweightEq(list[j].id) ? Math.round(peak.w * CARRY * 4) / 4 : 0
      switches = [{ pattern, from: list[i].id, to: list[j].id, carryW }]
      applySwitch(s, switches[0])
      s.cycling = cc
    })
    for (const sw of switches) toast(t('Switched to {0}, starting at {1}.', nameOf(sw.to), fmtNum(sw.carryW) + ' ' + (S.unit || 'kg')))
    close()
  }
  const slots = Array.from({ length: VARIATIONS }, (_, i) => vars[i] || null)
  return <div className="cyc-sheet">
    <div className="row between" style={{ marginBottom: 4 }}>
      <h3 style={{ margin: 0 }}>{t(PATTERN_NAME[pattern])}</h3>
      <Button size="sm" variant="ghost" onClick={close}>{t('Done')}</Button>
    </div>
    <div className="cyc-iso"><Buddy mood="hyped" size={56} talking={false} /><p className="muted small">{t('Start with your weakest variation. The others follow as each one stalls.')}</p></div>
    <div className="list grouped cyc-list">
      {slots.map((v, i) => {
        const peak = v && peakOf(S, v.id)
        const weeks = v && v.status === 'active' ? stallWeeks(S, v.id, v.since) : null
        return <div key={i} className={'item cyc-var' + (v ? ' is-' + v.status : ' is-empty')} role="button" tabIndex={0} onClick={() => pick(i)} onKeyDown={e => { if (e.key === 'Enter') pick(i) }}>
          <span className="cyc-n">{i + 1}</span>
          <div className="grow">
            <div className="tt">{v ? nameOf(v.id) : t('Pick a variation')}</div>
            <div className="ss">{v ? [peak && t('Peak {0}', fmtNum(peak.w) + ' ' + S.unit + ' × ' + peak.r), weeks != null && t('{0} of {1} weeks without progress', weeks, STALL_WEEKS)].filter(Boolean).join(' · ') || t(STATUS_LABEL[v.status]) : t('Tap to choose')}</div>
          </div>
          {v && <span className={'tag cyc-tag ' + v.status}>{t(STATUS_LABEL[v.status])}</span>}
          <Icon name="chevronRight" className="chev" />
        </div>
      })}
    </div>
    {vars.length < VARIATIONS && <Button icon="sparkles" onClick={fill} style={{ marginTop: 10 }}>{t('Suggest the rest')}</Button>}
    {active && vars.length >= 2 && <Button variant="tinted" icon="swap" onClick={switchNow} style={{ marginTop: 10 }}>{t('Switch now')}</Button>}
    <p className="sect-f" style={{ marginTop: 12 }}>{t('Switching carries {0}% of the peak over as the new starting weight, in every routine that holds it.', Math.round(CARRY * 100))}</p>
  </div>
}
export const cyclingSheet = pattern => useUI.getState().openSheet(close => <PatternSheet pattern={pattern} close={close} />)

/** The line under an exercise in the workout: where it stands in its pattern's cycle. */
export function cyclingLine(S, exId) {
  const c = cleanCycling(S.cycling)
  if (!c.on) return null
  for (const p of PATTERNS) {
    const i = c.patterns[p].vars.findIndex(v => v.id === exId)
    if (i < 0) continue
    const v = c.patterns[p].vars[i]
    const weeks = v.status === 'active' ? stallWeeks(S, exId, v.since) : null
    return { pattern: p, text: [t(PATTERN_NAME[p]), t('Variation {0}', i + 1) + ' / ' + c.patterns[p].vars.length, weeks != null && t('{0} of {1} weeks without progress', weeks, STALL_WEEKS)].filter(Boolean).join(' · ') }
  }
  return null
}

