// Block confetti: little rounded squares, the blocks of the logo and of Rest Blast, thrown up
// from a point and falling with a tumble. One full-screen canvas per burst, gone when the last
// block has fallen. Nothing under reduced motion.

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const css = (name, fallback) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback } catch { return fallback }
}

/**
 * Throw a burst of blocks.
 * @param {{x?:number, y?:number, count?:number, spread?:number, power?:number, colors?:string[]}} o
 *   x, y in px (default: the middle of the screen, a little high); spread in degrees around up.
 */
export function confetti({ x, y, count = 90, spread = 70, power = 1, colors } = {}) {
  if (typeof document === 'undefined' || reduced()) return
  const cv = document.createElement('canvas')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = window.innerWidth, H = window.innerHeight
  cv.width = W * dpr; cv.height = H * dpr
  cv.className = 'fx-confetti'
  cv.setAttribute('aria-hidden', 'true')
  document.body.appendChild(cv)
  const ctx = cv.getContext('2d')
  if (!ctx) { cv.remove(); return }
  ctx.scale(dpr, dpr)
  const pal = colors || [css('--acc', '#0a84ff'), css('--rest', '#a78bfa'), '#ffd23f', '#ffffff', '#ff7aa8', '#5ad1ff']
  const ox = x ?? W / 2, oy = y ?? H * 0.42
  const parts = Array.from({ length: count }, () => {
    const a = (-90 + (Math.random() - 0.5) * spread * 2) * Math.PI / 180
    const v = (7 + Math.random() * 9) * power
    return {
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      s: 5 + Math.random() * 6, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      tilt: Math.random() * 6.28, vt: 0.05 + Math.random() * 0.12,
      c: pal[(Math.random() * pal.length) | 0], life: 0,
    }
  })
  let last = performance.now()
  const step = now => {
    const dt = Math.min(2.5, (now - last) / 16.67); last = now
    ctx.clearRect(0, 0, W, H)
    let alive = 0
    for (const p of parts) {
      p.life += dt
      p.vy += 0.32 * dt; p.vx *= Math.pow(0.985, dt); p.vy *= Math.pow(0.99, dt)
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.tilt += p.vt * dt
      if (p.y > H + 20) continue
      alive++
      const fade = p.life > 120 ? Math.max(0, 1 - (p.life - 120) / 40) : 1
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.abs(Math.cos(p.tilt)) * 0.8 + 0.2)
      ctx.fillStyle = p.c
      const s = p.s, rr = s * 0.28
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, rr); else ctx.rect(-s / 2, -s / 2, s, s)
      ctx.fill()
      ctx.restore()
    }
    if (alive && parts[0].life < 200) requestAnimationFrame(step); else cv.remove()
  }
  requestAnimationFrame(step)
}

/** A burst from the middle of an element (a button, a card, the board). */
export function confettiFrom(el, o = {}) {
  const r = el?.getBoundingClientRect?.()
  confetti(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, ...o } : o)
}
