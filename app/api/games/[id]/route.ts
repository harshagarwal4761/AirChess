import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { games } from "../../../../db/schema";
import { respond, RoomError } from "../../../../lib/room-service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  return respond(async () => {
    const id = (await context.params).id;
    const db = getDb();
    const row = await db.select().from(games).where(eq(games.id, id)).get();
    if (!row) throw new RoomError("Archived game not found.", 404);
    return {
      game: {
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
      },
    };
  });
}
