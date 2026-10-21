import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

const PORT = 3199;
export const ADMIN = { username: "teste", password: "password-de-teste" };

/**
 * Arranca a app compilada (`npm run build`) numa BD SQLite temporária — nunca
 * toca na base de dados do dia a dia.
 */
export default async function setup(project: TestProject) {
  if (!existsSync(".next/BUILD_ID")) throw new Error("Corre `npm run build` antes dos testes de API.");

  const dir = mkdtempSync(path.join(os.tmpdir(), "karaoke-test-"));
  const dbPath = path.join(dir, "test.db");
  const env = {
    ...process.env,
    DATABASE_URL: `file:${dbPath}`,
    ADMIN_USERNAME: ADMIN.username,
    ADMIN_PASSWORD: ADMIN.password,
    ONE_VOTE_PER_IP: "true",
    PUBLIC_URL: "http://karaoke.test",
    NODE_ENV: "production" as const,
  };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "ignore" });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env, stdio: "ignore" });

  const server: ChildProcess = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    env,
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });

  const baseUrl = `http://127.0.0.1:${PORT}`;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${baseUrl}/api/state`)).ok) break;
    } catch {}
    if (i > 120) throw new Error("A app não arrancou.");
    await new Promise((r) => setTimeout(r, 500));
  }

  project.provide("baseUrl", baseUrl);
  project.provide("dbPath", dbPath);
  project.provide("admin", ADMIN);

  return () => {
    // Termina o grupo de processos (npx + next)
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
    dbPath: string;
    admin: { username: string; password: string };
  }
}
