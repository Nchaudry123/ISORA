import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { PERSONAL } from '../lib/demo.js'
import { setUp } from '../lib/onboarding.js'
import { MOBILE } from '../lib/mobile.js'
import { shouldOfferInstall, deviceOf, putOffNow, canPromptInstall, promptInstall, isStandalone, installState } from '../lib/install.js'

const isPhoneTab = () => installState() === 'tab'
import Buddy from './Buddy.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// "Add ISORA to your home screen", on Home, when the app runs in a phone's browser tab rather
// than from its icon (lib/install.js). iPhone: the Share → Add to Home Screen steps (Safari
// only; another iOS browser is told to open the page in Safari). Android: the browser's own
// install dialog when it offered one, the ⋮ menu steps otherwise. Later puts it away for a
// week, but only the card: it folds into a one-line pill that stays until the app runs from the
// icon, so the way to the home screen is never more than a tap away.

export default function InstallBanner() {
  const onboarded = useStore(s => setUp(s.S))
  const offer = PERSONAL && !MOBILE && isPhoneTab()
  const [show, setShow] = useState(() => PERSONAL && !MOBILE && shouldOfferInstall())
  const [gone, setGone] = useState(false)   // launched from the icon meanwhile
  const [canPrompt, setCanPrompt] = useState(canPromptInstall)
  const dev = deviceOf()
  // the Android prompt may arrive a moment after the page does
  useEffect(() => {
    if (!show || dev.os !== 'android') return
    const id = setInterval(() => { if (canPromptInstall()) { setCanPrompt(true); clearInterval(id) } }, 800)
    return () => clearInterval(id)
  }, [show])
  // launched from the icon meanwhile (another tab): nothing to ask
  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)')
    const on = () => { if (isStandalone()) { setShow(false); setGone(true) } }
    mq?.addEventListener?.('change', on)
    return () => mq?.removeEventListener?.('change', on)
  }, [])
  if (!onboarded || !offer || gone) return null
  const later = () => { putOffNow(); setShow(false) }
  if (!show) return <button type="button" className="inst-pill" onClick={() => setShow(true)}>
    <Icon name={dev.os === 'ios' ? 'share' : 'download'} /><span>{t('Not on your home screen yet')}</span><b>{t('Add')}</b>
  </button>
  const install = async () => { const ok = await promptInstall(); if (ok) setShow(false); else setCanPrompt(false) }
  const steps = dev.os === 'ios'
    ? (dev.safari ? t('Tap Share, then “Add to Home Screen”.') : t('Open this page in Safari first, then Share → Add to Home Screen.'))
    : t('Tap ⋮, then “Add to Home screen”.')
  // Safari's Share sits at the bottom of an iPhone screen; Chrome's ⋮ at the top right
  const point = dev.os === 'ios' ? 'down' : 'up'
  return <div className="inst" role="region" aria-label={t('Add ISORA to your home screen')}>
    <div className="inst-iso"><Buddy mood="hyped" size={58} point={point} /></div>
    <div className="inst-body">
      <div className="inst-t">{t('Add ISORA to your home screen')}</div>
      <div className="inst-s">{t('Full screen, works offline, one tap away. Like a real app.')}</div>
      <div className="inst-steps">{dev.os === 'ios' && dev.safari && <Icon name="share" />}{steps}</div>
      <div className="inst-acts">
        {canPrompt && <Button size="sm" variant="primary" icon="download" onClick={install}>{t('Install')}</Button>}
        <Button size="sm" variant="ghost" onClick={later}>{t('Later')}</Button>
      </div>
    </div>
    <button type="button" className="inst-x" aria-label={t('Later')} onClick={later}><Icon name="xmark" /></button>
  </div>
}
