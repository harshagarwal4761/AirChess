import { getSessionUser } from "../../../../lib/auth";
import {
  credential,
  readBody,
  respond,
  roomRequest,
  watchRoom,
} from "../../../../lib/room-service";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ code: string }> };
export async function GET(request: Request, context: Context) {
  return respond(async () => {
    const code = (await context.params).code;
    if (new URL(request.url).searchParams.get("watch") === "1") {
      return watchRoom(code);
    }
    return roomRequest(code, await credential(request));
  });
}
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    const user = await getSessionUser(request).catch(() => null);
    return roomRequest(
      (await context.params).code,
      await credential(request),
      await readBody(request),
      user,
    );
  });
}
