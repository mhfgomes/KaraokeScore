"use client";

import { useEffect, useState } from "react";
import { Podium, ResultsReveal } from "@/components/ResultsReveal";
import { useLiveState } from "@/components/useLiveState";
import { Brand } from "@/components/Brand";
import { Countdown } from "@/components/Countdown";
import { Card } from "@/components/ui/card";
import { STATUS_LABEL } from "@/lib/types";

export default function LivePage() {
  const { state, clockOffset } = useLiveState();
  const night = state?.night;

  // A revelação animada corre quando a votação fecha com o telão aberto
  // (ou ao carregar na tecla R, para repetir)
  const [prevStatus, setPrevStatus] = useState(night?.status);
  const [revealRun, setRevealRun] = useState(0);
  if (night?.status !== prevStatus) {
    setPrevStatus(night?.status);
    if (prevStatus === "VOTING" && night?.status === "CLOSED") setRevealRun((n) => n + 1);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") setRevealRun((n) => n + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!state) return null;

  if (!night || night.status === "CLOSED") {
    const results = state.results ?? [];
    return (
      <Screen title={night ? "Resultados da noite" : state.brand.name} subtitle={night?.date}>
        {results.length === 0 ? (
          <p className="text-4xl text-muted-foreground">Até à próxima! 🎤</p>
        ) : revealRun > 0 ? (
          <ResultsReveal key={revealRun} results={results} />
        ) : (
          <Podium results={results} />
        )}
      </Screen>
    );
  }

  if (night.status === "REGISTRATION") {
    const current = state.queue.find((q) => q.id === night.currentId);
    const upcoming = state.queue.filter((q) => q.status === "QUEUED" && q.id !== night.currentId).slice(0, 5);
    return (
      <Screen title={STATUS_LABEL.REGISTRATION} subtitle={night.date}>
        <div className="grid w-full grid-cols-[1fr_auto] gap-12">
          <div className="space-y-8">
            <Card className="block rounded-3xl border-2 border-primary p-8 ring-0">
              <p className="text-xl font-bold tracking-widest text-primary">A CANTAR AGORA</p>
              {current ? (
                <>
                  <p className="mt-2 text-6xl font-extrabold">{current.name}</p>
                  <p className="mt-2 text-3xl text-muted-foreground">
                    {current.song}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-4xl text-muted-foreground">A preparar o palco…</p>
              )}
            </Card>
            <div>
              <p className="mb-3 text-xl font-bold tracking-widest text-muted-foreground">A SEGUIR</p>
              {upcoming.length === 0 && <p className="text-2xl text-muted-foreground">Ninguém em espera. Inscreve-te!</p>}
              <ol className="space-y-2">
                {upcoming.map((q) => (
                  <li key={q.id} className="flex items-baseline gap-4 text-3xl">
                    <span className="w-14 text-muted-foreground">#{q.position}</span>
                    <span className="font-bold">{q.name}</span>
                    <span className="truncate text-2xl text-muted-foreground">{q.song}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <Qr target="registo" label="Inscreve-te" baseUrl={state.baseUrl} path="/registo" />
        </div>
      </Screen>
    );
  }

  const voting = state.voting!;
  return (
    <Screen
      title="Votação aberta"
      subtitle={
        <>
          {voting.total} votos
          {night.votingEndsAt && (
            <>
              {" · fecha em "}
              <Countdown endsAt={night.votingEndsAt} clockOffset={clockOffset} className="font-extrabold text-foreground" />
            </>
          )}
        </>
      }
    >
      <div className="grid w-full grid-cols-[1fr_auto] gap-12">
        <Card className="h-[60vh] flex-row items-end gap-4 rounded-3xl p-8">
          {voting.bars.map((pct, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end text-center">
              <span className="mb-2 text-2xl font-bold">{pct}%</span>
              <div
                className="rounded-t-xl bg-gradient-to-t from-gold-deep via-primary to-gold transition-all duration-700"
                style={{ height: `${Math.max(pct, 1)}%` }}
              />
            </div>
          ))}
        </Card>
        <Qr target="votar" label="Vota já" baseUrl={state.baseUrl} path="/votar" />
      </div>
    </Screen>
  );
}

function Screen({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col gap-10 p-12">
      <header className="flex items-center justify-between gap-8">
        <div>
          <h1 className="text-6xl font-extrabold">{title}</h1>
          <span className="text-3xl text-muted-foreground">{subtitle}</span>
        </div>
        <Brand size="xl" />
      </header>
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </main>
  );
}

function Qr({ target, label, baseUrl, path }: { target: string; label: string; baseUrl: string; path: string }) {
  return (
    <div className="flex flex-col items-center gap-4 self-center">
      <p className="text-3xl font-extrabold text-primary">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/qr?t=${target}`} alt="" className="size-80 rounded-2xl bg-white p-3" />
      <p className="text-xl text-muted-foreground">{baseUrl + path}</p>
    </div>
  );
}
