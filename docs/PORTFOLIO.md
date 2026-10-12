# Presenting AirChess

## An honest project description

> AirChess is a webcam-based multiplayer chess application. I built it with AI assistance using React and TypeScript, integrated MediaPipe's pretrained hand landmark model, and implemented pinch gestures, camera overlays, and server-validated game rooms. It uses chess.js for chess legality and Cloudflare D1 for persistent games.

Use this wording after you have studied and can explain the implementation. Do not claim custom model training, measured gesture accuracy, tournament-level adjudication, or production-scale reliability without doing that work.

## A 90-second demo

1. Show the camera view and explain that inference stays on the device.
2. Double pinch a pawn to select it, open the helper palm to animate it, then double pinch a legal destination.
3. Bring a friend into the room on another laptop; show their board is oriented for Black.
4. Make one move from each laptop and show synchronization.
5. Show promotion choices or a draw offer, then explain tracking-loss cancellation.
6. Show the tests and one architecture diagram.

Record this only after testing it on the actual devices. The local automated and browser checks do not replace a camera demonstration.

## Questions worth being able to answer

- What does the ML model output? (21 landmark coordinates, not a chess move.)
- Did you train it? (No. It is pretrained; the application integrates it.)
- Why normalize pinch distance? (Hands appear larger or smaller depending on distance.)
- Why two thresholds? (To avoid noisy repeated grab/release transitions.)
- Why validate moves on the server? (The client can be modified and can have stale state.)
- What is a revision check? (A write succeeds only if the state has not changed since it was read.)
- Why keep all moves? (To reconstruct the game and detect repetition.)
- Why polling? (Simple hosting and adequate latency for untimed turn-based games.)
- What remains limited? (Device variability, hand fatigue, handedness errors under occlusion, no clocks, no accounts, no broad abuse controls.)

## Measurable next improvement

Have a few volunteers make 20 prompted moves each. Record successful first attempts, accidental moves, tracking losses, and time-to-move under consistent lighting. Repeat after changing one parameter. Report the actual sample size and results. This is a better portfolio improvement than an unsupported claim of “99% accuracy.”

Later, collect consented landmark sequences for a small gesture vocabulary, split by person for training/testing, and train a classifier. That would be a distinct custom-ML phase, not something this version already does.
