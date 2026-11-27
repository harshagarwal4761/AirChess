import { AuthError, loginUser } from "../../../../lib/auth";
import { readBody, RoomError } from "../../../../lib/room-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await readBody(request)) as { username?: string; password?: string };
    const { user, cookie } = await loginUser(
      String(body.username ?? ""),
      String(body.password ?? ""),
      request,
    );
    return Response.json(
      { user },
      { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const status = e instanceof AuthError || e instanceof RoomError ? e.status : 503;
    const error =
      e instanceof AuthError || e instanceof RoomError
        ? e.message
        : "Login is unavailable right now.";
    return Response.json({ error }, { status });
  }
}
