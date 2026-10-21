import { prisma } from "@/lib/db";
import { ensureDeviceId } from "@/lib/device";
import { notifyUpdate } from "@/lib/events";
import { fail, handle } from "@/lib/http";
import { getClientIp } from "@/lib/net";

export const POST = handle(async (request: Request) => {
  const { performanceId } = await request.json().catch(() => ({}));
  const deviceId = await ensureDeviceId();
  const ip = getClientIp(request.headers);
  const ipLimit = process.env.ONE_VOTE_PER_IP !== "false" && ip;

  // Verificações e inserção na mesma transação: o fecho da votação e outros
  // votos simultâneos não se intercalam (o SQLite serializa as transações)
  await prisma.$transaction(async (tx) => {
    const night = await tx.night.findFirst({ where: { status: { not: "CLOSED" } }, orderBy: { id: "desc" } });
    if (night?.status !== "VOTING") fail(409, "A votação não está aberta.");
    if (night.votingEndsAt && night.votingEndsAt <= new Date()) fail(409, "O tempo de votação terminou.");

    const perf = await tx.performance.findFirst({
      where: { id: Number(performanceId), nightId: night.id, status: { not: "SKIPPED" } },
    });
    if (!perf) fail(400, "Concorrente inválido.");

    const existing = await tx.vote.findFirst({
      where: { nightId: night.id, OR: [{ deviceId }, ...(ipLimit ? [{ ip }] : [])] },
    });
    if (existing) fail(409, "Este dispositivo já votou nesta noite.");

    await tx.vote.create({ data: { nightId: night.id, performanceId: perf.id, deviceId, ip } });
  });
  notifyUpdate();
  return { ok: true };
});
