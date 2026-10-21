"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Milissegundos até `endsAt` (atualiza a cada segundo); null sem prazo. */
export function useRemaining(endsAt: string | null | undefined, clockOffset = 0) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now() + clockOffset);
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [endsAt, clockOffset]);
  if (!endsAt || now === null) return null;
  return Math.max(0, new Date(endsAt).getTime() - now);
}

export function formatRemaining(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Contagem decrescente m:ss; fica vermelha no último minuto. */
export function Countdown({ endsAt, clockOffset, className }: { endsAt: string | null | undefined; clockOffset?: number; className?: string }) {
  const ms = useRemaining(endsAt, clockOffset);
  if (ms === null) return null;
  return (
    <span className={cn("tabular-nums", ms <= 60_000 && "text-destructive", className)} role="timer">
      {formatRemaining(ms)}
    </span>
  );
}
