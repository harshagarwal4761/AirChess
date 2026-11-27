import {
  credential,
  getRoomRevision,
  RoomError,
  roomRequest,
  subscribeRoom,
  watchRoom,
} from "../../../../../lib/room-service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: Context) {
  const code = (await context.params).code;
  const watch = new URL(request.url).searchParams.get("watch") === "1";

  let key = "";
  let initial: Awaited<ReturnType<typeof watchRoom>>;
  try {
    if (watch) {
      initial = await watchRoom(code);
    } else {
      key = await credential(request);
      initial = await roomRequest(code, key);
    }
  } catch (e) {
    const status = e instanceof RoomError ? e.status : 503;
    const message = e instanceof RoomError ? e.message : "Stream unavailable.";
    return Response.json({ error: message }, { status });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastRevision = initial.revision;
      let syncing = false;

      const send = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          close();
        }
      };

      const ping = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          close();
        }
      };

      const sync = async (forceFetch = false) => {
        if (closed || syncing) return;
        syncing = true;
        try {
          if (!forceFetch) {
            const rev = await getRoomRevision(code);
            if (rev === null) {
              send("closed", { error: "Room not found or expired." });
              close();
              return;
            }
            if (rev <= lastRevision) return;
          }
          const latest = watch ? await watchRoom(code) : await roomRequest(code, key);
          if (latest.revision > lastRevision) {
            lastRevision = latest.revision;
            send("state", latest);
          }
        } catch (e) {
          if (e instanceof RoomError && (e.status === 401 || e.status === 403 || e.status === 404)) {
            send("closed", { error: e.message });
            close();
          }
        } finally {
          syncing = false;
        }
      };

      const unsubscribe = subscribeRoom(code, () => {
        void sync(true);
      });
      const pollTimer = setInterval(() => void sync(false), 600);
      const pingTimer = setInterval(ping, 10_000);
      const maxLifetimeTimer = setTimeout(close, 25_000);

      function close() {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(pollTimer);
        clearInterval(pingTimer);
        clearTimeout(maxLifetimeTimer);
        try {
          controller.close();
        } catch {
          /* Stream already closed. */
        }
      }

      cleanup = close;
      send("state", initial);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
