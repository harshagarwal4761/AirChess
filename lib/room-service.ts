import type { Color } from "chess.js";
import { eq, and, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { games, rooms, users } from "../db/schema";
import type { PublicUser } from "./auth";
import { calculateElo } from "./elo";
import {
  applyAction,
  newGame,
  TIME_CONTROLS,
  type Action,
  type RoomState,
  type TimeControlId,
} from "./game";

export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const lifetime = 7 * 24 * 60 * 60 * 1000;
const roomListeners = new Map<string, Set<() => void>>();

export function subscribeRoom(code: string, listener: () => void) {
  let set = roomListeners.get(code);
  if (!set) {
    set = new Set();
    roomListeners.set(code, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) roomListeners.delete(code);
  };
}

function notifyRoom(code: string) {
  const set = roomListeners.get(code);
  if (!set) return;
  for (const listener of set) listener();
}

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
    whiteName: row.whiteName ?? null,
    blackName: row.blackName ?? null,
    spectating: false,
    serverNow: Date.now(),
  };
}

function spectatorView(row: typeof rooms.$inferSelect) {
  return {
    code: row.code,
    color: null as Color | null,
    ready: Boolean(row.black),
    revision: row.revision,
    state: JSON.parse(row.state) as RoomState,
    whiteName: row.whiteName ?? null,
    blackName: row.blackName ?? null,
    spectating: true,
    serverNow: Date.now(),
  };
}

export async function createRoom(
  key: string,
  timeControl: TimeControlId = "untimed",
  user: PublicUser | null = null,
) {
  const control: TimeControlId = timeControl in TIME_CONTROLS ? timeControl : "untimed";
  const db = getDb();
  const now = Date.now();
  // Best-effort purge of expired rooms so D1 stays bounded.
  await db.delete(rooms).where(lt(rooms.updatedAt, now - lifetime)).catch(() => {});
  for (let i = 0; i < 6; i++) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const code = String(100000 + (random[0] % 900000));
    const row = {
      code,
      white: key,
      whiteUserId: user?.id ?? null,
      whiteName: user ? `@${user.username}` : null,
      state: JSON.stringify(newGame(1, control)),
      revision: 0,
      createdAt: now,
      updatedAt: now,
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

export async function watchRoom(code: string) {
  if (!/^\d{6}$/.test(code))
    throw new RoomError("Enter a six-digit room code.");
  const db = getDb();
  const row = await db.select().from(rooms).where(eq(rooms.code, code)).get();
  if (!row || Date.now() - row.updatedAt > lifetime)
    throw new RoomError("Room not found or expired. Create a new room.", 404);
  return spectatorView(row);
}

export async function getRoomRevision(code: string) {
  const db = getDb();
  const row = await db
    .select({ revision: rooms.revision, updatedAt: rooms.updatedAt })
    .from(rooms)
    .where(eq(rooms.code, code))
    .get();
  if (!row || Date.now() - row.updatedAt > lifetime) return null;
  return row.revision;
}

async function archiveFinishedRoomGame(
  row: typeof rooms.$inferSelect,
  next: RoomState,
) {
  if (!next.result || row.archivedGame) return;
  const db = getDb();
  const whiteUser = row.whiteUserId
    ? await db.select().from(users).where(eq(users.id, row.whiteUserId)).get()
    : null;
  const blackUser = row.blackUserId
    ? await db.select().from(users).where(eq(users.id, row.blackUserId)).get()
    : null;

  const whiteBefore: number | null = whiteUser?.rating ?? null;
  let whiteAfter: number | null = whiteBefore;
  const blackBefore: number | null = blackUser?.rating ?? null;
  let blackAfter: number | null = blackBefore;

  if (whiteUser && blackUser && whiteUser.id !== blackUser.id) {
    const elo = calculateElo(whiteUser.rating, blackUser.rating, next.result.winner);
    whiteAfter = elo.whiteAfter;
    blackAfter = elo.blackAfter;
  }

  const updateStats = async (user: typeof users.$inferSelect | null, side: Color, afterRating: number | null) => {
    if (!user) return;
    const isWin = next.result!.winner === side;
    const isLoss = next.result!.winner !== null && next.result!.winner !== side;
    const isDraw = next.result!.winner === null;
    await db
      .update(users)
      .set({
        rating: afterRating ?? user.rating,
        wins: sql`${users.wins} + ${isWin ? 1 : 0}`,
        losses: sql`${users.losses} + ${isLoss ? 1 : 0}`,
        draws: sql`${users.draws} + ${isDraw ? 1 : 0}`,
      })
      .where(eq(users.id, user.id));
  };

  await updateStats(whiteUser ?? null, "w", whiteAfter);
  await updateStats(blackUser ?? null, "b", blackAfter);

  await db.insert(games).values({
    id: crypto.randomUUID(),
    mode: "online",
    roomCode: row.code,
    whiteUserId: row.whiteUserId ?? null,
    blackUserId: row.blackUserId ?? null,
    whiteName: row.whiteName ?? "White",
    blackName: row.blackName ?? "Black",
    timeControl: next.clock?.control ?? "untimed",
    moves: JSON.stringify(next.moves),
    resultText: next.result.text,
    winner: next.result.winner,
    whiteRatingBefore: whiteBefore,
    whiteRatingAfter: whiteAfter,
    blackRatingBefore: blackBefore,
    blackRatingAfter: blackAfter,
    createdAt: Date.now(),
  });
}

export async function roomRequest(
  code: string,
  key: string,
  body?: { type?: string; revision?: number; action?: Action },
  user: PublicUser | null = null,
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
      .set({
        black: key,
        blackUserId: user?.id ?? null,
        blackName: user ? `@${user.username}` : null,
        revision: row.revision + 1,
        updatedAt: Date.now(),
      })
      .where(and(eq(rooms.code, code), eq(rooms.revision, row.revision)))
      .returning();
    if (!updated.length)
      throw new RoomError("The room changed. Try joining again.", 409);
    notifyRoom(code);
    return view(updated[0], key);
  }
  const current = view(row, key);
  if (!body) return current;
  if (body.type !== "action" || !body.action)
    throw new RoomError("Unknown room action.");
  if (!current.ready) throw new RoomError("Wait for your friend to join.");
  if (typeof body.revision !== "number" || !Number.isInteger(body.revision) || body.revision < 0)
    throw new RoomError("Invalid room revision.");
  if (body.revision !== row.revision)
    throw new RoomError(
      "The board changed. Wait for it to sync and try again.",
      409,
    );
  let next: RoomState;
  try {
    next = applyAction(current.state, current.color, body.action, Date.now());
  } catch (e) {
    throw new RoomError(e instanceof Error ? e.message : "Invalid move.");
  }
  const shouldArchive = Boolean(next.result && !row.archivedGame);
  const nextArchived = !next.result ? 0 : row.archivedGame || (shouldArchive ? 1 : 0);
  const updated = await db
    .update(rooms)
    .set({
      state: JSON.stringify(next),
      archivedGame: nextArchived,
      revision: row.revision + 1,
      updatedAt: Date.now(),
    })
    .where(and(eq(rooms.code, code), eq(rooms.revision, row.revision)))
    .returning();
  if (!updated.length)
    throw new RoomError("Another action arrived first. Please try again.", 409);
  if (shouldArchive) {
    await archiveFinishedRoomGame(row, next).catch((e) => console.error("Archive failed", e));
  }
  notifyRoom(code);
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
  if (new TextEncoder().encode(text).length > 2048)
    throw new RoomError("Request too large.", 413);
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object") throw new Error();
    return body;
  } catch {
    throw new RoomError("Invalid request.");
  }
}
