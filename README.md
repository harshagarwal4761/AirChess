# AirChess

**Your next move. In the air.** A webcam chess app with steady-hover and double-pinch controls, a translucent camera overlay, and online rooms for two players.

This is a computer-vision application, not a physical hologram. You look at the screen and move your hand in front of the webcam. MediaPipe's pretrained model runs locally in the browser; your camera frames are never uploaded by AirChess.

## Start here

You do **not** need to know ML to use this. You can learn the application one layer at a time. Start with [the beginner guide](docs/LEARNING.md), then [architecture](docs/ARCHITECTURE.md).

### Clone and run

Install Node.js 22.13 or newer, then run:

```bash
git clone https://github.com/harshagarwal4761/AirChess.git
cd AirChess
npm ci
npm run build
npm run db:setup
npm run dev
```

If the repository is private, sign in to GitHub with an account that has access before cloning. Open the address printed by the terminal, normally **http://127.0.0.1:5173**. Keep that terminal running.

For an existing checkout with dependencies and the database prepared, run `npm run dev` from the project folder.

`db:setup` creates the local database using the generated migrations and records which migrations have run. It is safe to repeat. Local and hosted databases are separate.

### Play

1. Try a few moves by clicking a piece and a highlighted destination.
2. Click **Enable air controls**, then allow camera access. Use a regular desktop browser if the embedded preview cannot open your camera.
3. Show only your chosen control hand with your thumb and index apart until calibrated. In **Steady hover** mode, point at a piece and hold the cursor in its square for 1.1 seconds until the ring fills. Move to a highlighted destination and hold again. Moving away cancels the countdown.
4. Optional: raise your second open palm to pause all gesture input. Lower it to resume. The selected piece is kept. **Double pinch** remains available in the Air controls panel: close/open twice on the piece, then twice on its destination.
5. Hold an open fingertip over a button for 1.3 seconds to activate it. A border shows the dwell timer. Move away before activating that button again.
6. Create a room and share its link or six-digit code. Your friend joins from their laptop and plays Black. Their camera is independent of yours.

The first camera permission prompt needs a click. The model/wasm download is about 19 MB on first use; it is served by the app. Tracking runs in a background Web Worker, processing fresh camera frames as soon as the model is free. It requests up to 60 camera FPS and falls back from GPU to CPU if necessary. Actual performance depends on your device.

**A localhost link only works on the computer running the server.** To play from different laptops, both players need access to the same HTTPS deployment. Do not send your friend `127.0.0.1`. Ordinary unencrypted LAN URLs generally cannot access the webcam. The hosted AirChess site is configured for anyone with its link. Both players open https://airchess-gesture-play.richroot2.chatgpt.site/ ; one chooses Create room and the other chooses Join room and enters the six-digit code. GitHub stores the source; it does not run the multiplayer server. Each player enables their own camera.

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

### Aiming, selection, and the second hand
One calibrated hand controls moves and menus. Its index cursor follows continuously, even if the thumb is curled. The cursor is mapped to the actual mirrored video rectangle, with time-based smoothing. Expanded reach is off by default because it intentionally offsets the cursor from the visible fingertip.

Steady hover is the default: remain inside an eligible square for 1.1 seconds to confirm. A ring and progress bar show the countdown. Leaving the square resets it. The activated square stays latched until you leave, preventing repeated selection. Tracking loss resets the countdown without dropping the selected chess piece. Only current-turn pieces and legal destinations can be confirmed.

Double pinch is optional. Aim inside the central 88% of a square for 160 ms before two complete close/open cycles. The pre-pinch square locks while the cursor continues following your finger. Complete both cycles within 3.5 seconds; holding a pinch longer than 1.5 seconds or moving the palm too far cancels. Watch the highlighted coordinate and confirmation count.

The second open palm pauses gesture input immediately and resumes 350 ms after it is lowered. Use **Settings → Choose control hand again** to switch the controller. Local practice lets the same control hand play both colors. Saved board transparency remains available.

Synthetic integration tests exercise the actual React page and hook, but cannot establish webcam accuracy across users. No claim of zero incorrect selections is made.

### Move the board and panels
Use **Arrange layout** in the top bar. Drag a panel by its labeled handle, or hover over its arrow buttons to nudge it in the air. A focused handle also responds to arrow keys (8px), or Shift+arrow (32px). Click **Done arranging** to resume chess selection. Panels may overlap; the one being moved comes to the front.

The board, Air controls, Friendly match, and Move history panels save their offsets in this browser. Dialogs have their own always-visible move handles. **Reset layout** (or **Settings → Reset panel positions**) restores the default positions. Screen-edge limits keep handles reachable after resizing.

The tracking readout shows processed FPS and average capture-to-result delay in milliseconds. The previous artificial 20 FPS cap has been removed; actual FPS is limited by the camera, model, GPU/CPU, and browser. Camera resolution, model, confidence thresholds, smoothing, hover duration, and pinch safeguards are retained. Nearly opaque panel blur is disabled over live video to reduce GPU work.

## Developer signature

AirChess is a project by **Harsh Agarwal** ([GitHub](https://github.com/harshagarwal4761)). Open the **HA / by Harsh** button in the header to see the creator card. The knight hides a small Easter egg: activate it three times. The card supports keyboard and air-button controls, and respects reduced-motion preferences. Black pieces use a contrasting outline for visibility over a transparent board.
