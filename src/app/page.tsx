"use client";

import Link from "next/link";
import { Mic, Star, Trophy, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brand } from "@/components/Brand";
import { useLiveState } from "@/components/useLiveState";
import { STATUS_LABEL } from "@/lib/types";

export default function Home() {
  const { state } = useLiveState();
  const night = state?.night;
  const live = night && night.status !== "CLOSED";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-4 px-4 py-10">
      <div className="mb-4 flex flex-col items-center gap-3 text-center">
        <h1>
          <Brand size="lg" />
        </h1>
        {state && (
          <Badge variant={live ? "default" : "secondary"}>
            {live ? `${STATUS_LABEL[night.status]} · ${night.date}` : "Nenhuma noite a decorrer"}
          </Badge>
        )}
      </div>
      {night?.status === "REGISTRATION" && (
        <Button asChild size="lg" className="h-16 text-xl">
          <Link href="/registo">
            <Mic /> Inscrever-me
          </Link>
        </Button>
      )}
      {night?.status === "VOTING" && (
        <Button asChild size="lg" className="h-16 text-xl">
          <Link href="/votar">
            <Star /> Votar
          </Link>
        </Button>
      )}
      <Button asChild variant="outline" size="lg" className="h-12">
        <Link href="/classificacoes">
          <Trophy /> Classificações
        </Link>
      </Button>
      {state?.brand.menuEnabled && (
        <Button asChild variant="outline" size="lg" className="h-12">
          <Link href="/menu">
            <UtensilsCrossed /> Menu
          </Link>
        </Button>
      )}
    </main>
  );
}
