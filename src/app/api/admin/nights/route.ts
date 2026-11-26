import { prisma } from "@/lib/db";
import { fail, handle, requireAdmin } from "@/lib/http";
import { deleteNight, openNight, parseNightDate, updateNight } from "@/lib/night";

/** Todas as noites, das mais recentes para as mais antigas, com um resumo. */
export const GET = handle(async () => {
  await requireAdmin();
  const nights = await prisma.night.findMany({
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: {
      _count: { select: { votes: true } },
      songList: { select: { name: true } },
      performances: { where: { status: { not: "SKIPPED" } }, select: { name: true, rank: true, voteCount: true } },
    },
  });
  return {
    nights: nights.map((n) => ({
      id: n.id,
      date: n.date,
      status: n.status,
      maxSignups: n.maxSignups,
      songListId: n.songListId,
      songListName: n.songList?.name ?? null,
      performances: n.performances.length,
      votes: n._count.votes,
      winners: n.performances.filter((p) => p.rank === 1 && p.voteCount > 0).map((p) => p.name),
    })),
  };
});

const maxOf = (max: unknown) => (max == null || max === "" ? null : Number(max));
const listOf = (id: unknown) => (id == null || id === "" ? null : Number(id));

export const POST = handle(async (request: Request) => {
  await requireAdmin();
  const { action, id, date, maxSignups, songListId } = await request.json().catch(() => ({}));
  const nightId = Number(id);
  if (action !== "create" && !Number.isInteger(nightId)) fail(400, "Noite inválida.");
  if (action === "create") {
    await openNight(date ? parseNightDate(date) : undefined, maxOf(maxSignups), listOf(songListId));
  } else if (action === "update") {
    await updateNight(nightId, {
      ...(date !== undefined && { date: parseNightDate(date) }),
      ...(maxSignups !== undefined && { maxSignups: maxOf(maxSignups) }),
      ...(songListId !== undefined && { songListId: listOf(songListId) }),
    });
  } else if (action === "delete") {
    await deleteNight(nightId);
  } else fail(400, "Ação inválida.");
});
