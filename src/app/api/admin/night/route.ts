import { prisma } from "@/lib/db";
import { fail, handle, requireAdmin } from "@/lib/http";
import { cancelNight, closeVoting, setMaxSignups, getCurrentNight, openNight, startVoting } from "@/lib/night";

// Detalhe completo da noite atual (inclui telefone e idade — só admin)
export const GET = handle(async () => {
  await requireAdmin();
  const current = await getCurrentNight();
  if (!current) return { night: null, performances: [] };
  const songList = current.songListId ? await prisma.songList.findUnique({ where: { id: current.songListId }, select: { name: true } }) : null;
  const night = { ...current, songListName: songList?.name ?? null };
  const performances = await prisma.performance.findMany({
    where: { nightId: night.id },
    orderBy: { position: "asc" },
    include: { members: { orderBy: { position: "asc" } }, contestant: { select: { phone: true, age: true } }, _count: { select: { votes: true } } },
  });
  return {
    night,
    performances: performances.map((p) => ({
      id: p.id,
      position: p.position,
      name: p.name,
      song: p.song,
      notes: p.notes,
      status: p.status,
      phone: p.members[0]?.phone ?? p.contestant.phone,
      age: p.members[0]?.age ?? p.contestant.age,
      contestants: p.members.length ? p.members.map(({ name, age, phone }) => ({ name, age, phone })) : [{ name: p.name, age: p.contestant.age, phone: p.contestant.phone }],
      votes: p._count.votes,
      rank: p.rank,
      points: p.points,
    })),
  };
});

export const POST = handle(async (request: Request) => {
  await requireAdmin();
  const { action, minutes, max, songListId } = await request.json().catch(() => ({}));
  if (action === "open") await openNight(undefined, null, songListId == null || songListId === "" ? null : Number(songListId));
  else if (action === "startVoting") await startVoting(minutes ? Number(minutes) : null);
  else if (action === "closeVoting") await closeVoting();
  else if (action === "cancel") await cancelNight();
  else if (action === "setMaxSignups") await setMaxSignups(max == null || max === "" ? null : Number(max));
  else fail(400, "Ação inválida.");
});
