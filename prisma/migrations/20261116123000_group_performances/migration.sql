DROP INDEX "Performance_nightId_contestantId_key";
CREATE TABLE "PerformanceMember" (
  "performanceId" INTEGER NOT NULL,
  "contestantId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "age" INTEGER NOT NULL,
  "phone" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  PRIMARY KEY ("performanceId", "contestantId"),
  CONSTRAINT "PerformanceMember_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PerformanceMember_contestantId_fkey" FOREIGN KEY ("contestantId") REFERENCES "Contestant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PerformanceMember_performanceId_position_key" ON "PerformanceMember"("performanceId", "position");
INSERT INTO "PerformanceMember" ("performanceId", "contestantId", "name", "age", "phone", "position")
SELECT p.id, p.contestantId, p.name, c.age, c.phone, 0 FROM "Performance" p JOIN "Contestant" c ON c.id = p.contestantId;
