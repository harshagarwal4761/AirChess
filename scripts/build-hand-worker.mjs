import { fileURLToPath } from "node:url";
import { build } from "esbuild";
// MediaPipe loads its WASM glue with importScripts, requiring a classic worker.
// Generate the same bundled worker for development and production.
await build({
  entryPoints: [fileURLToPath(new URL("../workers/hand-tracking.worker.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("../public/hand-tracking-worker.js", import.meta.url)),
  bundle: true, format: "iife", platform: "browser", target: "es2022", minify: true,
});
