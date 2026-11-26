"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Copy, Plus } from "lucide-react";
import { postJson } from "@/components/useLiveState";
import { useSongLists } from "@/components/useSongLists";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SongListsPage() {
  const router = useRouter();
  const { lists } = useSongLists();
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState("none");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await postJson("/api/admin/songs", {
        action: "createList",
        name,
        copyFrom: copyFrom === "none" ? null : Number(copyFrom),
      });
      router.push(`/admin/musicas/${id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  if (lists === undefined) return null;
  if (lists === null) {
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
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
          <Link href="/admin">
            <ArrowLeft /> Painel de Admin
          </Link>
        </Button>
        <h1 className="text-3xl font-extrabold">Listas de músicas</h1>
        <p className="text-muted-foreground">Cada noite usa uma lista. Na inscrição só se pode escolher uma música dessa lista.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listas</CardTitle>
          <CardDescription>Abre uma lista para ver, editar ou importar músicas.</CardDescription>
        </CardHeader>
        <CardContent>
          {lists.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">Ainda não há listas. Sem listas, a música é escrita à mão na inscrição.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {lists.map((l) => (
                <li key={l.id}>
                  <Link href={`/admin/musicas/${l.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{l.name}</span>
                        {l.isDefault && <Badge>Por defeito</Badge>}
                        {l.inUse && <Badge variant="secondary">Na noite aberta</Badge>}
                      </span>
                      <span className="text-sm text-muted-foreground">{l.songs === 1 ? "1 música" : `${l.songs} músicas`}</span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nova lista</CardTitle>
          <CardDescription>Começa vazia ou como cópia de outra lista.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="list-name">Nome</Label>
              <Input id="list-name" required maxLength={60} placeholder="Ex.: Noite dos anos 80" value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
            </div>
            {lists.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="list-copy">Músicas</Label>
                <Select value={copyFrom} onValueChange={setCopyFrom}>
                  <SelectTrigger id="list-copy" className="w-56">
                    <Copy />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Lista vazia</SelectItem>
                    {lists.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        Copiar de {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" disabled={busy || !name.trim()}>
              <Plus /> Criar lista
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
