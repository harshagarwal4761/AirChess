import { createRoom, credential, respond } from "../../../lib/room-service";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return respond(async () => createRoom(await credential(request)));
}
