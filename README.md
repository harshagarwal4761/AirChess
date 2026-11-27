# AirChess

**Your next move. In the air.** A full-stack chess web application featuring hands-free webcam gesture controls, a local Stockfish WebAssembly opponent, and real-time online rooms with blitz clocks, spectators, accounts, and Elo ratings.

This is a computer-vision web application, not a physical hologram. You move your hand in front of your webcam; MediaPipe's pretrained hand-landmarker extracts 21 keypoints locally in a Web Worker, a lightweight gesture pipeline drives cursor smoothing and piece selection, and camera frames never leave your device.

## Start here

You can learn the application one layer at a time starting with [the beginner guide](docs/LEARNING.md) and [architecture](docs/ARCHITECTURE.md).

### Clone and run

Install Node.js 22.13 or newer, then run:

```bash
git clone https://github.com/harshagarwal4761/AirChess.git
cd AirChess
npm ci
npm run db:setup
npm run dev
```

Open the address printed by the terminal, normally **http://127.0.0.1:5173**. `db:setup` applies D1 migrations cleanly (safe to repeat; local and hosted databases are separate).

### Play

1. Choose **Pass & play**, **vs Stockfish**, or **Online** in the Game mode card, or make moves directly by mouse, keyboard shortcuts (`?` to view), or webcam.
2. Click **Enable air controls**, then allow camera access. Use a regular desktop browser if an embedded preview restricts webcam permissions.
3. Show your control hand with thumb and index apart until calibrated. In **Steady hover** mode, point at a piece and hold inside its square for 1.1 seconds until the ring fills, then hold on a highlighted destination. Hold a **fist** briefly to cancel your selection.
4. Optional: switch to **Double pinch** in the Air controls panel, or enable two-hand palm pause in Settings (single-hand tracking defaults on for higher frame rates on integrated GPUs).
5. Create an **Online** room (untimed, `3+2`, `5+0`, or `10+0`) and share the invite link (`/?room=CODE`) or spectator link (`/?room=CODE&watch=1`). Optionally sign in to archive games, earn Elo in rated rooms, replay matches (`/?game=<id>`), and appear on the leaderboard.

The first camera activation loads ~19 MB of local MediaPipe model/WASM assets served by the app. Inference runs in a dedicated Web Worker using `requestVideoFrameCallback` (with `requestAnimationFrame` fallback) and skips frames while busy instead of queuing, falling back between GPU and CPU delegates automatically.

**A localhost link only works on your own machine.** To play across separate laptops, both players must open the same HTTPS deployment. GitHub stores the source code; it does not run the backend server.

## Included

- **Three game modes:** Local pass-and-play (with local undo and optional clocks), **vs Stockfish WASM** (`Casual`, `Club`, `Master` presets with local UCI evaluation bar & best-move hints), and **Online rooms** (live SSE updates with polling fallback + read-only spectators).
- **Complete chess rules & analysis:** Castling, en passant, 4-piece promotion modal, automatic checkmate/stalemate/insufficient-material/threefold-repetition/fifty-move draws, live ECO opening detection, interactive move-history scrubbing with auto-scroll, capture/material advantage summary, PGN download, and one-click Copy FEN/PGN.
- **Blitz & rapid clocks:** Server-synced clocks (`3+2`, `5+0`, `10+0`) with increment application, timeout adjudication (`flag` + bare-king draw check), and isolated 100 ms UI updates.
- **Accounts & archives:** Optional guest play alongside salted PBKDF2-SHA256 accounts (`register`/`login`/`logout`/`me`), HTTP-only D1 session cookies, automatic D1 game archiving, K=32 Elo updates, shareable replay URLs, and top-player leaderboard.
- **Custom gesture layer:** Pretrained MediaPipe 21-landmark detection combined with adaptive One-Euro smoothing, geometric pinch hysteresis, a custom 2-layer MLP gesture classifier (`open`, `pinch`, `fist`, `peace`) trained on synthesized palm-basis poses (`npm run train:gestures`), and an optional Settings gesture sample recorder/exporter.
- **Custom themes & modular UI:** SVG Staunton pieces across three board themes (`Emerald`, `Slate`, `Walnut`), continuous `0–100%` board transparency over live camera video, synthesized Web Audio sounds, draggable/nudgeable floating panels (`MovableSurface`), keyboard shortcuts, and custom error/404 pages.

## Verify

```bash
npm run check          # lint + typecheck + unit tests + production build
npm run db:setup       # initialize/migrate local Cloudflare D1 SQLite database
# With `npm run dev` running against local D1:
AIRCHESS_TEST_URL=http://127.0.0.1:5173 npm run test:integration
```

See [TESTING.md](docs/TESTING.md) for automated vs. physical-camera test scope and [PLAN.md](PLAN.md) for the full phased build record.

## Project map

| File | What it does |
| --- | --- |
| `app/page.tsx` | Top-level board coordination, SSE sync, keyboard shortcuts, AI & camera hooks |
| `app/api/rooms/`, `app/api/auth/`, `app/api/games/`, `app/api/health/` | Server-authoritative room actions, SSE stream, auth sessions, archive/leaderboard, D1 health |
| `components/` | Modular UI: `chess-board.tsx` (`MatchClock`), `sidebar-panels.tsx`, `game-modals.tsx`, `profile-modal.tsx`, `movable-surface.tsx`, `chess-pieces.tsx` |
| `hooks/use-hand-tracking.ts`, `hooks/use-stockfish.ts` | Webcam/MediaPipe worker lifecycle & Stockfish WASM worker lifecycle |
| `lib/` | Pure logic: `game.ts`, `room-service.ts`, `auth.ts`, `elo.ts`, `rate-limit.ts`, `openings.ts`, `air-pointer.ts`, `gestures.ts`, `double-pinch.ts`, `gesture-features.ts`, `gesture-classifier.ts`, `stockfish.ts` |
| `workers/` | Dedicated Web Workers bundled for MediaPipe (`hand-tracking.worker.ts`) and Stockfish (`stockfish.worker.ts`) |
| `db/schema.ts`, `drizzle/` | Drizzle SQLite schema (`users`, `sessions`, `rooms`, `games`) and D1 migrations |
| `scripts/` | Worker builds, local D1 migration runner, synthetic gesture classifier trainer, QA build helpers |
| `tests/` | Unit tests (`npm test`) and live HTTP+D1 integration suite (`npm run test:integration`) |

## Portfolio honesty

Describe AirChess accurately: MediaPipe supplies the **pretrained 21-point hand landmark model**, and `chess.js` / `stockfish.js` supply the **chess legality and WASM engine**. On top of those, the application implements server-authoritative room/clock synchronization, PBKDF2 authentication + Elo archiving, real-time SSE streaming, adaptive One-Euro cursor filtering, square-border hysteresis, and a small custom 2-layer MLP gesture classifier trained on 520 synthesized palm-basis poses. Always test real webcam comfort and accuracy yourself before quoting live gesture accuracy numbers.

See [PORTFOLIO.md](docs/PORTFOLIO.md) for a 90-second demo script and architecture Q&A.

### Move the board and panels
Use **Arrange layout** in the top bar. Drag a panel by its labeled handle, or hover over its arrow buttons to nudge it in the air. A focused handle also responds to arrow keys (8px), or Shift+arrow (32px). Click **Done arranging** to resume chess selection. **Reset layout** (or **Settings → Reset panel positions**) restores default positions cleanly within the viewport.

## Developer signature

AirChess is a project by **Harsh Agarwal** ([GitHub](https://github.com/harshagarwal4761)). Open the **HA / by Harsh** button in the header to see the creator card. The knight hides a small Easter egg: activate it three times.
