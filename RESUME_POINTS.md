# AirChess — Resume & Interview Points

Keep this file updated as features land so every bullet is backed by actual implemented code and verified checks.

## Project Summary
**AirChess** — Full-stack, webcam-controlled multiplayer & AI chess web application built with **React 19, TypeScript, Next.js/Vinext, MediaPipe Tasks Vision, Stockfish WebAssembly, Drizzle ORM, and Cloudflare Workers + D1**.

---

## Core Engineering Bullets (Ready for Resume)

### Full-Stack & Distributed State
- **Built a server-authoritative multiplayer chess backend on Cloudflare Workers & D1 (SQLite) using Drizzle ORM**, designing a 4-table relational schema (`users`, `sessions`, `rooms`, `games`) with legal move replay (`chess.js`), per-tab SHA-256 bearer auth, and compare-and-swap optimistic concurrency (`WHERE code = ? AND revision = ?`) to prevent race conditions and double-seat joins.
- **Implemented salted PBKDF2-SHA256 authentication (100k iterations, constant-time verification via Web Crypto) and HTTP-only D1 session cookies**, paired with automatic game archiving, K=32 Elo rating updates on rated multiplayer matches, shareable replay URLs (`/?game=<id>`), and a live player leaderboard.
- **Engineered real-time room synchronization via Server-Sent Events (`/api/rooms/:code/events`) with in-memory pub/sub push, D1 revision checks, and automatic polling fallback**, delivering sub-10ms local updates, `visibilitychange` fast wake, monotonic revision guards, and read-only live **Spectator mode** (`?watch=1`).
- **Implemented server-authoritative blitz/rapid chess clocks (`3+2`, `5+0`, `10+0`)**, calculating elapsed turn time from server timestamps (`serverNow` clock-skew sync), increment application, and CAS-protected timeout adjudication (`flag` action + insufficient-material draw check).

### Computer Vision & Real-Time Performance
- **Integrated MediaPipe Hand Landmarker (21 3D keypoints) inside a dedicated Web Worker with live GPU-vs-CPU auto-benchmarking** to keep webcam inference off the UI thread; measures actual worker `detectForVideo` inference latency over warmup/sample frames, automatically switches integrated-GPU devices exceeding 50 ms/frame to SIMD WASM CPU when faster, caches the winning delegate (`Auto / GPU / CPU`), downscales high-res feeds to `384p` (`Fast`) or `512p` (`Crisp`) via `createImageBitmap`, and exposes a Settings engine/resolution selector.
- **Engineered rock-steady air cursor stability & zero-reflow rendering**, upgrading the One-Euro (`1€`) filter with sub-2.2 px stationary tremor damping, adding dt-scaled palm-jump thresholds (preventing false tracking drops during fast hand swipes at 12–15 FPS), single-hand handedness-flicker immunity (`280 ms` dropout hold), 12% sticky hover square hysteresis on seams, batched single-path 2D skeleton drawing, cached video geometry, and `translate3d` GPU cursor compositing.

### WebAssembly Chess Engine & Analysis
- **Embedded a single-threaded Stockfish WebAssembly chess engine in a Web Worker** with configurable difficulty presets (`Casual`, `Club`, `Master`), UCI score normalization (`cp` and `mate` mapped to White's perspective), a live evaluation meter, and best-move hints automatically restricted during active multiplayer games.

### Frontend Architecture, Accessibility & UX
- **Modularized a 1,200+ line client page into memoized React components (`ChessBoard`, `SidebarPanels`, `MatchClock`)** with zero ESLint/React Compiler issues, eliminating 10 Hz full-tree re-renders during timed games by isolating clock ticks and using single-shot timeout scheduling; added custom Staunton SVG pieces, 3 themes with 0–100% camera overlay transparency, draggable/nudgeable floating panels, ECO opening detection (`lib/openings.ts`), FEN/PGN copy & export, move scrubbing, keyboard shortcuts, and custom error/404 boundaries.
- **Hardened full-stack reliability with sliding-window IP rate limiting (`429` + `Retry-After`), constant-time unknown-user login verification, opportunistic D1 session pruning, single-query SSE delta reads (`readRoomIfNewer`), and `GET /api/health`**, backed by `npm run check` (**55 automated unit tests** + lint + typecheck + production build) and end-to-end HTTP+D1 integration tests (`AIRCHESS_TEST_URL=... npm run test:integration`).

---

### Custom Machine Learning Gesture Classifier
- **Designed and trained a custom 2-layer MLP gesture classifier (`26 → 24 ReLU → 4 Softmax`) in TypeScript (`npm run train:gestures`)** over 26 translation-, scale-, aspect-, and rotation-invariant palm-basis features (`open`, `pinch`, `fist`, `peace`), achieving **100% held-out validation accuracy on 520 synthesized biomechanical poses** across hand tilt (`±31°`) and mirroring, and exported compact (~5 KB) weights for `< 0.05 ms` browser inference with temporal probability smoothing (`GestureSmoother`).
- **Integrated live gesture classification into the control loop**, displaying real-time class confidence in the HUD, fusing tilt-invariant `pinch` probabilities with geometric pinch hysteresis, and enabling a 450 ms **fist-hold** gesture to cancel piece selection hands-free.

---

## Verified Status
- All core features across Phases 1–16 (Playable AI, Real-Time SSE + Clocks + Spectators, PBKDF2 Auth + D1 Archives + Elo, Repo Hardening, and Final Webcam Auto-Benchmark & Stability Pass) are implemented, checked via `npm run check`, and pushed cleanly to GitHub.
