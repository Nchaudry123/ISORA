// Iso's body, simulated (components/Buddy.jsx draws it). Instead of looping keyframes, every frame
// steps a handful of damped springs and a little gravity, so Iso has weight: a jelly body that
// squashes and wobbles, arms that lag behind and flap, real jumps with a landing, eyes that blink
// and wander, a lean toward whatever it looks at, and a stream of small behaviours picked for its
// mood (dance, wave, spin, head tilt, stretch, yawn …). The face is simulated too: eyebrows, how
// wide the eyes are and how big the smile, each on a spring, set by the mood and overridden for a
// moment by a reaction (surprise, love, laugh, dizzy, oops). Pure: the caller owns the clock and
// the random source, which is what the test drives.

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

// the face by mood: brow (−1 drooping … 1 raised), browIn (knitted, focused), wide (eye size), smile
const FACE = {
  hyped: { brow: 0.35, browIn: 0, wide: 1.05, smile: 0.7 },
  cheer: { brow: 0.6, browIn: 0, wide: 1.1, smile: 1 },
  proud: { brow: 0.25, browIn: 0, wide: 1, smile: 1 },
  new: { brow: 0.7, browIn: 0, wide: 1.2, smile: 0.3 },
  chill: { brow: 0, browIn: 0, wide: 0.9, smile: 0.4 },
  active: { brow: -0.15, browIn: 1, wide: 0.95, smile: 0.2 },
  missing: { brow: -0.75, browIn: 0.2, wide: 1, smile: 0 },
  sleepy: { brow: -0.4, browIn: 0, wide: 0.6, smile: 0.2 },
}
// reactions: how long they last, and the face they hold (blended in and out)
export const REACTIONS = {
  surprise: { dur: 0.45, brow: 1, browIn: 0, wide: 1.45, smile: 0, o: 1 },
  love: { dur: 1.3, brow: 0.5, browIn: 0, wide: 0.7, smile: 1, hearts: true },
  laugh: { dur: 1.2, brow: 0.4, browIn: 0, wide: 0.35, smile: 1, o: 0.6, shake: true },
  dizzy: { dur: 1.1, brow: 0.9, browIn: 0, wide: 1.1, smile: 0.1, o: 0.5, wobble: true },
  oops: { dur: 0.9, brow: -0.5, browIn: 0.5, wide: 1.15, smile: 0, o: 0.3 },
}

// breathing: depth and speed by mood
const BREATH = { active: [0.035, 5.2], sleepy: [0.03, 1.5], hyped: [0.03, 3], cheer: [0.03, 3.4], missing: [0.02, 1.8] }

const between = (rng, [a, b]) => a + rng() * (b - a)
const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function initialState(rng = Math.random) {
  return {
    t: 0,
    jy: 0, jv: 0, air: false, airT: 0, airTotal: 1, spinFrom: 0, spinning: false,  // jump (negative is up)
    s: 1, sv: 0,                                                // squash: <1 squashed, >1 stretched
    rot: 0, rv: 0, spin: 0,                                     // lean, degrees, around the feet
    lx: 0, lxv: 0, ly: 0, lyv: 0, tx: 0, ty: 0, nextGaze: 0.8,  // where it looks, −1…1
    al: 0, alv: 0, ar: 0, arv: 0,                               // arms, degrees from hanging
    brow: 0, browv: 0, browIn: 0, browInv: 0, wide: 1, widev: 0, smile: 0.4, smilev: 0,
    blink: 1, blinkAt: -1, nextBlink: 1 + rng() * 2.5,
    mouth: 1, o: 0,                                             // mouth open-ness, and the round "o"
    beh: null, behT: 0, nextBeh: 0.6 + rng() * 1.6, side: 1,
    rx: null, rxT: 0,                                           // the reaction running, and for how long
    pokes: [], hearts: [],                                      // recent poke times; hearts in flight {t0, x}
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
  st.alv += 200; st.arv -= 200       // the arms fling up
  if (spin) { st.spinning = true; st.spinFrom = st.spin }
}

/** A reaction, over whatever Iso was doing with its face. */
export function react(st, kind) {
  if (!REACTIONS[kind]) return
  st.rx = kind; st.rxT = 0
  if (REACTIONS[kind].hearts) {
    const n = st.hearts.length ? 2 : 3
    for (let i = 0; i < n; i++) st.hearts.push({ t0: st.t + i * 0.12, x: -14 + i * 14 + (i % 2 ? 4 : -4) })
    st.hearts = st.hearts.slice(-5)
  }
}

/** A tap: a squish, a hop, a surprised face that melts into a happy one; tapped a lot, it laughs. */
export function poke(st, rng = Math.random) {
  st.sv -= 2.6
  st.rv += (rng() < 0.5 ? -1 : 1) * 45
  st.pokes = st.pokes.filter(t => st.t - t < 1.3).concat(st.t)
  if (st.pokes.length >= 3) { st.pokes = []; react(st, 'laugh'); jump(st, 6) }
  else { react(st, 'surprise'); jump(st, 10 + rng() * 6, rng() < 0.25) }
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
 * null; `talking` opens and shuts the mouth (and Iso glances at what it says, `talkSide`).
 * Returns the pose for the drawing.
 */
export function step(st, { dt, mood = 'chill', pointer = null, talking = false, talkSide = 1, small = false }, rng = Math.random) {
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

  // the reaction running, if any: a surprise melts into love
  let rx = st.rx ? REACTIONS[st.rx] : null
  if (rx) {
    st.rxT += dt
    if (st.rxT >= rx.dur) {
      if (st.rx === 'surprise' && st.pokes.length) { st.rx = 'love'; st.rxT = 0; rx = REACTIONS.love; react(st, 'love') }
      else { st.rx = null; rx = null }
    }
  }
  const rxE = rx ? smooth(Math.min(1, st.rxT / 0.12, (rx.dur - st.rxT) / 0.25)) : 0

  // where it looks: the finger, a behaviour, what it is saying, or a wander
  st.nextGaze -= dt
  if (st.nextGaze <= 0) {
    const centre = rng() < 0.35
    st.tx = centre ? 0 : (rng() * 2 - 1)
    st.ty = centre ? 0 : (rng() * 1.2 - 0.5)
    st.nextGaze = 1.2 + rng() * 2.8
  }
  let gx = st.tx * 0.6, gy = st.ty * 0.5
  if (talking) { gx = talkSide * 0.55; gy = -0.1 }
  if (pointer) { gx = pointer.dx; gy = pointer.dy }
  if (beh === 'look') { gx = side * (bt < 0.8 ? 1 : -0.6); gy = -0.15 }
  if (beh === 'tilt') gy = -0.5
  if (beh === 'sigh' || beh === 'nod') gy = 0.7
  if (mood === 'sleepy') gy = Math.max(gy, 0.4)
  if (rx?.wobble) { gx = Math.sin(st.rxT * 22) * 0.9; gy = Math.cos(st.rxT * 17) * 0.4 }

  // targets for the springs
  const [depth, speed] = BREATH[mood] || [0.025, 2.2]
  let sT = 1 + depth * Math.sin(st.t * speed)
  let rT = Math.sin(st.t * 0.55) * 2 + gx * 3
  let alT = Math.sin(st.t * 1.3) * 4, arT = -Math.sin(st.t * 1.1 + 1) * 4
  if (mood === 'cheer') { alT = 95 + 18 * Math.sin(st.t * 9); arT = -95 - 18 * Math.sin(st.t * 9) }
  if (st.air) { sT = 1.08; alT += 55; arT -= 55 }

  const idle = { sT, rT, alT, arT }
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
  if (beh) {
    const d = DUR[beh] || 1
    const e = smooth(Math.min(1, bt / 0.3, (d - bt) / 0.3))
    sT = idle.sT + (sT - idle.sT) * e; rT = idle.rT + (rT - idle.rT) * e
    alT = idle.alT + (alT - idle.alT) * e; arT = idle.arT + (arT - idle.arT) * e
  }
  if (rx?.shake) { rT += Math.sin(st.rxT * 40) * 5 * rxE; sT += Math.sin(st.rxT * 40) * 0.025 * rxE }
  if (st.rx === 'love') { alT = Math.max(alT, 30 * rxE); arT = Math.min(arT, -30 * rxE) }

  // the face: the mood's, with the reaction blended over it
  const face = FACE[mood] || FACE.chill
  let browT = face.brow, browInT = face.browIn, wideT = face.wide, smileT = face.smile, oT = 0
  if (beh === 'tilt' || beh === 'look') browT += 0.4
  if (beh === 'pump') browInT = 1
  if (beh === 'yawn') { wideT = 0.3; browT = 0.3 }
  if (talking) browT += 0.15 * Math.sin(st.t * 7)
  if (rx) {
    browT += (rx.brow - browT) * rxE; browInT += (rx.browIn - browInT) * rxE
    wideT += (rx.wide - wideT) * rxE; smileT += (rx.smile - smileT) * rxE; oT = (rx.o || 0) * rxE
  }

  // integrate in small steps so stiff springs stay stable at any frame rate
  for (let left = dt; left > 1e-6; left -= SUB) {
    const h = Math.min(SUB, left)
    if (st.air) {
      st.jv += G * h; st.jy += st.jv * h; st.airT += h
      if (st.jy >= 0) {
        st.alv -= 140; st.arv += 140     // and flop down as it lands
        // landing: the faster the fall, the bigger the squash
        st.sv -= Math.min(7, st.jv * 0.03)
        st.jy = 0; st.jv = 0; st.air = false
        if (st.spinning) { st.spinning = false; st.spin = st.spinFrom; react(st, 'dizzy') }
      }
    }
    // damping ratios: body 0.5 (a jelly wobble that dies in two swings), lean and arms ~0.65,
    // gaze ~0.9 (eyes glide, they do not bounce); the face is quick and settles without a bounce
    spring(st, 's', 'sv', sT, 220, 15, h)
    spring(st, 'rot', 'rv', rT, 60, 10, h)
    spring(st, 'lx', 'lxv', gx, 55, 13, h)
    spring(st, 'ly', 'lyv', gy, 55, 13, h)
    spring(st, 'al', 'alv', alT, 110, 14, h)
    spring(st, 'ar', 'arv', arT, 110, 14, h)
    spring(st, 'brow', 'browv', browT, 180, 24, h)
    spring(st, 'browIn', 'browInv', browInT, 180, 24, h)
    spring(st, 'wide', 'widev', wideT, 200, 26, h)
    spring(st, 'smile', 'smilev', smileT, 140, 22, h)
  }
  // one full turn over the time it is in the air
  if (st.spinning) st.spin = st.spinFrom + 360 * Math.min(1, st.airT / st.airTotal)
  st.o = oT

  // blinking, now and then twice, not with eyes already shut
  st.nextBlink -= dt
  if (st.nextBlink <= 0) { st.blinkAt = st.t; st.nextBlink = rng() < 0.22 ? 0.28 : 2 + rng() * 3.5 }
  const since = st.t - st.blinkAt
  st.blink = since >= 0 && since < 0.18 ? 1 - 0.9 * smooth(Math.sin(since / 0.18 * Math.PI)) : 1
  if (mood === 'sleepy' && beh !== 'yawn') st.blink = Math.min(st.blink, 0.55 + 0.1 * Math.sin(st.t))

  st.mouth = talking ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(st.t * 11)) * (0.6 + 0.4 * Math.sin(st.t * 4.1 + 1))
    : beh === 'yawn' ? 1 + 1.1 * Math.sin(Math.min(1, bt / DUR.yawn) * Math.PI) : 1
  if (st.rx === 'laugh') st.mouth = 0.8 + 0.5 * Math.abs(Math.sin(st.rxT * 24))

  st.hearts = st.hearts.filter(hh => st.t - hh.t0 < 1.3)
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
    blink: st.blink, mouth: st.mouth, o: st.o,
    brow: st.brow, browIn: st.browIn, wide: Math.max(0.2, st.wide), smile: Math.max(0, Math.min(1, st.smile)),
    hearts: st.hearts.map(hh => ({ k: Math.max(0, Math.min(1, (st.t - hh.t0) / 1.3)), x: hh.x })),
    shadow: Math.max(0.45, 1 + st.jy / 60),
  }
}
