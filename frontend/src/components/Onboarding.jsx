import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, getLang } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { PERSONAL } from '../lib/demo.js'
import { newProfile } from '../lib/equipment.js'
import { cleanProfile } from '../lib/profile.js'
import { SCRIPT, normalizeProfile, scriptedFocus, pickPlan, resumeScript, unitHint, planShape } from '../lib/onboarding.js'
import { normalizeCode, download, saveCode } from '../lib/cloud.js'
import { loadStarterPlan, PLAN_COPY } from '../sheets.jsx'
import IsoraMark from './IsoraMark.jsx'
import Buddy from './Buddy.jsx'
import { BuddyPicker, currentLevel } from './BuddyParts.jsx'
import { oweTours } from './Tour.jsx'
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
  const root = useRef(null)
  // The overlay is sized to the visual viewport, not the layout one: on iOS the keyboard does not
  // resize the page, it scrolls it, and a plain inset:0 overlay then sat half off-screen with the
  // Home page showing under the composer. The page is pinned meanwhile, so nothing scrolls under.
  useEffect(() => {
    const vv = window.visualViewport
    const el = root.current
    const y = window.scrollY
    document.body.classList.add('ob-open')
    document.body.style.top = -y + 'px'
    const fit = () => {
      if (!el) return
      if (vv) { el.style.height = Math.round(vv.height) + 'px'; el.style.transform = `translateY(${Math.round(vv.offsetTop)}px)` }
      end.current?.scrollIntoView?.({ block: 'end' })
    }
    fit()
    vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit)
    window.addEventListener('orientationchange', fit)
    return () => {
      vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit)
      window.removeEventListener('orientationchange', fit)
      document.body.classList.remove('ob-open'); document.body.style.top = ''
      window.scrollTo(0, y)
    }
  }, [])
  const known = useRef({})          // what the server says the chat has learned so far (api/coach-chat.js)
  const declined = useRef([])
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
  // The scripted chat picks up where the AI one got to (lib/onboarding.js resumeScript): what
  // was answered is kept, and only the open questions are asked — never the name again.
  const toScript = () => {
    mode.current = 'script'
    script.current = resumeScript(known.current, declined.current)
    if (script.current.i >= SCRIPT.length) {
      const p = normalizeProfile(script.current.answers)
      const f = scriptedFocus(p)
      finish({ ...p, ...f }, f.focus)
      return
    }
    askScript()
  }
  const answerScript = text => {
    const st = SCRIPT[script.current.i]
    // a tapped quick reply arrives translated; read it as the English it stands for
    const en = st.quick.find(q => t(q) === text) || text
    const v = st.read(en, S.unit)
    if (v === undefined) { say('coach', t('Sorry, I didn’t catch that.') + ' ' + t(st.ask, script.current.answers.name || '')); return }
    script.current.answers[st.key] = v
    // "176 lb" or "5 ft 11": the app will switch to pounds; "80 kg" keeps kilos
    if ((st.key === 'weightKg' || st.key === 'heightCm') && !script.current.answers.unit) { const u = unitHint(text); if (u) script.current.answers.unit = u }
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
      let data = null
      // one more try after a hiccup (a busy model, a timeout), so a single bad request does not
      // end the AI chat; the scripted one only takes over if the second try fails too
      for (let attempt = 0; attempt < 2 && !data; attempt++) {
        if (attempt) await new Promise(res => setTimeout(res, 1200))
        try {
          const r = await fetch('/api/coach-chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: history.current, known: known.current, declined: declined.current }),
          })
          if (r.status === 503) throw Object.assign(new Error('not-configured'), { final: true })
          if (!r.ok) throw new Error('coach ' + r.status)
          data = await r.json()
        } catch (e) { if (e.final || attempt) throw e }
      }
      if (data.known && typeof data.known === 'object') known.current = { ...known.current, ...data.known }
      if (Array.isArray(data.declined)) declined.current = data.declined
      // the same line twice in a row is the model going round in circles: hand over to the script
      const last = [...history.current].reverse().find(m => m.role === 'assistant')
      if (last && last.content.trim() === String(data.reply || '').trim() && !data.done) throw new Error('repeat')
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
      // the unit they spoke in becomes the app's, before the weigh-in below is written in it
      if (p.unit && p.unit !== s.unit) s.unit = p.unit
      s.profile = cleanProfile({ ...cleanProfile(s.profile), name: p.name, goal: p.goal, weekTarget: p.daysPerWeek,
        heightCm: p.heightCm, experience: p.experience, focus: p.focus, focusAreas: p.focusAreas })
      if (p.weightKg) {
        // in pounds, a kg figure the model rounded comes back a hair off a whole number: snap it
        let w = s.unit === 'lb' ? Math.round(p.weightKg * 2.20462 * 10) / 10 : Math.round(p.weightKg * 10) / 10
        if (s.unit === 'lb' && Math.abs(w - Math.round(w)) <= 0.15) w = Math.round(w)
        s.bodyweight = [...s.bodyweight.filter(b => b.d !== todayISO()), { d: todayISO(), w, t: Date.now() }].sort((a, b) => (a.d < b.d ? -1 : 1))
      }
      if (gear) { s.equipProfiles = [...(s.equipProfiles || []), gear]; s.equipFilterOn = true; s.activeEquipId = gear.id }
      s.onboarded = true
    })
    loadStarterPlan(pickPlan(p), gear, planShape(p))
    oweTours(['home', 'workout'])   // Iso shows the way round, once Home and the first workout are up
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
  if (!picked) return <div className="ob" ref={root} role="dialog" aria-label={t('Welcome to ISORA')}>
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

  return <div className="ob" ref={root} role="dialog" aria-label={t('Welcome to ISORA')}>
    <div className="ob-head">
      <span className="ob-av buddy-av"><Buddy mood={result ? 'proud' : 'hyped'} size={44} talking={busy} /></span>
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
