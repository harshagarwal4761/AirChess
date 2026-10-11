# Third-party components and attribution

- **MediaPipe Tasks Vision 0.10.32** by Google: pretrained hand landmark inference and WebAssembly runtime. Runtime files in `public/mediapipe/wasm` are copied from the pinned npm package. Source: https://github.com/google-ai-edge/mediapipe . Package license is Apache-2.0; see the accompanying runtime license.
- **Hand Landmarker model**, float16, version 1: downloaded from https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task . Official task documentation and upstream model information: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker . This project does not claim authorship or training of the model. Refer to upstream model terms before redistributing variants.
- **chess.js 1.4.0**: chess rules, notation and legality. https://github.com/jhlywa/chess.js (BSD-2-Clause).
- **Lucide React**: interface icons. https://lucide.dev (ISC).
- **DM Sans / Manrope**: Google Fonts, loaded through its CSS service. Fonts fall back to local sans-serif if the service is unavailable.
- **React, TypeScript, Vinext, Vite, Drizzle, Cloudflare tooling** and starter integration: see each package's upstream license. The Sites build integration retains its original license in `build/`.

Chess pieces use platform chess glyphs; no proprietary chess artwork is embedded.
