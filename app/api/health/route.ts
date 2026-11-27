import { sql } from "drizzle-orm";
import { getDb } from "../../../db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    await db.run(sql`SELECT 1`);
    return Response.json(
      { ok: true, db: "connected", timestamp: Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, db: "unavailable", timestamp: Date.now() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
