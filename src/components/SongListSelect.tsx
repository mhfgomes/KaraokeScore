"use client";

import { ListMusic } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SongListSummary } from "./useSongLists";

/** Valor "" = sem lista (música escrita à mão). */
export function SongListSelect({
  lists,
  value,
  onChange,
  allowNone = false,
  id,
  className,
}: {
  lists: SongListSummary[];
  value: number | null;
  onChange: (id: number | null) => void;
  allowNone?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <Select value={value === null ? "none" : String(value)} onValueChange={(v) => onChange(v === "none" ? null : Number(v))}>
      <SelectTrigger id={id} aria-label="Lista de músicas" className={className}>
        <ListMusic />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {lists.map((l) => (
          <SelectItem key={l.id} value={String(l.id)}>
            {l.name} ({l.songs}){l.isDefault ? " · por defeito" : ""}
          </SelectItem>
        ))}
        {allowNone && <SelectItem value="none">Sem lista (texto livre)</SelectItem>}
      </SelectContent>
    </Select>
  );
}
