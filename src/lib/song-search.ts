// Regras do catálogo de músicas partilhadas pelo browser e pelo servidor (sem acesso à BD).
export type CatalogSong = { id: number; artist: string; title: string };

export const MAX_ARTIST = 80;
export const MAX_TITLE = 120;
/** Máximo de linhas num bulk insert. */
export const MAX_BULK = 5000;

export const foldText = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Todas as palavras têm de aparecer no artista ou no título (sem acentos). */
export function searchSongs(songs: CatalogSong[], query: string) {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return songs;
  return songs.filter((s) => {
    const haystack = foldText(`${s.artist} ${s.title}`);
    return words.every((w) => haystack.includes(w));
  });
}

export type SongInput = { artist: string; title: string };

export const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const fold = (s: string) => foldText(clean(s));

export const songKey = ({ artist, title }: SongInput) => `${fold(artist)}|${fold(title)}`;
export const songLabel = ({ artist, title }: SongInput) => (artist ? `${artist} – ${title}` : title);
export const catalogLabel = songLabel;

/** Ordem dos campos em cada linha de um bulk insert. */
export type LineOrder = "artist-title" | "title-artist";

/**
 * Título de secção ("PORTUGUESAS", "POP e BALADAS"): todas as palavras com
 * duas ou mais letras estão em maiúsculas.
 */
export function isSectionHeading(line: string) {
  const words = line.match(/\p{L}{2,}/gu);
  return !!words && words.every((w) => w === w.toLocaleUpperCase("pt") && w !== w.toLocaleLowerCase("pt"));
}

/**
 * Uma música por linha, separada por " – ", " - ", ";" ou tab (colado de uma
 * folha de cálculo). Só separa no primeiro separador. Sem separador, a linha
 * inteira é o título. Linhas vazias ou começadas por # são ignoradas.
 */
export function parseSongLine(line: string, order: LineOrder = "artist-title"): SongInput | null {
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) return null;
  const match = raw.match(/^(.*?)\s*(?:\t|;|\s[–—-]\s)\s*(.+)$/);
  const [first, second] = match ? [clean(match[1]), clean(match[2])] : ["", clean(raw)];
  const song = !match ? { artist: "", title: second } : order === "artist-title" ? { artist: first, title: second } : { artist: second, title: first };
  if (!song.title || song.artist.length > MAX_ARTIST || song.title.length > MAX_TITLE) return null;
  return song;
}

/** Interpreta um texto inteiro (bulk insert). */
export function parseSongText(text: string, { order = "artist-title", skipHeadings = true }: { order?: LineOrder; skipHeadings?: boolean } = {}) {
  const songs: SongInput[] = [];
  let invalid = 0;
  let headings = 0;
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    if (skipHeadings && isSectionHeading(raw)) {
      headings++;
      continue;
    }
    const song = parseSongLine(raw, order);
    if (song) songs.push(song);
    else invalid++;
  }
  return { songs, invalid, headings };
}
