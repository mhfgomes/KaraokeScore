import { prisma } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/http";

/** Todos os concorrentes registados, com um resumo das participações. */
export const GET = handle(async () => {
  await requireAdmin();
  const rows = await prisma.contestant.findMany({
    include: {
      participations: {
        where: { performance: { status: { not: "SKIPPED" } } },
        select: { performance: { select: { nightId: true, points: true, night: { select: { date: true } } } } },
      },
    },
  });

  const contestants = rows.map((c) => {
    const perfs = c.participations.map((m) => m.performance);
    const dates = perfs.map((p) => p.night.date).sort();
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      age: c.age,
      createdAt: c.createdAt.toISOString(),
      performances: perfs.length,
      nights: new Set(perfs.map((p) => p.nightId)).size,
      points: perfs.reduce((s, p) => s + p.points, 0),
      lastNight: dates.at(-1) ?? null,
    };
  });
  contestants.sort((a, b) => a.name.localeCompare(b.name, "pt"));
  return { contestants };
});
