"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Countdown } from "@/components/Countdown";
import { Notice, Shell } from "@/components/Shell";
import { postJson, useLiveState } from "@/components/useLiveState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function VotePage() {
  const { state, refresh, clockOffset } = useLiveState();
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function vote() {
    if (selected === null) return;
    setBusy(true);
    try {
      await postJson("/api/vote", { performanceId: selected });
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <Shell title="Votar">{null}</Shell>;

  if (state.night?.status !== "VOTING" || !state.voting) {
    return (
      <Shell title="Votar">
        <Notice>
          {state.night?.status === "CLOSED" ? "A votação terminou. Vê os resultados nas classificações." : "A votação ainda não abriu."}
        </Notice>
      </Shell>
    );
  }

  if (state.hasVoted) {
    return (
      <Shell title="Obrigado! 🙌">
        <Card>
          <CardContent className="text-center">
            <p className="text-muted-foreground">O teu voto foi registado.</p>
            <p className="mt-4 text-5xl font-extrabold text-primary">{state.voting.total}</p>
            <p className="text-muted-foreground">votos até agora</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell title="Escolhe o teu favorito">
      {state.night.votingEndsAt && (
        <p className="mb-3 text-center text-muted-foreground">
          A votação fecha em <Countdown endsAt={state.night.votingEndsAt} clockOffset={clockOffset} className="font-bold text-foreground" />
        </p>
      )}
      <div role="radiogroup" className="space-y-3">
        {state.voting.candidates.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={selected === c.id}
            onClick={() => setSelected(c.id)}
            className={cn(
              "w-full rounded-xl border bg-card p-5 text-left transition-colors hover:border-muted-foreground",
              selected === c.id && "border-primary ring-2 ring-primary hover:border-primary",
            )}
          >
            <p className="text-lg font-bold">{c.name}</p>
            <p className="text-sm text-muted-foreground">
              {c.song}
            </p>
          </button>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-4 mt-4 bg-background/90 px-4 py-4 backdrop-blur">
        <Button size="lg" className="h-14 w-full text-lg" disabled={selected === null || busy} onClick={vote}>
          {busy ? "A votar…" : "Confirmar voto"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Só podes votar uma vez.</p>
      </div>
    </Shell>
  );
}
