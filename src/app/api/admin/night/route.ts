import { prisma } from "@/lib/db";
import { fail, handle, requireAdmin } from "@/lib/http";
import { closeVoting, getCurrentNight, openNight, startVoting } from "@/lib/night";

// Detalhe completo da noite atual (inclui telefone e idade — só admin)
export const GET = handle(async () => {
  await requireAdmin();
  const night = await getCurrentNight();
  if (!night) return { night: null, performances: [] };
  const performances = await prisma.performance.findMany({
    where: { nightId: night.id },
    orderBy: { position: "asc" },
    include: { contestant: { select: { phone: true, age: true } }, _count: { select: { votes: true } } },
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
      phone: p.contestant.phone,
      age: p.contestant.age,
      votes: p._count.votes,
      rank: p.rank,
      points: p.points,
    })),
  };
});

export const POST = handle(async (request: Request) => {
  await requireAdmin();
  const { action, minutes } = await request.json().catch(() => ({}));
  if (action === "open") await openNight();
  else if (action === "startVoting") await startVoting(minutes ? Number(minutes) : null);
  else if (action === "closeVoting") await closeVoting();
  else fail(400, "Ação inválida.");
});
