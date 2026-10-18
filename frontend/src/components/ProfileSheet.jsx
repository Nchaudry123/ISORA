import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
import { fmtNum, exerciseNameText } from '../lib/format.js'
import { exOr } from '../lib/exercises.js'
import { bestSetFor } from '../lib/exercise-history.js'
import { cleanProfile, initialOf, GOALS, GOAL_NAME, AVATARS, personalRecords } from '../lib/profile.js'
import { Button, TextField } from './ui.jsx'
import Icon from './Icon.jsx'

// You, in the app (lib/profile.js): the avatar on Home, the profile sheet that sets it, and the
// list of your personal records.

/** Your avatar: the picture you chose, else your initial, else a person outline. */
export function Avatar({ profile, size = 40, onClick, label }) {
  const p = cleanProfile(profile)
  const Tag = onClick ? 'button' : 'span'
  const initial = initialOf(p.name)
  return (
    <Tag className={'avatar' + (p.avatar ? ' pic' : initial ? ' ini' : '')} style={{ '--sz': size + 'px' }}
      onClick={onClick} aria-label={onClick ? label : undefined} aria-hidden={onClick ? undefined : 'true'} type={onClick ? 'button' : undefined}>
      {p.avatar || initial || <Icon name="personCircle" />}
    </Tag>
  )
}

function ProfileSheet({ close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const p = cleanProfile(S.profile)
  const [name, setName] = useState(p.name)
  const save = patch => update(s => { s.profile = cleanProfile({ ...cleanProfile(s.profile), ...patch }) })
  const done = () => { save({ name }); close() }
  return <div className="profile-sheet">
    <div className="row between" style={{ marginBottom: 6 }}>
      <h3 style={{ margin: 0 }}>{t('Your profile')}</h3>
      <Button size="sm" variant="ghost" onClick={done}>{t('Done')}</Button>
    </div>
    <div className="pf-hero"><Avatar profile={{ ...p, name }} size={76} /></div>
    <TextField value={name} maxLength={40} placeholder={t('Your name')} aria-label={t('Your name')}
      onChange={e => setName(e.target.value)} onBlur={() => save({ name })} />
    {p.focus && <div className="pf-focus">
      <div className="pf-focus-t">{t('Your focus')}</div>
      <p>{p.focus}</p>
      {p.focusAreas.length > 0 && <div className="ob-areas">{p.focusAreas.map(a => <span key={a}>{a}</span>)}</div>}
    </div>}

    <h2 className="sect-t pf-h">{t('Avatar')}</h2>
    <div className="pf-grid">
      <button type="button" className={'pf-opt' + (!p.avatar ? ' on' : '')} onClick={() => save({ avatar: '' })} aria-label={t('Your initial')}>
        <Avatar profile={{ name }} size={44} />
      </button>
      {AVATARS.map(a => <button type="button" key={a} className={'pf-opt' + (p.avatar === a ? ' on' : '')} onClick={() => save({ avatar: a })}>
        <span className="avatar pic" style={{ '--sz': '44px' }}>{a}</span>
      </button>)}
    </div>

    <h2 className="sect-t pf-h">{t('What you train for')}</h2>
    <div className="pf-chips">
      {GOALS.map(g => <button type="button" key={g} className={'pf-chip' + (p.goal === g ? ' on' : '')} onClick={() => save({ goal: p.goal === g ? null : g })}>{t(GOAL_NAME[g])}</button>)}
    </div>

    <h2 className="sect-t pf-h">{t('Workouts a week')}</h2>
    <div className="pf-chips">
      {[1, 2, 3, 4, 5, 6, 7].map(n => <button type="button" key={n} className={'pf-chip num' + (p.weekTarget === n ? ' on' : '')} onClick={() => save({ weekTarget: p.weekTarget === n ? 0 : n })}>{n}</button>)}
    </div>
    <p className="sect-f">{t('Home shows how far along the week you are.')}</p>
  </div>
}
export const profileSheet = () => useUI.getState().openSheet(close => <ProfileSheet close={close} />)

/** A best set in words: 100 kg × 5, 1:30 hold, 25 min. */
export function setText(set, unit) {
  if (!set) return ''
  if (set.min) return t('{0} min', fmtNum(set.min))
  if (set.sec) return (set.w ? fmtNum(set.w) + ' ' + unit + ' · ' : '') + Math.floor(set.sec / 60) + ':' + String(set.sec % 60).padStart(2, '0')
  return (set.w ? fmtNum(set.w) + ' ' + unit + ' × ' : '') + (set.r || 0) + (set.w ? '' : ' ' + t('reps'))
}

export const recordsOf = S => personalRecords(S.workouts, id => bestSetFor(S, id))

function RecordsSheet({ close }) {
  const S = useStore(s => s.S)
  const recs = recordsOf(S)
  return <>
    <div className="row between" style={{ marginBottom: 10 }}>
      <h3 style={{ margin: 0 }}>{t('Personal records')}</h3>
      <Button size="sm" variant="ghost" onClick={close}>{t('Done')}</Button>
    </div>
    {recs.length ? <div className="list">
      {recs.map(r => <div key={r.exId} className="item">
        <span className="lrow-i pr-av"><Icon name="trophy" /></span>
        <div className="grow"><div className="tt">{exerciseNameText(exOr(r.exId))}</div>
          <div className="ss">{new Date(r.d + 'T12:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
        <span className="pr-val">{setText(r.set, S.unit)}</span>
      </div>)}
    </div> : <div className="empty muted">{t('Your records show up here once a workout beats your best.')}</div>}
  </>
}
export const recordsSheet = () => useUI.getState().openSheet(close => <RecordsSheet close={close} />)
