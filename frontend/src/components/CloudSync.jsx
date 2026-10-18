import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { PERSONAL } from '../lib/demo.js'
import { savedCode, upload, cloudCopy } from '../lib/cloud.js'

// Automatic cloud save for the personal app (lib/cloud.js), once a recovery code is set up in
// Settings → Data & backup: a quarter of a minute after the data last changed, and at once when
// the app goes to the background, the encrypted copy is replaced. Nothing is sent while the copy
// is the one already up there, and a failed try (offline) simply waits for the next change.
export const CLOUD_AT = 'isora_cloud_at'
let lastSent = null

export async function backupNow({ force = false } = {}) {
  const code = savedCode()
  if (!code) return null
  const S = useStore.getState().S
  const snap = JSON.stringify(cloudCopy(S))
  if (!force && snap === lastSent) return null
  const r = await upload(S, code)
  lastSent = snap
  const at = r.uploadedAt || new Date().toISOString()
  try { localStorage.setItem(CLOUD_AT, at) } catch {}
  return at
}

export default function CloudSync() {
  useEffect(() => {
    if (!PERSONAL) return
    let timer
    const run = () => backupNow().catch(() => {})
    const unsub = useStore.subscribe((st, prev) => { if (st.S !== prev.S) { clearTimeout(timer); timer = setTimeout(run, 15000) } })
    const onHide = () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); run() } }
    document.addEventListener('visibilitychange', onHide)
    timer = setTimeout(run, 5000)
    return () => { unsub(); clearTimeout(timer); document.removeEventListener('visibilitychange', onHide) }
  }, [])
  return null
}
