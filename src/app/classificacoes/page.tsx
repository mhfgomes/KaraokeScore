"use client";

import { useEffect, useState } from "react";
import { Notice, Shell } from "@/components/Shell";
import { useLiveState } from "@/components/useLiveState";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type NightResult = { id: number; name: string; song: string; rank: number | null; voteCount: number; points: number };
type MonthRow = { name: string; points: number; firsts: number; votes: number; nights: number; rank: number };

/** "2026-10" → "outubro de 2026" */
function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1));
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function RankingsPage() {
  const { state } = useLiveState();
  const [nights, setNights] = useState<{ id: number; date: string }[]>([]);
  const [nightId, setNightId] = useState<string>("");
  const [nightResults, setNightResults] = useState<NightResult[]>([]);
  const [month, setMonth] = useState("");
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);
  // Meses com noites terminadas, mais o mês atual (vem do servidor), do mais recente para o mais antigo
  const [currentMonth, setCurrentMonth] = useState("");
  const months = [...new Set([currentMonth, ...nights.map((n) => n.date.slice(0, 7))].filter(Boolean))].sort().reverse();

  // Muda quando uma noite fecha: volta a carregar tudo
  const closedNight = state?.night?.status === "CLOSED" ? state.night.id : null;

  useEffect(() => {
    let ignore = false;
    fetch("/api/nights", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (ignore) return;
        setNights(d.nights);
        // Sem escolha feita (ou na noite mais recente), segue a noite mais recente
        setNightId((cur) => (!cur || cur === String(d.nights[1]?.id) ? String(d.nights[0]?.id ?? "") : cur));
      });
    return () => {
      ignore = true;
    };
  }, [closedNight]);

  useEffect(() => {
    if (!nightId) return;
    let ignore = false;
    fetch(`/api/nights/${nightId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !ignore && setNightResults(d.results ?? []));
    return () => {
      ignore = true;
    };
  }, [nightId, closedNight]);

  useEffect(() => {
    let ignore = false;
    // Sem mês escolhido, o servidor devolve o mês atual
    fetch(`/api/rankings${month ? `?month=${month}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (ignore) return;
        setMonthRows(d.ranking ?? []);
        if (!month) {
          setMonth(d.month);
          setCurrentMonth(d.month);
        }
      });
    return () => {
      ignore = true;
    };
  }, [month, closedNight]);

  return (
    <Shell title="Classificações">
      <Tabs defaultValue="night">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="night">Noite</TabsTrigger>
          <TabsTrigger value="month">Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="night" className="space-y-4">
          {nights.length === 0 ? (
            <Notice>Ainda não há noites terminadas.</Notice>
          ) : (
            <>
              <Select value={nightId} onValueChange={setNightId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolhe a noite" />
                </SelectTrigger>
                <SelectContent>
                  {nights.map((n) => (
                    <SelectItem key={n.id} value={String(n.id)}>
                      {n.date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Ranking
                headers={["#", "Concorrente", "Votos", "Pts"]}
                rows={nightResults.map((r) => [
                  r.voteCount > 0 ? `${MEDAL[r.rank ?? 0] ?? ""} ${r.rank}` : "–",
                  <div key="n">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.song}
                    </p>
                  </div>,
                  r.voteCount,
                  <b key="p" className="text-gold">
                    {r.points}
                  </b>,
                ])}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="month" className="space-y-4">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolhe o mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Ranking
            headers={["#", "Concorrente", "Noites", "1.os", "Pts"]}
            rows={monthRows.map((r) => [
              `${MEDAL[r.rank] ?? ""} ${r.rank}`,
              <span key="n" className="font-semibold">
                {r.name}
              </span>,
              r.nights,
              r.firsts,
              <b key="p" className="text-gold">
                {r.points}
              </b>,
            ])}
          />
          <p className="text-xs text-muted-foreground">
            1.º lugar 3 pts · 2.º 2 pts · 3.º 1 pt. Desempate: mais 1.os lugares, depois mais votos.
          </p>
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function Ranking({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return <Notice>Sem resultados.</Notice>;
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h} className="px-4">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j} className="px-4 py-3">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
