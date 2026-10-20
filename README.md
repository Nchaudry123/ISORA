# ISORA

**Lift. Rest. Play. Repeat.**

Open it on your phone and add it to your home screen: **https://isora-six.vercel.app**

ISORA takes its name from the Greek *ισορροπία* (isorropía), "balance": the balance between
effort and recovery. It is a gym and body-weight tracker with a buddy who trains with you and a
game built into every rest. Your data stays on your phone (with an encrypted cloud copy if you
turn it on); the public build at the link above needs no account.

## What you get

- **Iso**, your buddy: a small blue block creature with a simulated body (springs, real jumps,
  a wandering gaze) and a face that moves (eyebrows, eyes, smile, reactions). It greets you on
  Home with a line of the day, levels up with your training, cheers when you finish a workout,
  and watches your Rest Blast rounds. One name, Iso.
- **A guided first run**: an animated intro, then Iso asks your name, goal, weight and height
  (in your words: "176 lb" switches the app to pounds), experience, days and equipment, and sets
  up a starter plan. The chat runs on a small model through OpenRouter when the server has a
  key, and on a built-in script when it does not; either way it never repeats a question.
- **Home as an inbox**: today as a hero card (start, resume with progress, see the summary, or
  plan a rest day), the week as story circles, what is coming up, what you did recently.
- **Rest Blast** in every rest (below).
- **Encrypted cloud backup** with a recovery code, dark and light themes on true black and
  white, and 18 languages.

## Rest Blast

Every rest between sets becomes a 3:00 round of **Rest Blast**, a block puzzle in the style of
Block Blast: drag pieces onto an 8×8 board, clear full rows and columns, chain clears for combos.
A lifted piece rides just above your fingertip and drops on the nearest cell that fits; its best
spot pulses on the board, and a tap on a piece sends it straight there (Settings → Rest Blast →
Hints turns that off). The header says which set is up next.

The game is rigged by the rest clock, on purpose:

| Rest elapsed | What you are dealt |
|---|---|
| 0:00 – 1:30 | Only helpful pieces: every tray fits together and leans towards line clears |
| 1:30 – 3:00 | Steadily worse: awkward pieces with few places to go, and towards the end pieces that fit nowhere |
| 3:00 | Nothing fits. The round ends, and it is time for your next set |

The rest bar stays on top (Skip, ±15 s, pause), **Hide** tucks the game away behind a handle on
the rest bar, and Workout settings → **Rest Blast** turns it off and restores your normal rest timer.

- Game logic, the dealer, snapping and hints: [`frontend/src/lib/blockblast.js`](frontend/src/lib/blockblast.js)
- The game screen: [`frontend/src/components/RestGame.jsx`](frontend/src/components/RestGame.jsx)
- Iso: [`frontend/src/lib/iso-motion.js`](frontend/src/lib/iso-motion.js), [`frontend/src/components/Buddy.jsx`](frontend/src/components/Buddy.jsx)

## Everything else

The tracker underneath is [openGym](https://github.com/DuarteSantos8/openGym) by Duarte Santos:
routines and progression rules, guided workouts with supersets and warm-ups, muscle recovery,
1,324 exercises, imports from FitNotes/Strong/Hevy, passkey login, and your data on your server.
Its documentation applies here unchanged: see [docs/UPSTREAM_README.md](docs/UPSTREAM_README.md)
and [docs/](docs/).

```bash
cp .env.example .env
docker compose up -d --build          # full stack

cd frontend && npm install && npm run dev   # frontend only, hot reload
cd frontend && npm test
```

## License

ISORA is a derivative of openGym and is licensed under the
[GNU AGPL v3.0 or later](LICENSE), like the original. If you run a modified version for other
people, you must offer them its source. See [NOTICE.md](NOTICE.md).
