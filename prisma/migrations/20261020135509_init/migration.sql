-- CreateTable
CREATE TABLE "Admin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Night" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTRATION',
    "currentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Contestant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Performance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nightId" INTEGER NOT NULL,
    "contestantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nightId" INTEGER NOT NULL,
    "performanceId" INTEGER NOT NULL,
    "voterType" TEXT NOT NULL DEFAULT 'PUBLIC',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "deviceId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "Night" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vote_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Contestant_phone_key" ON "Contestant"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Performance_nightId_contestantId_key" ON "Performance"("nightId", "contestantId");

-- CreateIndex
CREATE INDEX "Vote_nightId_ip_idx" ON "Vote"("nightId", "ip");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_nightId_deviceId_key" ON "Vote"("nightId", "deviceId");
