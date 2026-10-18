import { describe, it, expect } from 'vitest'
import { newCode, normalizeCode, idOf, seal, open, cloudCopy, upload, download } from './cloud.js'

describe('cloud save', () => {
  it('makes readable 20-character codes and reads them back however typed', () => {
    const code = newCode()
    expect(code).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/)
    expect(normalizeCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code)
    expect(normalizeCode('too short')).toBeNull()
  })

  it('names a backup by a hash, never by the code', async () => {
    const code = 'ABCDE-FGHJK-LMNPQ-RSTUV'
    const id = await idOf(code)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
    expect(id).not.toContain('ABCDE')
    expect(await idOf(code)).toBe(id)
  })

  it('encrypts so only the same code opens it', async () => {
    const code = newCode()
    const sealed = await seal({ unit: 'kg', workouts: [1, 2] }, code)
    expect(sealed).not.toContain('workouts')
    expect(await open(sealed, code)).toEqual({ unit: 'kg', workouts: [1, 2] })
    await expect(open(sealed, newCode())).rejects.toThrow()
  })

  it('leaves the session in progress on the phone', () => {
    expect(cloudCopy({ active: { id: 1 }, unit: 'kg' })).toEqual({ unit: 'kg' })
  })

  it('round-trips through the endpoint and says why when it cannot', async () => {
    const store = {}
    const fake = async (url, { method, body }) => {
      const id = url.split('id=')[1]
      if (method === 'PUT') { store[id] = JSON.parse(body).data; return { ok: true, json: async () => ({ uploadedAt: 'now' }) } }
      return store[id] ? { ok: true, json: async () => ({ data: store[id], uploadedAt: 'now' }) } : { ok: false, json: async () => ({ error: 'not-found' }) }
    }
    const code = newCode()
    await upload({ unit: 'lb', active: { x: 1 } }, code, fake)
    expect((await download(code, fake)).state).toEqual({ unit: 'lb' })
    await expect(download(newCode(), fake)).rejects.toMatchObject({ code: 'not-found' })
    const off = async () => { throw new TypeError('network') }
    await expect(upload({}, code, off)).rejects.toMatchObject({ code: 'offline' })
  })
})
