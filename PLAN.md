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

## Phase 6 — hands and transparency (user feedback)
- [x] Continuous 0–100% board transparency, lower default opacity, persistent preference, and gesture-accessible adjustments.
- [x] Two simultaneously tracked hands with separate cursors, pinch states, and stable identities when detection order changes.
- [x] Practice mode explicitly controls both colors; protect a pickup from the other hand and bring the active side within comfortable reach.
- [x] Regression tests for both-color gesture moves, hand loss/reordering, and competing pickups; inspect controls and republish the existing private site.

Verification: 25 automated tests pass. Browser checks cover transparency endpoints/persistence and turn-following. The latest production build/type check will run during packaging. Physical two-hand tracking remains a manual acceptance check.

## Phase 7 — deliberate double-pinch controls
- [x] One calibrated control hand; second open palm animates the selected piece and legal squares only.
- [x] Stable center targeting, two complete pinch cycles to select, two to move, visible progress, and cancellation on drift/loss/timeout.
- [x] Lock the aimed square during pinching so fingertip curl cannot change the destination; correct hand-size distances for camera aspect ratio.
- [x] Move landmark inference into a worker to avoid blocking interface rendering.
- [x] Test gesture sequences, wrong-square guards, role isolation, and build/browser behavior; prepare the existing site for publication.

Verification: 31 tests, typecheck, production build, actual worker/model blank-frame inference, and both-color UI targeting pass. Physical camera accuracy and a complete two-laptop gesture game remain human acceptance checks. Publication follows the final package check.

## Phase 8 — repair unusable aiming and selection
- [x] Map to the actual video rectangle and remove pinch-dependent pointer freezing; use time-based smoothing.
- [x] Add steady-hover selection with countdown and repeat protection; retain a more forgiving double-pinch option.
- [x] Preserve the selected piece across tracking interruptions while resetting incomplete confirmations.
- [x] Replace second-hand animations with an open-palm pause; expose useful tracking feedback.
- [x] Verify the actual hook-to-board path with simulated camera frames, gesture regressions, and browser checks; prepare publication and GitHub synchronization.

Physical webcam accuracy still requires user testing. Synthetic input should exercise the production interaction path rather than only isolated functions.

Phase 8 checks: 36 unit tests, TypeScript validation, production build, and 12 browser integration assertions pass. Actual camera performance remains a user/device acceptance check.

## Phase 9 — move panels and reduce tracking delay
- [x] Add draggable board, control, room, history, and dialog surfaces; support arrow-key/air nudges, persistence, screen bounds, and layout reset.
- [x] Remove the 20 FPS cap, schedule fresh camera frames without queuing, and avoid repeated chess computations/UI updates. Keep model resolution and gesture safeguards.
- [x] Verify moved-board aiming, layout persistence/reset, modal movement, and gesture regression, including a narrow browser viewport.

- [x] Publish the tested build, verify GitHub matches, enable the user-requested public-link audience, and check hosted multiplayer. Completed in release 3ba0e16.

## Phase 10 — interface polish and developer signature
- [x] Improve piece contrast and add a compact developer credit that works in focus view.
- [x] Add a developer card linked to Harsh Agarwal's GitHub and an optional knight Easter egg.
- [x] Check keyboard/mobile behavior, typecheck, unit tests, and production build.
- [ ] Publish to the live Site and confirm GitHub matches.
