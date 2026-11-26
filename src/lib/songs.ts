import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { fail } from "./http";
import { notifyUpdate } from "./events";
import { clean, MAX_ARTIST, MAX_BULK, MAX_TITLE, songKey, type SongInput } from "./song-search";

export { MAX_BULK, parseSongLine, parseSongText, songLabel } from "./song-search";

type Tx = Prisma.TransactionClient;
const MAX_LIST_NAME = 60;

/** Valida e normaliza uma música; o artista é opcional. */
export function toSong(artist: unknown, title: unknown): SongInput {
  const a = clean(typeof artist === "string" ? artist : "");
  const t = clean(typeof title === "string" ? title : "");
  if (!t) fail(400, "Indica o título da música.");
  if (a.length > MAX_ARTIST || t.length > MAX_TITLE) fail(400, "Artista ou título demasiado longo.");
  return { artist: a, title: t };
}

function toListName(name: unknown) {
  const n = clean(typeof name === "string" ? name : "");
  if (!n || n.length > MAX_LIST_NAME) fail(400, `Indica um nome para a lista (até ${MAX_LIST_NAME} caracteres).`);
  return n;
}

async function requireList(id: number, tx: Tx = prisma) {
  const list = Number.isInteger(id) ? await tx.songList.findUnique({ where: { id } }) : null;
  if (!list) fail(404, "Lista de músicas não encontrada.");
  return list;
}

async function nameTaken(name: string, exceptId?: number) {
  const lists = await prisma.songList.findMany({ select: { id: true, name: true } });
  const folded = name.toLocaleLowerCase("pt");
  return lists.some((l) => l.id !== exceptId && l.name.toLocaleLowerCase("pt") === folded);
}

// ── Listas ────────────────────────────────────────────────────────────────

/** Listas com o número de músicas e se estão a ser usadas pela noite aberta. */
export async function listSongLists() {
  const [lists, active] = await Promise.all([
    prisma.songList.findMany({ include: { _count: { select: { songs: true } } } }),
    prisma.night.findFirst({ where: { status: { not: "CLOSED" } }, select: { songListId: true } }),
  ]);
  return lists
    .map((l) => ({ id: l.id, name: l.name, isDefault: l.isDefault, songs: l._count.songs, inUse: active?.songListId === l.id }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, "pt"));
}

/** Cria uma lista vazia ou uma cópia de outra. A primeira lista fica por defeito. */
export async function createList(rawName: unknown, copyFrom?: number | null) {
  const name = toListName(rawName);
  if (await nameTaken(name)) fail(409, "Já existe uma lista com esse nome.");
  const list = await prisma.$transaction(async (tx) => {
    const source = copyFrom != null ? await requireList(copyFrom, tx) : null;
    const isDefault = (await tx.songList.count()) === 0;
    const created = await tx.songList.create({ data: { name, isDefault } });
    if (source) {
      const songs = await tx.song.findMany({ where: { listId: source.id }, select: { artist: true, title: true, key: true } });
      await tx.song.createMany({ data: songs.map((s) => ({ ...s, listId: created.id })) });
    }
    return created;
  });
  notifyUpdate();
  return { id: list.id };
}

export async function renameList(id: number, rawName: unknown) {
  const name = toListName(rawName);
  await requireList(id);
  if (await nameTaken(name, id)) fail(409, "Já existe uma lista com esse nome.");
  await prisma.songList.update({ where: { id }, data: { name } });
  notifyUpdate();
}

export async function setDefaultList(id: number) {
  await prisma.$transaction(async (tx) => {
    await requireList(id, tx);
    await tx.songList.updateMany({ data: { isDefault: false } });
    await tx.songList.update({ where: { id }, data: { isDefault: true } });
  });
  notifyUpdate();
}

/** Apaga uma lista (não pode estar a ser usada pela noite aberta). */
export async function deleteList(id: number) {
  await prisma.$transaction(async (tx) => {
    const list = await requireList(id, tx);
    const active = await tx.night.findFirst({ where: { status: { not: "CLOSED" }, songListId: id } });
    if (active) fail(409, "Esta lista está a ser usada na noite aberta. Muda a lista da noite antes de a apagar.");
    await tx.song.deleteMany({ where: { listId: id } });
    await tx.songList.delete({ where: { id } });
    // Se era a lista por defeito, passa a ser a mais antiga das restantes
    if (list.isDefault) {
      const next = await tx.songList.findFirst({ orderBy: { id: "asc" } });
      if (next) await tx.songList.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  notifyUpdate();
}

/**
 * Lista a usar numa noite nova: a escolhida; se não for indicada e só existir
 * uma, essa; sem listas, nenhuma (a música é escrita à mão).
 */
export async function resolveSongList(requested: number | null | undefined, tx: Tx = prisma) {
  if (requested != null) return (await requireList(requested, tx)).id;
  const lists = await tx.songList.findMany({ select: { id: true }, take: 2 });
  if (lists.length > 1) fail(400, "Escolhe a lista de músicas para esta noite.");
  return lists[0]?.id ?? null;
}

// ── Músicas ───────────────────────────────────────────────────────────────

export async function getList(id: number) {
  const list = await requireList(id);
  const songs = await prisma.song.findMany({ where: { listId: id }, select: { id: true, artist: true, title: true } });
  songs.sort((a, b) => a.artist.localeCompare(b.artist, "pt") || a.title.localeCompare(b.title, "pt"));
  return { list: { id: list.id, name: list.name, isDefault: list.isDefault }, songs };
}

/** Músicas da lista da noite aberta (para a inscrição). */
export async function songsForCurrentNight() {
  const night = await prisma.night.findFirst({ where: { status: { not: "CLOSED" } }, orderBy: { id: "desc" } });
  if (!night?.songListId) return [];
  return (await getList(night.songListId)).songs;
}

/** Junta músicas a uma lista, ignorando as que já lá estão. */
export async function addSongs(listId: number, songs: SongInput[]) {
  if (songs.length > MAX_BULK) fail(400, `No máximo ${MAX_BULK} músicas de cada vez.`);
  const unique = new Map(songs.map((s) => [songKey(s), s]));
  const result = await prisma.$transaction(async (tx) => {
    await requireList(listId, tx);
    const existing = await tx.song.findMany({ where: { listId, key: { in: [...unique.keys()] } }, select: { key: true } });
    for (const { key } of existing) unique.delete(key);
    await tx.song.createMany({ data: [...unique].map(([key, s]) => ({ ...s, key, listId })) });
    return { added: unique.size, skipped: songs.length - unique.size };
  });
  if (result.added) notifyUpdate();
  return result;
}

export async function updateSong(id: number, song: SongInput) {
  const current = await prisma.song.findUnique({ where: { id } });
  if (!current) fail(404, "Música não encontrada.");
  const key = songKey(song);
  const clash = await prisma.song.findUnique({ where: { listId_key: { listId: current.listId, key } } });
  if (clash && clash.id !== id) fail(409, "Essa música já existe nesta lista.");
  await prisma.song.update({ where: { id }, data: { ...song, key } });
  notifyUpdate();
}

export async function deleteSongs(ids: number[]) {
  await prisma.song.deleteMany({ where: { id: { in: ids } } });
  notifyUpdate();
}

export async function clearList(listId: number) {
  await requireList(listId);
  await prisma.song.deleteMany({ where: { listId } });
  notifyUpdate();
}
