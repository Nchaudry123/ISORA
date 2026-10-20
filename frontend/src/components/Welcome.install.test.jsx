// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// the personal build, in an iPhone's Safari tab
vi.mock('../lib/demo.js', () => ({ DEMO: true, PERSONAL: true, DEMO_SEEDED: 'gym_demo_seeded_v1', REPO: '' }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
const { default: Welcome } = await import('./Welcome.jsx')

let host, root
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(navigator, 'userAgent', { value: IPHONE, configurable: true })
  localStorage.removeItem('isora_install_later_v2')
  host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })
const click = el => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))

describe('the welcome in a phone’s browser tab', () => {
  it('adds a home-screen screen before the last, with Safari’s steps', () => {
    act(() => root.render(<Welcome onDone={() => {}} />))
    expect(host.querySelectorAll('.wel-dots i')).toHaveLength(5)
    for (let k = 0; k < 3; k++) click(host.querySelector('.wel-next'))
    expect(host.querySelector('.wel-title').textContent).toBe('Put ISORA on your home screen.')
    expect(host.querySelector('.wel-body').textContent).toMatch(/Share at the bottom of Safari/)
    expect(host.querySelector('.wel-phone.is-ios .wel-phone-share')).toBeTruthy()
    expect(host.querySelector('.is-up')).toBeNull()
    click(host.querySelector('.wel-next'))
    expect(host.querySelector('.wel-title').textContent).toBe('Find your balance.')
  })

  it('tells another iOS browser to use Safari, and Android where its menu is', () => {
    Object.defineProperty(navigator, 'userAgent', { value: IPHONE.replace('Version/26.0', 'CriOS/130.0'), configurable: true })
    act(() => root.render(<Welcome onDone={() => {}} />))
    for (let k = 0; k < 3; k++) click(host.querySelector('.wel-next'))
    expect(host.querySelector('.wel-body').textContent).toMatch(/^Open this page in Safari/)
    act(() => root.unmount()); root = createRoot(host)
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', configurable: true })
    act(() => root.render(<Welcome onDone={() => {}} />))
    for (let k = 0; k < 3; k++) click(host.querySelector('.wel-next'))
    expect(host.querySelector('.wel-body').textContent).toMatch(/^Tap ⋮ at the top/)
    expect(host.querySelector('.wel-slide.is-install.is-up .wel-phone.is-android')).toBeTruthy()
  })

  it('leaves the screen out once the app runs from its icon, or after Later', () => {
    localStorage.setItem('isora_install_later_v2', String(Date.now()))
    act(() => root.render(<Welcome onDone={() => {}} />))
    expect(host.querySelectorAll('.wel-dots i')).toHaveLength(4)
  })
})
