# Verification record

## Automated

- `npm test`: 14 tests for turn legality, castling, en passant, all promotion pieces, checkmate, stalemate, material/fifty-move/repetition draws, draw agreement, mutual rematch, resignation, pinch arming/hysteresis/stability/loss, mapping, and scale normalization.
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
- [ ] Make 20 intended moves with no accidental release; record success rate and latency.
- [ ] Move the hand out of view while pinched: no move should commit.
- [ ] Open a menu with dwell; leave and reenter to activate the same key twice.
- [ ] Use the gesture keypad to join; select all promotion options in test games.
- [ ] Check both bright/dim lighting and left/right hands.
- [ ] Stop the camera: verify its browser indicator turns off.
- [ ] Test a complete game from two physical laptops on the hosted HTTPS URL.
- [ ] Check comfort and hand fatigue over a ten-minute session.

## Deployment checks

A private hosted deployment verifies build/runtime availability but does not grant a friend access. Site sharing and game room access are separate. Public exposure should follow a deliberate review of rate limits and retention. No cross-laptop or real-webcam claims should be inferred from the local two-tab test.
