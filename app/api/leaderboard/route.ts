import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { respond } from "../../../lib/room-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return respond(async () => {
    const db = getDb();
    const rows = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        rating: users.rating,
        wins: users.wins,
        losses: users.losses,
        draws: users.draws,
      })
      .from(users)
      .orderBy(desc(users.rating), desc(users.wins))
      .limit(20);
    return { players: rows };
  });
}
