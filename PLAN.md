# AirChess — implementation plan

## Product and boundaries
Build a webcam-based chess application for two friends on separate laptops. Each player sees a translucent board over their own mirrored camera view and moves pieces by pinching in the air. The screen displays the effect; this is not a physical hologram. Camera frames stay in the browser. Browser permission prompts require ordinary input.

This is both a fun application and a learning/portfolio project. Use an existing hand-landmark model honestly; do not claim to train a model from scratch. Explain every major subsystem in beginner-friendly documentation.

## Phase 1 — foundation and design
- [x] Set up a typed React application with server endpoints and durable room storage.
- [x] Establish a responsive, dark camera-stage interface with a mint/ivory translucent board, clear game status, move history, and gesture guide.
- [x] Provide local practice without a camera so the application remains explorable.
Acceptance: application builds and the board can be played with ordinary pointer input.

## Phase 2 — correct chess
- [x] Use chess.js for legality, check, checkmate, stalemate, repetition, insufficient material, and the fifty-move rule.
- [x] Support castling, en passant, and explicit queen/rook/bishop/knight promotion.
- [x] Add legal-move hints, last-move highlights, captured-piece display, PGN export, and reset for practice.
Acceptance: automated tests cover special moves and game-ending positions.

## Phase 3 — air controls
- [x] Integrate MediaPipe Hand Landmarker, browser camera permissions, loading/errors, and resource cleanup.
- [x] Map mirrored hand coordinates into viewport coordinates; smooth motion and normalize pinch thresholds to hand size.
- [x] Implement stable pinch-to-select/release-to-place, cancel on tracking loss, and a visible cursor.
- [x] Add dwell activation for menus/promotion and an on-screen room keypad for gesture joining.
- [x] Explain lighting, framing, posture, and the difference between model inference and gesture logic.
Acceptance: deterministic tests for gesture transitions and mapping; real webcam usability is recorded separately and never claimed without observation.

## Phase 4 — multiplayer
- [x] Create/join rooms with server-assigned White/Black seats and unguessable player credentials.
- [x] Validate every move on the server and serialize updates with optimistic concurrency.
- [x] Persist move history for repetition detection, reconnect after refresh, and rotate the board for Black.
- [x] Add resignation, agreed draws, mutual rematches, and connection feedback.
- [x] Use casual untimed games initially; competitive clocks, matchmaking, and a computer opponent are future extensions.
Acceptance: two independent clients can join, exchange moves, reject illegal/out-of-turn/stale actions, and finish/rematch a game.

## Phase 5 — verification and delivery
- [x] Run type/build checks and meaningful chess, gesture, and multiplayer tests.
- [x] Inspect desktop/mobile browser behavior and repair observed issues where tooling permits.
- [x] Write setup, architecture, manual testing, portfolio explanation, and next-step learning documentation.
- [x] Attempt supported private deployment; report any hosting/access blockers honestly.
- [x] Update this plan with completed work, verification results, and remaining manual checks.
Acceptance: reproducible local run instructions, passing automated checks, and a clear account of what has/has not been tested.

## Technical choices
React/TypeScript for UI; chess.js for chess rules; MediaPipe for pretrained hand tracking; server-authoritative HTTP room endpoints with D1 storage and revision checks. Polling is acceptable for turn-based casual chess and simpler to deploy than a dedicated WebSocket service. Separate game and gesture logic from presentation so they can be tested and explained.

## Deferred extensions
Chess clocks with server time and timeout adjudication; Stockfish practice; recorded gesture datasets and a trained gesture classifier; stronger abuse controls for public launch; camera-on usability studies across devices; physical tabletop anchoring/AR glasses.

## Progress log
- Plan created before implementation. Workspace was empty. No existing source to preserve.


## Verification and handoff record
- Phases 1–4 implemented; Phase 5 software checks completed. No custom ML training is claimed.
- 14 automated chess/gesture tests pass; TypeScript checking and the production build pass.
- HTTP integration against real local D1 passes for seat ownership, two-player moves, illegal/out-of-turn/stale requests, racing updates, reconnect reads, draws, resignation, and rematches.
- Two separate browser tabs created/joined a room, played e4/e5, and recovered Black's seat/history after refresh. Browser console inspection found no errors in the tested paths.
- Inspected desktop layout at 1440×1080, narrow layout at 390×844 (no horizontal overflow), and compact focus mode at 1366×768. Camera mode automatically uses the compact layout.
- Fresh-database migration and repeated local setup were checked successfully.
- Beginner setup, architecture, portfolio wording, dependency attribution, and manual testing documentation are included under `airchess/docs/`.
- Site registration is complete. Private publication is the final delivery step; hosting access is independent of chess room membership. A friend needs permission to access the hosted site before joining a room.

### Remaining human/device acceptance checks
- [ ] Run the actual webcam model and tune pinch/dwell thresholds for your camera and lighting.
- [ ] Play a complete gesture-only game between two physical laptops on the same accessible HTTPS deployment.
- [ ] Measure accuracy, latency, and fatigue before making portfolio performance claims.

These checks need physical hands and cameras. The automated and two-tab checks do not establish real-camera accuracy or cross-device performance. Future extensions remain deferred as listed above.
