# Learn AirChess without already knowing web development or ML

You can build confidence by understanding one working feature at a time. You do not need to understand every file before playing.

## The five ideas

1. **HTML** describes what is on the page: buttons, the board, text, and video.
2. **CSS** makes those things look the way they do. Open `app/globals.css` and change a color as your first experiment.
3. **JavaScript/TypeScript** handles decisions. TypeScript adds descriptions of the values functions expect, helping catch mistakes before the app runs.
4. **React** updates the screen when state changes. Selecting a square changes `selected`; the board rerenders with move hints.
5. **A server and database** let two laptops share a game. Each browser sends moves to the same server; the database remembers them.

`npm` is the tool that installs JavaScript libraries and runs named commands. `npm run dev` runs the app locally. A terminal is simply where you type that command.

## Where ML fits

The webcam supplies an image. MediaPipe's already-trained model predicts 21 points describing your hand: wrist, joints, and fingertips. We call that running **inference**.

Our code compares the thumb-tip and index-tip positions. When the gap becomes small relative to your hand's size, it recognizes a pinch. The gesture rules are ordinary code; we did not train them. The model does not know anything about chess.

The chess library separately checks whether your proposed move is legal. The multiplayer server separately checks whether you are the player whose turn it is.

## A practical sequence

- **First session:** run the app, make moves with a mouse, open the gesture guide, then try the camera.
- **Next:** learn variables, functions, objects, arrays, `if`, and events in JavaScript. Find examples in `lib/gestures.ts`.
- **Then:** learn React state and components. Follow `selected` and `squareClick` in `app/page.tsx`.
- **Then:** read `lib/game.ts`. Explain why we keep the full move history instead of only the current board.
- **Then:** follow one move from the browser through the API into the database. Learn HTTP GET/POST, JSON, and revision numbers.
- **Finally:** learn basic ML concepts: training vs inference, landmarks vs classifications, validation data, accuracy and latency. A future custom gesture classifier becomes much easier once these make sense.

## Small changes you can own

1. Adjust a board color and explain the CSS rule.
2. Change a help sentence and find where it appears.
3. Add a test for a chess position you know.
4. Change the dwell time, test it with a friend, and explain whether it became easier or harder.
5. Record the number of accidental moves in 20 attempts under different lighting conditions.

You can honestly say this project was built with AI assistance. What makes it yours is learning how it works, testing it, making your own decisions, and being able to explain the tradeoffs. You do not need to pretend you wrote every line unaided.
