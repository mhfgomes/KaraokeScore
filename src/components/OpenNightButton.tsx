"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SongListSelect } from "./SongListSelect";
import { defaultListId, type SongListSummary } from "./useSongLists";

/**
 * Abre uma noite. Com mais do que uma lista de músicas pergunta qual usar;
 * com uma (ou nenhuma) abre logo.
 */
export function OpenNightButton({
  onOpen,
  disabled,
  children = "Abrir nova noite",
}: {
  onOpen: (songListId: number | null) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const [lists, setLists] = useState<SongListSummary[] | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/songs", { cache: "no-store" });
      const found: SongListSummary[] = res.ok ? ((await res.json()).lists ?? []) : [];
      if (found.length > 1) {
        setChoice(defaultListId(found));
        setLists(found);
      } else onOpen(found[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button disabled={disabled || loading} onClick={start}>
        {children}
      </Button>
      <AlertDialog open={lists !== null} onOpenChange={(open) => !open && setLists(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Que lista de músicas usar?</AlertDialogTitle>
            <AlertDialogDescription>Na inscrição só se pode escolher uma música desta lista. Podes mudá-la depois em Noites.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="open-night-list">Lista de músicas</Label>
            {lists && <SongListSelect id="open-night-list" lists={lists} value={choice} onChange={setChoice} className="w-full" />}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={choice === null} onClick={() => onOpen(choice)}>
              Abrir noite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
