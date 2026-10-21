import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { fail, HttpError } from "./http";
import { notifyUpdate } from "./events";
import { competitionRank, pointsFor } from "./scoring";
import { VOTING_DURATIONS } from "./types";

export type NightStatus = "REGISTRATION" | "VOTING" | "CLOSED";

type Tx = Prisma.TransactionClient;

export function today() {
  // Data em Lisboa (AAAA-MM-DD), independente do fuso horário do PC
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

/** Noite ativa (não fechada) ou, se não houver, a última. */
export async function getCurrentNight() {
  const active = await prisma.night.findFirst({
    where: { status: { not: "CLOSED" } },
    orderBy: { id: "desc" },
  });
  return active ?? prisma.night.findFirst({ orderBy: { id: "desc" } });
}

/**
 * Lê a noite ativa e valida a fase. Chamado dentro de uma transação, a
 * verificação e as escritas seguintes ficam atómicas (o adaptador SQLite
 * serializa as transações).
 */
export async function requireActiveNight(status?: NightStatus, tx: Tx = prisma) {
  const night = await tx.night.findFirst({ where: { status: { not: "CLOSED" } }, orderBy: { id: "desc" } });
  if (!night) fail(409, "Não há nenhuma noite aberta.");
  if (status && night.status !== status) fail(409, "Ação não disponível nesta fase da noite.");
  return night;
}

export async function openNight() {
  const night = await prisma.$transaction(async (tx) => {
    const active = await tx.night.findFirst({ where: { status: { not: "CLOSED" } } });
    if (active) fail(409, "Já existe uma noite aberta.");
    return tx.night.create({ data: { date: today() } });
  });
  notifyUpdate();
  return night;
}

// Temporizador do fecho automático (um só, partilhado entre recarregamentos em dev)
const timers = globalThis as unknown as { kvAutoClose?: ReturnType<typeof setTimeout> };

function scheduleAutoClose(endsAt: Date | null) {
  clearTimeout(timers.kvAutoClose);
  if (!endsAt) return;
  timers.kvAutoClose = setTimeout(
    () => closeIfExpired().catch((e) => console.error("Fecho automático falhou:", e)),
    Math.max(0, endsAt.getTime() - Date.now()) + 250,
  );
}

/**
 * Fecha a votação se o tempo acabou. Também é chamado ao ler o estado, o que
 * cobre o caso de o servidor ter sido reiniciado com uma votação temporizada.
 */
export async function closeIfExpired() {
  const night = await prisma.night.findFirst({
    where: { status: "VOTING", votingEndsAt: { lte: new Date() } },
  });
  if (!night) return;
  try {
    await closeVoting();
  } catch (e) {
    // Outro pedido fechou-a entretanto
    if (!(e instanceof HttpError)) throw e;
  }
}

/** Abre a votação; com `minutes`, fecha sozinha ao fim desse tempo. */
export async function startVoting(minutes?: number | null) {
  if (minutes != null && !VOTING_DURATIONS.includes(minutes as (typeof VOTING_DURATIONS)[number])) {
    fail(400, "Duração inválida.");
  }
  const votingEndsAt = minutes ? new Date(Date.now() + minutes * 60_000) : null;
  await prisma.$transaction(async (tx) => {
    const night = await requireActiveNight("REGISTRATION", tx);
    // Quem está a cantar agora é a última atuação: fica como "feita"
    if (night.currentId) {
      await tx.performance.updateMany({
        where: { id: night.currentId, nightId: night.id, status: "QUEUED" },
        data: { status: "DONE" },
      });
    }
    const pending = await tx.performance.count({ where: { nightId: night.id, status: "QUEUED" } });
    if (pending > 0) {
      fail(409, `Ainda há ${pending} por cantar. Marca quem faltar como "Não compareceu".`);
    }
    const votable = await tx.performance.count({ where: { nightId: night.id, status: "DONE" } });
    if (votable === 0) fail(409, "Não há concorrentes para votar.");
    await tx.night.update({ where: { id: night.id }, data: { status: "VOTING", currentId: null, votingEndsAt } });
  });
  scheduleAutoClose(votingEndsAt);
  notifyUpdate();
}

export async function closeVoting() {
  await prisma.$transaction(async (tx) => {
    const night = await requireActiveNight("VOTING", tx);
    const performances = await tx.performance.findMany({
      where: { nightId: night.id, status: { not: "SKIPPED" } },
      include: { votes: { select: { weight: true } } },
    });
    const tallied = performances.map((p) => ({ id: p.id, votes: p.votes.reduce((s, v) => s + v.weight, 0) }));
    const ranked = competitionRank(tallied, (a, b) => b.votes - a.votes);
    for (const r of ranked) {
      await tx.performance.update({
        where: { id: r.id },
        data: { voteCount: r.votes, rank: r.rank, points: pointsFor(r.rank, r.votes) },
      });
    }
    await tx.night.update({ where: { id: night.id }, data: { status: "CLOSED", votingEndsAt: null } });
  });
  scheduleAutoClose(null);
  notifyUpdate();
}

async function setCurrentTx(tx: Tx, performanceId: number | null) {
  const night = await requireActiveNight("REGISTRATION", tx);
  if (performanceId !== null) {
    const target = await tx.performance.findFirst({ where: { id: performanceId, nightId: night.id, status: "QUEUED" } });
    if (!target) fail(404, "Atuação não encontrada na fila desta noite.");
  }
  // A atuação que estava a decorrer passa a "feita"
  if (night.currentId && night.currentId !== performanceId) {
    await tx.performance.updateMany({
      where: { id: night.currentId, nightId: night.id, status: "QUEUED" },
      data: { status: "DONE" },
    });
  }
  await tx.night.update({ where: { id: night.id }, data: { currentId: performanceId } });
}

export async function setCurrent(performanceId: number | null) {
  await prisma.$transaction((tx) => setCurrentTx(tx, performanceId));
  notifyUpdate();
}

/** Avança a fila: termina a atuação atual e passa à próxima em espera. */
export async function nextInQueue() {
  await prisma.$transaction(async (tx) => {
    const night = await requireActiveNight("REGISTRATION", tx);
    const next = await tx.performance.findFirst({
      where: { nightId: night.id, status: "QUEUED", id: { not: night.currentId ?? -1 } },
      orderBy: { position: "asc" },
    });
    await setCurrentTx(tx, next?.id ?? null);
  });
  notifyUpdate();
}

const ALLOWED_FROM: Record<"QUEUED" | "SKIPPED", string> = { SKIPPED: "QUEUED", QUEUED: "SKIPPED" };

/** "Não compareceu" (SKIPPED) e repor (QUEUED); só durante as inscrições. */
export async function setPerformanceStatus(performanceId: number, status: "QUEUED" | "SKIPPED") {
  await prisma.$transaction(async (tx) => {
    const night = await requireActiveNight("REGISTRATION", tx);
    const perf = await tx.performance.findFirst({ where: { id: performanceId, nightId: night.id } });
    if (!perf) fail(404, "Atuação não encontrada.");
    if (perf.status !== ALLOWED_FROM[status]) fail(409, "Esta atuação já não está nesse estado.");
    await tx.performance.update({ where: { id: perf.id }, data: { status } });
    if (night.currentId === perf.id) {
      await tx.night.update({ where: { id: night.id }, data: { currentId: null } });
    }
  });
  notifyUpdate();
}

/** Classificação mensal: soma dos pontos por concorrente (telefone). */
export async function monthlyRanking(month: string) {
  const performances = await prisma.performance.findMany({
    where: { night: { status: "CLOSED", date: { startsWith: month } }, status: { not: "SKIPPED" } },
    include: { night: { select: { date: true } } },
    orderBy: { id: "asc" },
  });
  const byContestant = new Map<number, { name: string; points: number; firsts: number; votes: number; nights: number }>();
  for (const p of performances) {
    const row = byContestant.get(p.contestantId) ?? { name: p.name, points: 0, firsts: 0, votes: 0, nights: 0 };
    row.name = p.name; // nome mais recente
    row.points += p.points;
    row.firsts += p.rank === 1 && p.voteCount > 0 ? 1 : 0;
    row.votes += p.voteCount;
    row.nights += 1;
    byContestant.set(p.contestantId, row);
  }
  return competitionRank(
    [...byContestant.values()],
    (a, b) => b.points - a.points || b.firsts - a.firsts || b.votes - a.votes,
  );
}
