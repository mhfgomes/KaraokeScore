/**
 * Simula uma noite completa contra a app a correr (inscrições, fila, votos, fecho),
 * usando a API, por isso o telão e os telemóveis atualizam-se em tempo real.
 *
 *   npm run mock                       # noite completa ao ritmo de "espetáculo"
 *   npm run mock -- --fast             # sem pausas
 *   npm run mock -- --stop-at voting   # deixa a votação aberta (para votares tu)
 *   npm run mock -- --timer 5          # votação temporizada (fecha sozinha)
 *   npm run mock -- --help
 *
 * Os concorrentes de teste usam telefones 9100000NN (o mesmo número volta a ser
 * usado entre noites, o que também alimenta a classificação mensal).
 */
import "dotenv/config";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: process.env.MOCK_URL ?? "http://localhost:3000" },
    user: { type: "string", default: process.env.MOCK_ADMIN_USERNAME ?? process.env.ADMIN_USERNAME ?? "admin" },
    password: { type: "string", default: process.env.MOCK_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "" },
    contestants: { type: "string", short: "c", default: "6" },
    votes: { type: "string", short: "v", default: "40" },
    "no-show": { type: "string", default: "1" },
    timer: { type: "string" },
    "stop-at": { type: "string" },
    fast: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});


const SINGERS = [
  ["Ana Silva", "ABBA – Dancing Queen"],
  ["Rui Costa", "Queen – Bohemian Rhapsody"],
  ["Marta Lopes", "Adele – Rolling in the Deep"],
  ["João Dias", "Xutos & Pontapés – A Minha Casinha"],
  ["Inês Ferreira", "Amália Rodrigues – Barco Negro"],
  ["Pedro Santos", "Bon Jovi – Livin' on a Prayer"],
  ["Sofia Martins", "Whitney Houston – I Wanna Dance with Somebody"],
  ["Tiago Gomes", "Ornatos Violeta – Ouvi Dizer"],
  ["Carla Pinto", "Gloria Gaynor – I Will Survive"],
  ["Miguel Rocha", "Toto – Africa"],
  ["Beatriz Sousa", "Mariza – Ó Gente da Minha Terra"],
  ["André Neves", "Journey – Don't Stop Believin'"],
] as const;

if (args.help) {
  console.log(`Simula uma noite de karaoke contra a app a correr.

Opções:
  --url <url>          Endereço da app (por omissão http://localhost:3000)
  --user / --password  Admin (por omissão ADMIN_USERNAME/ADMIN_PASSWORD do .env;
                       ou MOCK_ADMIN_USERNAME/MOCK_ADMIN_PASSWORD)
  -c, --contestants N  Concorrentes a inscrever (por omissão 6, máx. ${SINGERS.length})
  -v, --votes N        Votos do público (por omissão 40)
  --no-show N          Quantos "não compareceram" (por omissão 1)
  --timer M            Votação temporizada: 5, 10, 15, 20 ou 30 minutos
  --stop-at <fase>     Parar em "registration" (fila por cantar) ou "voting" (votação aberta)
  --fast               Sem pausas (por omissão há pausas para se ver no telão)`);
  process.exit(0);
}

const base = args.url.replace(/\/$/, "");
const pause = (ms: number) => (args.fast ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
let adminCookie = "";

async function api(path: string, body?: unknown, opts: { admin?: boolean; ip?: string } = {}) {
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base, // a app recusa pedidos de outras origens
      ...(opts.admin && adminCookie ? { Cookie: adminCookie } : {}),
      // Cada "pessoa" do público com um IP diferente (só funciona sem nginx, ex.: npm run dev)
      ...(opts.ip ? { "X-Real-IP": opts.ip } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (path === "/api/admin/login" && res.ok) {
    adminCookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  }
  if (!res.ok) throw new Error(`${path}: ${data.error ?? res.status}`);
  return data;
}

type Night = { id: number; date: string; status: "REGISTRATION" | "VOTING" | "CLOSED"; currentId: number | null };
type Perf = { id: number; name: string; status: "QUEUED" | "DONE" | "SKIPPED" };

const adminNight = () => api("/api/admin/night", undefined, { admin: true }) as Promise<{ night: Night | null; performances: Perf[] }>;
const action = (body: object) => api("/api/admin/night", body, { admin: true });
const queue = (body: object) => api("/api/admin/queue", body, { admin: true });

async function main() {
  const count = Math.min(Math.max(Number(args.contestants) || 6, 1), SINGERS.length);
  const totalVotes = Math.max(Number(args.votes) || 0, 0);
  const noShows = Math.min(Math.max(Number(args["no-show"]) || 0, 0), count - 1);

  console.log(`🎤 Mock contra ${base}`);
  await api("/api/admin/login", { username: args.user, password: args.password });

  let { night } = await adminNight();
  if (night?.status === "VOTING") {
    console.log("Já há uma votação aberta: passo direto aos votos.");
  } else {
    if (!night || night.status === "CLOSED") {
      await action({ action: "open" });
      ({ night } = await adminNight());
      console.log(`Noite aberta (${night!.date}).`);
    } else {
      console.log(`A continuar a noite de ${night.date}, já aberta.`);
    }

    // Inscrições (ignora quem já estiver inscrito nesta noite)
    for (let i = 0; i < count; i++) {
      const [name, song] = SINGERS[i];
      const phone = `9100000${String(i + 1).padStart(2, "0")}`;
      try {
        const { position } = await api("/api/register", {
          name,
          age: 20 + ((i * 7) % 40),
          phone,
          song,
          notes: i === 0 ? "Inscrição de teste (mock)" : "",
          consent: true,
        });
        console.log(`  #${position} ${name} — ${song}`);
      } catch (e) {
        console.log(`  (${name}: ${(e as Error).message})`);
      }
      await pause(600);
    }
    if (args["stop-at"] === "registration") return console.log("Parado com as inscrições abertas.");

    // Fila: os últimos "não compareceram", os restantes cantam
    let perfs = (await adminNight()).performances.filter((p) => p.status === "QUEUED");
    for (const p of noShows ? perfs.slice(-noShows) : []) {
      await queue({ action: "skip", id: p.id });
      console.log(`  ✗ ${p.name} não compareceu`);
    }
    perfs = (await adminNight()).performances.filter((p) => p.status === "QUEUED");
    for (const p of perfs) {
      await queue({ action: "setCurrent", id: p.id });
      console.log(`  ▶ a cantar: ${p.name}`);
      await pause(2500);
    }

    await action({ action: "startVoting", minutes: args.timer ? Number(args.timer) : null });
    console.log(args.timer ? `Votação aberta (${args.timer} min).` : "Votação aberta.");
  }

  // Votos: distribuição desigual para haver um vencedor claro (e às vezes empates)
  const candidates = (await adminNight()).performances.filter((p) => p.status !== "SKIPPED");
  const weights = candidates.map((_, i) => 1 / (i + 1) + Math.random() * 0.6);
  const sum = weights.reduce((a, b) => a + b, 0);
  let cast = 0;
  for (let v = 0; v < totalVotes; v++) {
    let r = Math.random() * sum;
    const pick = candidates[weights.findIndex((w) => (r -= w) < 0)] ?? candidates[0];
    try {
      // Sem cookie = dispositivo novo; IP diferente para o limite de um voto por IP
      await api("/api/vote", { performanceId: pick.id }, { ip: `10.99.${Math.floor(v / 250)}.${(v % 250) + 1}` });
      cast++;
    } catch (e) {
      if (cast === 0 && v === 0) console.log(`  (voto recusado: ${(e as Error).message})`);
    }
    await pause(150);
  }
  console.log(`${cast} votos registados.`);
  if (cast < totalVotes) {
    console.log("  Alguns votos foram recusados: atrás do nginx (ou com ONE_VOTE_PER_IP) o IP não pode ser simulado.");
  }
  if (args["stop-at"] === "voting" || args.timer) {
    return console.log(args.timer ? "A votação fecha sozinha quando o tempo acabar." : "Votação deixada aberta.");
  }

  await pause(2000);
  await action({ action: "closeVoting" });
  console.log("Votação fechada — vê a revelação no telão (/ao-vivo).");
}

main().catch((e) => {
  console.error("❌", (e as Error).message);
  process.exit(1);
});
