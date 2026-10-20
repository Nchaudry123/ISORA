// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TourHost, { startTour, oweTours, owedTours } from './Tour.jsx'

// happy-dom lays nothing out: give every element a box so the tour can find its targets
const box = { top: 100, left: 10, width: 300, height: 48, right: 310, bottom: 148 }
let host, root, screen
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  Element.prototype.getBoundingClientRect = () => box
  Element.prototype.scrollIntoView = () => {}
  screen = document.createElement('div')
  screen.innerHTML = '<div class="setrow next"></div><div class="progline"></div><div class="whdr-finish"></div>'
  document.body.append(screen)
  host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
  oweTours(['workout'])
})
afterEach(() => { act(() => root.unmount()); host.remove(); screen.remove(); vi.useRealTimers() })
const tick = ms => act(() => { vi.advanceTimersByTime(ms) })

describe('Iso’s guide, when the screen moves on without it', () => {
  it('waits out of sight while Rest Blast covers the page, then comes back', () => {
    act(() => root.render(<TourHost />))
    act(() => startTour('workout'))
    expect(host.querySelector('.tour')).toBeTruthy()
    const game = document.createElement('div'); game.id = 'rest-game'; document.body.append(game)
    tick(400)
    expect(host.querySelector('.tour')).toBeNull()
    game.remove()
    tick(400)
    expect(host.querySelector('.tour')).toBeTruthy()
  })

  it('skips a step whose target has gone, and ends once none is left, marking itself done', () => {
    act(() => root.render(<TourHost />))
    act(() => startTour('workout'))
    expect(host.querySelectorAll('.tour-dots i')).toHaveLength(3)
    expect(host.querySelector('.tour-dots i.on')).toBe(host.querySelectorAll('.tour-dots i')[0])
    screen.querySelector('.setrow').remove()            // the set row is gone (the exercise changed)
    tick(400)
    expect(host.querySelector('.tour-dots i.on')).toBe(host.querySelectorAll('.tour-dots i')[1])
    screen.innerHTML = ''                                // the workout screen itself is gone
    tick(400)
    expect(host.querySelector('.tour')).toBeNull()
    expect(owedTours().has('workout')).toBe(false)
  })

  it('ends on another page even though the tab bar, its last target, is everywhere', () => {
    oweTours(['home'])
    screen.innerHTML = '<div class="today-hero"></div><div class="week"></div><div class="bcard"></div><div id="tabbar"><button class="start"></button></div>'
    act(() => root.render(<TourHost />))
    act(() => startTour('home'))
    expect(host.querySelectorAll('.tour-dots i')).toHaveLength(5)
    screen.innerHTML = '<div id="tabbar"><button class="start"></button></div>'   // History: only the tab bar is left
    tick(400)
    expect(host.querySelector('.tour')).toBeNull()
    expect(owedTours().has('home')).toBe(false)
  })
})
