// ISORA's cloud save (Vercel function, /api/cloud?id=…). Stores one encrypted backup per recovery
// code in a private Vercel Blob store. The app encrypts the backup on the phone with a key derived
// from the recovery code before it ever leaves (lib/cloud.js) and names it by a hash of that code,
// so this function, the store and Vercel only ever see an opaque id and ciphertext.
//
//   PUT  { data: base64 }   → saves (overwrites) the backup for that id
//   GET                      → { data, uploadedAt } or 404
//
// Needs BLOB_READ_WRITE_TOKEN (set when a Blob store is connected to the project); without it
// this answers 503 and the app keeps backups on the device only.
import { put, get } from '@vercel/blob'

const ID = /^[0-9a-f]{64}$/
const MAX_B64 = 3_500_000      // under Vercel's 4.5 MB request limit
const pathOf = id => `isora/${id}.bin`

const readAll = async stream => {
  const chunks = []
  for await (const c of stream) chunks.push(Buffer.from(c))
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'not-configured' })
  const id = String(req.query?.id || '')
  if (!ID.test(id)) return res.status(400).json({ error: 'bad-id' })

  try {
    if (req.method === 'PUT') {
      const data = req.body?.data
      if (typeof data !== 'string' || !data || data.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return res.status(400).json({ error: 'bad-data' })
      const blob = await put(pathOf(id), Buffer.from(data, 'base64'), {
        access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/octet-stream',
      })
      return res.status(200).json({ ok: true, uploadedAt: blob.uploadedAt || new Date().toISOString() })
    }
    if (req.method === 'GET') {
      const blob = await get(pathOf(id), { access: 'private', useCache: false })
      if (!blob || blob.statusCode !== 200 || !blob.stream) return res.status(404).json({ error: 'not-found' })
      const buf = await readAll(blob.stream)
      return res.status(200).json({ data: buf.toString('base64'), uploadedAt: blob.blob?.uploadedAt || null })
    }
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'method' })
  } catch (e) {
    if (e?.name === 'BlobNotFoundError') return res.status(404).json({ error: 'not-found' })
    return res.status(500).json({ error: 'failed' })
  }
}
