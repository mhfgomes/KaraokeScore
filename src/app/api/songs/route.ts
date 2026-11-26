import { handle } from "@/lib/http";
import { songsForCurrentNight } from "@/lib/songs";

/** Músicas da lista usada na noite aberta (para escolher na inscrição). */
export const GET = handle(async () => ({ songs: await songsForCurrentNight() }));
