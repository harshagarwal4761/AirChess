import { getSessionUser } from "../../../lib/auth";
import { createRoom, credential, readBody, respond } from "../../../lib/room-service";
import type { TimeControlId } from "../../../lib/game";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return respond(async () => {
    const key = await credential(request);
    const user = await getSessionUser(request).catch(() => null);
    const body = (await readBody(request).catch(() => ({}))) as {
      timeControl?: TimeControlId;
    };
    return createRoom(key, body.timeControl, user);
  });
}
