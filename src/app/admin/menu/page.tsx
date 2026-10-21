"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { postJson, useLiveState } from "@/components/useLiveState";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPrice, parsePrice } from "@/lib/format";
import type { Menu } from "@/lib/menu";
import { cn } from "@/lib/utils";

type Category = Menu[number];
type Item = Category["items"][number];

async function act(body: Record<string, unknown>) {
  try {
    await postJson("/api/admin/menu", body);
    return true;
  } catch (err) {
    toast.error((err as Error).message);
    return false;
  }
}

export default function AdminMenuPage() {
  const { state } = useLiveState();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [newCategory, setNewCategory] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setAdmin(!!d.admin));
  }, []);

  // Recarrega a cada atualização em tempo real (inclui as alterações feitas aqui)
  const load = useCallback(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMenu(d.menu));
  }, []);
  useEffect(load, [load, state]);

  if (admin === undefined) return null;
  if (!admin) {
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
            <Link href="/admin">
              <ArrowLeft /> Painel de Admin
            </Link>
          </Button>
          <h1 className="text-3xl font-extrabold">Menu</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/menu" target="_blank">
            Ver menu público
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Menu visível ao público</p>
            <p className="text-sm text-muted-foreground">Quando desativado, o botão Menu desaparece da página inicial.</p>
          </div>
          {state && (
            <Switch
              checked={state.brand.menuEnabled}
              onCheckedChange={(enabled) => act({ action: "setEnabled", enabled })}
              aria-label="Menu visível ao público"
            />
          )}
        </CardContent>
      </Card>

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (adding) return;
          setAdding(true);
          if (await act({ action: "addCategory", name: newCategory })) setNewCategory("");
          setAdding(false);
        }}
      >
        <Input placeholder="Nova categoria (ex.: Cervejas, Cocktails, Petiscos)" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
        <Button type="submit" disabled={adding}>
          <Plus /> {adding ? "A adicionar…" : "Categoria"}
        </Button>
      </form>

      {menu?.length === 0 && <p className="text-muted-foreground">Começa por criar uma categoria.</p>}

      {menu?.map((c, i) => (
        <CategoryCard key={c.id} category={c} first={i === 0} last={i === menu.length - 1} />
      ))}
    </main>
  );
}

function CategoryCard({ category, first, last }: { category: Category; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  return (
    <Card>
      <CardHeader>
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act({ action: "renameCategory", id: category.id, name })) setEditing(false);
            }}
          >
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="icon" title="Guardar">
              <Check />
            </Button>
            <Button type="button" size="icon" variant="ghost" title="Cancelar" onClick={() => setEditing(false)}>
              <X />
            </Button>
          </form>
        ) : (
          <CardTitle className="text-xl font-extrabold">{category.name}</CardTitle>
        )}
        <CardAction className="flex gap-1">
          <Button variant="ghost" size="icon" title="Subir" disabled={first} onClick={() => act({ action: "moveCategory", id: category.id, dir: -1 })}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon" title="Descer" disabled={last} onClick={() => act({ action: "moveCategory", id: category.id, dir: 1 })}>
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Mudar nome"
            onClick={() => {
              setName(category.name);
              setEditing(true);
            }}
          >
            <Pencil />
          </Button>
          <ConfirmButton
            variant="ghost"
            size="icon"
            aria-label={`Apagar categoria ${category.name}`}
            title={`Apagar "${category.name}"?`}
            description={`A categoria e os seus ${category.items.length} artigos são apagados.`}
            confirmLabel="Apagar"
            onConfirm={() => act({ action: "deleteCategory", id: category.id })}
          >
            <Trash2 />
          </ConfirmButton>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {category.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artigo</TableHead>
                <TableHead className="w-28 text-right">Preço</TableHead>
                <TableHead className="w-24">Disponível</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {category.items.map((item, i) => (
                <ItemRow key={item.id} item={item} first={i === 0} last={i === category.items.length - 1} />
              ))}
            </TableBody>
          </Table>
        )}
        <ItemForm
          submitLabel="Adicionar artigo"
          onSubmit={(data) => act({ action: "addItem", categoryId: category.id, ...data })}
        />
      </CardContent>
    </Card>
  );
}

function ItemRow({ item, first, last }: { item: Item; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="py-3">
          <ItemForm
            initial={item}
            submitLabel="Guardar"
            onCancel={() => setEditing(false)}
            onSubmit={async (data) => {
              const ok = await act({ action: "updateItem", id: item.id, ...data });
              if (ok) setEditing(false);
              return ok;
            }}
          />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className={cn(!item.available && "opacity-50")}>
      <TableCell className="whitespace-normal">
        <p className="font-semibold">{item.name}</p>
        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
      </TableCell>
      <TableCell className="text-right">{formatPrice(item.priceCents)}</TableCell>
      <TableCell>
        <Switch
          checked={item.available}
          aria-label="Disponível"
          onCheckedChange={(available) => act({ action: "setAvailable", id: item.id, available })}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Subir" disabled={first} onClick={() => act({ action: "moveItem", id: item.id, dir: -1 })}>
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon" title="Descer" disabled={last} onClick={() => act({ action: "moveItem", id: item.id, dir: 1 })}>
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          <ConfirmButton
            variant="ghost"
            size="icon"
            aria-label={`Apagar ${item.name}`}
            title={`Apagar "${item.name}"?`}
            description="Esta ação não pode ser desfeita."
            confirmLabel="Apagar"
            onConfirm={() => act({ action: "deleteItem", id: item.id })}
          >
            <Trash2 />
          </ConfirmButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ItemForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Item;
  submitLabel: string;
  onSubmit: (data: { name: string; description: string; priceCents: number }) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? (initial.priceCents / 100).toFixed(2).replace(".", ",") : "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const priceCents = parsePrice(price);
    if (priceCents === null) return toast.error("Preço inválido (ex.: 2,50).");
    setBusy(true);
    const ok = await onSubmit({ name, description, priceCents });
    setBusy(false);
    if (ok) {
      if (!initial) {
        setName("");
        setDescription("");
        setPrice("");
      }
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_7rem_auto]">
      <Input required placeholder="Nome" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Descrição (opcional)" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
      <Input required placeholder="Preço €" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" variant={initial ? "default" : "outline"} disabled={busy}>
          {!initial && <Plus />} {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
