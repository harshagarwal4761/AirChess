import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraPoint,
  exceededPalmJump,
  followPointer,
  hoverSelect,
  newHover,
  resolveControllerHand,
  type PointerState,
} from '../lib/air-pointer';
const e2 = { square: 'e2', x: 50, y: 50, size: 50 }, e4 = { ...e2, square: 'e4', y: 150 };
test('mapping matches an offset video rectangle with portrait cropping', () => {
  assert.deepEqual(cameraPoint({x:.5,y:.5},{width:1920,height:1080},{left:12,top:20,width:800,height:900}), {x:412,y:470});
});
test('mapping uses the rendered width excluding the scrollbar', () => {
  assert.deepEqual(cameraPoint({x:0,y:.5},{width:1600,height:900},{left:0,top:0,width:1585,height:890}), {x:1585,y:445});
});
test('pointer follows movement continuously and settles without pinch input', () => {
  let s: PointerState = {point:{x:0,y:0},time:0};
  for (let t=50;t<=500;t+=50) s=followPointer(s,{x:120,y:70},t);
  assert.ok(Math.hypot(s!.point.x-120,s!.point.y-70)<1);
});
test('hover selects exactly once and must leave before repeating', () => {
  let s=hoverSelect(newHover(),e2,0).state;
  const done=hoverSelect(s,e2,1100); assert.equal(done.confirmed,'e2');
  assert.equal(hoverSelect(done.state,e2,3000).confirmed,null);
  s=hoverSelect(done.state,e4,3100).state;
  assert.equal(hoverSelect(s,e4,4200).confirmed,'e4');
});
test('changing square or losing target resets countdown', () => {
  let s=hoverSelect(newHover(),e2,0).state;
  s=hoverSelect(s,e4,900).state;
  assert.equal(hoverSelect(s,e4,1200).confirmed,null);
  s=hoverSelect(s,null,1500).state;
  s=hoverSelect(s,e4,1600).state;
  assert.equal(hoverSelect(s,e4,2100).confirmed,null);
});
test('hoverSelect honors custom fast dwell threshold', () => {
  const s = hoverSelect(newHover(), e2, 0, 700).state;
  assert.equal(hoverSelect(s, e2, 650, 700).confirmed, null);
  assert.equal(hoverSelect(s, e2, 700, 700).confirmed, 'e2');
});
test('resolveControllerHand tolerates brief label flip in single-hand mode only', () => {
  const p = { x: 200, y: 200 };
  const last = { x: 215, y: 205 };
  assert.equal(resolveControllerHand(['Left'], 'Right', false, p, last, 300), 0);
  assert.equal(resolveControllerHand(['Left'], 'Right', true, p, last, 300), -1);
  assert.equal(resolveControllerHand(['Left'], 'Right', false, { x: 700, y: 700 }, last, 300), -1);
});
test('exceededPalmJump scales tolerance across low-FPS frame intervals', () => {
  const last = { x: 200, y: 200 };
  // 220px swipe at 12 FPS (~85ms) should not reset single-hand tracking on a 900px viewport.
  assert.equal(exceededPalmJump({ x: 420, y: 200 }, last, 85, 900, false), false);
  // Instantaneous 500px teleport in 16ms is still rejected.
  assert.equal(exceededPalmJump({ x: 700, y: 200 }, last, 16, 900, true), true);
});
