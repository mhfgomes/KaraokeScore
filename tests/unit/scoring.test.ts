import { describe, expect, it } from "vitest";
import { competitionRank, pointsFor } from "@/lib/scoring";

const byVotes = (a: { votes: number }, b: { votes: number }) => b.votes - a.votes;

describe("competitionRank", () => {
  it("ordena e numera 1, 2, 3", () => {
    const ranked = competitionRank([{ id: "c", votes: 1 }, { id: "a", votes: 9 }, { id: "b", votes: 5 }], byVotes);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });

  it("empatados partilham o lugar e o seguinte salta (1, 1, 3)", () => {
    const ranked = competitionRank([{ votes: 4 }, { votes: 4 }, { votes: 2 }, { votes: 2 }, { votes: 1 }], byVotes);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3, 3, 5]);
  });

  it("aceita desempates encadeados (mensal: pontos, 1.os lugares, votos)", () => {
    const rows = [
      { name: "A", points: 6, firsts: 1, votes: 10 },
      { name: "B", points: 6, firsts: 2, votes: 5 },
      { name: "C", points: 6, firsts: 2, votes: 7 },
    ];
    const ranked = competitionRank(rows, (a, b) => b.points - a.points || b.firsts - a.firsts || b.votes - a.votes);
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([["C", 1], ["B", 2], ["A", 3]]);
  });

  it("não altera a lista original", () => {
    const items = [{ votes: 1 }, { votes: 2 }];
    competitionRank(items, byVotes);
    expect(items).toEqual([{ votes: 1 }, { votes: 2 }]);
  });
});

describe("pointsFor", () => {
  it("3, 2 e 1 pontos para os três primeiros", () => {
    expect([1, 2, 3, 4].map((rank) => pointsFor(rank, 5))).toEqual([3, 2, 1, 0]);
  });

  it("sem votos não há pontos, mesmo em 1.º", () => {
    expect(pointsFor(1, 0)).toBe(0);
  });
});
