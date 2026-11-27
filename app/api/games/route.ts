import { desc, eq, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { games, users } from "../../../db/schema";
import { getSessionUser } from "../../../lib/auth";
import { replay, TIME_CONTROLS, type TimeControlId } from "../../../lib/game";
import { readBody, respond, RoomError } from "../../../lib/room-service";

export const dynamic = "force-dynamic";

function serializeGame(row: typeof games.$inferSelect) {
  return {
    id: row.id,
    mode: row.mode,
    roomCode: row.roomCode,
    whiteName: row.whiteName,
    blackName: row.blackName,
    timeControl: row.timeControl,
    moves: JSON.parse(row.moves) as string[],
    resultText: row.resultText,
    winner: row.winner,
    whiteRatingBefore: row.whiteRatingBefore,
    whiteRatingAfter: row.whiteRatingAfter,
    blackRatingBefore: row.blackRatingBefore,
    blackRatingAfter: row.blackRatingAfter,
    createdAt: row.createdAt,
  };
}

export async function GET(request: Request) {
  return respond(async () => {
    const user = await getSessionUser(request);
    if (!user) return { games: [] };
    const db = getDb();
    const rows = await db
      .select()
      .from(games)
      .where(or(eq(games.whiteUserId, user.id), eq(games.blackUserId, user.id)))
      .orderBy(desc(games.createdAt))
      .limit(25);
    return { games: rows.map(serializeGame) };
  });
}

export async function POST(request: Request) {
  return respond(async () => {
    const user = await getSessionUser(request);
    if (!user) throw new RoomError("Sign in to archive games.", 401);
    const body = (await readBody(request)) as {
      mode?: string;
      playerColor?: "w" | "b";
      difficulty?: string;
      timeControl?: TimeControlId;
      moves?: string[];
      resultText?: string;
      winner?: "w" | "b" | null;
    };
    if (!Array.isArray(body.moves) || body.moves.length === 0) {
      throw new RoomError("Game has no moves to save.");
    }
    try {
      replay(body.moves);
    } catch {
      throw new RoomError("Invalid move list.");
    }
    const playerColor = body.playerColor === "b" ? "b" : "w";
    const diff =
      body.difficulty === "casual" || body.difficulty === "master" ? body.difficulty : "club";
    const aiLabel = `Stockfish (${diff[0].toUpperCase()}${diff.slice(1)})`;
    const tc = body.timeControl && body.timeControl in TIME_CONTROLS ? body.timeControl : "untimed";
    const winner = body.winner === "w" || body.winner === "b" ? body.winner : null;
    const isWin = winner === playerColor;
    const isLoss = winner !== null && winner !== playerColor;
    const isDraw = winner === null;

    const db = getDb();
    const id = crypto.randomUUID();
    await db.insert(games).values({
      id,
      mode: "ai",
      roomCode: null,
      whiteUserId: playerColor === "w" ? user.id : null,
      blackUserId: playerColor === "b" ? user.id : null,
      whiteName: playerColor === "w" ? `@${user.username}` : aiLabel,
      blackName: playerColor === "b" ? `@${user.username}` : aiLabel,
      timeControl: tc,
      moves: JSON.stringify(body.moves),
      resultText: String(body.resultText ?? "Finished").slice(0, 80),
      winner,
      whiteRatingBefore: null,
      whiteRatingAfter: null,
      blackRatingBefore: null,
      blackRatingAfter: null,
      createdAt: Date.now(),
    });
    await db
      .update(users)
      .set({
        wins: sql`${users.wins} + ${isWin ? 1 : 0}`,
        losses: sql`${users.losses} + ${isLoss ? 1 : 0}`,
        draws: sql`${users.draws} + ${isDraw ? 1 : 0}`,
      })
      .where(eq(users.id, user.id));

    return { id };
  });
}
