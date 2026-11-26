"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, FileUp, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { postJson } from "@/components/useLiveState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchSongs, type CatalogSong, type LineOrder } from "@/lib/song-search";

/** Linhas mostradas de cada vez (catálogos grandes). */
const PAGE = 200;
const MAX_FILE = 2 * 1024 * 1024;

async function act(body: Record<string, unknown>) {
  try {
    return (await postJson("/api/admin/songs", body)) as { added?: number; skipped?: number; invalid?: number; headings?: number };
  } catch (err) {
    toast.error((err as Error).message);
    return null;
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type ListInfo = { id: number; name: string; isDefault: boolean };

// O id vem do URL: fora da pré-renderização (Cache Components exige o Suspense)
export default function SongListPage() {
  return (
    <Suspense>
      <SongListEditor />
    </Suspense>
  );
}

function SongListEditor() {
  const listId = Number(useParams<{ id: string }>().id);
  const router = useRouter();
  // undefined = a carregar; null = sem sessão; "missing" = lista não existe
  const [list, setList] = useState<ListInfo | null | "missing" | undefined>(undefined);
  const [songs, setSongs] = useState<CatalogSong[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [order, setOrder] = useState<LineOrder>("artist-title");
  const [skipHeadings, setSkipHeadings] = useState(true);
  const [single, setSingle] = useState({ artist: "", title: "" });
  const [bulk, setBulk] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<CatalogSong | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/songs?listId=${listId}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) return setList(null);
        if (!r.ok) return setList("missing");
        const d = await r.json();
        setList(d.list);
        setSongs(d.songs);
      })
      .catch(() => setList("missing"));
  }, [listId]);
  useEffect(load, [load]);

  const filtered = useMemo(() => searchSongs(songs, query), [songs, query]);
  const bulkLines = useMemo(() => bulk.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#")).length, [bulk]);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    const result = await act(body);
    setBusy(false);
    if (result) load();
    return result;
  }

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    const result = await run({ action: "add", listId, ...single });
    if (!result) return;
    if (result.added) {
      toast.success("Música adicionada.");
      setSingle({ artist: "", title: "" });
      document.getElementById("song-artist")?.focus();
    } else toast.info("Essa música já está nesta lista.");
  }

  async function addBulk(e: React.FormEvent) {
    e.preventDefault();
    const result = await run({ action: "bulk", listId, text: bulk, order, skipHeadings });
    if (!result) return;
    const parts = [plural(result.added ?? 0, "adicionada", "adicionadas")];
    if (result.skipped) parts.push(plural(result.skipped, "já existia", "já existiam"));
    if (result.invalid) parts.push(plural(result.invalid, "linha inválida", "linhas inválidas"));
    if (result.headings) parts.push(plural(result.headings, "título de secção ignorado", "títulos de secção ignorados"));
    toast.success(parts.join(" · "));
    setBulk("");
  }

  async function readFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite voltar a escolher o mesmo ficheiro
    if (!file) return;
    if (file.size > MAX_FILE) return toast.error("Ficheiro demasiado grande (máx. 2 MB).");
    const text = await file.text();
    setBulk((current) => (current.trim() ? `${current.trimEnd()}\n${text}` : text));
    toast.info(`"${file.name}" carregado. Revê e carrega em Adicionar.`);
  }

  async function save() {
    if (!editing) return;
    if (await run({ action: "update", ...editing })) setEditing(null);
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (await run({ action: "renameList", listId, name: renaming })) setRenaming(null);
  }

  async function removeList() {
    if (await run({ action: "deleteList", listId })) {
      toast.success("Lista apagada.");
      router.push("/admin/musicas");
    }
  }

  if (list === undefined) return null;
  if (list === "missing") {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-muted-foreground">
        Esta lista não existe.{" "}
        <Link href="/admin/musicas" className="text-primary underline">
          Ver listas
        </Link>
      </main>
    );
  }
  if (!list) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-muted-foreground">
        Sessão terminada.{" "}
        <Link href="/admin" className="text-primary underline">
          Entrar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
          <Link href="/admin/musicas">
            <ArrowLeft /> Listas de músicas
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {renaming === null ? (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold">{list.name}</h1>
              {list.isDefault && <Badge>Por defeito</Badge>}
              <Button size="icon" variant="ghost" aria-label="Mudar o nome da lista" onClick={() => setRenaming(list.name)}>
                <Pencil />
              </Button>
            </div>
          ) : (
            <form onSubmit={rename} className="flex items-center gap-2">
              <Input aria-label="Nome da lista" maxLength={60} value={renaming} onChange={(e) => setRenaming(e.target.value)} className="w-64" autoFocus />
              <Button size="icon" variant="ghost" type="submit" aria-label="Guardar nome" disabled={busy}>
                <Check />
              </Button>
              <Button size="icon" variant="ghost" type="button" aria-label="Cancelar" onClick={() => setRenaming(null)}>
                <X />
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            {!list.isDefault && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run({ action: "setDefault", listId })}>
                <Star /> Tornar por defeito
              </Button>
            )}
            <ConfirmButton
              variant="outline"
              size="sm"
              disabled={busy}
              title={`Apagar a lista "${list.name}"?`}
              description={`A lista e as ${songs.length} músicas são apagadas. As inscrições já feitas não mudam. Esta ação não pode ser desfeita.`}
              confirmLabel="Apagar lista"
              onConfirm={removeList}
            >
              <Trash2 className="text-destructive" /> Apagar lista
            </ConfirmButton>
          </div>
        </div>
        <p className="text-muted-foreground">
          {list.isDefault ? "Esta lista é a sugerida ao abrir uma noite." : "Ao abrir uma noite, escolhes que lista usar."}
          {songs.length === 0 && " Uma noite com esta lista vazia aceita a música escrita à mão."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Adicionar uma música</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addOne} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="song-artist">Artista</Label>
                <Input id="song-artist" maxLength={80} value={single.artist} onChange={(e) => setSingle({ ...single, artist: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="song-title">Música *</Label>
                <Input
                  id="song-title"
                  required
                  maxLength={120}
                  value={single.title}
                  onChange={(e) => setSingle({ ...single, title: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={busy || !single.title.trim()}>
                <Plus /> Adicionar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adicionar várias</CardTitle>
            <CardDescription>
              Uma por linha, separadas por <code>-</code>, <code>–</code>, <code>;</code> ou tab. As repetidas são ignoradas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addBulk} className="space-y-3">
              <Label htmlFor="song-bulk" className="sr-only">
                Lista de músicas
              </Label>
              <Textarea
                id="song-bulk"
                rows={8}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={
                  order === "artist-title"
                    ? "PORTUGUESAS\nXutos & Pontapés - A Minha Casinha\nRui Veloso - Porto Côvo"
                    : "PORTUGUESAS\nA Minha Casinha - Xutos & Pontapés\nPorto Côvo - Rui Veloso"
                }
                className="font-mono text-sm"
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Select value={order} onValueChange={(v) => setOrder(v as LineOrder)}>
                  <SelectTrigger aria-label="Formato de cada linha" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="artist-title">Artista – Música</SelectItem>
                    <SelectItem value="title-artist">Música – Artista</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Checkbox id="skip-headings" checked={skipHeadings} onCheckedChange={(v) => setSkipHeadings(v === true)} />
                  <Label htmlFor="skip-headings" className="font-normal">
                    Ignorar títulos em maiúsculas
                  </Label>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={busy || bulkLines === 0}>
                  <Plus /> Adicionar {bulkLines > 0 && plural(bulkLines, "linha", "linhas")}
                </Button>
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <FileUp /> Carregar .txt
                </Button>
                <input ref={fileRef} type="file" accept=".txt,.csv,text/plain" hidden onChange={readFile} />
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Músicas da lista</CardTitle>
          <CardDescription>{plural(songs.length, "música", "músicas")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Procurar por artista ou música"
                aria-label="Procurar músicas"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                className="pl-9"
              />
            </div>
            {songs.length > 0 && (
              <ConfirmButton
                variant="outline"
                size="sm"
                disabled={busy}
                title="Apagar todas as músicas desta lista?"
                description={`As ${songs.length} músicas saem da lista (a lista continua a existir). As inscrições já feitas não mudam. Esta ação não pode ser desfeita.`}
                confirmLabel="Apagar todas"
                onConfirm={() => run({ action: "clear", listId })}
              >
                <Trash2 className="text-destructive" /> Apagar todas
              </ConfirmButton>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">{songs.length ? "Nenhuma música encontrada." : "Esta lista está vazia."}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artista</TableHead>
                    <TableHead>Música</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, limit).map((song) =>
                    editing?.id === song.id ? (
                      <TableRow key={song.id}>
                        <TableCell>
                          <Input
                            aria-label="Artista"
                            maxLength={80}
                            value={editing.artist}
                            onChange={(e) => setEditing({ ...editing, artist: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label="Música"
                            maxLength={120}
                            value={editing.title}
                            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && save()}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" aria-label="Guardar" disabled={busy} onClick={save}>
                              <Check />
                            </Button>
                            <Button size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setEditing(null)}>
                              <X />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={song.id}>
                        <TableCell className="text-muted-foreground">{song.artist || "—"}</TableCell>
                        <TableCell className="font-medium">{song.title}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" aria-label={`Editar ${song.title}`} onClick={() => setEditing(song)}>
                              <Pencil />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Apagar ${song.title}`}
                              disabled={busy}
                              onClick={() => run({ action: "delete", ids: [song.id] })}
                            >
                              <Trash2 className="text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
              {filtered.length > limit && (
                <div className="text-center">
                  <Button variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>
                    Mostrar mais ({filtered.length - limit} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
