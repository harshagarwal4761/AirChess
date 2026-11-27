import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimitsForTest } from "../lib/rate-limit";

test("checkRateLimit enforces window cap and resets after window expires", () => {
  resetRateLimitsForTest();
  const key = "auth:1.2.3.4";
  assert.equal(checkRateLimit(key, 2, 1000, 100).allowed, true);
  assert.equal(checkRateLimit(key, 2, 1000, 200).allowed, true);
  const blocked = checkRateLimit(key, 2, 1000, 300);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 1);
  assert.equal(checkRateLimit(key, 2, 1000, 1200).allowed, true);
});
