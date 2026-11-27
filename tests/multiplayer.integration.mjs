// Run against a local server with its D1 migrations applied. Uses only disposable test rooms.
import assert from "node:assert/strict";
const origin = process.env.AIRCHESS_TEST_URL ?? "http://localhost:5173";
const white = crypto.randomUUID(),
  black = crypto.randomUUID(),
  stranger = crypto.randomUUID();
async function request(path, key, body, expected = 200) {
  const response = await fetch(`${origin}/api/rooms${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
let r = await request("", white, { type: "create" });
const code = r.code;
assert.equal(r.color, "w");
assert.equal(r.ready, false);
await request(
  `/${code}`,
  white,
  {
    type: "action",
    revision: r.revision,
    action: { type: "move", from: "e2", to: "e4" },
  },
  400,
);
r = await request(`/${code}`, black, { type: "join" });
assert.equal(r.color, "b");
assert.equal(r.ready, true);
await request(`/${code}`, stranger, { type: "join" }, 409);
await request(`/${code}`, stranger, undefined, 403);
await request(`/${code}`, "bad", undefined, 401);
await request(
  `/${code}`,
  black,
  {
    type: "action",
    revision: r.revision,
    action: { type: "move", from: "e7", to: "e5" },
  },
  400,
);
await request(
  `/${code}`,
  white,
  {
    type: "action",
    revision: r.revision,
    action: { type: "move", from: "e2", to: "e5" },
  },
  400,
);
const stale = r.revision;
r = await request(`/${code}`, white, {
  type: "action",
  revision: r.revision,
  action: { type: "move", from: "e2", to: "e4" },
});
assert.deepEqual(r.state.moves, ["e4"]);
await request(
  `/${code}`,
  black,
  {
    type: "action",
    revision: stale,
    action: { type: "move", from: "e7", to: "e5" },
  },
  409,
);
r = await request(`/${code}`, black, {
  type: "action",
  revision: r.revision,
  action: { type: "move", from: "e7", to: "e5" },
});
const fetched = await request(`/${code}`, white);
assert.deepEqual(fetched.state.moves, ["e4", "e5"]);
assert.ok(!("white" in fetched));
// Both requests carry the same revision: exactly one must commit.
const race = await Promise.all(
  [1, 2].map(() =>
    fetch(`${origin}/api/rooms/${code}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${white}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "action",
        revision: r.revision,
        action: { type: "move", from: "g1", to: "f3" },
      }),
    }),
  ),
);
assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
r = await request(`/${code}`, black);
r = await request(`/${code}`, black, {
  type: "action",
  revision: r.revision,
  action: { type: "offer-draw" },
});
await request(
  `/${code}`,
  black,
  { type: "action", revision: r.revision, action: { type: "accept-draw" } },
  400,
);
r = await request(`/${code}`, white, {
  type: "action",
  revision: r.revision,
  action: { type: "accept-draw" },
});
assert.equal(r.state.result.text, "Draw by agreement");
r = await request(`/${code}`, white, {
  type: "action",
  revision: r.revision,
  action: { type: "rematch" },
});
assert.ok(r.state.result);
r = await request(`/${code}`, black, {
  type: "action",
  revision: r.revision,
  action: { type: "rematch" },
});
assert.equal(r.state.game, 2);
assert.deepEqual(r.state.moves, []);
r = await request(`/${code}`, black, {
  type: "action",
  revision: r.revision,
  action: { type: "resign" },
});
assert.equal(r.state.result.winner, "w");

// Spectator read-only view & timed room creation.
const timed = await request("", white, { type: "create", timeControl: "blitz3_2" });
assert.equal(timed.state.clock.control, "blitz3_2");
assert.equal(timed.state.clock.wMs, 180000);
await request(`/${timed.code}`, black, { type: "join" });
const watchRes = await fetch(`${origin}/api/rooms/${timed.code}?watch=1`);
assert.equal(watchRes.status, 200);
const watchData = await watchRes.json();
assert.equal(watchData.spectating, true);
assert.equal(watchData.color, null);
assert.ok(!("white" in watchData) && !("black" in watchData));

// SSE event stream emits initial state snapshot cleanly.
const sseAbort = new AbortController();
const sseRes = await fetch(`${origin}/api/rooms/${timed.code}/events?watch=1`, {
  signal: sseAbort.signal,
});
assert.equal(sseRes.status, 200);
assert.match(sseRes.headers.get("content-type") ?? "", /text\/event-stream/);
const reader = sseRes.body.getReader();
const chunk = new TextDecoder().decode((await reader.read()).value);
assert.match(chunk, /event: state/);
sseAbort.abort();

console.log(
  "Multiplayer integration passed: create, seats, auth, legal turns, stale/racing writes, reconnect, draw, rematch, resign, timed clocks, spectators, and SSE stream.",
);
