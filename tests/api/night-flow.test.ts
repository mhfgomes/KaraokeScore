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

describe("lista de músicas por defeito", () => {
  it("existe à partida com as músicas da lista principal", async () => {
    const { lists } = (await admin("/api/admin/songs")).data;
    expect(lists).toEqual([{ id: 1, name: "Lista principal", isDefault: true, songs: 126, inUse: false }]);
    const { songs } = (await admin("/api/admin/songs?listId=1")).data;
    expect(songs).toContainEqual(expect.objectContaining({ artist: "Xutos & Pontapés", title: "A Minha Casinha" }));
    expect(songs).toContainEqual(expect.objectContaining({ artist: "", title: "Ó malhão malhão" }));
    // Os testes seguintes usam música escrita à mão (sem listas)
    expect((await admin("/api/admin/songs", { action: "deleteList", listId: 1 })).status).toBe(200);
  });
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

describe("cancelar a noite", () => {
  it("apaga a noite aberta com as inscrições; sem noite aberta dá erro", async () => {
    expect((await admin("/api/admin/night", { action: "open" })).status).toBe(200);
    expect((await admin("/api/admin/night", { action: "startVoting" })).data.error).toMatch(/cancela-a/);
    expect((await register("Ana", "912000001")).status).toBe(200);
    const night = (await admin("/api/admin/night")).data.night;
    expect((await admin("/api/admin/night", { action: "cancel" })).status).toBe(200);
    expect((db().prepare("SELECT COUNT(*) AS n FROM Performance WHERE nightId = ?").get(night.id) as { n: number }).n).toBe(0);
    expect((await admin("/api/admin/night")).data.night?.status).toBe("CLOSED");
    expect((await admin("/api/admin/night", { action: "cancel" })).status).toBe(409);
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


describe("atuações com vários concorrentes e inscrições repetidas", () => {
  it("permite solos, duplas e trios com a mesma pessoa e mantém os dados de cada inscrição", async () => {
    await admin("/api/admin/night", { action: "open" });
    const ana = { name: "Ana", age: 30, phone: "912000001" };
    const rui = { name: "Rui", age: 31, phone: "912000002" };
    const marta = { name: "Marta", age: 32, phone: "912000003" };
    const signup = (contestants: object[]) => call("/api/register", { contestants, song: "Queen – Somebody to Love", consent: true });
    expect((await register("Ana", "+351 912 000 001")).status).toBe(200);
    expect((await signup([ana, rui])).status).toBe(200);
    expect((await signup([ana, rui, marta])).status).toBe(200);
    expect((await signup([])).status).toBe(400);
    expect((await signup([ana, { ...ana, phone: "+351912000001" }])).status).toBe(400);
    expect((await signup([ana, { ...rui, age: 0 }])).status).toBe(400);
    const detail = (await admin("/api/admin/night")).data;
    expect(detail.performances.map((p: { name: string }) => p.name)).toEqual(["Ana", "Ana + Rui", "Ana + Rui + Marta"]);
    expect(detail.performances[2].contestants).toEqual([ana, rui, marta]);
    const state = (await call("/api/state")).data;
    expect(state.queue).toHaveLength(3);
    expect(JSON.stringify(state)).not.toMatch(/91200000|"age"|"phone"/);
    await admin("/api/admin/night", { action: "setMaxSignups", max: 3 });
    expect((await signup([rui])).status).toBe(409);
    for (let i = 0; i < 3; i++) await admin("/api/admin/queue", { action: "next" });
    await admin("/api/admin/night", { action: "startVoting" });
    const groupId = detail.performances[2].id;
    expect((await call("/api/vote", { performanceId: groupId }, { ip: "10.9.0.1" })).status).toBe(200);
    await admin("/api/admin/night", { action: "closeVoting" });
    const ranking = (await call("/api/rankings")).data.ranking;
    expect(ranking.find((r: { name: string }) => r.name === "Ana")).toMatchObject({ points: 6, nights: 2 });
    expect(ranking.find((r: { name: string }) => r.name === "Marta")).toMatchObject({ points: 5, nights: 2 });
  });

  it("lista todos os concorrentes registados no admin", async () => {
    const { contestants } = (await admin("/api/admin/contestants")).data;
    expect(contestants.map((c: { name: string }) => c.name)).toEqual([...contestants.map((c: { name: string }) => c.name)].sort((a, b) => a.localeCompare(b)));
    expect(contestants.find((c: { phone: string }) => c.phone === "912000001")).toMatchObject({ name: "Ana", performances: 4, points: 6 });
  });
});

describe("gestão de noites", () => {
  type NightRow = { id: number; date: string; status: string; maxSignups: number | null; performances: number; votes: number };
  const nights = async () => (await admin("/api/admin/nights")).data.nights as NightRow[];
  const act = (body: object) => admin("/api/admin/nights", body);

  it("cria uma noite com data e limite, e só uma de cada vez", async () => {
    expect((await act({ action: "create", date: "2026-02-30" })).status).toBe(400);
    expect((await act({ action: "create", date: "2026-11-01", maxSignups: 0 })).status).toBe(400);
    expect((await act({ action: "create", date: "2026-11-01", maxSignups: 12 })).status).toBe(200);
    expect((await act({ action: "create", date: "2026-11-02" })).status).toBe(409);
    expect((await nights()).find((n) => n.date === "2026-11-01")).toMatchObject({ status: "REGISTRATION", maxSignups: 12, performances: 0 });
  });

  it("edita a data e o limite; numa noite fechada só a data", async () => {
    const open = (await nights()).find((n) => n.status === "REGISTRATION")!;
    expect((await act({ action: "update", id: open.id, date: "2026-11-03", maxSignups: "" })).status).toBe(200);
    expect((await nights()).find((n) => n.id === open.id)).toMatchObject({ date: "2026-11-03", maxSignups: null });
    expect((await act({ action: "update", id: open.id, date: "ontem" })).status).toBe(400);
    const closed = (await nights()).find((n) => n.status === "CLOSED")!;
    expect((await act({ action: "update", id: closed.id, maxSignups: 5 })).status).toBe(409);
    expect((await act({ action: "update", id: 9999, date: "2026-11-03" })).status).toBe(404);
  });

  it("apaga uma noite com as atuações e os votos", async () => {
    const closed = (await nights()).find((n) => n.status === "CLOSED" && n.votes > 0)!;
    expect((await act({ action: "delete", id: closed.id })).status).toBe(200);
    expect((await nights()).some((n) => n.id === closed.id)).toBe(false);
    expect((db().prepare("SELECT COUNT(*) AS n FROM Vote WHERE nightId = ?").get(closed.id) as { n: number }).n).toBe(0);
    expect((await act({ action: "delete", id: closed.id })).status).toBe(404);
    expect((await act({ action: "delete", id: "abc" })).status).toBe(400);
    const open = (await nights()).find((n) => n.status === "REGISTRATION")!;
    expect((await act({ action: "delete", id: open.id })).status).toBe(200);
    expect((await call("/api/state")).data.night?.status).not.toBe("REGISTRATION");
  });
});

describe("listas de músicas", () => {
  type Song = { id: number; artist: string; title: string };
  type List = { id: number; name: string; isDefault: boolean; songs: number; inUse: boolean };
  const lists = async () => (await admin("/api/admin/songs")).data.lists as List[];
  const listSongs = async (listId: number) => (await admin(`/api/admin/songs?listId=${listId}`)).data.songs as Song[];
  const act = (body: object) => admin("/api/admin/songs", body);
  const signup = (extra: object) => call("/api/register", { name: "Ana", age: 30, phone: "912000001", consent: true, ...extra });
  let rock = 0;
  let pop = 0;

  it("cria listas; a primeira fica por defeito e os nomes não se repetem", async () => {
    rock = (await act({ action: "createList", name: "Rock" })).data.id;
    expect((await act({ action: "createList", name: "rock" })).status).toBe(409);
    expect((await act({ action: "createList", name: " " })).status).toBe(400);
    expect(await lists()).toEqual([{ id: rock, name: "Rock", isDefault: true, songs: 0, inUse: false }]);
  });

  it("adiciona uma a uma e em bulk, nos dois formatos, sem repetidas", async () => {
    expect((await act({ action: "add", listId: rock, artist: "ABBA", title: "" })).status).toBe(400);
    expect((await act({ action: "add", listId: 9999, title: "X" })).status).toBe(404);
    expect((await act({ action: "add", listId: rock, artist: "Queen", title: "Bohemian Rhapsody" })).data).toMatchObject({ added: 1, skipped: 0 });
    const bulk = await act({ action: "bulk", listId: rock, text: "ROCK\nqueen - bohemian rhapsody\nAC/DC - Highway to Hell\n\nBon Jovi;It's My Life\n" });
    expect(bulk.data).toEqual({ added: 2, skipped: 1, invalid: 0, headings: 1 });
    const reversed = await act({ action: "bulk", listId: rock, order: "title-artist", text: "Zombie - The Cranberries" });
    expect(reversed.data.added).toBe(1);
    expect((await listSongs(rock)).map((s) => `${s.artist}|${s.title}`)).toEqual([
      "AC/DC|Highway to Hell",
      "Bon Jovi|It's My Life",
      "Queen|Bohemian Rhapsody",
      "The Cranberries|Zombie",
    ]);
  });

  it("copia uma lista e muda a lista por defeito", async () => {
    pop = (await act({ action: "createList", name: "Pop", copyFrom: rock })).data.id;
    expect(await listSongs(pop)).toHaveLength(4);
    expect((await act({ action: "renameList", listId: pop, name: "Rock" })).status).toBe(409);
    expect((await act({ action: "renameList", listId: pop, name: "Pop e Baladas" })).status).toBe(200);
    expect((await act({ action: "setDefault", listId: pop })).status).toBe(200);
    expect((await lists()).map((l) => [l.name, l.isDefault])).toEqual([["Pop e Baladas", true], ["Rock", false]]);
  });

  it("com várias listas, abrir a noite exige escolher uma", async () => {
    expect((await admin("/api/admin/night", { action: "open" })).status).toBe(400);
    expect((await admin("/api/admin/night", { action: "open", songListId: 9999 })).status).toBe(404);
    expect((await admin("/api/admin/night", { action: "open", songListId: rock })).status).toBe(200);
    expect((await admin("/api/admin/night")).data.night).toMatchObject({ songListId: rock, songListName: "Rock" });
    expect((await lists()).find((l) => l.id === rock)?.inUse).toBe(true);
    expect((await call("/api/state")).data.night.songListName).toBe("Rock");
  });

  it("a inscrição só aceita músicas da lista da noite", async () => {
    const [first] = await listSongs(rock);
    const [, popSong] = await listSongs(pop);
    expect((await call("/api/songs")).data.songs).toHaveLength(4);
    expect((await signup({ song: "Música inventada" })).status).toBe(400);
    expect((await signup({ songId: popSong.id })).status).toBe(400);
    expect((await signup({ songId: first.id })).status).toBe(200);
    expect((await admin("/api/admin/night")).data.performances.at(-1).song).toBe("AC/DC – Highway to Hell");
  });

  it("não apaga a lista em uso; muda a lista da noite e apaga", async () => {
    expect((await act({ action: "deleteList", listId: rock })).status).toBe(409);
    const nightId = (await admin("/api/admin/night")).data.night.id;
    expect((await admin("/api/admin/nights", { action: "update", id: nightId, songListId: pop })).status).toBe(200);
    expect((await act({ action: "deleteList", listId: rock })).status).toBe(200);
    expect(await listSongs(pop)).toHaveLength(4);
    // A inscrição já feita mantém a música
    expect((await admin("/api/admin/night")).data.performances.at(-1).song).toBe("AC/DC – Highway to Hell");
  });

  it("edita e apaga músicas", async () => {
    const songs = await listSongs(pop);
    const queen = songs.find((s) => s.artist === "Queen")!;
    expect((await act({ action: "update", id: queen.id, artist: "ac/dc", title: "highway to hell" })).status).toBe(409);
    expect((await act({ action: "update", id: queen.id, artist: "Queen", title: "Don't Stop Me Now" })).status).toBe(200);
    expect((await listSongs(pop)).find((s) => s.id === queen.id)?.title).toBe("Don't Stop Me Now");
    expect((await act({ action: "delete", ids: [songs[0].id] })).status).toBe(200);
    expect(await listSongs(pop)).toHaveLength(3);
    expect((await act({ action: "clear", listId: pop })).status).toBe(200);
    expect(await listSongs(pop)).toHaveLength(0);
    // Lista vazia: não aparece no menu inicial
    expect((await call("/api/state")).data.night.songListName).toBeNull();
    // Lista vazia: aceita texto livre
    expect((await signup({ phone: "912000002", song: "Livre – Qualquer" })).status).toBe(200);
  });

  it("com uma só lista, abre a noite com essa", async () => {
    const nightId = (await admin("/api/admin/night")).data.night.id;
    await admin("/api/admin/nights", { action: "delete", id: nightId });
    expect((await admin("/api/admin/night", { action: "open" })).status).toBe(200);
    expect((await admin("/api/admin/night")).data.night.songListId).toBe(pop);
  });
});
