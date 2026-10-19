import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { fmtDur, fmtVol, todayISO } from '../lib/format.js'
import { setsDone } from '../lib/history.js'
import { WorkoutRow, DayNoteRow, workoutDetailSheet, logPastWorkoutSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { dayNoteOf } from '../lib/day-notes.js'

// Newest first: every workout, and in between them the days off you left a note on (#261). A
// note on a day that has a workout too stays in the day sheet; the workout speaks for that day.
export function historyRows(S) {
  const trained = new Set((S.workouts || []).map(w => w?.d))
  const notes = Object.keys(S.dayNotes || {}).filter(d => !trained.has(d)).map(d => ({ d, note: dayNoteOf(S, d) })).filter(x => x.note)
  const rows = [...(S.workouts || []).map(w => ({ d: w.d, w })), ...notes]
  // Stable, so workouts keep the order they are stored in (by day, then start) within a day.
  return rows.map((r, i) => [r, i]).sort((a, b) => (a[0].d < b[0].d ? 1 : a[0].d > b[0].d ? -1 : b[1] - a[1])).map(([r]) => r)
}

/** The rows by month, newest first, each month with its totals: workouts, time, sets, volume. */
export function historyMonths(rows) {
  const out = []
  for (const r of rows) {
    const key = String(r.d || '').slice(0, 7)
    let m = out[out.length - 1]
    if (!m || m.key !== key) { m = { key, rows: [], workouts: 0, ms: 0, sets: 0, vol: 0 }; out.push(m) }
    m.rows.push(r)
    if (r.w) {
      m.workouts++
      m.ms += Math.max(0, (r.w.end || 0) - (r.w.start || 0))
      m.sets += setsDone(r.w)
      m.vol += Number.isFinite(r.w.vol) ? r.w.vol : 0
    }
  }
  return out
}

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const rows = historyRows(S)
  const months = historyMonths(rows)
  const thisMonth = todayISO().slice(0, 7)
  const label = key => {
    if (key === thisMonth) return t('This month')
    const d = new Date(key + '-15T12:00:00')
    return d.toLocaleDateString(dateLocale(), { month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
  }
  const first = S.workouts.length ? [...S.workouts].map(w => w.d).sort()[0] : null
  return <>
    <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('History')}</h1>
        <div className="sub">{[tn('{0} workout', '{0} workouts', S.workouts.length), first && t('since {0}', new Date(first + 'T12:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: first.slice(0, 4) === todayISO().slice(0, 4) ? undefined : 'numeric' }))].filter(Boolean).join(' · ')}</div></div></div>
    <Button icon="plus" onClick={logPastWorkoutSheet} style={{ marginBottom: 4 }}>{t('Log a past workout')}</Button>
    {/* one grouped list per month, with the month's totals in its heading */}
    {months.length ? months.map(m => <div key={m.key} className="hist-month">
      <div className="hist-m">
        <h3 className="inbox-h">{label(m.key)}</h3>
        {m.workouts > 0 && <span className="hist-m-stats">{[tn('{0} workout', '{0} workouts', m.workouts), m.ms >= 60000 && fmtDur(m.ms), m.sets > 0 && tn('{0} set', '{0} sets', m.sets), fmtVol(m.vol, S.unit)].filter(Boolean).join(' · ')}</span>}
      </div>
      <div className="list grouped">{m.rows.map(r => r.w
        ? <WorkoutRow key={r.w.id} w={r.w} onClick={() => workoutDetailSheet(r.w)} />
        : <DayNoteRow key={'note-' + r.d} iso={r.d} note={r.note} />)}</div>
    </div>)
      : <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet. Your first one will land here.')}</div>}
  </>
}
