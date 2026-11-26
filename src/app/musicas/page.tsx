"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Mic, Search } from "lucide-react";
import { Notice, Shell } from "@/components/Shell";
import { useLiveState } from "@/components/useLiveState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchSongs, type CatalogSong } from "@/lib/song-search";

/** Lista de músicas da noite (só leitura), para escolher antes de se inscrever. */
export default function SongsPage() {
  const { state } = useLiveState();
  const [songs, setSongs] = useState<CatalogSong[] | null>(null);
  const [query, setQuery] = useState("");
  const listName = state?.night?.status === "REGISTRATION" ? state.night.songListName : null;

  // Recarrega quando a lista da noite muda
  useEffect(() => {
    if (!listName) return;
    fetch("/api/songs", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSongs(d.songs ?? []))
      .catch(() => setSongs([]));
  }, [listName]);

  const filtered = useMemo(() => searchSongs(songs ?? [], query), [songs, query]);

  if (!state) return <Shell title="Lista de músicas">{null}</Shell>;
  if (!listName) {
    return (
      <Shell title="Lista de músicas">
        <Notice>A lista de músicas só está disponível enquanto as inscrições estão abertas.</Notice>
      </Shell>
    );
  }

  return (
    <Shell title="Lista de músicas">
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-background/90 px-4 pt-1 pb-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Procurar músicas"
            placeholder="Procura por artista ou música"
            className="h-11 pl-9 text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {songs && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {query ? `${filtered.length} de ${songs.length} músicas` : `${songs.length} músicas`}
          </p>
        )}
      </div>

      {songs && (
        <Card className="py-0">
          <CardContent className="px-0">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-muted-foreground">Nenhuma música encontrada.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((s) => (
                  <li key={s.id} className="px-4 py-3">
                    <p className="font-semibold">{s.title}</p>
                    {s.artist && <p className="text-sm text-muted-foreground">{s.artist}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-0 -mx-4 mt-4 bg-background/90 px-4 py-4 backdrop-blur">
        <Button asChild size="lg" className="h-14 w-full text-lg">
          <Link href="/registo">
            <Mic /> Inscrever-me
          </Link>
        </Button>
      </div>
    </Shell>
  );
}
