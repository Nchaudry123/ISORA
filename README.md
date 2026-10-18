# ISORA

**Lift. Rest. Play. Repeat.**

ISORA takes its name from the Greek *ισορροπία* (isorropía), "balance": the balance between
effort and recovery. It is a self-hosted gym and body-weight tracker with a game built into the rest.

## Rest Blast

Every rest between sets becomes a 3:00 round of **Rest Blast**, a block puzzle in the style of
Block Blast: drag pieces onto an 8×8 board, clear full rows and columns, chain clears for combos.

The game is rigged by the rest clock, on purpose:

| Rest elapsed | What you are dealt |
|---|---|
| 0:00 – 1:30 | Only helpful pieces: every tray fits together and leans towards line clears |
| 1:30 – 3:00 | Steadily worse: awkward pieces with few places to go, and towards the end pieces that fit nowhere |
| 3:00 | Nothing fits. The round ends, and it is time for your next set |

The rest bar stays on top (Skip, ±15 s, pause), **Hide** tucks the game away without ending the
round, and Workout settings → **Rest Blast** turns it off and restores your normal rest timer.

- Game logic and the dealer: [`frontend/src/lib/blockblast.js`](frontend/src/lib/blockblast.js)
- The game screen: [`frontend/src/components/RestGame.jsx`](frontend/src/components/RestGame.jsx)

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
