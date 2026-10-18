import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, getLang } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { PERSONAL } from '../lib/demo.js'
import { newProfile } from '../lib/equipment.js'
import { cleanProfile } from '../lib/profile.js'
import { SCRIPT, normalizeProfile, scriptedFocus, pickPlan } from '../lib/onboarding.js'
import { normalizeCode, download, saveCode } from '../lib/cloud.js'
import { loadStarterPlan, PLAN_COPY } from '../sheets.jsx'
import IsoraMark from './IsoraMark.jsx'
import Buddy from './Buddy.jsx'
import { BuddyPicker, currentLevel } from './BuddyParts.jsx'
import { cleanBuddy, KIND, DEFAULT_NAME } from '../lib/buddy.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// The first open of the personal app: ISORA's coach greets you in a chat, learns what you train
// for, your weight and height, your level, your days and your equipment, and sets the app up —
// profile, a first weigh-in, an equipment profile, and the starter plan that fits (lib/onboarding.js).
// The coach is an LLM behind /api/coach-chat; when that is not available (no key, offline) the
// same chat runs from the script, so the first open never depends on the network.

const OPENER = (lang, unit, buddy) => `[ISORA was just opened for the first time. App language: ${lang}. Weight unit: ${unit}. In this chat you are ${buddy.name}, my ISORA buddy (a little square blue block creature) that I just met: speak as ${buddy.name}, a warm, playful companion. Greet me and start.]`

export default function Onboarding() {
  const show = useStore(s => PERSONAL && !s.S.onboarded && !s.S.routines.length && !s.S.workouts.length && !s.S.active)
  return show ? <OnboardingChat /> : null
}

function OnboardingChat() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [msgs, setMsgs] = useState([])            // { from: 'coach' | 'me', text }
  const [quick, setQuick] = useState([])
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [result, setResult] = useState(null)       // the profile once the chat has it all
  const [restoring, setRestoring] = useState(false)
  const mode = useRef('ai')
  const [picked, setPicked] = useState(() => !!cleanBuddy(S.buddy).kind)
  const buddy = cleanBuddy(S.buddy)
  const history = useRef(null)
  const script = useRef({ i: 0, answers: {} })
  const end = useRef(null)

  const say = (from, text) => setMsgs(m => [...m, { from, text, id: m.length }])
  useEffect(() => { end.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }) }, [msgs, busy, result])

  // --- the scripted coach -------------------------------------------------
  const askScript = () => {
    const st = SCRIPT[script.current.i]
    // the buddy introduces itself by its own name; the rest of the script uses yours
    say('coach', script.current.i === 0 ? t('Hi, I’m {0}, your ISORA buddy. What should I call you?', cleanBuddy(useStore.getState().S.buddy).name) : t(st.ask, script.current.answers.name || ''))
    setQuick(st.quick.map(q => t(q)))
  }
  const toScript = () => {
    mode.current = 'script'
    script.current = { i: 0, answers: {} }
    askScript()
  }
  const answerScript = text => {
    const st = SCRIPT[script.current.i]
    // a tapped quick reply arrives translated; read it as the English it stands for
    const en = st.quick.find(q => t(q) === text) || text
    const v = st.read(en, S.unit)
    if (v === undefined) { say('coach', t('Sorry, I didn’t catch that.') + ' ' + t(st.ask, script.current.answers.name || '')); return }
    script.current.answers[st.key] = v
    script.current.i++
    if (script.current.i < SCRIPT.length) { askScript(); return }
    const p = normalizeProfile(script.current.answers)
    const f = scriptedFocus(p)
    finish({ ...p, ...f }, f.focus)
  }

  // --- the LLM coach --------------------------------------------------------
  const askAI = async () => {
    setBusy(true); setQuick([])
    try {
      const r = await fetch('/api/coach-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.current }),
      })
      if (!r.ok) throw new Error('coach ' + r.status)
      const data = await r.json()
      history.current.push({ role: 'assistant', content: data.reply })
      if (data.done && data.profile) {
        const p = normalizeProfile(data.profile)
        finish(p.focus ? p : { ...p, ...scriptedFocus(p) }, data.reply)
      } else {
        say('coach', data.reply)
        setQuick(data.quickReplies || [])
      }
    } catch {
      // no key, offline or a bad answer: the scripted coach picks the chat up from the start
      toScript()
    } finally { setBusy(false) }
  }

  // once the buddy is chosen, and once per mount even where React runs effects twice (StrictMode)
  const started = useRef(false)
  useEffect(() => {
    if (!picked || started.current) return
    started.current = true
    history.current = [{ role: 'user', content: OPENER(getLang(), S.unit, cleanBuddy(useStore.getState().S.buddy)) }]
    askAI()
  }, [picked])

  const send = text => {
    const v = String(text || '').trim()
    if (!v || busy || result) return
    say('me', v); setDraft(''); setQuick([])
    if (mode.current === 'ai') { history.current.push({ role: 'user', content: v }); askAI() }
    else answerScript(v)
  }

  const finish = (p, closing) => {
    if (closing && closing !== p.focus) say('coach', closing)
    say('coach', p.focus)
    setResult(p)
  }

  // --- setting the app up ---------------------------------------------------
  const apply = () => {
    const p = result
    const gear = p.equipment.length ? newProfile(t('My equipment')) : null
    if (gear) gear.equipment = p.equipment
    update(s => {
      s.profile = cleanProfile({ ...cleanProfile(s.profile), name: p.name, goal: p.goal, weekTarget: p.daysPerWeek,
        heightCm: p.heightCm, experience: p.experience, focus: p.focus, focusAreas: p.focusAreas })
      if (p.weightKg) {
        const w = s.unit === 'lb' ? Math.round(p.weightKg * 2.20462 * 10) / 10 : p.weightKg
        s.bodyweight = [...s.bodyweight.filter(b => b.d !== todayISO()), { d: todayISO(), w, t: Date.now() }].sort((a, b) => (a.d < b.d ? -1 : 1))
      }
      if (gear) { s.equipProfiles = [...(s.equipProfiles || []), gear]; s.equipFilterOn = true; s.activeEquipId = gear.id }
      s.onboarded = true
    })
    loadStarterPlan(pickPlan(p), gear)
  }
  const skip = () => update(s => { s.onboarded = true })

  const restore = async code => {
    const c = normalizeCode(code)
    if (!c) { useUI.getState().toast(t('That isn’t a recovery code. It has 20 letters and numbers.')); return }
    setBusy(true)
    try {
      const { state } = await download(c)
      saveCode(c)
      useStore.getState().importBackup(state)
      update(s => { s.onboarded = true })
      useUI.getState().toast(t('Welcome back. Your data is restored.'))
    } catch (e) {
      useUI.getState().toast(e.code === 'not-found' ? t('No backup found for that code.') : e.code === 'wrong-code' ? t('That code doesn’t open this backup.') : t('Couldn’t reach the cloud. Check your connection and try again.'))
    } finally { setBusy(false) }
  }

  // first: meet Iso; Iso then runs the chat as itself
  if (!picked) return <div className="ob" role="dialog" aria-label={t('Welcome to ISORA')}>
    <div className="ob-head">
      <span className="ob-av"><IsoraMark size={24} /></span>
      <div className="ob-head-t"><div className="ob-name">{t('Welcome to ISORA')}</div><div className="ob-sub">{t('Your ISORA buddy')}</div></div>
      <button type="button" className="ob-skip" onClick={skip}>{t('Skip')}</button>
    </div>
    <div className="ob-thread ob-pick">
      <p className="ob-pick-intro">{t('This is Iso, your ISORA buddy. Iso cheers you on, keeps an eye on your week and grows as you train.')}</p>
      <BuddyPicker onDone={() => { update(s => { s.buddy = { ...cleanBuddy(s.buddy), kind: KIND, name: DEFAULT_NAME, born: todayISO(), level: currentLevel() } }); setPicked(true) }} />
    </div>
  </div>

  return <div className="ob" role="dialog" aria-label={t('Welcome to ISORA')}>
    <div className="ob-head">
      <span className="ob-av buddy-av"><Buddy mood={busy ? 'active' : result ? 'proud' : 'hyped'} size={44} /></span>
      <div className="ob-head-t"><div className="ob-name">{buddy.name}</div><div className="ob-sub">{busy ? t('typing…') : t('Your ISORA buddy')}</div></div>
      <button type="button" className="ob-skip" onClick={skip}>{t('Skip')}</button>
    </div>

    <div className="ob-thread">
      {msgs.map(m => <div key={m.id} className={'ob-msg ' + m.from}>{m.text}</div>)}
      {busy && <div className="ob-msg coach typing" aria-label={t('typing…')}><i /><i /><i /></div>}
      {result && <div className="ob-card">
        <div className="ob-card-t">{t('Your plan')}</div>
        <div className="ob-card-plan">{PLAN_COPY[pickPlan(result)]().name} · {t('{0} days a week', result.daysPerWeek)}</div>
        {result.focusAreas.length > 0 && <div className="ob-areas">{result.focusAreas.map(a => <span key={a}>{a}</span>)}</div>}
        <Button variant="primary" icon="check" onClick={apply}>{t('Set me up')}</Button>
        <Button variant="ghost" onClick={() => { setResult(null); setMsgs([]); history.current = history.current.slice(0, 1); script.current = { i: 0, answers: {} }; mode.current === 'ai' ? askAI() : toScript() }}>{t('Start over')}</Button>
      </div>}
      <div ref={end} />
    </div>

    {!result && <div className="ob-foot">
      {quick.length > 0 && <div className="ob-quick">{quick.map(q => <button type="button" key={q} onClick={() => send(q)}>{q}</button>)}</div>}
      <form className="ob-compose" onSubmit={e => { e.preventDefault(); send(draft) }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('Message')} aria-label={t('Message')} maxLength={300} enterKeyHint="send" />
        <button type="submit" className="ob-send" disabled={!draft.trim() || busy} aria-label={t('Send')}><Icon name="arrowUp" /></button>
      </form>
      {restoring
        ? <form className="ob-restore" onSubmit={e => { e.preventDefault(); restore(new FormData(e.currentTarget).get('code')) }}>
          <input name="code" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" aria-label={t('Recovery code')} autoCapitalize="characters" autoComplete="off" />
          <Button size="sm" variant="tinted" type="submit">{t('Restore')}</Button>
        </form>
        : <button type="button" className="ob-link" onClick={() => setRestoring(true)}>{t('I have a recovery code')}</button>}
    </div>}
  </div>
}
