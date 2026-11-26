"use client";

import { useCallback, useEffect, useState } from "react";

export type SongListSummary = { id: number; name: string; isDefault: boolean; songs: number; inUse: boolean };

/** Listas de músicas (admin): `undefined` enquanto carrega, `null` sem sessão. */
export function useSongLists(deps: unknown[] = []) {
  const [lists, setLists] = useState<SongListSummary[] | null | undefined>(undefined);
  const reload = useCallback(() => {
    fetch("/api/admin/songs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLists(d?.lists ?? null))
      .catch(() => setLists(null));
  }, []);
  useEffect(reload, [reload, ...deps]);
  return { lists, reload };
}

/** Lista sugerida ao abrir uma noite: a por defeito, ou a primeira. */
export const defaultListId = (lists: SongListSummary[] | null | undefined) => (lists?.find((l) => l.isDefault) ?? lists?.[0])?.id ?? null;
