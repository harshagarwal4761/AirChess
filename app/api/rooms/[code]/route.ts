import {
  credential,
  readBody,
  respond,
  roomRequest,
} from "../../../../lib/room-service";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ code: string }> };
export async function GET(request: Request, context: Context) {
  return respond(async () =>
    roomRequest((await context.params).code, await credential(request)),
  );
}
export async function POST(request: Request, context: Context) {
  return respond(async () =>
    roomRequest(
      (await context.params).code,
      await credential(request),
      await readBody(request),
    ),
  );
}
