"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Contestant = {
  id: number;
  name: string;
  phone: string;
  age: number;
  createdAt: string;
  performances: number;
  nights: number;
  points: number;
  lastNight: string | null;
};

const DATE = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" });
// Comparação sem acentos nem maiúsculas
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function ContestantsPage() {
  const [contestants, setContestants] = useState<Contestant[] | null | undefined>(undefined);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/contestants")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setContestants(d?.contestants ?? null))
      .catch(() => setContestants(null));
  }, []);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    const digits = query.replace(/\D/g, "");
    if (!contestants || !q) return contestants ?? [];
    return contestants.filter((c) => fold(c.name).includes(q) || (digits && c.phone.includes(digits)));
  }, [contestants, query]);

  if (contestants === undefined) return null;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
        <Link href="/admin">
          <ArrowLeft /> Painel de Admin
        </Link>
      </Button>

      {contestants === null ? (
        <Card>
          <CardContent className="text-muted-foreground">
            Sessão terminada. <Link href="/admin" className="text-primary underline">Entrar</Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-extrabold">Concorrentes</CardTitle>
            <CardDescription>
              {contestants.length} {contestants.length === 1 ? "concorrente registado" : "concorrentes registados"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Procurar por nome ou telefone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                aria-label="Procurar concorrentes"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">
                {contestants.length ? "Nenhum concorrente encontrado." : "Ainda não há concorrentes registados."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Idade</TableHead>
                    <TableHead className="text-right">Atuações</TableHead>
                    <TableHead className="text-right">Noites</TableHead>
                    <TableHead className="text-right">Pontos</TableHead>
                    <TableHead>Última noite</TableHead>
                    <TableHead>Registo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="tabular-nums">
                        <a href={`tel:${c.phone}`} className="hover:underline">
                          {c.phone}
                        </a>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.age}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.performances}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.nights}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.points}</TableCell>
                      <TableCell className="tabular-nums">{c.lastNight ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{DATE.format(new Date(c.createdAt))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
