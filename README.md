# AirChess

**Your next move. In the air.** A webcam chess app with double-pinch controls, a translucent camera overlay, and online rooms for two players.

This is a computer-vision application, not a physical hologram. You look at the screen and move your hand in front of the webcam. MediaPipe's pretrained model runs locally in the browser; your camera frames are never uploaded by AirChess.

## Start here

You do **not** need to know ML to use this. You can learn the application one layer at a time. Start with [the beginner guide](docs/LEARNING.md), then [architecture](docs/ARCHITECTURE.md).

### Run this existing checkout

Node.js 22.13 or newer is required. The dependencies and local database have already been prepared in this workspace.

```bash
cd "/home/harsh/chess ml/airchess"
npm run dev
```

Open the address printed by the terminal, normally **http://127.0.0.1:5173**. Keep that terminal running. A second dev server will not start on top of the first one.

### Set up a fresh copy

```bash
npm ci
npm run build
npm run db:setup
npm run dev
```

`db:setup` creates the local database using the generated migrations and records which migrations have run. It is safe to repeat. Local and hosted databases are separate.

### Play

1. Try a few moves by clicking a piece and a highlighted destination.
2. Click **Enable air controls**, then allow camera access. Use a regular desktop browser if the embedded preview cannot open your camera.
3. Show only your chosen control hand with its palm open until calibrated. Aim at the center of a piece until its square is marked ready. Close and reopen thumb/index twice to select it; aim at a highlighted destination and repeat. Keep your palm still through each double pinch.
4. Optional: open your second palm to make the selected piece float and its legal destinations glow. This hand never selects pieces.
5. Hold an open fingertip over a button for 1.3 seconds to activate it. A border shows the dwell timer. Move away before activating that button again.
6. Create a room and share its link or six-digit code. Your friend joins from their laptop and plays Black. Their camera is independent of yours.

The first camera permission prompt needs a click. The model/wasm download is about 19 MB on first use; it is served by the app. Tracking runs in a background Web Worker and targets at most 20 inference frames per second and falls back from GPU to CPU if necessary. Actual performance depends on your device.

**A localhost link only works on the computer running the server.** To play from different laptops, both players need access to the same HTTPS deployment. Do not send your friend `127.0.0.1`. Ordinary unencrypted LAN URLs generally cannot access the webcam. The Sites deployment starts owner-private; a friend cannot enter until site sharing is configured to allow them.

## Included

- Local practice playing both sides with your calibrated control hand; the active color rotates toward you by default. No computer opponent yet.
- Server-validated multiplayer rooms, separate White/Black seats, refresh recovery in the same browser tab.
- Castling, en passant, four promotion choices, check/checkmate, stalemate, insufficient-material draws.
- Automatic threefold-repetition and fifty-move draws (a casual-play convention, not a full tournament claim procedure).
- Draw offers, resignation, mutual rematches, PGN export, move history, capture indicators.
- Mirrored live camera background, landmark skeleton, smoothed pointer, pinch hysteresis, tracking-loss cancellation.
- Gesture menus/keypad, mouse and keyboard fallback, a saved 0–100% transparency slider and gesture adjustment buttons, optional move sounds.

Games are untimed. A room expires after seven days without a room-changing action. The room code invites a second player; it is not a login password. Your unguessable player key is stored in this tab's session storage. Refresh preserves it; closing the tab/browser may lose it. There is no account-based recovery yet. Keep the room code before leaving if you intend to rejoin in the same tab.

## Verify

```bash
npm test
npm run typecheck
npm run build
# With the local app running and DB initialized:
node tests/multiplayer.integration.mjs
```

See [TESTING.md](docs/TESTING.md) for the tested cases and the remaining real-camera checks. See [PLAN.md](PLAN.md) for the phased implementation record.

## Project map

| File | What it does |
| --- | --- |
| `app/page.tsx` | Board, room interface, dialogs, game controls |
| `app/globals.css` | Visual design and responsive camera layout |
| `hooks/use-hand-tracking.ts` | Webcam and MediaPipe lifecycle, cursor, dwell activation |
| `workers/hand-tracking.worker.ts` | Off-thread model loading and landmark inference |
| `lib/double-pinch.ts` | Stable target locking, double-pinch confirmation, role guards |
| `lib/gestures.ts` | Pinch state machine and camera-to-screen mapping |
| `lib/game.ts` | Chess replay, results, moves, draw/rematch rules |
| `lib/room-service.ts` | Seat authentication, room storage, atomic updates |
| `app/api/rooms/` | HTTP endpoints used by both players |
| `db/schema.ts`, `drizzle/` | Database structure and migrations |
| `tests/` | Rules, gesture, and multiplayer checks |
| `build/`, `.openai/` | Sites hosting integration inherited from the starter |

## Portfolio

Describe this as **a gesture-controlled multiplayer chess application using a pretrained hand-tracking model**. Do not claim you trained the landmark model, wrote the chess engine, or validated accuracy across users. [PORTFOLIO.md](docs/PORTFOLIO.md) gives a demo script, architecture explanation, and a practical learning path.

Built with React, TypeScript, Vinext/Vite, Cloudflare D1, chess.js, and MediaPipe. See [THIRD_PARTY.md](docs/THIRD_PARTY.md) for sources. The project is a portfolio prototype, not a hardened public chess service: before opening anonymous access widely, add per-client rate limits, room cleanup, stronger seat recovery, observability, and device testing.

### Two-hand roles and accuracy guards
One calibrated hand controls moves and menus. The second open palm activates a visual effect only. Use **Settings → Choose control hand again** to switch the controller. Loss or ambiguous handedness cancels input; the helper is never deliberately promoted to controller.

Aim inside the central 64% of a square for 320 ms. The first pinch locks that square; complete two close/open cycles within 2.2 seconds. Excessive palm drift, long holds, or tracking loss cancels the attempt. The aim cursor freezes while pinching so fingertip curl cannot switch squares. Watch the coordinate and 1/2 confirmation indicator. These guards reduce mistakes, but physical testing is still needed; no webcam system can promise zero wrong selections.

Settings includes optional Reach assist (off by default), Follow active side for local practice, and saved board transparency. Local practice allows the same controller to play White and Black.
