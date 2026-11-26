import { prisma } from "@/lib/db";
import { notifyUpdate } from "@/lib/events";
import { fail, handle } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { songLabel } from "@/lib/songs";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const POST = handle(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const freeSong = text(body.song, 160);
  const songId = Number(body.songId);
  const notes = text(body.notes, 280) || null;
  // Aceita também o formato anterior para inscrições individuais.
  const rawMembers = body.contestants === undefined ? [body] : body.contestants;
  if (!Array.isArray(rawMembers) || rawMembers.length === 0) fail(400, "Indica pelo menos um concorrente.");
  const members = rawMembers.map((member: unknown, index: number) => {
    if (!member || typeof member !== "object") fail(400, "Concorrente inválido.");
    const data = member as Record<string, unknown>;
    const name = text(data.name, 60);
    const age = Number(data.age);
    const phone = normalizePhone(text(data.phone, 30));
    if (!name) fail(400, `Indica o nome do concorrente ${index + 1}.`);
    if (!Number.isInteger(age) || age < 1 || age > 120) fail(400, `Idade inválida no concorrente ${index + 1}.`);
    if (!phone) fail(400, `Número de telefone inválido no concorrente ${index + 1}.`);
    return { name, age, phone };
  });
  if (new Set(members.map((m) => m.phone)).size !== members.length) {
    fail(400, "O mesmo concorrente não pode aparecer duas vezes na mesma atuação.");
  }
  if (body.consent !== true) fail(400, "É necessário aceitar o tratamento dos dados.");


  // Tudo numa transação: a fase da noite, os concorrentes e a posição na fila são
  // verificadas e gravadas sem que outro pedido se intercale
  const perf = await prisma.$transaction(async (tx) => {
    const night = await tx.night.findFirst({ where: { status: { not: "CLOSED" } }, orderBy: { id: "desc" } });
    if (!night) fail(409, "Não há nenhuma noite aberta.");
    if (night.status !== "REGISTRATION") fail(409, "As inscrições desta noite já fecharam.");

    // A música vem da lista da noite; sem lista (ou lista vazia) aceita-se texto livre
    let song = freeSong;
    if (night.songListId && (await tx.song.count({ where: { listId: night.songListId } }))) {
      const chosen = Number.isInteger(songId) ? await tx.song.findFirst({ where: { id: songId, listId: night.songListId } }) : null;
      if (!chosen) fail(400, "Escolhe uma música da lista.");
      song = songLabel(chosen);
    }
    if (!song) fail(400, "Indica a música.");
    if (night.maxSignups != null) {
      const count = await tx.performance.count({ where: { nightId: night.id, status: { not: "SKIPPED" } } });
      if (count >= night.maxSignups) fail(409, "As inscrições desta noite estão esgotadas.");
    }

    const participants = [];
    for (const member of members) {
      const contestant = await tx.contestant.upsert({
        where: { phone: member.phone },
        update: { name: member.name, age: member.age },
        create: member,
      });
      participants.push({ ...member, contestantId: contestant.id, position: participants.length });
    }

    const last = await tx.performance.aggregate({ where: { nightId: night.id }, _max: { position: true } });
    return tx.performance.create({
      data: {
        nightId: night.id,
        contestantId: participants[0].contestantId,
        name: members.map((m) => m.name).join(" + "),
        members: { create: participants },
        song,
        notes,
        position: (last._max.position ?? 0) + 1,
        consentAt: new Date(),
      },
    });
  });
  notifyUpdate();
  return { position: perf.position };
});
