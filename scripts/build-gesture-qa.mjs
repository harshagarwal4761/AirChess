import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
// Run after a production build. This diagnostic exists only in ignored dist.
await mkdir('dist/client/gesture-qa', { recursive: true });
await build({ entryPoints: ['tests/browser/gesture-qa.tsx'], bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', outfile: 'dist/client/gesture-qa/harness.js', define: { 'process.env.NODE_ENV': '"production"' } });
await writeFile('dist/client/gesture-qa/index.html', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>AirChess local synthetic checks</title><link rel="stylesheet" href="/gesture-qa/harness.css"><script defer src="/gesture-qa/harness.js"></script>');
