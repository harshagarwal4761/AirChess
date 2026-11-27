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
- **Integrated MediaPipe Hand Landmarker (21 3D keypoints) inside a dedicated Web Worker** to keep webcam inference off the UI thread, processing live frames without queuing (`requestVideoFrameCallback` + stalled-frame watchdog) with GPU/CPU fallback and zero server-side camera uploads.
- **Improved real-time air cursor stability and throughput** by replacing naive EMA smoothing with an adaptive **One-Euro (1€) filter**, adding square-border hysteresis and single-frame flicker tolerance, defaulting to single-hand ROI tracking (`numHands: 1` for higher frame rates on integrated GPUs), and validating camera-to-screen projection across mirrored/cropped viewports.

### WebAssembly Chess Engine & Analysis
- **Embedded a single-threaded Stockfish WebAssembly chess engine in a Web Worker** with configurable difficulty presets (`Casual`, `Club`, `Master`), UCI score normalization (`cp` and `mate` mapped to White's perspective), a live evaluation meter, and best-move hints automatically restricted during active multiplayer games.

### Frontend Architecture, Accessibility & UX
- **Modularized a 1,200+ line client page into typed React components** with zero React 19 compiler hook lint errors, custom cross-platform Staunton SVG pieces, 3 board themes with 0–100% camera overlay transparency, draggable/keyboard-nudgeable panels (`MovableSurface`), interactive move-history scrubbing, material advantage tracking, and synthesized Web Audio feedback.
- **Verified core reliability with 48 automated unit tests (`node:test`) and D1 integration tests**, covering chess special rules (castling, en passant, promotion, repetition), timed clock increments/timeouts, Elo math, custom MLP gesture classification, layout clamping, Stockfish UCI parsing, concurrent multiplayer writes, spectators, SSE streaming, auth cookies, and D1 game archiving.

---

### Custom Machine Learning Gesture Classifier
- **Designed and trained a custom 2-layer MLP gesture classifier (`26 → 24 ReLU → 4 Softmax`) in TypeScript (`npm run train:gestures`)** over 26 translation-, scale-, aspect-, and rotation-invariant palm-basis features (`open`, `pinch`, `fist`, `peace`), achieving **100% held-out validation accuracy on 520 synthesized biomechanical poses** across hand tilt (`±31°`) and mirroring, and exported compact (~5 KB) weights for `< 0.05 ms` browser inference with temporal probability smoothing (`GestureSmoother`).
- **Integrated live gesture classification into the control loop**, displaying real-time class confidence in the HUD, fusing tilt-invariant `pinch` probabilities with geometric pinch hysteresis, and enabling a 450 ms **fist-hold** gesture to cancel piece selection hands-free.

---

## Upcoming Additions
- **Final Tracking Polish (Next):** Real-camera latency/FPS profiling and final webcam tracking accuracy tuning.
