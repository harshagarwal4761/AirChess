# AirChess — Resume & Interview Points

Keep this file updated as features land so every bullet is backed by actual implemented code and verified checks.

## Project Summary
**AirChess** — Full-stack, webcam-controlled multiplayer & AI chess web application built with **React 19, TypeScript, Next.js/Vinext, MediaPipe Tasks Vision, Stockfish WebAssembly, Drizzle ORM, and Cloudflare Workers + D1**.

---

## Core Engineering Bullets (Ready for Resume)

### Full-Stack & Distributed State
- **Built a server-authoritative multiplayer chess backend on Cloudflare Workers & D1 (SQLite) using Drizzle ORM**, enforcing legal move replay via `chess.js`, per-tab SHA-256 bearer session authentication, and compare-and-swap optimistic concurrency (`WHERE code = ? AND revision = ?`) to prevent race conditions and double-seat joins.
- **Engineered client-side state synchronization and resilience**, handling tab-visibility-aware polling (`visibilitychange` fast wake), monotonic revision guards against out-of-order responses, fatal vs. transient HTTP error recovery, and opportunistic expired-room pruning in D1.

### Computer Vision & Real-Time Performance
- **Integrated MediaPipe Hand Landmarker (21 3D keypoints) inside a dedicated Web Worker** to keep webcam inference off the UI thread, processing live frames without queuing (`requestVideoFrameCallback` + stalled-frame watchdog) with GPU/CPU fallback and zero server-side camera uploads.
- **Improved real-time air cursor stability and throughput** by replacing naive EMA smoothing with an adaptive **One-Euro (1€) filter**, adding square-border hysteresis and single-frame flicker tolerance, defaulting to single-hand ROI tracking (`numHands: 1` for higher frame rates on integrated GPUs), and validating camera-to-screen projection across mirrored/cropped viewports.

### WebAssembly Chess Engine & Analysis
- **Embedded a single-threaded Stockfish WebAssembly chess engine in a Web Worker** with configurable difficulty presets (`Casual`, `Club`, `Master`), UCI score normalization (`cp` and `mate` mapped to White's perspective), a live evaluation meter, and best-move hints automatically restricted during active multiplayer games.

### Frontend Architecture, Accessibility & UX
- **Modularized a 1,200+ line client page into typed React components** with zero React 19 compiler hook lint errors, custom cross-platform Staunton SVG pieces, 3 board themes with 0–100% camera overlay transparency, draggable/keyboard-nudgeable panels (`MovableSurface`), interactive move-history scrubbing, material advantage tracking, and synthesized Web Audio feedback.
- **Verified core reliability with 44+ automated unit tests (`node:test`) and D1 integration tests**, covering chess special rules (castling, en passant, promotion, repetition), gesture state machines, layout clamping, Stockfish UCI parsing, and concurrent multiplayer API writes.

---

### Custom Machine Learning Gesture Classifier
- **Designed and trained a custom 2-layer MLP gesture classifier (`26 → 24 ReLU → 4 Softmax`) in TypeScript (`npm run train:gestures`)** over 26 translation-, scale-, aspect-, and rotation-invariant palm-basis features (`open`, `pinch`, `fist`, `peace`), achieving **100% held-out validation accuracy on 520 synthesized biomechanical poses** across hand tilt (`±31°`) and mirroring, and exported compact (~5 KB) weights for `< 0.05 ms` browser inference with temporal probability smoothing (`GestureSmoother`).
- **Integrated live gesture classification into the control loop**, displaying real-time class confidence in the HUD, fusing tilt-invariant `pinch` probabilities with geometric pinch hysteresis, and enabling a 450 ms **fist-hold** gesture to cancel piece selection hands-free.

---

## Upcoming Additions (Add Metrics Once Implemented & Measured)
- **Phase 13 (Planned):** Cloudflare Durable Objects WebSockets + server-authoritative blitz/rapid clocks + spectator mode.
- **Phase 14 (Planned):** GitHub OAuth + HTTP-only sessions, relational user/game archive in D1, and Elo rating progression.
