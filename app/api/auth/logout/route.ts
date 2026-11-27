import { logoutUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookie = await logoutUser(request);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } },
  );
}
