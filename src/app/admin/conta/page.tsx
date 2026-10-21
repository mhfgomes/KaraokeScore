"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { postJson } from "@/components/useLiveState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

export default function AccountPage() {
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setUsername(d.admin?.username ?? null));
  }, []);

  const field = (key: keyof typeof EMPTY) => ({
    id: key,
    type: "password",
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) return toast.error("As passwords novas não coincidem.");
    setBusy(true);
    try {
      await postJson("/api/admin/password", { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm(EMPTY);
      toast.success("Password alterada. As outras sessões foram terminadas.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (username === undefined) return null;

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
        <Link href="/admin">
          <ArrowLeft /> Painel de Admin
        </Link>
      </Button>

      {username === null ? (
        <Card>
          <CardContent className="text-muted-foreground">
            Sessão terminada. <Link href="/admin" className="text-primary underline">Entrar</Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-extrabold">Alterar password</CardTitle>
            <CardDescription>
              Conta <b>{username}</b>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Password atual</Label>
                <Input required autoComplete="current-password" {...field("currentPassword")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova password (mín. 8 caracteres)</Label>
                <Input required minLength={8} autoComplete="new-password" {...field("newPassword")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova password</Label>
                <Input required minLength={8} autoComplete="new-password" {...field("confirmPassword")} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "A guardar…" : "Alterar password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
