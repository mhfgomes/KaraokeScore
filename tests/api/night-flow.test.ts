import { beforeAll, describe, expect, it } from "vitest";
import { call, db, loginAdmin } from "./client";

// Fluxo completo de uma noite, por ordem (os testes partilham o estado)
let cookie = "";
const admin = (path: string, body?: unknown) => call(path, body, { cookie });
const register = (name: string, phone: string, extra: object = {}) =>
  call("/api/register", { name, age: 30, phone, song: "ABBA – Dancing Queen", consent: true, ...extra });
const performances = async () => (await admin("/api/admin/night")).data.performances as { id: number; name: string; status: string; age: number }[];

beforeAll(async () => {
  cookie = await loginAdmin();
});

describe("abrir a noite", () => {
  it("sem noite aberta, inscrições são recusadas", async () => {
    const res = await register("Ana", "912000001");
    expect(res.status).toBe(409);
  });

  it("aberturas simultâneas criam só uma noite", async () => {
    const results = await Promise.all([admin("/api/admin/night", { action: "open" }), admin("/api/admin/night", { action: "open" })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((db().prepare("SELECT COUNT(*) AS n FROM Night WHERE status != 'CLOSED'").get() as { n: number }).n).toBe(1);
  });
});

describe("inscrições", () => {
  it("valida os campos", async () => {
    expect((await register("", "912000001")).status).toBe(400);
    expect((await register("Ana", "12345")).status).toBe(400);
    expect((await register("Ana", "912000001", { age: 0 })).status).toBe(400);
    expect((await register("Ana", "912000001", { song: "" })).status).toBe(400);
    expect((await register("Ana", "912000001", { consent: false })).status).toBe(400);
  });

  it("inscrições simultâneas recebem posições diferentes", async () => {
    const names = ["Ana", "Rui", "Marta", "João", "Inês"];
    const results = await Promise.all(names.map((name, i) => register(name, `91200000${i + 1}`)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.map((r) => r.data.position).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("o mesmo telefone (noutro formato) não se inscreve duas vezes nem altera os dados", async () => {
    const res = await register("Outro Nome", "+351 912 000 001", { age: 99 });
    expect(res.status).toBe(409);
    const ana = (await performances()).find((p) => p.name === "Ana")!;
    expect(ana.age).toBe(30);
    expect((db().prepare("SELECT name FROM Contestant WHERE phone = '912000001'").get() as { name: string }).name).toBe("Ana");
  });

  it("o estado público não expõe telefones nem idades", async () => {
    const { data } = await call("/api/state");
    expect(JSON.stringify(data)).not.toMatch(/91200000|"age"|"phone"/);
    expect(data.queue).toHaveLength(5);
  });
});

describe("fila", () => {
  it("não aceita pôr a cantar uma atuação inexistente", async () => {
    const res = await admin("/api/admin/queue", { action: "setCurrent", id: 9999 });
    expect(res.status).toBe(404);
  });

  it("não abre a votação com pessoas por cantar", async () => {
    const res = await admin("/api/admin/night", { action: "startVoting" });
    expect(res.status).toBe(409);
    expect(res.data.error).toMatch(/Ainda há 5 por cantar/);
  });

  it("'Não compareceu' e repor", async () => {
    const ines = (await performances()).find((p) => p.name === "Inês")!;
    expect((await admin("/api/admin/queue", { action: "skip", id: ines.id })).status).toBe(200);
    expect((await admin("/api/admin/queue", { action: "skip", id: ines.id })).status).toBe(409);
    expect((await admin("/api/admin/queue", { action: "restore", id: ines.id })).status).toBe(200);
    expect((await admin("/api/admin/queue", { action: "skip", id: ines.id })).status).toBe(200);
  });

  // A ordem da fila depende de quem se inscreveu primeiro (pedidos simultâneos)
  let lastSinger = "";

  it("'Próximo' avança pela ordem da fila e marca quem cantou", async () => {
    const singers = (await performances()).filter((p) => p.status !== "SKIPPED").map((p) => p.name);
    for (let i = 0; i < 4; i++) await admin("/api/admin/queue", { action: "next" });
    const statuses = (await performances()).filter((p) => p.status !== "SKIPPED").map((p) => p.status);
    expect(statuses).toEqual(["DONE", "DONE", "DONE", "QUEUED"]);
    lastSinger = singers[3];
    const { data } = await call("/api/state");
    expect(data.queue.find((q: { id: number }) => q.id === data.night.currentId).name).toBe(lastSinger);
  });

  it("abre a votação e quem estava a cantar fica como 'cantou'", async () => {
    expect((await admin("/api/admin/night", { action: "startVoting" })).status).toBe(200);
    expect((await performances()).find((p) => p.name === lastSinger)!.status).toBe("DONE");
  });

  it("depois de abrir a votação: sem inscrições nem repor faltosos", async () => {
    expect((await register("Tarde", "912000099")).status).toBe(409);
    const ines = (await performances()).find((p) => p.name === "Inês")!;
    expect((await admin("/api/admin/queue", { action: "restore", id: ines.id })).status).toBe(409);
  });
});

describe("votação", () => {
  const ids = async () => Object.fromEntries((await performances()).map((p) => [p.name, p.id]));

  it("não aceita votos em faltosos", async () => {
    const { Inês } = await ids();
    const res = await call("/api/vote", { performanceId: Inês }, { ip: "10.0.0.1" });
    expect(res.status).toBe(400);
  });

  it("um voto por dispositivo", async () => {
    const { Ana } = await ids();
    const first = await call("/api/vote", { performanceId: Ana }, { ip: "10.0.0.2", device: "dev-1" });
    const again = await call("/api/vote", { performanceId: Ana }, { ip: "10.0.0.3", device: "dev-1" });
    expect([first.status, again.status]).toEqual([200, 409]);
  });

  it("um voto por IP, mesmo com pedidos simultâneos de dispositivos diferentes", async () => {
    const { Rui } = await ids();
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => call("/api/vote", { performanceId: Rui }, { ip: "10.0.0.50", device: `par-${i}` })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it("barras anónimas, ordenadas da maior para a menor", async () => {
    const { Ana, Marta } = await ids();
    // Ana 1 (já tem) + 3 = 4; Rui 1; Marta 1
    for (const [i, id] of [Ana, Ana, Ana, Marta].entries()) {
      await call("/api/vote", { performanceId: id }, { ip: `10.0.1.${i + 1}` });
    }
    const { data } = await call("/api/state");
    expect(data.voting.total).toBe(6);
    expect(data.voting.bars).toEqual([...data.voting.bars].sort((a: number, b: number) => b - a));
    expect(data.voting.bars[0]).toBeCloseTo(66.7, 1);
  });

  it("fecha e atribui os pontos (empate no 2.º lugar)", async () => {
    expect((await admin("/api/admin/night", { action: "closeVoting" })).status).toBe(200);
    const { data } = await call("/api/state");
    const results = Object.fromEntries(data.results.map((r: { name: string; rank: number; points: number }) => [r.name, [r.rank, r.points]]));
    // Ana 4 votos; Rui e Marta 1 (empatados em 2.º); João 0
    expect(results).toEqual({ Ana: [1, 3], Rui: [2, 2], Marta: [2, 2], João: [4, 0] });
  });

  it("depois de fechar não se vota", async () => {
    const res = await call("/api/vote", { performanceId: 1 }, { ip: "10.0.2.1" });
    expect(res.status).toBe(409);
  });

  it("classificação mensal soma os pontos", async () => {
    const { data } = await call("/api/rankings");
    const rows = data.ranking.map((r: { name: string; points: number; rank: number }) => [r.name, r.points, r.rank]);
    expect(rows[0]).toEqual(["Ana", 3, 1]);
    // Empatados: mesmo lugar, ordem entre eles indiferente
    expect(rows.slice(1, 3)).toEqual(expect.arrayContaining([["Rui", 2, 2], ["Marta", 2, 2]]));
  });
});

describe("votação temporizada", () => {
  it("recusa durações fora da lista", async () => {
    await admin("/api/admin/night", { action: "open" });
    await register("Solo", "912000010");
    await admin("/api/admin/queue", { action: "next" });
    const res = await admin("/api/admin/night", { action: "startVoting", minutes: 7 });
    expect(res.status).toBe(400);
  });

  it("indica quando fecha e fecha sozinha quando o tempo acaba", async () => {
    expect((await admin("/api/admin/night", { action: "startVoting", minutes: 5 })).status).toBe(200);
    const { data } = await call("/api/state");
    const remaining = new Date(data.night.votingEndsAt).getTime() - data.serverTime;
    expect(remaining).toBeGreaterThan(4.9 * 60_000);
    expect(remaining).toBeLessThanOrEqual(5 * 60_000);

    // Simula o fim do tempo
    // (mesmo formato que o Prisma usa para guardar datas no SQLite)
    const conn = db();
    const { kind } = conn.prepare("SELECT typeof(votingEndsAt) AS kind FROM Night WHERE status = 'VOTING'").get() as { kind: string };
    const past = new Date(Date.now() - 1000);
    conn.prepare("UPDATE Night SET votingEndsAt = ? WHERE status = 'VOTING'").run(kind === "integer" ? past.getTime() : past.toISOString());
    const late = await call("/api/vote", { performanceId: data.queue[0].id }, { ip: "10.0.3.1" });
    expect(late.status).toBe(409);
    expect(late.data.error).toMatch(/tempo/);

    const after = await call("/api/state");
    expect(after.data.night.status).toBe("CLOSED");
  });
});
