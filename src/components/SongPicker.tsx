"use client";

import { useId, useMemo, useState } from "react";
import { Music, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { catalogLabel, searchSongs, type CatalogSong } from "@/lib/song-search";
import { cn } from "@/lib/utils";

const VISIBLE = 50;

/**
 * Escolha de uma música do catálogo: caixa de pesquisa com lista de sugestões
 * (padrão combobox: setas para navegar, Enter para escolher, Esc para limpar).
 */
export function SongPicker({
  id,
  songs,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  songs: CatalogSong[];
  value: number | null;
  onChange: (id: number | null) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = songs.find((s) => s.id === value) ?? null;
  const matches = useMemo(() => searchSongs(songs, query), [songs, query]);
  const visible = matches.slice(0, VISIBLE);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
        <Music className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{selected.title}</span>
          {selected.artist && <span className="block truncate text-sm text-muted-foreground">{selected.artist}</span>}
        </p>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Mudar a música (escolhida: ${catalogLabel(selected)})`}
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
        >
          Mudar
        </Button>
      </div>
    );
  }

  const choose = (song: CatalogSong) => {
    onChange(song.id);
    setActive(0);
  };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!visible.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = (active + step + visible.length) % visible.length;
      setActive(next);
      document.getElementById(`${listId}-${visible[next].id}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault(); // não submete o formulário
      if (visible[active]) choose(visible[active]);
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      setQuery("");
      setActive(0);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={id}
          role="combobox"
          aria-expanded={visible.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={visible[active] ? `${listId}-${visible[active].id}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Procura por artista ou música"
          className="h-11 pl-9 text-base"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Músicas" className="max-h-72 overflow-y-auto rounded-md border">
        {visible.map((song, i) => (
          <li
            key={song.id}
            id={`${listId}-${song.id}`}
            role="option"
            aria-selected={i === active}
            onPointerMove={() => i !== active && setActive(i)}
            onClick={() => choose(song)}
            className={cn("cursor-pointer border-b px-3 py-2.5 last:border-b-0", i === active && "bg-accent")}
          >
            <span className="block font-medium">{song.title}</span>
            {song.artist && <span className="block text-sm text-muted-foreground">{song.artist}</span>}
          </li>
        ))}
        {!visible.length && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhuma música encontrada.</li>}
      </ul>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {matches.length > VISIBLE
          ? `A mostrar ${VISIBLE} de ${matches.length} músicas. Escreve para encontrar a tua.`
          : `${matches.length} ${matches.length === 1 ? "música" : "músicas"}`}
      </p>
    </div>
  );
}
