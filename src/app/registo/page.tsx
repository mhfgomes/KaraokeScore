"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Notice, Shell } from "@/components/Shell";
import { SongPicker } from "@/components/SongPicker";
import { postJson, useLiveState } from "@/components/useLiveState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizePhone } from "@/lib/phone";
import { catalogLabel, type CatalogSong } from "@/lib/song-search";

type Member = { id: number; name: string; age: string; phone: string };
type MemberField = Exclude<keyof Member, "id">;
type Errors = Record<string, string>;
type Done = { position: number; names: string[]; song: string };

const EMPTY = { song: "", songId: null as number | null, notes: "", consent: false };
const newMember = (id: number): Member => ({ id, name: "", age: "", phone: "" });
const memberId = (id: number, key: MemberField) => `contestant-${id}-${key}`;
const errorId = (id: string) => `${id}-error`;

const digits = (v: string) => v.replace(/\D/g, "");
// Dígitos, com "+" opcional só no início (números estrangeiros)
const phoneChars = (v: string) => (v.trim().startsWith("+") ? "+" : "") + digits(v);
// "Ana", "Ana e Rui", "Ana, Rui e Inês"
const joinNames = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`);

/** Mesmas regras da API, para mostrar os erros junto aos campos antes de enviar. */
function validate(members: Member[], form: typeof EMPTY, useCatalog: boolean): Errors {
  const errors: Errors = {};
  const seen = new Map<string, number>();
  members.forEach((m, index) => {
    if (!m.name.trim()) errors[memberId(m.id, "name")] = "Indica o nome.";
    const age = Number(m.age);
    if (!m.age || !Number.isInteger(age) || age < 1 || age > 120) errors[memberId(m.id, "age")] = "Idade entre 1 e 120.";
    const phone = normalizePhone(m.phone);
    if (!m.phone) errors[memberId(m.id, "phone")] = "Indica o telefone.";
    else if (!phone) errors[memberId(m.id, "phone")] = "Telefone inválido. Usa 9 dígitos ou + e o indicativo.";
    else if (seen.has(phone)) errors[memberId(m.id, "phone")] = `Este telefone já está no concorrente ${seen.get(phone)! + 1}.`;
    else seen.set(phone, index);
  });
  if (useCatalog ? form.songId === null : !form.song.trim()) errors.song = useCatalog ? "Escolhe uma música da lista." : "Indica a música.";
  if (!form.consent) {
    errors.consent = members.length > 1 ? "Confirma a autorização de todos os concorrentes para continuar." : "Aceita o tratamento dos dados para continuar.";
  }
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={errorId(id)} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export default function RegisterPage() {
  const { state } = useLiveState();
  const [form, setForm] = useState(EMPTY);
  const [contestants, setContestants] = useState<Member[]>([newMember(0)]);
  const [nextId, setNextId] = useState(1);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  // Catálogo de músicas (null enquanto carrega); vazio = texto livre
  const [songs, setSongs] = useState<CatalogSong[] | null>(null);
  const loadSongs = useCallback(() => {
    fetch("/api/songs", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSongs(d.songs ?? []))
      .catch(() => setSongs([]));
  }, []);
  useEffect(loadSongs, [loadSongs]);
  const useCatalog = !!songs?.length;
  // Campo a focar depois do próximo render (novo concorrente, remoção, erro)
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    const el = document.getElementById(id);
    if (!el) return;
    el.focus({ preventScroll: true });
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  });

  const group = contestants.length > 1;

  const clearError = (key: string) => {
    if (!errors[key]) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const describe = (key: string, hint?: string) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": [errors[key] && errorId(key), hint].filter(Boolean).join(" ") || undefined,
  });

  const field = (key: "song" | "notes") => ({
    id: key,
    className: "h-11 text-base", // 16px evita o zoom automático no iOS
    value: form[key],
    ...describe(key),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [key]: e.target.value });
      clearError(key);
    },
  });

  function addContestant() {
    setContestants((current) => [...current, newMember(nextId)]);
    focusNext.current = memberId(nextId, "name");
    setNextId((id) => id + 1);
    setAnnounce(`Concorrente ${contestants.length + 1} adicionado.`);
  }

  function removeContestant(index: number) {
    const remaining = contestants.filter((_, i) => i !== index);
    setContestants(remaining);
    // Foca o concorrente que ocupou o lugar (ou o anterior, se era o último)
    const target = remaining[Math.min(index, remaining.length - 1)];
    focusNext.current = memberId(target.id, "name");
    setAnnounce(`Concorrente ${index + 1} removido. ${remaining.length === 1 ? "Inscrição individual." : `${remaining.length} concorrentes.`}`);
    // Erros de telefone duplicado podem deixar de se aplicar
    setErrors({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const found = validate(contestants, form, useCatalog);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      focusNext.current = first;
      // Força o render mesmo que os erros sejam iguais aos anteriores
      setAnnounce(`${Object.keys(found).length === 1 ? "Há 1 campo" : `Há ${Object.keys(found).length} campos`} por corrigir.`);
      return;
    }
    setBusy(true);
    try {
      const members = contestants.map((c) => ({ name: c.name.trim(), age: Number(c.age), phone: c.phone }));
      const chosen = songs?.find((s) => s.id === form.songId);
      const { position } = await postJson("/api/register", { ...form, contestants: members });
      setDone({ position, names: members.map((m) => m.name), song: chosen ? catalogLabel(chosen) : form.song.trim() });
      setForm(EMPTY);
      setContestants([newMember(nextId)]);
      setNextId((id) => id + 1);
      setErrors({});
      setAnnounce("");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setFormError((err as Error).message);
      loadSongs(); // a música pode ter saído do catálogo entretanto
      focusNext.current = "form-error";
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <Shell title="Inscrição">{null}</Shell>;

  if (done !== null) {
    const many = done.names.length > 1;
    return (
      <Shell title="Inscrição feita! 🎉">
        <Card>
          <CardContent className="text-center">
            <p className="text-muted-foreground">{many ? "Ficaram com o número" : "Ficaste com o número"}</p>
            <p className="my-2 text-7xl font-extrabold text-primary">#{done.position}</p>
            <p className="text-lg font-semibold text-balance">{joinNames(done.names)}</p>
            <p className="mt-1 text-balance">{done.song}</p>
            <p className="mt-4 text-muted-foreground">
              {many ? "Fiquem atentos ao ecrã para saberem quando é a vossa vez." : "Fica atento ao ecrã para saberes quando é a tua vez."}
            </p>
          </CardContent>
        </Card>
        <Button variant="outline" className="mt-4 h-11 w-full text-base" onClick={() => setDone(null)}>
          Fazer outra inscrição
        </Button>
      </Shell>
    );
  }

  if (state.night?.status !== "REGISTRATION") {
    return (
      <Shell title="Inscrição">
        <Notice>As inscrições não estão abertas neste momento.</Notice>
      </Shell>
    );
  }

  const { maxSignups, signups } = state.night;
  if (maxSignups != null && signups >= maxSignups) {
    return (
      <Shell title="Inscrição">
        <Notice>As inscrições desta noite estão esgotadas ({maxSignups} atuações).</Notice>
      </Shell>
    );
  }

  return (
    <Shell title="Inscrição">
      <Card>
        <CardContent>
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
          <form onSubmit={submit} noValidate className="space-y-6">
            <section className="space-y-4" aria-labelledby="contestants-title">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="contestants-title" className="text-lg font-semibold">
                    Concorrentes
                  </h2>
                  <p className="text-sm text-muted-foreground">{group ? `${contestants.length} a cantar juntos` : "A solo, ou junta quem canta contigo"}</p>
                </div>
                <Button type="button" variant="outline" className="h-11 shrink-0 px-4 text-base" onClick={addContestant} aria-label="Adicionar concorrente">
                  +1
                </Button>
              </div>

              {contestants.map((contestant, index) => {
                const first = index === 0;
                const memberField = (key: MemberField, clean = (v: string) => v) => {
                  const id = memberId(contestant.id, key);
                  return {
                    id,
                    className: "h-11 text-base",
                    value: contestant[key],
                    ...describe(id),
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = clean(e.target.value);
                      setContestants((current) => current.map((c) => (c.id === contestant.id ? { ...c, [key]: value } : c)));
                      clearError(id);
                    },
                  };
                };
                const ids = { name: memberId(contestant.id, "name"), age: memberId(contestant.id, "age"), phone: memberId(contestant.id, "phone") };
                const fields = (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={ids.name}>Nome *</Label>
                      {/* Só o primeiro é preenchido automaticamente: os restantes são outras pessoas */}
                      <Input maxLength={60} autoComplete={first ? "name" : "off"} {...memberField("name")} />
                      <FieldError id={ids.name} message={errors[ids.name]} />
                    </div>
                    <div className="grid grid-cols-[5.5rem_1fr] gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={ids.age}>Idade *</Label>
                        <Input inputMode="numeric" maxLength={3} autoComplete="off" {...memberField("age", digits)} />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <Label htmlFor={ids.phone}>Telefone *</Label>
                        <Input type="tel" inputMode="tel" maxLength={16} autoComplete={first ? "tel" : "off"} {...memberField("phone", phoneChars)} />
                      </div>
                    </div>
                    <FieldError id={ids.age} message={errors[ids.age]} />
                    <FieldError id={ids.phone} message={errors[ids.phone]} />
                  </div>
                );

                if (!group) return <div key={contestant.id}>{fields}</div>;
                return (
                  <div key={contestant.id} role="group" aria-labelledby={`contestant-${contestant.id}-title`} className="rounded-xl border px-3 pt-1 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 id={`contestant-${contestant.id}-title`} className="text-sm font-medium">
                        Concorrente {index + 1}
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        className="-mr-2 h-11 px-3 text-muted-foreground hover:text-destructive"
                        aria-label={`Remover concorrente ${index + 1}${contestant.name.trim() ? ` (${contestant.name.trim()})` : ""}`}
                        onClick={() => removeContestant(index)}
                      >
                        <X aria-hidden /> Remover
                      </Button>
                    </div>
                    {fields}
                  </div>
                );
              })}

              {group && (
                <Button type="button" variant="outline" className="h-11 w-full border-dashed text-base" onClick={addContestant}>
                  <Plus aria-hidden /> Adicionar outro concorrente
                </Button>
              )}
            </section>

            <section className="space-y-4 border-t pt-5" aria-labelledby="performance-title">
              <div>
                <h2 id="performance-title" className="text-lg font-semibold">
                  Atuação
                </h2>
                {group && <p className="text-sm text-muted-foreground">Uma música para o grupo todo.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="song">Música *</Label>
                {useCatalog ? (
                  <SongPicker
                    id="song"
                    songs={songs}
                    value={form.songId}
                    invalid={!!errors.song}
                    describedBy={errors.song ? errorId("song") : undefined}
                    onChange={(songId) => {
                      setForm({ ...form, songId });
                      clearError("song");
                      focusNext.current = "song"; // o campo troca de elemento: mantém o foco
                    }}
                  />
                ) : (
                  <Input maxLength={160} placeholder="Artista – Música" autoComplete="off" {...field("song")} />
                )}
                <FieldError id="song" message={errors.song} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea rows={2} maxLength={280} {...field("notes")} className="text-base" />
              </div>
            </section>

            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  className="mt-0.5 size-5"
                  checked={form.consent}
                  {...describe("consent")}
                  onCheckedChange={(v) => {
                    setForm({ ...form, consent: v === true });
                    clearError("consent");
                  }}
                />
                <Label htmlFor="consent" className="block text-sm leading-snug font-normal text-muted-foreground">
                  {group
                    ? "Confirmo que todos os concorrentes autorizam o tratamento dos seus nomes, idades e telefones para a gestão do concurso de karaoke."
                    : "Autorizo o tratamento do meu nome, idade e telefone para a gestão do concurso de karaoke."}{" "}
                  O telefone e a idade não são mostrados publicamente.
                </Label>
              </div>
              <FieldError id="consent" message={errors.consent} />
            </div>

            {formError && (
              <p id="form-error" tabIndex={-1} role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive outline-none">
                {formError}
              </p>
            )}
            <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={busy}>
              {busy ? "A enviar…" : group ? `Inscrever grupo de ${contestants.length}` : "Inscrever-me"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}
