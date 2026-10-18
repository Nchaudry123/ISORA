// Cloud save (api/cloud.js): your data, encrypted on this phone, kept in the cloud under a
// recovery code only you hold. The code does both jobs: a hash of it names the backup, a key
// derived from it (PBKDF2 → AES-GCM) encrypts it. The server never sees the code, the key or the
// data — lose the code and the backup cannot be opened, by anyone.
//
// The code lives in this browser's storage (CODE_KEY), not in the profile: an exported backup
// shared with someone must not carry the key to the cloud copy.

export const CODE_KEY = 'isora_cloud_code'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   // no 0/O, 1/I: read aloud or typed from paper
const SALT = new TextEncoder().encode('isora-cloud-v1')
const ITER = 150000

/** A new recovery code: 20 characters (100 bits) in four groups, e.g. 7KQ2M-XW9PA-… */
export function newCode(rand = n => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = rand(20)
  let s = ''
  for (let i = 0; i < 20; i++) s += ALPHABET[bytes[i] % 32]
  return s.match(/.{5}/g).join('-')
}

/** A code as typed (any case, spaces, dashes) in its canonical form, or null if it is not one. */
export function normalizeCode(text) {
  const raw = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (raw.length !== 20 || [...raw].some(c => !ALPHABET.includes(c))) return null
  return raw.match(/.{5}/g).join('-')
}

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
const b64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s) }
const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0))

/** The name the backup is stored under: a SHA-256 of the code, never the code itself. */
export async function idOf(code) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('isora-id:' + code)))
}

async function keyOf(code) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: SALT, iterations: ITER, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** The state as base64 of iv ‖ AES-GCM ciphertext. */
export async function seal(state, code) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(state))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyOf(code), data))
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12)
  return b64(out)
}

/** The state back from seal(); throws if the code is wrong or the data was changed. */
export async function open(sealed, code) {
  const all = unb64(sealed)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await keyOf(code), all.slice(12))
  return JSON.parse(new TextDecoder().decode(pt))
}

// What goes up: the profile without the one session in progress, which belongs to this phone.
export const cloudCopy = S => { const { active, ...rest } = S || {}; return rest }

/** Uploads the state under `code`. Resolves { uploadedAt } or rejects with .code ('not-configured', 'offline', …). */
export async function upload(S, code, f = fetch) {
  const [id, data] = await Promise.all([idOf(code), seal(cloudCopy(S), code)])
  let r
  try { r = await f('/api/cloud?id=' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) }) }
  catch { throw Object.assign(new Error('offline'), { code: 'offline' }) }
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(body.error || 'failed'), { code: body.error || 'failed' })
  return { uploadedAt: body.uploadedAt }
}

/** Downloads and opens the backup for `code`. Rejects with .code 'not-found', 'wrong-code', … */
export async function download(code, f = fetch) {
  const id = await idOf(code)
  let r
  try { r = await f('/api/cloud?id=' + id, { method: 'GET' }) }
  catch { throw Object.assign(new Error('offline'), { code: 'offline' }) }
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(body.error || 'failed'), { code: body.error || 'failed' })
  try { return { state: await open(body.data, code), uploadedAt: body.uploadedAt } }
  catch { throw Object.assign(new Error('wrong-code'), { code: 'wrong-code' }) }
}

export const savedCode = () => { try { return normalizeCode(localStorage.getItem(CODE_KEY)) } catch { return null } }
export const saveCode = code => { try { code ? localStorage.setItem(CODE_KEY, code) : localStorage.removeItem(CODE_KEY) } catch {} }
