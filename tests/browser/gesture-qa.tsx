// Local browser integration harness. Never imported by or shipped with the app.
// It replaces camera/model input, while mounting the real page and tracking hook.
import React from "react";
import { createRoot } from "react-dom/client";
import AirChess from "../../app/page";
import "../../app/globals.css";
let square = "e2", ratio = 1.1, missing = false, helper = false, curl = 0;
let stopped = 0, frames = 0, processing = 0, maxProcessing = 0;
let layoutEvents = 0;
const pinchTrace: string[] = [];
window.addEventListener('airchess-layout-change', () => layoutEvents++);
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const video = HTMLVideoElement.prototype;
Object.defineProperties(video, {
  videoWidth: { get: () => 960, configurable: true },
  videoHeight: { get: () => 540, configurable: true },
  readyState: { get: () => 4, configurable: true },
  currentTime: { get: () => performance.now() / 1000, configurable: true },
});
video.play = async () => {};
if (new URLSearchParams(location.search).get("scheduler") === "fallback") {
  Object.defineProperty(video, "requestVideoFrameCallback", { value: undefined, configurable: true });
} else {
  video.requestVideoFrameCallback = callback => window.setTimeout(() => callback(performance.now(), { mediaTime: performance.now() / 1000 } as VideoFrameCallbackMetadata), 16);
  video.cancelVideoFrameCallback = id => clearTimeout(id);
}
const stream = new MediaStream();
stream.getTracks = () => [{ stop: () => stopped++ } as unknown as MediaStreamTrack];
Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => stream } });
window.createImageBitmap = (async () => ({ close() {} })) as unknown as typeof createImageBitmap;
function screenHand(isHelper = false) {
  const rect = document.querySelector(`[data-square="${square}"]`)!.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + (isHelper ? 150 : 0), y = rect.top + rect.height / 2;
  const points = Array.from({ length: 21 }, () => ({ x, y: y + 60 }));
  points[0] = { x, y: y + 110 };
  points[5] = { x: x - 30, y: y + 65 };
  points[17] = { x: x + 30, y: y + 65 };
  points[8] = { x: x + (isHelper ? 0 : curl), y };
  points[4] = { x: points[8].x + (isHelper ? 80 : ratio * 60), y };
  if (isHelper) for (const i of [12, 16, 20]) points[i] = { x, y };
  const v = document.querySelector('video')!.getBoundingClientRect();
  const scale = Math.max(v.width / 960, v.height / 540);
  return points.map(p => ({ x: 1 - (p.x - v.left + (960 * scale - v.width) / 2) / (960 * scale), y: (p.y - v.top + (540 * scale - v.height) / 2) / (540 * scale), z: 0 }));
}
class FakeWorker {
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  dead = false;
  postMessage(data: { type: string; timestamp: number }) {
    if (data.type === "frame") { frames++; processing++; maxProcessing = Math.max(maxProcessing, processing); }
    setTimeout(() => {
      if (data.type === "frame") processing--;
      if (this.dead) return;
      if (data.type === "init") this.onmessage?.({ data: { type: "ready" } });
      else this.onmessage?.({ data: { type: "result", timestamp: data.timestamp, landmarks: missing ? [] : helper ? [screenHand(), screenHand(true)] : [screenHand()], handedness: missing ? [] : helper ? [[{ categoryName: "Right" }], [{ categoryName: "Left" }]] : [[{ categoryName: "Right" }]] } });
    }, 8);
  }
  terminate() { this.dead = true; }
}
window.Worker = FakeWorker as unknown as typeof Worker;
const root = document.createElement("div"); document.body.appendChild(root);
createRoot(root).render(<AirChess />);
const panel = document.createElement("div");
panel.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:1000;background:#fff;color:#111;padding:12px;max-width:420px;font:12px monospace;border:2px solid #24834d;pointer-events:none";
panel.innerHTML = '<button id="run-qa" style="pointer-events:auto">Run synthetic gesture checks</button><pre id="qa-results">Camera and model are simulated in this local test only.</pre>';
document.body.appendChild(panel);
const log = document.querySelector('#qa-results')!;
const check = (ok: boolean, name: string) => { log.textContent += `\n${ok ? "PASS" : "FAIL"}: ${name}`; if (!ok) throw new Error(name); };
const button = (text: string) => [...root.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!;
const cell = (name: string) => root.querySelector(`[data-square="${name}"]`)!;
const selected = (name: string) => cell(name).getAttribute('aria-pressed') === 'true';
const piece = (name: string, value: string) => cell(name).getAttribute('aria-label')!.includes(value);
async function aim(name: string, ms = 1550) { square = name; await pause(ms); }
async function pinches(name: string) {
  square = name; ratio = 1.1; curl = 0; await pause(550);
  for (let i = 0; i < 2; i++) {
    for (const closed of [true, false]) {
      ratio = closed ? .2 : 1.1; curl = closed ? 25 : 0;
      for (let j = 0; j < 5; j++) { await pause(50); pinchTrace.push(`${closed ? 'closed' : 'open'} layout=${layoutEvents}: ${root.querySelector('.air-feedback strong')?.textContent}`); }
    }
  }
  await pause(200);
}
document.querySelector('#run-qa')!.addEventListener('click', async () => {
  (document.querySelector('#run-qa') as HTMLButtonElement).disabled = true;
  (document.querySelector('#run-qa') as HTMLButtonElement).style.pointerEvents = 'none';
  log.textContent = "Running actual React page + tracking hook with synthetic landmarks…";
  try {
    button('Arrange layout').click(); await pause(100);
    button('Reset layout').click(); await pause(100);
    const board = root.querySelector('[data-movable="board"]')!;
    const before = board.getBoundingClientRect();
    const delta = before.left < 32 ? 24 : -24;
    (root.querySelector(`[aria-label="Move Chessboard ${delta > 0 ? 'right' : 'left'}"]`) as HTMLButtonElement).click();
    await pause(100);
    check(Math.abs(board.getBoundingClientRect().left - before.left - delta) < 1 && board.getBoundingClientRect().width === before.width, 'board moves without changing square size');
    check(Boolean(localStorage.getItem('airchess.layout.v1.board')), 'layout position saved');
    button('Done arranging').click(); await pause(100);
    const startedAt = performance.now();
    button('Enable air controls').click(); await pause(900);
    // Regression: a naturally curled thumb previously froze the cursor.
    ratio = .5; await aim('d2', 600);
    const r = cell('d2').getBoundingClientRect();
    const cursor = root.querySelector('.air-cursor') as HTMLElement;
    const pos = new DOMMatrix(getComputedStyle(cursor).transform);
    check(Math.hypot(pos.m41 - r.left - r.width / 2, pos.m42 - r.top - r.height / 2) < 6, 'cursor follows index with thumb partly closed');
    await aim('e2'); check(selected('e2'), 'hover selects intended White pawn on moved board');
    const measuredFps = frames * 1000 / (performance.now() - startedAt);
    check(measuredFps > 24, `uncapped synthetic throughput ${Math.round(measuredFps)} FPS`);
    await pause(1450); check(selected('e2'), 'holding does not deselect or repeat');
    missing = true; await pause(300); check(selected('e2'), 'tracking loss preserves selection');
    missing = false; await aim('d5'); check(piece('e2','white pawn'), 'illegal square cannot move the piece');
    await aim('e4'); check(piece('e4','white pawn'), 'hover commits legal White move');
    await aim('e7'); check(selected('e7'), 'same hand selects Black in practice');
    helper = true; await aim('e5', 1800);
    check(selected('e7') && piece('e7','black pawn'), 'second open palm pauses without dropping selection');
    helper = false; await pause(1900); check(piece('e5','black pawn'), 'lowering helper resumes and completes Black move');
    button('Double pinch').click(); ratio = 1.1;
    await pinches('g1'); check(selected('g1'), 'double pinch selects despite fingertip curl');
    await pinches('f3'); check(piece('f3','white knight'), 'double pinch commits intended destination');
    button('Stop camera').click(); await pause(100);
    check(stopped > 0, 'camera resources released');
    check(maxProcessing === 1, 'only one frame in flight');
    button('Arrange layout').click(); await pause(50);
    button('Reset layout').click(); await pause(50);
    check(!localStorage.getItem('airchess.layout.v1.board'), 'layout reset clears stored offsets');
    button('Done arranging').click();
    log.textContent += '\nALL 17 CHECKS PASSED';
  } catch (error) { log.textContent += `\nSTOPPED: ${error}\n${pinchTrace.join('\n')}`; }
});
