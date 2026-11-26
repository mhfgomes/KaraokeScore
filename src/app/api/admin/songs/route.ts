import { fail, handle, requireAdmin } from "@/lib/http";
import {
  addSongs,
  clearList,
  createList,
  deleteList,
  deleteSongs,
  getList,
  listSongLists,
  MAX_BULK,
  parseSongText,
  renameList,
  setDefaultList,
  toSong,
  updateSong,
} from "@/lib/songs";

/** Sem `listId`: todas as listas. Com `listId`: a lista e as suas músicas. */
export const GET = handle(async (request: Request) => {
  await requireAdmin();
  const listId = new URL(request.url).searchParams.get("listId");
  return listId === null ? { lists: await listSongLists() } : getList(Number(listId));
});

export const POST = handle(async (request: Request) => {
  await requireAdmin();
  const body = await request.json().catch(() => ({}));
  const { action, id, ids, listId, name, artist, title, text, copyFrom, order, skipHeadings } = body;
  const needInt = (v: unknown, what: string) => {
    if (!Number.isInteger(v)) fail(400, `${what} inválida.`);
    return v as number;
  };
  switch (action) {
    // Listas
    case "createList":
      return createList(name, copyFrom == null ? null : needInt(copyFrom, "Lista"));
    case "renameList":
      return renameList(needInt(listId, "Lista"), name);
    case "setDefault":
      return setDefaultList(needInt(listId, "Lista"));
    case "deleteList":
      return deleteList(needInt(listId, "Lista"));
    case "clear":
      return clearList(needInt(listId, "Lista"));
    // Músicas
    case "add":
      return addSongs(needInt(listId, "Lista"), [toSong(artist, title)]);
    case "bulk": {
      if (typeof text !== "string") fail(400, "Texto inválido.");
      if (order !== undefined && order !== "artist-title" && order !== "title-artist") fail(400, "Formato inválido.");
      const parsed = parseSongText(text, { order, skipHeadings: skipHeadings !== false });
      if (parsed.songs.length + parsed.invalid > MAX_BULK) fail(400, `No máximo ${MAX_BULK} músicas de cada vez.`);
      const result = await addSongs(needInt(listId, "Lista"), parsed.songs);
      return { ...result, invalid: parsed.invalid, headings: parsed.headings };
    }
    case "update":
      return updateSong(needInt(id, "Música"), toSong(artist, title));
    case "delete":
      if (!Array.isArray(ids) || !ids.every(Number.isInteger)) fail(400, "Música inválida.");
      return deleteSongs(ids);
    default:
      fail(400, "Ação inválida.");
  }
});
