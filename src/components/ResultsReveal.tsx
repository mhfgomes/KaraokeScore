"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import type { PublicState } from "@/lib/types";
import { cn } from "@/lib/utils";

type Result = NonNullable<PublicState["results"]>[number];

export const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const PLACE: Record<number, string> = { 1: "1.º lugar", 2: "2.º lugar", 3: "3.º lugar" };

/** Pódio: só quem teve votos e ficou nos 3 primeiros (empates partilham o lugar). */
export function podiumOf(results: Result[]) {
  return results.filter((r) => r.votes > 0 && (r.rank ?? 99) <= 3);
}

// Duração de cada fase (ms)
const INTRO = 3500;
const SUSPENSE = 3000;
const SUSPENSE_WINNER = 5000;
const SHOW = 3500;

type Step = { kind: "intro" } | { kind: "suspense"; rank: number } | { kind: "show"; rank: number } | { kind: "done" };

/**
 * Revela o pódio do 3.º para o 1.º lugar, com uma pausa de suspense antes de
 * cada lugar (mais longa para o vencedor) e confetti no fim.
 */
export function ResultsReveal({ results }: { results: Result[] }) {
  const podium = useMemo(() => podiumOf(results), [results]);
  // Lugares por ordem de revelação (ex.: empate 1,1,3 → 3 e depois 1)
  const ranks = useMemo(() => [...new Set(podium.map((r) => r.rank!))].sort((a, b) => b - a), [podium]);

  const steps = useMemo<{ step: Step; ms: number }[]>(
    () => [
      { step: { kind: "intro" }, ms: INTRO },
      ...ranks.flatMap((rank) => [
        { step: { kind: "suspense", rank } as Step, ms: rank === 1 ? SUSPENSE_WINNER : SUSPENSE },
        { step: { kind: "show", rank } as Step, ms: SHOW },
      ]),
      { step: { kind: "done" }, ms: 0 },
    ],
    [ranks],
  );

  const [index, setIndex] = useState(0);
  useEffect(() => {
    const { ms } = steps[index];
    if (!ms) return;
    const t = setTimeout(() => setIndex((i) => i + 1), ms);
    return () => clearTimeout(t);
  }, [index, steps]);

  const step = steps[index].step;
  // Lugares já revelados (o atual incluído quando está a ser mostrado)
  const revealedUntil = step.kind === "done" ? 0 : step.kind === "show" ? step.rank : step.kind === "suspense" ? step.rank + 1 : 99;
  const revealed = podium.filter((r) => r.rank! >= revealedUntil).sort((a, b) => a.rank! - b.rank!);

  if (podium.length === 0) return <p className="text-4xl text-muted-foreground">Não houve votos nesta noite.</p>;

  if (step.kind === "intro") {
    return (
      <div className="flex flex-col items-center gap-8 text-center">
        <p className="animate-rise text-7xl font-extrabold">A votação terminou!</p>
        <p className="animate-pulse text-4xl text-muted-foreground">A contar os votos…</p>
        <Equalizer />
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-6">
      {step.kind === "suspense" && (
        <div className="flex flex-col items-center gap-6 py-6 text-center">
          <p className="animate-rise text-5xl font-bold text-muted-foreground">
            {step.rank === 1 ? "E o grande vencedor da noite é…" : `Em ${PLACE[step.rank]}…`}
          </p>
          <span className="animate-drumroll text-9xl">🥁</span>
        </div>
      )}
      <div className="w-full space-y-4">
        {revealed.map((r) => (
          <ResultCard key={r.id} result={r} highlight={r.rank === 1} fresh={step.kind === "show" && r.rank === step.rank} />
        ))}
      </div>
      {revealed.some((r) => r.rank === 1) && <Confetti />}
    </div>
  );
}

function ResultCard({ result: r, highlight, fresh }: { result: Result; highlight?: boolean; fresh?: boolean }) {
  return (
    <Card
      className={cn(
        "flex-row items-center gap-6 rounded-3xl p-6",
        fresh && "animate-reveal",
        highlight && "py-8",
      )}
    >
      <span className={cn(highlight ? "text-8xl" : "text-6xl")}>{MEDAL[r.rank!]}</span>
      <div className="flex-1">
        <p className={cn("font-extrabold", highlight ? "text-6xl text-gold" : "text-4xl")}>{r.name}</p>
        <p className="text-2xl text-muted-foreground">{r.song}</p>
      </div>
      <div className="text-right">
        <p className="text-4xl font-extrabold text-gold">+{r.points} pts</p>
        <p className="text-xl text-muted-foreground">{r.votes} votos</p>
      </div>
    </Card>
  );
}

/** Pódio estático (sem animação), do 1.º para o 3.º. */
export function Podium({ results }: { results: Result[] }) {
  const podium = podiumOf(results);
  if (podium.length === 0) return <p className="text-4xl text-muted-foreground">Não houve votos nesta noite.</p>;
  return (
    <div className="w-full max-w-5xl space-y-4">
      {podium.map((r) => (
        <ResultCard key={r.id} result={r} highlight={r.rank === 1} />
      ))}
    </div>
  );
}

/** Barras a "dançar" enquanto se contam os votos. */
function Equalizer() {
  return (
    <div className="flex h-32 items-end gap-3" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          className="w-8 animate-pulse rounded-t-lg bg-gradient-to-t from-gold-deep via-primary to-gold"
          style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 4) * 150}ms`, animationDuration: `${600 + (i % 3) * 200}ms` }}
        />
      ))}
    </div>
  );
}

const CONFETTI_COLORS = ["#f2cc74", "#d9a032", "#f1e4c6", "#e0614a", "#8a5a14"];

/** Confetti em CSS (posições determinísticas, sem Math.random no render). */
function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 70 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-4 w-2.5 animate-confetti rounded-sm"
          style={{
            left: `${(i * 53) % 100}%`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            // Duração e atraso diferentes por peça (o atraso negativo espalha-as logo no ecrã)
            animationDuration: `${3 + ((i * 7) % 30) / 10}s`,
            animationDelay: `-${((i * 13) % 40) / 10}s`,
          }}
        />
      ))}
    </div>
  );
}
