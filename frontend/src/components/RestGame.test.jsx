// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RestGame from './RestGame.jsx'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn() }))

let host, root, originalS

beforeEach(() => {
  vi.useFakeTimers()
  originalS = useStore.getState().S
  useStore.setState({ S: { ...originalS, sound: false, restGame: true } })
  useUI.setState({ timer: null, work: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.render(null))
  useUI.getState().stopRest()
  useStore.setState({ S: originalS })
  host.remove()
  vi.useRealTimers()
})

const mount = () => act(() => root.render(<RestGame />))
const game = () => host.querySelector('#rest-game')

describe('RestGame', () => {
  it('opens with a rest, deals three pieces, and closes with the rest', () => {
    mount()
    expect(game()).toBeNull()
    act(() => useUI.getState().startRest(180, 0))
    expect(game()).not.toBeNull()
    expect(host.querySelectorAll('.rb-slot .rb-piece')).toHaveLength(3)
    expect(host.querySelector('.rb-over')).toBeNull()
    act(() => useUI.getState().stopRest())
    expect(game()).toBeNull()
  })

  it('stays away for the switch-sides pause and when turned off', () => {
    mount()
    act(() => useUI.getState().startRest(10, 0, { kind: 'switch' }))
    expect(game()).toBeNull()
    act(() => useUI.getState().stopRest())
    act(() => useStore.setState({ S: { ...useStore.getState().S, restGame: false } }))
    act(() => useUI.getState().startRest(180, 0))
    expect(game()).toBeNull()
  })

  it('at 0:00 ends the round: nothing in the tray fits, and Back to lifting ends the rest', () => {
    mount()
    act(() => useUI.getState().startRest(180, 0))
    act(() => vi.advanceTimersByTime(181000))
    expect(useUI.getState().timer?.ready).toBe(true)
    expect(host.querySelector('.rb-over')?.textContent).toContain('Next set')
    expect(host.querySelectorAll('.rb-slot .rb-piece')).toHaveLength(3)
    const btn = [...host.querySelectorAll('.rb-over button')].find(b => b.textContent.includes('Back to lifting'))
    act(() => btn.click())
    expect(useUI.getState().timer).toBeNull()
    expect(game()).toBeNull()
  })

  it('Hide keeps the round and offers a way back', () => {
    mount()
    act(() => useUI.getState().startRest(180, 0))
    const hide = [...host.querySelectorAll('.rb-head button')].find(b => b.textContent === 'Hide')
    act(() => hide.click())
    expect(game().hidden).toBe(true)
    act(() => host.querySelector('.rb-reopen').click())
    expect(game().hidden).toBe(false)
  })
})
