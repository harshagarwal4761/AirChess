import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPanel, readOffset } from '../lib/panel-layout';
const base = { left: 200, top: 100, width: 400, height: 450 };
test('panel can move in all four directions within the screen', () => {
  assert.deepEqual(clampPanel({x:-80,y:30},base,{width:1200,height:800}),{x:-80,y:30});
  assert.deepEqual(clampPanel({x:120,y:-30},base,{width:1200,height:800}),{x:120,y:-30});
});
test('panel clamping keeps handles reachable after viewport shrinks', () => {
  const offset = clampPanel({x:900,y:-1000},base,{width:500,height:400});
  assert.equal(base.left+offset.x,92);
  assert.equal(base.top+offset.y,8);
});
test('corrupt layout preferences never produce invalid transforms', () => {
  for (const value of [null,'oops','{"x":null,"y":3}','{"x":1e999,"y":0}']) assert.deepEqual(readOffset(value),{x:0,y:0});
  assert.deepEqual(readOffset('{"x":-14,"y":35}'),{x:-14,y:35});
});
