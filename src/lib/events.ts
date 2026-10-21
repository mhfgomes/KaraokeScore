import { EventEmitter } from "node:events";

// Canal em memória para SSE. Funciona porque a app corre num único processo (`next start`).
const globalForEvents = globalThis as unknown as { karaokeEvents?: EventEmitter };

export const events = globalForEvents.karaokeEvents ?? new EventEmitter();
events.setMaxListeners(0);
globalForEvents.karaokeEvents = events;

export function notifyUpdate() {
  events.emit("update");
}
