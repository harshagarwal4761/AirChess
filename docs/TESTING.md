# Verification record

## Automated suites

- **`npm run check`**: Runs ESLint (zero errors across client, API, workers, and tests), `tsc --noEmit`, `npm test`, and the production Vinext/Cloudflare build.
- **`npm test` (55 unit tests via `tsx --test tests/*.test.ts`)**:
  - `tests/game.test.ts`: Legal turns, castling, en passant, 4-piece promotion, checkmate, stalemate, insufficient-material/fifty-move/repetition draws, mutual draws/rematches, resignation, local undo, material summary, timed clock deductions, increments, and timeout adjudication.
  - `tests/gesture-classifier.test.ts`: Custom 2-layer MLP gesture classification (`open`, `pinch`, `fist`, `peace`) under tilt/mirroring + `GestureSmoother` hysteresis.
  - `tests/double-pinch.test.ts`, `tests/gestures.test.ts`, `tests/air-pointer.test.ts`: Video-rectangle coordinate projection, One-Euro pointer tracking, hover countdown & repeat latching, pinch hysteresis, tracking-loss retention/cancellation.
  - `tests/stockfish.test.ts`: UCI move/info parsing, mate & centipawn normalization, eval win percentage.
  - `tests/openings.test.ts`: Longest-prefix ECO opening matching and check-marker stripping.
  - `tests/rate-limit.test.ts`: Sliding-window request caps and expiration reset.
  - `tests/elo.test.ts` & `tests/panel-layout.test.ts`: Symmetric K=32 Elo updates, viewport clamping, and corrupt-storage resilience.
- **`AIRCHESS_TEST_URL=http://127.0.0.1:5173 npm run test:integration`**: End-to-end HTTP + Cloudflare D1 integration tests against a running app server covering room create/join, seat locks, unauthorized access, CAS revision conflicts, simultaneous moves, spectator `?watch=1`, SSE `/api/rooms/:code/events` streaming, blitz clock flagging, user registration/login/logout, HTTP-only sessions, Elo rating updates, game archive & replay lookup, leaderboard, and `/api/health`.
- **`npm run db:setup`**: Non-interactive local D1 schema migration check (safe and idempotent).

## Browser UI checks

- Local practice & Stockfish AI play (`e4`/`e5`), move scrubbing, ECO opening badges (`Sicilian Defense`, `Italian Game`, etc.), FEN/PGN copy & download, board themes (`Emerald`/`Slate`/`Walnut`), keyboard shortcuts, and 404/error routes.
- Two-tab multiplayer create/join, SSE synchronization, spectator mode (`?watch=1`), session login/profile archive replay (`/?game=<id>`), mobile (`390×844`) & desktop viewports with zero runtime console errors.
- Movable surface dragging, layout reset, and `tests/browser/gesture-qa.tsx` synthetic camera/landmark hook assertions (17 assertions covering both colors, hover/double-pinch, helper pause, frame backpressure, and moved-board hit-testing).

## Real-camera acceptance checklist — requires a person at a webcam

Synthetic landmark sequences verify pipeline logic but do **not** establish real-world accuracy across cameras, lighting, or users.

- [ ] Grant camera permission and verify smooth tracking FPS and cursor alignment across all 64 squares under room lighting.
- [ ] Complete 20 consecutive gesture moves (steady-hover + double-pinch + fist-cancel) and measure first-attempt accuracy and hand comfort.
- [ ] Play a full timed game between two physical laptops over HTTPS (`?room=CODE`) with one spectator (`?watch=1`).
