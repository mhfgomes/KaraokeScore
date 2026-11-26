import { describe, expect, it } from "vitest";
import { isSectionHeading, parseSongLine, parseSongText, searchSongs, songKey } from "@/lib/song-search";

describe("parseSongLine", () => {
  it("separa artista e música pelos separadores aceites", () => {
    expect(parseSongLine("ABBA – Dancing Queen")).toEqual({ artist: "ABBA", title: "Dancing Queen" });
    expect(parseSongLine("  Queen - Bohemian Rhapsody ")).toEqual({ artist: "Queen", title: "Bohemian Rhapsody" });
    expect(parseSongLine("Amália Rodrigues;Estranha Forma de Vida")).toEqual({ artist: "Amália Rodrigues", title: "Estranha Forma de Vida" });
    expect(parseSongLine("Xutos & Pontapés\tA Minha Casinha")).toEqual({ artist: "Xutos & Pontapés", title: "A Minha Casinha" });
  });

  it("só separa no primeiro separador e não parte hífens dentro de palavras", () => {
    expect(parseSongLine("a-ha - Take On Me - Remastered")).toEqual({ artist: "a-ha", title: "Take On Me - Remastered" });
    expect(parseSongLine("Bem-me-quer")).toEqual({ artist: "", title: "Bem-me-quer" });
  });

  it("ignora linhas vazias, comentários e demasiado longas", () => {
    expect(parseSongLine("   ")).toBeNull();
    expect(parseSongLine("# lista de 2026")).toBeNull();
    expect(parseSongLine(`Artista – ${"x".repeat(121)}`)).toBeNull();
  });
});

describe("parseSongText", () => {
  it("lê a ordem Música - Artista e ignora títulos de secção", () => {
    const text = "PORTUGUESAS\nPorto Côvo - Rui Veloso\nINTERNACIONAIS - CLÁSSICOS E ROCK\nTake on Me - a-ha\nPOP e BALADAS\nÓ malhão malhão";
    expect(parseSongText(text, { order: "title-artist" })).toEqual({
      songs: [
        { artist: "Rui Veloso", title: "Porto Côvo" },
        { artist: "a-ha", title: "Take on Me" },
        { artist: "", title: "Ó malhão malhão" },
      ],
      invalid: 0,
      headings: 3,
    });
  });

  it("deteta títulos de secção só quando as palavras estão em maiúsculas", () => {
    expect(isSectionHeading("BRASILEIRAS E LATINAS")).toBe(true);
    expect(isSectionHeading("POP e BALADAS")).toBe(true);
    expect(isSectionHeading("Highway to Hell - AC/DC")).toBe(false);
    expect(isSectionHeading("50 Reais - Naiara Azevedo")).toBe(false);
    expect(isSectionHeading("12345")).toBe(false);
  });
});

describe("catálogo", () => {
  it("a chave ignora acentos, maiúsculas e espaços", () => {
    expect(songKey({ artist: "Amália  Rodrigues", title: "Barco Negro" })).toBe(songKey({ artist: "amalia rodrigues", title: "BARCO NEGRO " }));
  });

  it("pesquisa por várias palavras no artista e no título", () => {
    const songs = [
      { id: 1, artist: "Amália Rodrigues", title: "Barco Negro" },
      { id: 2, artist: "Queen", title: "Bohemian Rhapsody" },
    ];
    expect(searchSongs(songs, "amalia negro").map((s) => s.id)).toEqual([1]);
    expect(searchSongs(songs, "")).toHaveLength(2);
    expect(searchSongs(songs, "abba")).toEqual([]);
  });
});
