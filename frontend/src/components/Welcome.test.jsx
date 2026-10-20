// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Welcome, { WelcomeHost, showWelcome } from './Welcome.jsx'

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const text = () => host.textContent
const click = el => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const swipe = (from, to) => act(() => {
  const el = host.querySelector('.wel')
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: from, clientY: 300, pointerType: 'touch', button: 0 }))
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: to, clientY: 306, pointerType: 'touch', button: 0 }))
})

describe('the welcome', () => {
  it('walks four screens with Next or a swipe, and ends on Let’s go', () => {
    const onDone = vi.fn()
    act(() => root.render(<Welcome onDone={onDone} />))
    expect(text()).toContain('Hi, I’m Iso.')
    expect(host.querySelectorAll('.wel-dots i')).toHaveLength(4)
    expect(host.querySelector('.wel-dots i.on')).toBe(host.querySelectorAll('.wel-dots i')[0])

    click(host.querySelector('.wel-next'))
    expect(text()).toContain('Rest Blast')
    expect(host.querySelector('.wel-board')).toBeTruthy()

    swipe(300, 80)                        // left: forward
    expect(text()).toContain('A plan that keeps up.')
    swipe(80, 300)                        // right: back
    expect(text()).toContain('Rest Blast')
    swipe(300, 290)                       // a tap, not a swipe
    expect(text()).toContain('Rest Blast')

    click(host.querySelector('.wel-next')); click(host.querySelector('.wel-next'))
    expect(text()).toContain('Find your balance.')
    expect(host.querySelector('.wel-next').textContent).toBe('Let’s go')
    expect(host.querySelector('.wel-skip').textContent).toBe('')
    expect(onDone).not.toHaveBeenCalled()
    click(host.querySelector('.wel-next'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('skips from any screen', () => {
    const onDone = vi.fn()
    act(() => root.render(<Welcome onDone={onDone} />))
    click(host.querySelector('.wel-skip'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('plays again from Settings over the app, and Done closes it', () => {
    act(() => root.render(<WelcomeHost />))
    expect(host.querySelector('.wel')).toBeNull()
    act(() => showWelcome())
    expect(host.querySelector('.wel.replay')).toBeTruthy()
    expect(document.body.classList.contains('ob-open')).toBe(true)
    for (let k = 0; k < 3; k++) click(host.querySelector('.wel-next'))
    expect(host.querySelector('.wel-next').textContent).toBe('Done')
    click(host.querySelector('.wel-next'))
    expect(host.querySelector('.wel')).toBeNull()
    expect(document.body.classList.contains('ob-open')).toBe(false)
  })
})
