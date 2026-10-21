-- Junta "artist" e "song" num único campo "song" ("Artista – Música").
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Performance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nightId" INTEGER NOT NULL,
    "contestantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "song" TEXT NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "consentAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rank" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Performance_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "Night" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Performance_contestantId_fkey" FOREIGN KEY ("contestantId") REFERENCES "Contestant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Performance" ("consentAt", "contestantId", "createdAt", "id", "name", "nightId", "notes", "points", "position", "rank", "song", "status", "voteCount") SELECT "consentAt", "contestantId", "createdAt", "id", "name", "nightId", "notes", "points", "position", "rank", "artist" || ' – ' || "song", "status", "voteCount" FROM "Performance";
DROP TABLE "Performance";
ALTER TABLE "new_Performance" RENAME TO "Performance";
CREATE UNIQUE INDEX "Performance_nightId_contestantId_key" ON "Performance"("nightId", "contestantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
