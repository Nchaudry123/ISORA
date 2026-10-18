import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutines, effectiveRoutineIds, nextTrainingDay, streakWeeks, lastBW, setsDoneActive, setsDone } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekStartOf, weekDayOffset, DAYS, DAYN, exerciseNameText, durPart, fmtVol } from '../lib/format.js'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, starterPlanSheet, bwDeltaColor, weighInsSheet, workoutDetailSheet } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import QueueRow from '../components/QueueRow.jsx'
import { queueOf, queueView, weekTally, pinState } from '../lib/queue.js'
import { scheduleModeOf } from '../lib/rotation.js'
import { useConnectionTrouble } from '../components/SyncBanner.jsx'
import { Button } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf } from '../lib/glyphs.js'
import { dayNoteOf } from '../lib/day-notes.js'
import { cleanStats } from '../lib/blockblast.js'
import { previewOf, comingUp, recentDone, dayDistance, setsLeft } from '../lib/inbox.js'
import { exOr } from '../lib/exercises.js'
import Elapsed from '../components/Elapsed.jsx'
import IsoraMark from '../components/IsoraMark.jsx'
import { Avatar, profileSheet, recordsSheet, recordsOf, setText } from '../components/ProfileSheet.jsx'
import { cleanProfile, greetingFor } from '../lib/profile.js'

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  // The banner switched off and the sync stuck: a dot on the gear (Settings → Show connection status).
  const trouble = useConnectionTrouble()
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  // A weekday can hold several routines. `todayRoutines` is the whole day; `routine` is the
  // first, kept for the one-routine glyph. The derived session name joins them (§9).
  const todayRoutines = effectiveRoutines(S, todayISO())
  const routine = todayRoutines[0] || null
  const todayName = todayRoutines.map(r => r.name).join(' + ')
  // A fulfilled pin (a coach session pinned to today and since done) reads as no override.
  const todayOvr = S.dayPlan[todayISO()] !== undefined && pinState(S, S.dayPlan[todayISO()]) !== 'done'
  // An open editor on a saved workout (lib/session-edit.js) holds S.active too, but it is not a
  // session in progress: the row takes you back to it as an edit, the way the tab bar does.
  const editingSaved = !!S.active?.editingWorkoutId
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const ws = weekStartOf(S)
  // The first day of the shown week. Named for the role, not for Monday — which day that is
  // is the setting.
  const wkStart = new Date(today)
  wkStart.setDate(today.getDate() - weekDayOffset(today.getDay(), ws) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  // The last session logged for today, if any — what the row below reports instead of asking
  // you to start the one you already did. Last wins, so a second session names itself. Only once
  // today's plan is covered, though: a freestyle session on a planned day, or the rotation's
  // first session done when its next one is today's too, leaves the row offering what is still
  // to do, as Start and the progress row already do. A queue session is never "covered" by an
  // earlier workout: the queue only names one it does not count as done yet.
  const loggedToday = S.workouts.filter(w => w.d === todayISO())
  const queueIds = queueOf(S)?.ids || []
  const coveredToday = id => !queueIds.includes(id) && loggedToday.some(w => (Array.isArray(w.routineIds) ? w.routineIds : [w.routineId]).includes(id))
  const doneToday = (todayRoutines.every(r => coveredToday(r.id)) && loggedToday.at(-1)) || null
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(wkStart); d.setDate(wkStart.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineIds(S, iso).length > 0, ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    // A day off with a note (#261) reads as excused, not as a plan that went by.
    const dot = done ? ' done' : dayNoteOf(S, iso) ? ' noted' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} {...tappable(() => dayOverrideSheet(iso))}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${wkStart.getDate()} ${wkStart.toLocaleDateString(dateLocale(), { month: 'short' })} – ${wkEnd.getDate()} ${wkEnd.toLocaleDateString(dateLocale(), { month: 'short' })}`

  // A coach week (S.queue) read through the same tolerant reader QueueRow uses, so a malformed
  // queue from another client shows the weekday dots, never an empty card.
  const queue = queueView(S, todayISO())
  // This card shows one thing or the other — QueueRow for a live queue, or Rotation chosen with
  // nothing built yet (S.scheduleMode), in which case there is no queue for QueueRow to render and
  // an empty-state card takes its place. Plan does the same in rotation mode: no weekday grid, only
  // the days that add a routine the loop does not have (Plan.jsx, "Also on fixed days").
  const rotating = scheduleModeOf(S) === 'rotation'
  // A planner-written queue (no rotationId) still names its weekday when it hasn't started yet —
  // that copy predates rotation and stays as it is. Our own rotation has no weekday of its own
  // (lib/rotation.js): naming one here — including on the pass's own one-day empty gap (THE
  // ONE-DAY BOUNDARY, rotation.js) or before a first routine is even added — would be the
  // fixed-week model leaking into a schedule that was never weekday-based.
  const liveQ = queueOf(S)
  const plannerQueue = !!queue && !liveQ?.rotationId
  // Ownership, not mere presence of a rotationId: a stale id left over from a rebuilt rotation
  // would otherwise still read as "this app manages it" (lib/rotation.js).
  const managedQueue = !!liveQ && !!S.rotation && liveQ.rotationId === S.rotation.id
  // On a rest day, saying when you train next beats leaving the row as a full stop.
  const next = !S.active && !todayRoutines.length && !(rotating && !plannerQueue) ? nextTrainingDay(S, todayISO()) : null
  // The streak card's fraction: this calendar week's workouts over the weekdays with a plan, or,
  // in a coach week, the queue's sessions and your own days together (lib/queue.js weekTally).
  const { done: doneThisWeek, planned: plannedPerWeek } = weekTally(S, todayISO())
  const blast = cleanStats(S.restBlast)
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  // today's session shown right under the week strip
  const onToday = () => { if (S.active) nav('/workout'); else if (todayRoutines.length) startFlow(effectiveRoutineIds(S, todayISO())); else dayOverrideSheet(todayISO()) }
  // A chip on the coach week's progress row starts that one routine, in any order. A session
  // already in progress wins, as on the today row — starting another would overwrite it.
  const onQueueStart = id => { if (S.active) nav('/workout'); else startFlow([id]) }

  // The inbox (lib/inbox.js): coming up and recently done, as message rows under today's.
  const nameOf = id => exerciseNameText(exOr(id))
  const previewText = r => { const p = previewOf(r, nameOf); return p.text + (p.more ? ' ' + t('+{0} more', p.more) : '') }
  const ahead = rotating && !plannerQueue ? [] : comingUp(todayISO(), iso => effectiveRoutines(S, iso), { count: 4 })
  const recent = recentDone(S.workouts, 3)
  const when = iso => {
    const k = dayDistance(iso, todayISO())
    const d = new Date(iso + 'T12:00:00')
    return k === 'today' ? t('Today') : k === 'tomorrow' ? t('Tomorrow') : k === 'yesterday' ? t('Yesterday')
      : k === 'week' ? d.toLocaleDateString(dateLocale(), { weekday: 'short' }) : d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
  }
  const weighedToday = bw && bw.d === todayISO()
  const prof = cleanProfile(S.profile)
  const recs = recordsOf(S)
  const left = setsLeft(S.active)

  return <div className="narrow home-inbox">
    {/* You at the top: your avatar (tap for the profile), a greeting by name once you have
        given one, and how far along your weekly target you are (lib/profile.js). */}
    <div className="hdr home-hdr">
      <Avatar profile={S.profile} size={44} onClick={profileSheet} label={t('Your profile')} />
      <div className="home-hdr-txt">
        <h1 className={!user && prof.name ? 'greet' : undefined}>{user ? t('Hi {0}', user.name) : prof.name ? t(greetingFor(today.getHours()), prof.name) : <span className="brand"><IsoraMark />ISORA</span>}</h1>
        <div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
          {prof.weekTarget > 0 && <span className={'wk-goal' + (doneThisWeek >= prof.weekTarget ? ' met' : '')}>{t('{0} of {1} this week', doneThisWeek, prof.weekTarget)}</span>}</div>
      </div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={trouble ? t('Settings') + ', ' + t('Connection problem') : t('Settings')}><Icon name="gear" />{trouble && <span className="tab-dot" aria-hidden="true" />}</button>
    </div>

    {/* The week as a row of story circles: ringed when planned, filled when done, today bold.
        A coach week or a rotation runs by order, not by weekday, so its progress row stands in
        for the circles (components/QueueRow.jsx). */}
    {rotating ? <div className="card">
      {queue ? <QueueRow S={S} today={todayISO()} onStart={onQueueStart} managed={managedQueue} /> : <div className="empty">
        {t('No rotation yet. Add routines to it in Plan.')}
        <div style={{ marginTop: 10 }}><Button size="sm" variant="tinted" onClick={() => nav('/plan')}>{t('Set up in Plan')}</Button></div>
      </div>}
    </div> : <div className="stories">
      <div className="stories-head">
        <button className="iconbtn sm" onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
        <span className="stories-lbl">{wkLabel}</span>
        <button className="iconbtn sm" onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
      </div>
      <div className="week">{strip}</div>
    </div>}

    <h3 className="inbox-h">{t('Today')}</h3>
    <div className="inbox">
      {/* Once today's session is logged the row stops asking for it (issue #4); a session in
          progress wins, and an open editor on a saved workout reads as an edit. */}
      <div className={'today-row ib-row ' + (S.active ? 'is-active' : doneToday ? 'is-done' : routine ? 'is-train' : 'is-rest')} {...tappable(onToday)}>
        <span className="ib-av">
          <Icon name={S.active ? (editingSaved ? 'pencil' : 'play') : doneToday ? 'checkCircle' : routine ? glyphOf(routine.emoji) : 'moon'} />
        </span>
        <div className="ib-body">
          <div className="ttl">{S.active ? (editingSaved ? S.active.name : t('{0} (in progress)', S.active.name))
            : doneToday ? (doneToday.name ? t('{0} (done)', doneToday.name) : t('Workout done'))
            : routine ? todayName : t('Rest day')}</div>
          {next && !doneToday && <div className="ss">{t('Next session: {0}, {1}', t(DAYN[next.weekday]), next.routine.name)}</div>}
          {/* A moved day says so on the small line, not in the title. */}
          {todayOvr && routine && !doneToday && !S.active && <div className="ss resch">{t('rescheduled')}</div>}
          {S.active && !editingSaved && left > 0 && <div className="pv">{tn('{0} set left', '{0} sets left', left)}</div>}
          {!S.active && routine && !doneToday && <div className="pv">{previewText(routine)}</div>}
        </div>
        <div className="ib-side">
          <span className="ib-time">{S.active && !editingSaved ? <Elapsed start={S.active.start} /> : t('Today')}</span>
          {S.active ? <span className="tag act">{editingSaved ? t('Edit') : t('Resume')}</span>
            : doneToday ? <span className="tag ok">{t('Done')}</span>
            : routine ? <span className="tag acc">{t('Start')}</span>
            : <Icon name="plus" className="chev" />}
        </div>
      </div>
      {/* the weigh-in as a to-do, until today's is logged */}
      {S.showWeightCard !== false && !weighedToday && <div className="ib-row" {...tappable(() => bwSheet())}>
        <span className="ib-av" style={{ background: 'var(--teal)' }}><Icon name="scale" /></span>
        <div className="ib-body"><div className="ib-t">{t('Log today’s weight')}</div>
          <div className="pv">{bw ? t('Last: {0}', fmtNum(bw.w) + ' ' + S.unit + ' · ' + when(bw.d)) : t('No weigh-ins yet')}</div></div>
        <div className="ib-side"><span className="ib-dot" aria-hidden="true" /></div>
      </div>}
    </div>
    {/* Start something else than the plan: the only way to the Start screen on a planned day. */}
    {!S.active && <div className="inbox-door">
      <Button size="sm" variant="ghost" className="dim" icon="swap" onClick={() => nav('/workout')}>
        {t('Choose a different workout')}
      </Button>
    </div>}

    {!S.routines.length && !S.active && (
      <div className="card welcome">
        <div className="big">{t('Welcome!')}</div>
        <div className="muted small" style={{ margin: '6px 0 14px' }}>{t('Set up your weekly routine to get going, or grab a ready-made starter plan.')}</div>
        <Button variant="primary" icon="clipboard" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
    )}

    {ahead.length > 0 && <>
      <h3 className="inbox-h">{t('Coming up')}</h3>
      <div className="inbox">
        {ahead.map(({ iso, routines }) => <div key={iso} className="ib-row" {...tappable(() => dayOverrideSheet(iso))}>
          <span className="ib-av ghost"><Icon name={glyphOf(routines[0].emoji)} /></span>
          <div className="ib-body"><div className="ib-t">{routines.map(r => r.name).join(' + ')}</div><div className="pv">{previewText(routines[0])}</div></div>
          <div className="ib-side"><span className="ib-time">{when(iso)}</span></div>
        </div>)}
      </div>
    </>}

    {recent.length > 0 && <>
      <h3 className="inbox-h">{t('Recent workouts')}</h3>
      <div className="inbox">
        {recent.map(w => <div key={w.id} className="ib-row" {...tappable(() => workoutDetailSheet(w))}>
          <span className="ib-av done"><Icon name="checkCircle" /></span>
          <div className="ib-body"><div className="ib-t">{w.name || t('Workout')}</div>
            <div className="pv">{[...durPart((w.end || 0) - (w.start || 0)), tn('{0} set', '{0} sets', setsDone(w)), w.vol ? fmtVol(w.vol, S.unit) : null].filter(Boolean).join(' · ')}</div></div>
          <div className="ib-side"><span className="ib-time">{when(w.d)}</span>
            {w.prs?.length > 0 && <span className="ib-badge pr"><Icon name="trophy" />{w.prs.length}</span>}</div>
        </div>)}
      </div>
    </>}

    <h3 className="inbox-h">{t('More')}</h3>
    <div className="inbox">
      {/* your personal records, newest first (components/ProfileSheet.jsx) */}
      {recs.length > 0 && <div className="ib-row" {...tappable(recordsSheet)}>
        <span className="ib-av" style={{ background: 'var(--record)', color: '#000' }}><Icon name="trophy" /></span>
        <div className="ib-body"><div className="ib-t">{t('Personal records')}</div>
          <div className="pv">{exerciseNameText(exOr(recs[0].exId))} · {setText(recs[0].set, S.unit)}</div></div>
        <div className="ib-side"><span className="ib-time">{when(recs[0].d)}</span><span className="ib-badge pr">{recs.length}</span></div>
      </div>}
      {/* Rest Blast: the puzzle in every rest, and its record (lib/blockblast.js). */}
      <div className="ib-row rb-home" {...tappable(() => nav('/settings/workout'))}>
        <span className="ib-av" style={{ background: S.restGame !== false ? 'var(--rest)' : 'var(--surface-3)' }}><Icon name="balance" /></span>
        <div className="ib-body"><div className="ib-t">{t('Rest Blast')}</div>
          <div className="pv">{S.restGame !== false
            ? (blast.games ? t('Best {0} · {1} rounds', blast.best, blast.games) : t('A 3:00 round in every rest'))
            : t('Off')}</div></div>
        <div className="ib-side"><Icon name="chevronRight" className="chev" /></div>
      </div>
      {/* the gym check-in cards (QR membership codes); folds away via Settings → Gym check-in */}
      {S.checkIn !== false && <div className="ib-row" {...tappable(() => nav('/checkin'))}>
        <span className="ib-av" style={{ background: 'var(--blue)' }}><Icon name="qr" /></span>
        <div className="ib-body"><div className="ib-t">{t('Check in')}</div><div className="pv">{t('At the gym')}</div></div>
        <div className="ib-side"><Icon name="chevronRight" className="chev" /></div>
      </div>}
      <div className="ib-row" {...tappable(() => calendarSheet())}>
        <span className="ib-av" style={{ background: 'var(--orange)' }}><Icon name="flame" /></span>
        <div className="ib-body"><div className="ib-t">{t('{0} week streak', streakWeeks(S))}</div>
          <div className="pv">{doneThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {tn('{0} workout total', '{0} workouts total', S.workouts.length)}</div></div>
        <div className="ib-side"><Icon name="calendar" className="chev" /></div>
      </div>
    </div>

    {S.showWeightCard !== false && <div className="card bw-card">
      <div className="row between bw-head" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <div className="big">{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem' }}>{S.unit}</span></div>
          {/* only when it actually moved — an unchanged weight used to read as "− 0" */}
          {!!delta && (
            <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
              {fmtNum(Math.abs(delta))}
            </span>
          )}
          <span className="dim small" style={{ marginInlineStart: 'auto' }}>{fmtDate(bw.d, true)}</span>
        </div>
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
        {/* every weigh-in, week by week with its average (Discord 'Weight') */}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
          <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={weighInsSheet}>{t('All weigh-ins')}</Button>
        </div>
      </> : <div className="muted small">{S.weighIn === false
        ? t('No weigh-ins yet. Log your weight to start the curve.')
        : t("No weigh-ins yet. Log your weight to start the curve (we also ask before every workout).")}</div>}
    </div>}
  </div>
}
