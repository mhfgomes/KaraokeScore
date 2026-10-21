import { connection } from "next/server";
import { events } from "@/lib/events";

// SSE: envia "update" sempre que algo muda; os clientes voltam a pedir /api/state.
export async function GET(request: Request) {
  await connection();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const onUpdate = () => send("data: update\n\n");
      const heartbeat = setInterval(() => send(": ping\n\n"), 20000);

      events.on("update", onUpdate);
      send("retry: 3000\ndata: hello\n\n");

      cleanup = () => {
        clearInterval(heartbeat);
        events.off("update", onUpdate);
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: não fazer buffer do SSE
    },
  });
}
