-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "brandName" TEXT NOT NULL DEFAULT 'Karaoke',
    "logoMime" TEXT,
    "logo" BLOB,
    "updatedAt" DATETIME NOT NULL
);
