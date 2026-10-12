# Verification record

## Automated

- `npm test`: 36 tests for turn legality, castling, en passant, all promotion pieces, checkmate, stalemate, material/fifty-move/repetition draws, draw agreement, mutual rematch, resignation, pinch arming/hysteresis/stability/loss, mapping, and scale normalization.
- `npm run typecheck`: TypeScript compile validation.
- `npm run build`: complete production Worker/client build.
- `node tests/multiplayer.integration.mjs`: real local HTTP/D1 tests using distinct player credentials. Covers create/join, occupied seats, unauthorized reads, malformed credentials, out-of-turn/illegal/stale moves, simultaneous updates, refresh-style reads, draw consent, mutual rematch, and resignation.

## Browser checks performed

- Local practice: selecting e2 highlights e3/e4; placing on e4 updates turn and history.
- Create room through UI; open invite in a separate tab; join as Black.
- Black orientation is reversed and the White seat is separate.
- White plays e4, Black receives it and plays e5.
- Reloading Black's tab restores the same room, color, and e4/e5 history.
- Desktop inspection at 1440×1080, narrow layout at 390×844 without horizontal overflow, and compact focus view at 1366×768.
- Settings dialog, focus view toggle, and a fresh/repeated local database setup were checked.

## Real-camera acceptance checklist — requires a person at a webcam

These are not marked as passed by automated landmark tests.

- [ ] Grant permission and check the model loads in the intended browser.
- [ ] Verify the pointer follows the visible mirrored fingertip at every board corner.
- [ ] Make 20 intended double-pinch moves; record first-attempt success, wrong squares, cancellations, and latency.
- [ ] Lose the controller after the first pinch: no move should commit; the helper must not take over.
- [ ] Open a menu with dwell; leave and reenter to activate the same key twice.
- [ ] Use the gesture keypad to join; select all promotion options in test games.
- [ ] Check both bright/dim lighting and left/right hands.
- [ ] Stop the camera: verify its browser indicator turns off.
- [ ] Test a complete game from two physical laptops on the hosted HTTPS URL.
- [ ] Check comfort and hand fatigue over a ten-minute session.

## Deployment checks

A private hosted deployment verifies build/runtime availability but does not grant a friend access. Site sharing and game room access are separate. Public exposure should follow a deliberate review of rate limits and retention. No cross-laptop or real-webcam claims should be inferred from the local two-tab test.

## Earlier transparency/practice checks
Browser verification: 0% and 100% slider endpoints checked; at 100% both square backgrounds compute to alpha 0. A 75% setting survives refresh. After e4, local practice rotates Black to the bottom.

## Phase 7 regression coverage (historical; superseded by Phase 8)
The current suite replaces the superseded two-independent-controller tests. It covers complete double-pinch confirmation, single pinch rejection, settling, target changes, fingertip curl, palm drift, tracking loss, timeout, long holds, square border exclusion, controller isolation, helper palm detection, camera aspect ratio, real pinch-edge sequences, practice orientation, and reach mapping, alongside chess legality tests.

- [ ] Historical animation behavior was replaced by second-hand pause in Phase 8.
- [ ] Move White and Black in local practice with the same controller.
- [ ] Cross/occlude hands and verify cancellation; record any handedness misclassification.
- [ ] Aim at square borders or move the palm during confirmation: no adjacent square should be chosen.
- [ ] Make two complete pinches on source and destination at varied comfortable speeds.
- [ ] Verify the ready coordinate and 1/2 indicator are understandable.

Actual physical gesture accuracy remains unverified. Automated landmark sequences cannot establish a zero-error interaction guarantee.

Phase 7 software verification (12 October 2026): 31/31 tests and TypeScript validation pass; production build passes. A temporary local browser diagnostic loaded the actual model/WASM in the classic worker and completed blank-frame inference (zero hands), without accessing the webcam. Local UI checks verified White e4 and Black e5, both colors' eligible gesture targets, and the updated guide. No console errors appeared in those UI paths. The diagnostic page was removed before publication.

## Phase 8: actual hook-to-board integration

36 unit tests pass, including video-rectangle mapping, continuous pointer movement, hover timing, and repeat prevention. The local browser harness mounts the actual React page and `useHandTracking`, replacing only camera/model input. Twelve assertions passed: curled-thumb pointer alignment; intended White selection; no repeated selection; selection surviving detection loss; illegal destination rejection; White move; Black selection; second-hand pause preserving selection; resumed Black move; double-pinch source and destination with simulated fingertip curl; camera cleanup.

To reproduce after `npm run build`: run `node scripts/build-gesture-qa.mjs`, start `npm start -- --port 5173`, open `/gesture-qa/`, and click **Run synthetic gesture checks**. This is an explicitly simulated local test, not a webcam accuracy measurement. Run a normal production build afterward to remove the diagnostic assets before packaging. No test route or model override is imported by the production app.

Physical acceptance now starts with Steady hover: show one hand with thumb/index apart, confirm the cursor follows the visible fingertip, hold on a piece until the ring fills, then hold on a highlighted destination. Raise/lower a second open palm to pause/resume. Measure incorrect squares, missed selections, and latency under your actual lighting.

## Phase 9: movable panels and frame scheduling

39 unit tests and TypeScript validation pass. Both video-frame callbacks and the RAF fallback passed all 17 synthetic browser assertions, including moved-board selection, both colors, double pinch, helper pause, illegal destinations, one frame in flight, cleanup, and layout reset. Synthetic throughput exceeded the former 20 FPS ceiling (49–60 FPS with simulated inference); these are not webcam/model benchmarks. Camera resolution, model confidence, smoothing, and gesture confirmation durations are unchanged.

Manual browser checks verified actual pointer dragging, keyboard nudges, a moved room panel, exact board offset restoration after reload, settings-dialog dragging and reopening, and layout reset. The header remains above movable panels so Reset layout remains accessible. Local multiplayer integration checks cover seat ownership, legal turns, state synchronization, stale/racing requests, draw, rematch, and resignation.

Real webcam FPS/accuracy and a full two-laptop gesture game remain human acceptance checks. Production packaging removes the local synthetic harness.

Narrow-screen regression: a panel resize notification used to reset a pinch even when its offset was unchanged. Layout notifications now fire only for actual movement or window resize, and a stable scrollbar gutter prevents width oscillation. The same 17 gesture checks pass at a 755-pixel browser width. The diagnostic overlay is pointer-transparent and resets saved test positions before each run.
