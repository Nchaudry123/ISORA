// Iso's body, simulated (components/Buddy.jsx draws it). Instead of looping keyframes, every frame
// steps a handful of damped springs and a little gravity, so Iso has weight: a jelly body that
// squashes and wobbles, arms that lag behind and flap, real jumps with a landing, eyes that blink
// and wander, a lean toward whatever it looks at, and a stream of small behaviours picked for its
// mood (dance, wave, spin, head tilt, stretch, yawn …). Pure: the caller owns the clock and the
// random source, which is what the test drives.

const G = 1100                         // gravity, in drawing units (the body is 84 wide) per s²
const SUB = 1 / 120                    // physics substep, s

// what Iso gets up to, by mood, and how long it waits between two things (s)
export const BEHAVIORS = {
  hyped: { list: ['hop', 'dance', 'wave', 'spin', 'look', 'hop', 'tilt'], gap: [1.6, 3.4] },
  cheer: { list: ['hop', 'spin', 'dance', 'hop'], gap: [1, 2.2] },
  proud: { list: ['dance', 'hop', 'wave', 'spin', 'tilt'], gap: [1.8, 3.6] },
  new: { list: ['wave', 'look', 'tilt', 'hop', 'look'], gap: [2.2, 4.4] },
  chill: { list: ['look', 'wave', 'stretch', 'tilt', 'hop', 'look'], gap: [2.6, 5.2] },
  active: { list: ['pump', 'hop', 'nod', 'pump'], gap: [1.8, 3.6] },
  missing: { list: ['look', 'sigh', 'look', 'tilt'], gap: [3, 6] },
  sleepy: { list: ['nod', 'yawn', 'nod'], gap: [4, 8] },
}
const DUR = { hop: 0.7, dance: 2.2, wave: 1.7, spin: 1.1, look: 1.6, tilt: 1.3, stretch: 1.4, pump: 1.1, nod: 1.6, yawn: 2, sigh: 1.8, poke: 0.9 }

// breathing: depth and speed by mood
const BREATH = { active: [0.035, 5.2], sleepy: [0.03, 1.5], hyped: [0.03, 3], cheer: [0.03, 3.4], missing: [0.02, 1.8] }

const between = (rng, [a, b]) => a + rng() * (b - a)

export function initialState(rng = Math.random) {
  return {
    t: 0,
    jy: 0, jv: 0, air: false, airT: 0, airTotal: 1, spinFrom: 0, spinning: false,  // jump (negative is up)
    s: 1, sv: 0,                                                // squash: <1 squashed, >1 stretched
    rot: 0, rv: 0, spin: 0,                                     // lean, degrees, around the feet
    lx: 0, lxv: 0, ly: 0, lyv: 0, tx: 0, ty: 0, nextGaze: 0.8,  // where it looks, −1…1
    al: 0, alv: 0, ar: 0, arv: 0,                               // arms, degrees from hanging
    blink: 1, blinkAt: -1, nextBlink: 1 + rng() * 2.5,
    mouth: 1,                                                   // mouth open-ness multiplier
    beh: null, behT: 0, nextBeh: 0.6 + rng() * 1.6, side: 1,
  }
}

const spring = (st, x, v, target, k, c, dt) => {
  const a = k * (target - st[x]) - c * st[v]
  st[v] += a * dt
  st[x] += st[v] * dt
}

/** Throw Iso up so it rises `h` units; `spin` turns it once round on the way. */
export function jump(st, h, spin = false) {
  if (st.air) { st.jv = Math.min(st.jv, -Math.sqrt(2 * G * h) * 0.8); return }
  st.air = true
  st.jv = -Math.sqrt(2 * G * h)
  st.airT = 0; st.airTotal = 2 * -st.jv / G
  st.sv -= 1.4                       // a quick crouch before it leaves the ground
  st.alv += 260; st.arv -= 260       // the arms fling up
  if (spin) { st.spinning = true; st.spinFrom = st.spin }
}

/** A tap: a squish, a hop, sometimes a spin. */
export function poke(st, rng = Math.random) {
  st.sv -= 3.2
  st.rv += (rng() < 0.5 ? -1 : 1) * 60
  jump(st, 10 + rng() * 6, rng() < 0.25)
  st.beh = 'poke'; st.behT = 0
}

/** A shove from outside (the page scrolled under it): a wobble, no hop. */
export function nudge(st, amount) {
  const a = Math.max(-1, Math.min(1, amount))
  st.sv += a * 1.2
  st.rv += a * 30
}

/**
 * Advance `dt` seconds. `pointer` is {dx, dy} toward the finger (−1…1) while it moves nearby, else
 * null; `talking` opens and shuts the mouth. Returns the pose for the drawing.
 */
export function step(st, { dt, mood = 'chill', pointer = null, talking = false, small = false }, rng = Math.random) {
  dt = Math.min(dt, 0.1)
  const b = BEHAVIORS[mood] || BEHAVIORS.chill
  st.t += dt

  // pick the next thing to do
  if (!st.beh && !small) {
    st.nextBeh -= dt
    if (st.nextBeh <= 0) {
      st.beh = b.list[(rng() * b.list.length) | 0]
      st.behT = 0
      st.side = rng() < 0.5 ? -1 : 1
      st.nextBeh = between(rng, b.gap)
      if (st.beh === 'hop') jump(st, 7 + rng() * 5)
      if (st.beh === 'spin') jump(st, 20, true)
    }
  }
  if (st.beh) {
    st.behT += dt
    if (st.behT >= (DUR[st.beh] || 1)) st.beh = null
  }
  const beh = st.beh, bt = st.behT, side = st.side

  // where it looks: the finger, a behaviour, or a wander
  st.nextGaze -= dt
  if (st.nextGaze <= 0) {
    const centre = rng() < 0.35
    st.tx = centre ? 0 : (rng() * 2 - 1)
    st.ty = centre ? 0 : (rng() * 1.2 - 0.5)
    st.nextGaze = 1.2 + rng() * 2.8
  }
  let gx = st.tx * 0.7, gy = st.ty * 0.6
  if (pointer) { gx = pointer.dx; gy = pointer.dy }
  if (beh === 'look') { gx = side * (bt < 0.8 ? 1 : -0.6); gy = -0.15 }
  if (beh === 'tilt') gy = -0.5
  if (beh === 'sigh' || beh === 'nod') gy = 0.7
  if (mood === 'sleepy') gy = Math.max(gy, 0.4)

  // targets for the springs
  const [depth, speed] = BREATH[mood] || [0.025, 2.2]
  let sT = 1 + depth * Math.sin(st.t * speed)
  let rT = Math.sin(st.t * 0.7) * 2.2 + gx * 3.5
  let alT = Math.sin(st.t * 1.3) * 4, arT = -Math.sin(st.t * 1.1 + 1) * 4
  if (mood === 'cheer') { alT = 95 + 18 * Math.sin(st.t * 9); arT = -95 - 18 * Math.sin(st.t * 9) }
  if (st.air) { sT = 1.08; alT += 55; arT -= 55 }

  switch (beh) {
    case 'dance': {
      const beat = Math.sin(bt * Math.PI * 4)
      rT = beat * 11
      alT = 60 + beat * 45; arT = -60 + beat * 45
      if (!st.air && Math.abs(beat) > 0.97 && bt < DUR.dance - 0.3) jump(st, 4)
      break
    }
    case 'wave': arT = -125 + 28 * Math.sin(bt * 15); rT += -4; break
    case 'tilt': rT = side * 13; break
    case 'look': rT = gx * 7; break
    case 'stretch': { const k = Math.sin(Math.min(1, bt / DUR.stretch) * Math.PI); sT = 1 + 0.13 * k; alT = 120 * k; arT = -120 * k; break }
    case 'pump': { const p = Math.abs(Math.sin(bt * Math.PI * 3.6)); alT = 30 + 90 * p; arT = -30 - 90 * p; sT = 1 - 0.05 * p; break }
    case 'nod': sT = 1 - 0.07 * Math.max(0, Math.sin(bt * Math.PI * 2.5)); rT = 3; break
    case 'yawn': { const k = Math.sin(Math.min(1, bt / DUR.yawn) * Math.PI); sT = 1 + 0.1 * k; alT = 100 * k; arT = -100 * k; break }
    case 'sigh': { const k = Math.sin(Math.min(1, bt / DUR.sigh) * Math.PI); sT = 1 - 0.07 * k; alT = -6; arT = 6; break }
  }

  // integrate in small steps so stiff springs stay stable at any frame rate
  for (let left = dt; left > 1e-6; left -= SUB) {
    const h = Math.min(SUB, left)
    if (st.air) {
      st.jv += G * h; st.jy += st.jv * h; st.airT += h
      if (st.jy >= 0) {
        st.alv -= 180; st.arv += 180     // and flop down as it lands
        // landing: the faster the fall, the bigger the squash
        st.sv -= Math.min(6, st.jv * 0.012)
        st.jy = 0; st.jv = 0; st.air = false
        if (st.spinning) { st.spinning = false; st.spin = st.spinFrom }
      }
    }
    spring(st, 's', 'sv', sT, 260, 9, h)          // jelly: stiff, lightly damped
    spring(st, 'rot', 'rv', rT, 70, 10, h)
    spring(st, 'lx', 'lxv', gx, 90, 14, h)
    spring(st, 'ly', 'lyv', gy, 90, 14, h)
    spring(st, 'al', 'alv', alT, 150, 9, h)
    spring(st, 'ar', 'arv', arT, 150, 9, h)
  }
  // one full turn over the time it is in the air
  if (st.spinning) st.spin = st.spinFrom + 360 * Math.min(1, st.airT / st.airTotal)

  // blinking, now and then twice, not with eyes already shut
  st.nextBlink -= dt
  if (st.nextBlink <= 0) { st.blinkAt = st.t; st.nextBlink = rng() < 0.22 ? 0.28 : 2 + rng() * 3.5 }
  const since = st.t - st.blinkAt
  st.blink = since >= 0 && since < 0.16 ? 1 - 0.9 * Math.sin(since / 0.16 * Math.PI) : 1
  if (mood === 'sleepy' && beh !== 'yawn') st.blink = Math.min(st.blink, 0.55 + 0.1 * Math.sin(st.t))

  st.mouth = talking ? 0.35 + 0.65 * Math.abs(Math.sin(st.t * 13) * Math.sin(st.t * 5.3 + 1))
    : beh === 'yawn' ? 1 + 1.1 * Math.sin(Math.min(1, bt / DUR.yawn) * Math.PI) : 1

  return pose(st)
}

/** What the drawing needs from the state. */
export function pose(st) {
  const s = Math.max(0.7, Math.min(1.3, st.s))
  return {
    jy: st.jy,
    rot: st.rot + st.spin,
    sy: s, sx: 1 + (1 - s) * 0.85,
    lx: st.lx, ly: st.ly,
    al: st.al, ar: st.ar,
    blink: st.blink, mouth: st.mouth,
    shadow: Math.max(0.45, 1 + st.jy / 60),
  }
}
