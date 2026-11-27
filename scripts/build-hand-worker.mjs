import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
// MediaPipe loads its WASM glue with importScripts, requiring a classic worker.
// Generate the same bundled worker for development and production.
await build({
  entryPoints: [fileURLToPath(new URL("../workers/hand-tracking.worker.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("../public/hand-tracking-worker.js", import.meta.url)),
  bundle: true, format: "iife", platform: "browser", target: "es2022", minify: true,
});

// Keep single-threaded Stockfish WASM assets synced for browser Web Worker use.
const stockfishDir = fileURLToPath(new URL("../public/stockfish", import.meta.url));
mkdirSync(stockfishDir, { recursive: true });
for (const file of ["stockfish.wasm.js", "stockfish.wasm", "Copying.txt"]) {
  copyFileSync(
    fileURLToPath(new URL(`../node_modules/stockfish.js/${file}`, import.meta.url)),
    `${stockfishDir}/${file}`,
  );
}
