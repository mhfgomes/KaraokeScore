"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Notice, Shell } from "@/components/Shell";
import { postJson, useLiveState } from "@/components/useLiveState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY = { name: "", age: "", phone: "", song: "", notes: "", consent: false };
type TextField = Exclude<keyof typeof EMPTY, "consent">;

export default function RegisterPage() {
  const { state } = useLiveState();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  // `clean` filtra o que é escrito (ex.: só dígitos)
  const field = (key: TextField, clean: (v: string) => string = (v) => v) => ({
    id: key,
    className: "h-11 text-base", // 16px evita o zoom automático no iOS
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: clean(e.target.value) }),
  });
  const digits = (v: string) => v.replace(/\D/g, "");
  // Dígitos, com "+" opcional só no início (números estrangeiros)
  const phoneChars = (v: string) => (v.trim().startsWith("+") ? "+" : "") + digits(v);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consent) return toast.error("É necessário aceitar o tratamento dos dados.");
    setBusy(true);
    try {
      const { position } = await postJson("/api/register", { ...form, age: Number(form.age) });
      setDone(position);
      setForm(EMPTY);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <Shell title="Inscrição">{null}</Shell>;

  if (state.night?.status !== "REGISTRATION") {
    return (
      <Shell title="Inscrição">
        <Notice>As inscrições não estão abertas neste momento.</Notice>
      </Shell>
    );
  }

  if (done !== null) {
    return (
      <Shell title="Inscrição feita! 🎉">
        <Card>
          <CardContent className="text-center">
            <p className="text-muted-foreground">És o número</p>
            <p className="my-2 text-7xl font-extrabold text-primary">#{done}</p>
            <p className="text-muted-foreground">Fica atento ao ecrã para saberes quando é a tua vez.</p>
          </CardContent>
        </Card>
        <Button variant="outline" className="mt-4 w-full" onClick={() => setDone(null)}>
          Inscrever outra pessoa
        </Button>
      </Shell>
    );
  }

  return (
    <Shell title="Inscrição">
      <Card>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do concorrente *</Label>
              <Input required maxLength={60} {...field("name")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="age">Idade *</Label>
                <Input required inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" {...field("age", digits)} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  required
                  type="tel"
                  inputMode="tel"
                  pattern="\+?[0-9]{9,15}"
                  title="Só números; usa + no início para números estrangeiros"
                  autoComplete="tel-national"
                  {...field("phone", phoneChars)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="song">Música *</Label>
              <Input required maxLength={160} placeholder="Artista – Música (ex.: ABBA – Dancing Queen)" {...field("song")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea rows={2} maxLength={280} {...field("notes")} className="text-base" />
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                className="mt-0.5"
                checked={form.consent}
                onCheckedChange={(v) => setForm({ ...form, consent: v === true })}
              />
              <Label htmlFor="consent" className="text-sm leading-snug font-normal text-muted-foreground">
                Autorizo o tratamento do meu nome, idade e telefone para a gestão do concurso de karaoke. O telefone e
                a idade não são mostrados publicamente.
              </Label>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "A enviar…" : "Inscrever"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}
