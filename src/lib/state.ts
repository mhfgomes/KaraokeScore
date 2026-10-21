import { prisma } from "./db";
import { getBrand } from "./brand";
import { getPublicBaseUrl } from "./net";
import { closeIfExpired, getCurrentNight } from "./night";

/** Estado público (sem telefone/idade). Durante a votação a distribuição é anónima. */
export async function getPublicState(deviceId?: string) {
  await closeIfExpired();
  const night = await getCurrentNight();
  const baseUrl = getPublicBaseUrl();
  const brand = await getBrand();
  if (!night) return { serverTime: Date.now(), baseUrl, brand, night: null, queue: [], voting: null, results: null, hasVoted: false };

  const performances = await prisma.performance.findMany({
    where: { nightId: night.id },
    orderBy: { position: "asc" },
    include: { _count: { select: { votes: true } } },
  });
  const active = performances.filter((p) => p.status !== "SKIPPED");

  const queue = performances.map((p) => ({
    id: p.id,
    position: p.position,
    name: p.name,
    song: p.song,
    status: p.status,
  }));

  let voting = null;
  if (night.status === "VOTING") {
    const total = active.reduce((s, p) => s + p._count.votes, 0);
    voting = {
      total,
      // Barras anónimas, ordenadas da maior para a menor
      bars: active
        .map((p) => (total ? Math.round((p._count.votes / total) * 1000) / 10 : 0))
        .sort((a, b) => b - a),
      candidates: active.map((p) => ({ id: p.id, name: p.name, song: p.song })),
    };
  }

  let results = null;
  if (night.status === "CLOSED") {
    results = active
      .map((p) => ({ id: p.id, name: p.name, song: p.song, rank: p.rank, votes: p.voteCount, points: p.points }))
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }

  const hasVoted = deviceId
    ? (await prisma.vote.count({ where: { nightId: night.id, deviceId } })) > 0
    : false;

  return {
    serverTime: Date.now(),
    baseUrl,
    brand,
    night: {
      id: night.id,
      date: night.date,
      status: night.status,
      currentId: night.currentId,
      votingEndsAt: night.votingEndsAt?.toISOString() ?? null,
    },
    queue,
    voting,
    results,
    hasVoted,
  };
}

export type PublicState = Awaited<ReturnType<typeof getPublicState>>;
