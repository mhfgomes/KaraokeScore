import { prisma } from "@/lib/db";
import { notifyUpdate } from "@/lib/events";
import { fail, handle } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";


const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const POST = handle(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const name = text(body.name, 60);
  const song = text(body.song, 160);
  const notes = text(body.notes, 280) || null;
  const age = Number(body.age);
  const phone = normalizePhone(text(body.phone, 30));

  if (!name) fail(400, "Indica o teu nome.");
  if (!Number.isInteger(age) || age < 1 || age > 120) fail(400, "Idade inválida.");
  if (!phone) fail(400, "Número de telefone inválido.");
  if (!song) fail(400, "Indica a música.");
  if (body.consent !== true) fail(400, "É necessário aceitar o tratamento dos dados.");

  // Tudo numa transação: a fase da noite, a duplicação e a posição na fila são
  // verificadas e gravadas sem que outro pedido se intercale
  const perf = await prisma.$transaction(async (tx) => {
    const night = await tx.night.findFirst({ where: { status: { not: "CLOSED" } }, orderBy: { id: "desc" } });
    if (!night) fail(409, "Não há nenhuma noite aberta.");
    if (night.status !== "REGISTRATION") fail(409, "As inscrições desta noite já fecharam.");

    const existing = await tx.contestant.findUnique({ where: { phone } });
    if (existing) {
      const already = await tx.performance.findUnique({
        where: { nightId_contestantId: { nightId: night.id, contestantId: existing.id } },
      });
      if (already) fail(409, "Este número de telefone já está inscrito nesta noite.");
    }
    const contestant = existing
      ? await tx.contestant.update({ where: { id: existing.id }, data: { name, age } })
      : await tx.contestant.create({ data: { phone, name, age } });

    const last = await tx.performance.aggregate({ where: { nightId: night.id }, _max: { position: true } });
    return tx.performance.create({
      data: {
        nightId: night.id,
        contestantId: contestant.id,
        name,
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
