# Presenting AirChess

## An honest project description

> AirChess is a full-stack webcam chess application built with React 19, TypeScript, Next.js/Vinext, Drizzle ORM, and Cloudflare Workers + D1. It integrates Google's pretrained MediaPipe 21-keypoint Hand Landmarker in a Web Worker alongside a One-Euro adaptive pointer filter, a custom 2-layer MLP gesture classifier trained on 520 synthesized biomechanical poses, a local Stockfish WebAssembly opponent, and SSE-synchronized online multiplayer rooms with blitz clocks, spectators, PBKDF2 authentication, and K=32 Elo ratings.

Always distinguish between external pretrained/engine dependencies (MediaPipe keypoints, `chess.js`, `stockfish.js`) and the parts engineered directly (worker pipeline, One-Euro + hysteresis controls, 2-layer MLP classifier, CAS multiplayer rooms, SSE stream, clocks, PBKDF2 auth, D1 archive & Elo, and UI).

## A 90-second demo

1. Show local camera inference: cursor smoothing, steady-hover ring confirmation, and fist-hold cancel, noting zero frames leave the browser.
2. Switch between **vs Stockfish WASM** (evaluation bar + best-move hint) and **Online** rooms (`3+2` clock, SSE instant sync, spectator `?watch=1` link).
3. Show ECO opening detection, move-history scrubbing, Copy FEN/PGN, and keyboard shortcuts (`?`).
4. Sign in via **Profile**, play or review an archived game (`/?game=<id>`), and inspect the Elo leaderboard.
5. Mention the `npm run check` (55 unit tests) and D1 integration test suite.

## Questions worth being able to answer

- **What outputs does MediaPipe give vs. your custom MLP?** MediaPipe outputs 21 normalized 3D hand keypoints; the custom 2-layer MLP (`26 → 24 ReLU → 4 Softmax`) classifies 26 scale/tilt-invariant palm-basis features into `open`, `pinch`, `fist`, or `peace`.
- **How did you fix webcam lag and jitter?** Moved inference to a Web Worker with `inFlight` single-frame backpressure (`requestVideoFrameCallback`), defaulted `numHands` to 1, replaced naive EMA with an adaptive One-Euro filter, and isolated 100 ms chess clock ticks in `<MatchClock>` so the main board never re-renders at 10 Hz.
- **How do online rooms prevent race conditions and clock cheating?** Compare-and-swap SQLite updates (`WHERE code = ? AND revision = ?`), server `serverNow` clock timestamps + server timeout validation, and SHA-256 hashed bearer tokens.
- **How are passwords stored and rate limits enforced?** Salted PBKDF2-SHA256 (100k iterations, constant-time comparison including a dummy check for unknown users), HTTP-only cookies, and sliding-window per-IP rate limiting (`429` + `Retry-After`) on auth and room creation.
- **What still needs measurement?** Live user accuracy across varied cameras/lighting using real consented webcam landmark recordings exported from the Settings sample recorder.
