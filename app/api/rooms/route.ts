import { getSessionUser } from "../../../lib/auth";
import { checkRateLimit, clientIdentifier } from "../../../lib/rate-limit";
import { createRoom, credential, readBody, respond } from "../../../lib/room-service";
import type { TimeControlId } from "../../../lib/game";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const limit = checkRateLimit(`room-create:${clientIdentifier(request)}`, 60, 60_000);
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many room creation requests. Please wait a moment." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSec),
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return respond(async () => {
    const key = await credential(request);
    const user = await getSessionUser(request).catch(() => null);
    const body = (await readBody(request).catch(() => ({}))) as {
      timeControl?: TimeControlId;
    };
    return createRoom(key, body.timeControl, user);
  });
}
