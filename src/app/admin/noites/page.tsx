"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { postJson, useLiveState } from "@/components/useLiveState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABEL } from "@/lib/types";
import { SongListSelect } from "@/components/SongListSelect";
import { defaultListId, useSongLists } from "@/components/useSongLists";

type Night = {
  id: number;
  date: string;
  status: keyof typeof STATUS_LABEL;
  maxSignups: number | null;
  songListId: number | null;
  songListName: string | null;
  performances: number;
  votes: number;
  winners: string[];
};

const noop = () => () => {};

// Data de hoje em Lisboa (AAAA-MM-DD)
const todayLisbon = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());

async function act(body: Record<string, unknown>) {
  try {
    await postJson("/api/admin/nights", body);
    return true;
  } catch (err) {
    toast.error((err as Error).message);
    return false;
  }
}

export default function NightsPage() {
  const { state } = useLiveState();
  const [nights, setNights] = useState<Night[] | null | undefined>(undefined);
  // A data de hoje só é lida no browser (não pode entrar na pré-renderização)
  const today = useSyncExternalStore(noop, todayLisbon, () => "");
  const [pickedDate, setNewDate] = useState<string | null>(null);
  const newDate = pickedDate ?? today;
  const [newMax, setNewMax] = useState("");
  const [editing, setEditing] = useState<{ id: number; date: string; maxSignups: string; songListId: number | null } | null>(null);
  const { lists } = useSongLists([state]);
  const [pickedList, setPickedList] = useState<number | null | undefined>(undefined);
  const newList = pickedList === undefined ? defaultListId(lists) : pickedList;
  const [busy, setBusy] = useState(false);

  // Recarrega a cada atualização em tempo real (inclui as alterações feitas aqui)
  const load = useCallback(() => {
    fetch("/api/admin/nights", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNights(d?.nights ?? null))
      .catch(() => setNights(null));
  }, []);
  useEffect(load, [load, state]);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    const ok = await act(body);
    setBusy(false);
    if (ok) load();
    return ok;
  }

  if (nights === undefined) return null;
  if (nights === null) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-muted-foreground">
        Sessão terminada.{" "}
        <Link href="/admin" className="text-primary underline">
          Entrar
        </Link>
      </main>
    );
  }

  const hasActive = nights.some((n) => n.status !== "CLOSED");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (await run({ action: "create", date: newDate, maxSignups: newMax, songListId: newList })) {
      setNewMax("");
      toast.success("Noite aberta.");
    }
  }

  async function save() {
    if (!editing) return;
    const night = nights!.find((n) => n.id === editing.id);
    const body: Record<string, unknown> = { action: "update", id: editing.id, date: editing.date };
    if (night?.status !== "CLOSED") Object.assign(body, { maxSignups: editing.maxSignups, songListId: editing.songListId });
    if (await run(body)) setEditing(null);
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
          <Link href="/admin">
            <ArrowLeft /> Painel de Admin
          </Link>
        </Button>
        <h1 className="text-3xl font-extrabold">Noites</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova noite</CardTitle>
          <CardDescription>
            {hasActive
              ? "Já existe uma noite aberta. Termina-a ou apaga-a antes de abrir outra."
              : "Abre uma noite com inscrições. A data define o mês da classificação."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="new-date">Data</Label>
              <Input id="new-date" type="date" required value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-max">Máx. inscrições</Label>
              <Input
                id="new-max"
                type="number"
                min={1}
                max={999}
                placeholder="Sem limite"
                value={newMax}
                onChange={(e) => setNewMax(e.target.value)}
                className="w-36"
              />
            </div>
            {lists && lists.length > 1 && (
              <div className="grid gap-2">
                <Label htmlFor="new-list">Lista de músicas</Label>
                <SongListSelect id="new-list" lists={lists} value={newList} onChange={setPickedList} className="w-64" />
              </div>
            )}
            {lists?.length === 1 && <p className="pb-2 text-sm text-muted-foreground">Músicas: {lists[0].name}</p>}
            <Button type="submit" disabled={busy || hasActive}>
              <Plus /> Abrir noite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todas as noites</CardTitle>
          <CardDescription>{nights.length === 1 ? "1 noite" : `${nights.length} noites`}</CardDescription>
        </CardHeader>
        <CardContent>
          {nights.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Ainda não há noites.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Atuações</TableHead>
                  <TableHead className="text-right">Votos</TableHead>
                  <TableHead>Máx. inscrições</TableHead>
                  <TableHead>Músicas</TableHead>
                  <TableHead>Vencedor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nights.map((n) => {
                  const isEditing = editing?.id === n.id;
                  return (
                    <TableRow key={n.id}>
                      <TableCell className="tabular-nums">
                        {isEditing ? (
                          <Input
                            type="date"
                            aria-label="Data"
                            value={editing.date}
                            onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                            className="w-40"
                          />
                        ) : (
                          n.date
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={n.status === "CLOSED" ? "secondary" : "default"}>{STATUS_LABEL[n.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{n.performances}</TableCell>
                      <TableCell className="text-right tabular-nums">{n.votes}</TableCell>
                      <TableCell className="tabular-nums">
                        {isEditing && n.status !== "CLOSED" ? (
                          <Input
                            type="number"
                            min={1}
                            max={999}
                            aria-label="Máximo de inscrições"
                            placeholder="Sem limite"
                            value={editing.maxSignups}
                            onChange={(e) => setEditing({ ...editing, maxSignups: e.target.value })}
                            className="w-28"
                          />
                        ) : (
                          (n.maxSignups ?? "—")
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing && n.status !== "CLOSED" && lists ? (
                          <SongListSelect
                            lists={lists}
                            allowNone
                            value={editing.songListId}
                            onChange={(songListId) => setEditing({ ...editing, songListId })}
                            className="w-48"
                          />
                        ) : (
                          (n.songListName ?? <span className="text-muted-foreground">Texto livre</span>)
                        )}
                      </TableCell>
                      <TableCell>{n.winners.length ? n.winners.join(", ") : "—"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button size="icon" variant="ghost" aria-label="Guardar" disabled={busy} onClick={save}>
                                <Check />
                              </Button>
                              <Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setEditing(null)}>
                                <X />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Editar"
                              onClick={() => setEditing({ id: n.id, date: n.date, maxSignups: n.maxSignups?.toString() ?? "", songListId: n.songListId })}
                            >
                              <Pencil />
                            </Button>
                          )}
                          <ConfirmButton
                            size="icon"
                            variant="ghost"
                            aria-label="Apagar"
                            disabled={busy}
                            title={`Apagar a noite de ${n.date}?`}
                            description={`As ${n.performances} atuações e os ${n.votes} votos desta noite são apagados e saem da classificação mensal. Os concorrentes continuam registados. Esta ação não pode ser desfeita.`}
                            confirmLabel="Apagar noite"
                            onConfirm={() => run({ action: "delete", id: n.id })}
                          >
                            <Trash2 className="text-destructive" />
                          </ConfirmButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
