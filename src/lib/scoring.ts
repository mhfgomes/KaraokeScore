// Pontos por lugar no fim de cada noite.
export const POINTS_BY_RANK: Record<number, number> = { 1: 3, 2: 2, 3: 1 };

// Ranking "de competição": empatados partilham o lugar e o seguinte salta (1, 1, 3).
export function competitionRank<T extends object>(items: T[], compare: (a: T, b: T) => number) {
  const sorted = [...items].sort(compare);
  const out: (T & { rank: number })[] = [];
  sorted.forEach((item, i) => {
    const rank = i > 0 && compare(sorted[i - 1], item) === 0 ? out[i - 1].rank : i + 1;
    out.push({ ...item, rank });
  });
  return out;
}

export function pointsFor(rank: number, votes: number) {
  return votes > 0 ? POINTS_BY_RANK[rank] ?? 0 : 0;
}
