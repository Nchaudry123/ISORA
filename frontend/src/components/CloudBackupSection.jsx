import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
import { newCode, normalizeCode, saveCode, savedCode, download } from '../lib/cloud.js'
import { copyText } from '../lib/clipboard.js'
import { confirmSheet } from '../sheets.jsx'
import { backupNow, CLOUD_AT } from './CloudSync.jsx'
import { Section, Row, Switch, Button, TextField } from './ui.jsx'

// Settings → Data & backup → Cloud backup (the personal app): turn the encrypted cloud copy on,
// see and copy the recovery code, back up now, or bring a backup back from a code (lib/cloud.js).

const toast = msg => useUI.getState().toast(msg)
const why = e => e?.code === 'not-configured' ? t('Cloud backup isn’t set up on this server yet.')
  : e?.code === 'not-found' ? t('No backup found for that code.')
    : e?.code === 'wrong-code' ? t('That code doesn’t open this backup.')
      : t('Couldn’t reach the cloud. Check your connection and try again.')

function CodeSheet({ code, close, fresh }) {
  return <div className="cloud-sheet">
    <h3>{t('Your recovery code')}</h3>
    <p className="muted small">{fresh
      ? t('Write it down or keep it in your password manager. It’s the only way to open your backup on a new phone, and nobody can recover it for you.')
      : t('Enter this code on a new phone to bring your data back.')}</p>
    <div className="cloud-code" aria-label={t('Recovery code')}>{code}</div>
    <Button icon="copy" onClick={async () => { await copyText(code); toast(t('Copied')) }}>{t('Copy code')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="primary" onClick={close}>{fresh ? t('I’ve saved it') : t('Done')}</Button>
  </div>
}

function RestoreSheet({ close }) {
  const [v, setV] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    const code = normalizeCode(v)
    if (!code) { toast(t('That isn’t a recovery code. It has 20 letters and numbers.')); return }
    setBusy(true)
    try {
      const { state } = await download(code)
      close()
      confirmSheet({
        title: t('Restore this backup?'), message: t('This replaces all current data on this phone with the cloud backup.'), confirmText: t('Restore'), danger: true,
        onConfirm: () => { useStore.getState().importBackup(state); saveCode(code); toast(t('Backup restored')) },
      })
    } catch (e) { toast(why(e)) } finally { setBusy(false) }
  }
  return <div className="cloud-sheet">
    <h3>{t('Restore from a code')}</h3>
    <TextField value={v} onChange={e => setV(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" aria-label={t('Recovery code')} autoCapitalize="characters" autoComplete="off" />
    <div style={{ height: 12 }} />
    <Button variant="primary" disabled={busy} onClick={go}>{busy ? t('Checking…') : t('Restore')}</Button>
  </div>
}

export default function CloudBackupSection() {
  const [code, setCode] = useState(savedCode)
  const [at, setAt] = useState(() => { try { return localStorage.getItem(CLOUD_AT) } catch { return null } })
  const [busy, setBusy] = useState(false)
  const open = render => useUI.getState().openSheet(render)
  const now = async (c = code) => {
    setBusy(true)
    try { const when = await backupNow({ force: true }); if (when) setAt(when); toast(t('Backed up')) }
    catch (e) { toast(why(e)); if (e?.code === 'not-configured' && c) { /* keep the code; it works once the server is ready */ } }
    finally { setBusy(false) }
  }
  const turnOn = () => {
    const c = newCode()
    saveCode(c); setCode(c)
    open(close => <CodeSheet code={c} close={close} fresh />)
    now(c)
  }
  const turnOff = () => confirmSheet({
    title: t('Turn off cloud backup?'),
    message: t('This phone stops backing up and forgets the code. The last copy stays in the cloud, readable only with the code.'),
    confirmText: t('Turn off'), danger: true,
    onConfirm: () => { saveCode(null); setCode(null) },
  })
  return <Section title={t('Cloud backup')} footer={t('Encrypted on this phone before it’s sent. Only your recovery code can open it, so keep the code somewhere safe.')}>
    <Row icon="cloud" iconTint="var(--blue)" title={t('Back up to the cloud')}
      subtitle={code ? (at ? t('Last backup {0}', new Date(at).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : t('Not backed up yet')) : t('Keeps your data safe if this phone is lost or wiped.')}>
      <Switch aria-label={t('Back up to the cloud')} checked={!!code} onChange={v => (v ? turnOn() : turnOff())} />
    </Row>
    {code && <Row icon="key" iconTint="var(--orange)" title={t('Recovery code')} value={code.slice(0, 5) + '-•••••'} accessory="chevron"
      onClick={() => open(close => <CodeSheet code={code} close={close} />)} />}
    {code && <Row icon="arrowUp" iconTint="var(--green)" title={busy ? t('Backing up…') : t('Back up now')} accessory="chevron" onClick={() => !busy && now()} />}
    <Row icon="download" iconTint="var(--teal)" title={t('Restore from a code')} accessory="chevron" onClick={() => open(close => <RestoreSheet close={close} />)} />
  </Section>
}
