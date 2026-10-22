// Aplica as migrações do Prisma (prisma/migrations) como o `prisma migrate deploy`,
// sem incluir o CLI do Prisma na imagem (~260 MB). Usa a mesma tabela
// _prisma_migrations e o mesmo checksum, por isso as duas formas são compatíveis.
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const Database = createRequire("/app/server.js")("better-sqlite3");

export function migrate(databaseUrl, dir) {
  const db = new Database(databaseUrl.replace(/^file:/, ""));
  db.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
  )`);

  const rows = db.prepare(`SELECT migration_name, finished_at FROM _prisma_migrations WHERE rolled_back_at IS NULL`).all();
  const failed = rows.find((r) => r.finished_at === null);
  if (failed) throw new Error(`A migração ${failed.migration_name} falhou antes; resolve-a manualmente.`);
  const applied = new Set(rows.map((r) => r.migration_name));

  const pending = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !applied.has(d.name))
    .map((d) => d.name)
    .sort();

  const insert = db.prepare(
    `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
     VALUES (?, ?, ?, ?, ?, 1)`,
  );
  for (const name of pending) {
    const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    const started = Date.now();
    db.transaction(() => {
      db.exec(sql);
      insert.run(randomUUID(), createHash("sha256").update(sql).digest("hex"), name, started, Date.now());
    })();
    console.log(`Migração aplicada: ${name}`);
  }
  if (!pending.length) console.log("Base de dados atualizada (sem migrações pendentes).");
  db.close();
}
