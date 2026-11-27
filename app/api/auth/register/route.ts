import { AuthError, registerUser } from "../../../../lib/auth";
import { readBody, RoomError } from "../../../../lib/room-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await readBody(request)) as {
      username?: string;
      password?: string;
      displayName?: string;
    };
    const { user, cookie } = await registerUser(
      String(body.username ?? ""),
      String(body.password ?? ""),
      body.displayName,
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
        : "Registration is unavailable right now.";
    return Response.json({ error }, { status });
  }
}
