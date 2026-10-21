"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KeyRound, LogOut, Mic, UtensilsCrossed, Monitor, SkipForward, Timer, Trophy, UserX, Undo2 } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Countdown } from "@/components/Countdown";
import { postJson, useLatest, useLiveState } from "@/components/useLiveState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABEL, VOTING_DURATIONS } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminPerformance = {
  id: number;
  position: number;
  name: string;
  song: string;
  notes: string | null;
  status: "QUEUED" | "DONE" | "SKIPPED";
  phone: string;
  age: number;
  votes: number;
  rank: number | null;
  points: number;
};
type AdminNight = { id: number; date: string; status: keyof typeof STATUS_LABEL; currentId: number | null; votingEndsAt: string | null };

export default function AdminPage() {
  const [admin, setAdmin] = useState<{ username: string } | null | undefined>(undefined);

  const loadMe = useCallback(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setAdmin(d.admin));
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  if (admin === undefined) return null;
  if (!admin) return <Login onDone={loadMe} />;
  return <Panel username={admin.username} onLogout={loadMe} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await postJson("/api/admin/login", { username, password });
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold">Admin</CardTitle>
          <CardDescription>Entra para gerir a noite de karaoke.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function Panel({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [night, setNight] = useState<AdminNight | null>(null);
  const [perfs, setPerfs] = useState<AdminPerformance[]>([]);
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState("15");
  const latest = useLatest();

  const load = useCallback(
    () =>
      latest(
        fetch("/api/admin/night", { cache: "no-store" }).then(async (res) => (res.ok ? res.json() : { status: res.status })),
        (d) => {
          if (d.status === 401) return onLogout();
          if (d.status) return toast.error("Não foi possível carregar a noite.");
          setNight(d.night);
          setPerfs(d.performances);
        },
      ).catch(() => toast.error("Sem ligação ao servidor.")),
    [latest, onLogout],
  );

  useEffect(() => {
    // O SSE envia "hello" ao ligar, o que faz a primeira carga
    const source = new EventSource("/api/events");
    source.onmessage = () => load();
    return () => source.close();
  }, [load]);

  // Uma ação de cada vez: evita, por ex., dois "Próximo a cantar" seguidos
  async function run(url: string, body: unknown) {
    if (busy) return;
    setBusy(true);
    try {
      await postJson(url, body);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const nightAction = (action: string, extra?: object) => run("/api/admin/night", { action, ...extra });
  const queueAction = (action: string, id?: number) => run("/api/admin/queue", { action, id });

  const active = night && night.status !== "CLOSED";
  const totalVotes = perfs.reduce((s, p) => s + p.votes, 0);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Painel de Admin</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/ao-vivo" target="_blank">
              <Monitor /> Telão
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/menu">
              <UtensilsCrossed /> Menu
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/classificacoes" target="_blank">
              <Trophy /> Classificações
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/conta">
              <KeyRound /> {username}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => postJson("/api/admin/logout").then(onLogout)}>
            <LogOut /> Sair
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{night ? `Noite de ${night.date}` : "Sem noites"}</p>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold">{active ? STATUS_LABEL[night.status] : "Nenhuma noite aberta"}</p>
            </div>
            {night && (
              <p className="text-sm text-muted-foreground">
                {perfs.filter((p) => p.status !== "SKIPPED").length} concorrentes · {totalVotes} votos
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!active && <Button disabled={busy} onClick={() => nightAction("open")}>Abrir nova noite</Button>}
            {night?.status === "REGISTRATION" && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => queueAction("next")}>
                  <SkipForward /> Próximo a cantar
                </Button>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger aria-label="Tempo de votação" className="w-36">
                    <Timer />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sem limite</SelectItem>
                    {VOTING_DURATIONS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} minutos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ConfirmButton
                  title="Abrir a votação?"
                  description={
                    duration === "0"
                      ? "As inscrições fecham e o público passa a poder votar. Fechas a votação manualmente."
                      : `As inscrições fecham e o público tem ${duration} minutos para votar. Depois a votação fecha sozinha.`
                  }
                  confirmLabel="Abrir votação"
                  disabled={busy}
                  onConfirm={() => nightAction("startVoting", { minutes: Number(duration) || null })}
                >
                  Abrir votação
                </ConfirmButton>
              </>
            )}
            {night?.status === "VOTING" && night.votingEndsAt && (
              <p className="self-center text-lg">
                Fecha em <Countdown endsAt={night.votingEndsAt} className="font-bold" />
              </p>
            )}
            {night?.status === "VOTING" && (
              <ConfirmButton
                title="Fechar a votação?"
                description="Os pontos da noite são atribuídos. Esta ação não pode ser desfeita."
                confirmLabel="Fechar votação"
                disabled={busy}
                onConfirm={() => nightAction("closeVoting")}
              >
                Fechar votação
              </ConfirmButton>
            )}
          </div>
        </CardContent>
      </Card>

      {night && (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                {["#", "Concorrente", "Idade", "Telefone", "Música", "Obs.", "Estado", "Votos", ""].map((h) => (
                  <TableHead key={h} className="px-3">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {perfs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    Ainda não há inscrições.
                  </TableCell>
                </TableRow>
              )}
              {perfs.map((p) => {
                const isCurrent = night.currentId === p.id;
                return (
                  <TableRow key={p.id} className={cn(p.status === "SKIPPED" && "opacity-40", isCurrent && "bg-primary/10")}>
                    <TableCell className="px-3 text-muted-foreground">{p.position}</TableCell>
                    <TableCell className="px-3 font-semibold">{p.name}</TableCell>
                    <TableCell className="px-3">{p.age}</TableCell>
                    <TableCell className="px-3">{p.phone}</TableCell>
                    <TableCell className="px-3">{p.song}</TableCell>
                    <TableCell className="max-w-48 truncate px-3 text-muted-foreground" title={p.notes ?? ""}>
                      {p.notes}
                    </TableCell>
                    <TableCell className="space-x-2 px-3">
                      <StatusBadge status={p.status} current={isCurrent} />
                      {night.status === "CLOSED" && p.rank && p.votes > 0 && (
                        <span className="text-gold">
                          {p.rank}.º · {p.points} pts
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-3">{p.votes}</TableCell>
                    <TableCell className="px-3 text-right">
                      {night.status === "REGISTRATION" && (
                        <div className="flex justify-end gap-2">
                          {!isCurrent && p.status !== "SKIPPED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Pôr a cantar"
                              aria-label={`Pôr ${p.name} a cantar`}
                              disabled={busy}
                              onClick={() => queueAction("setCurrent", p.id)}>
                              <Mic />
                            </Button>
                          )}
                          {p.status === "SKIPPED" ? (
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => queueAction("restore", p.id)}>
                              <Undo2 /> Repor
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => queueAction("skip", p.id)}>
                              <UserX /> Não compareceu
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <BrandingSettings />

      <Admins />
    </main>
  );
}

function StatusBadge({ status, current }: { status: AdminPerformance["status"]; current: boolean }) {
  if (current) return <Badge>🎤 A cantar</Badge>;
  if (status === "DONE") return <Badge variant="secondary">Cantou</Badge>;
  if (status === "SKIPPED") return <Badge variant="destructive">Saltado</Badge>;
  return <Badge variant="outline">Em espera</Badge>;
}

function Admins() {
  const [admins, setAdmins] = useState<{ id: number; username: string }[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setAdmins(d.admins ?? []));
  }, []);
  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await postJson("/api/admin/users", { username, password });
      setUsername("");
      setPassword("");
      toast.success("Admin criado.");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Administradores</CardTitle>
        <CardDescription>{admins.map((a) => a.username).join(", ")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={create} className="flex flex-wrap gap-2">
          <Input className="max-w-56" placeholder="Novo username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input className="max-w-56" placeholder="Password (mín. 8)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="outline">
            Criar admin
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BrandingSettings() {
  const { state } = useLiveState();
  const brand = state?.brand;
  const [name, setName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  async function save(extra?: Record<string, string>) {
    const form = new FormData();
    form.set("name", name ?? brand?.name ?? "");
    if (file) form.set("logo", file);
    for (const [k, v] of Object.entries(extra ?? {})) form.set(k, v);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/brand", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro inesperado.");
      setFile(null);
      setInputKey((k) => k + 1);
      toast.success("Branding atualizado.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!brand) return null;
  const preview = filePreview ?? brand.logoUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Nome e logo mostrados no início, nas páginas públicas e no telão.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-wrap items-end gap-6"
        >
          <div className="flex size-24 items-center justify-center rounded-lg border bg-background p-2">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Sem logo</span>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-name">Nome</Label>
            <Input id="brand-name" className="w-64" maxLength={60} value={name ?? brand.name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-logo">Logo (PNG, JPG, WebP ou SVG · máx. 2 MB)</Label>
            <Input
              key={inputKey}
              id="brand-logo"
              type="file"
              className="w-72"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Guardar
            </Button>
            {brand.logoUrl && !file && (
              <Button type="button" variant="outline" disabled={busy} onClick={() => save({ removeLogo: "true" })}>
                Remover logo
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
