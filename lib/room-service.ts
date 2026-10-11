import type { Color } from "chess.js";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { rooms } from "../db/schema";
import { applyAction, newGame, type Action, type RoomState } from "./game";
export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const lifetime = 7 * 24 * 60 * 60 * 1000;
async function hash(token: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function credential(request: Request) {
  const token =
    request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  if (!/^[a-zA-Z0-9-]{36,100}$/.test(token))
    throw new RoomError(
      "Your player key is missing. Rejoin or create a room.",
      401,
    );
  return hash(token);
}
function view(row: typeof rooms.$inferSelect, key: string) {
  const color: Color | null =
    row.white === key ? "w" : row.black === key ? "b" : null;
  if (!color)
    throw new RoomError("This room belongs to different players.", 403);
  return {
    code: row.code,
    color,
    ready: Boolean(row.black),
    revision: row.revision,
    state: JSON.parse(row.state) as RoomState,
  };
}
export async function createRoom(key: string) {
  const db = getDb();
  for (let i = 0; i < 6; i++) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const code = String(100000 + (random[0] % 900000));
    const row = {
      code,
      white: key,
      state: JSON.stringify(newGame()),
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const inserted = await db
      .insert(rooms)
      .values(row)
      .onConflictDoNothing()
      .returning();
    if (inserted.length) return view(inserted[0], key);
  }
  throw new RoomError("Could not allocate a room. Please try again.", 503);
}
export async function roomRequest(
  code: string,
  key: string,
  body?: { type?: string; revision?: number; action?: Action },
) {
  if (!/^\d{6}$/.test(code))
    throw new RoomError("Enter a six-digit room code.");
  const db = getDb();
  const row = await db.select().from(rooms).where(eq(rooms.code, code)).get();
  if (!row || Date.now() - row.updatedAt > lifetime)
    throw new RoomError("Room not found or expired. Create a new room.", 404);
  if (body?.type === "join") {
    if (row.white === key || row.black === key) return view(row, key);
    if (row.black)
      throw new RoomError("This room already has two players.", 409);
    const updated = await db
      .update(rooms)
      .set({ black: key, revision: row.revision + 1, updatedAt: Date.now() })
      .where(and(eq(rooms.code, code), eq(rooms.revision, row.revision)))
      .returning();
    if (!updated.length)
      throw new RoomError("The room changed. Try joining again.", 409);
    return view(updated[0], key);
  }
  const current = view(row, key);
  if (!body) return current;
  if (body.type !== "action" || !body.action)
    throw new RoomError("Unknown room action.");
  if (!current.ready) throw new RoomError("Wait for your friend to join.");
  if (body.revision !== row.revision)
    throw new RoomError(
      "The board changed. Wait for it to sync and try again.",
      409,
    );
  let next: RoomState;
  try {
    next = applyAction(current.state, current.color, body.action);
  } catch (e) {
    throw new RoomError(e instanceof Error ? e.message : "Invalid move.");
  }
  const updated = await db
    .update(rooms)
    .set({
      state: JSON.stringify(next),
      revision: row.revision + 1,
      updatedAt: Date.now(),
    })
    .where(and(eq(rooms.code, code), eq(rooms.revision, row.revision)))
    .returning();
  if (!updated.length)
    throw new RoomError("Another action arrived first. Please try again.", 409);
  return view(updated[0], key);
}
export async function respond(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (!(e instanceof RoomError)) console.error("Room request failed", e);
    return Response.json(
      {
        error:
          e instanceof RoomError
            ? e.message
            : "The room service is unavailable. Try again shortly.",
      },
      { status: e instanceof RoomError ? e.status : 503 },
    );
  }
}
export async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 2048) throw new RoomError("Request too large.", 413);
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object") throw new Error();
    return body;
  } catch {
    throw new RoomError("Invalid request.");
  }
}
