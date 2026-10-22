// Arranque do contentor: migrações → admin inicial → app.
import { execFileSync } from "node:child_process";
import { migrate } from "./migrate.mjs";

migrate(process.env.DATABASE_URL, "/app/prisma/migrations");
// Cria o admin a partir de ADMIN_USERNAME/ADMIN_PASSWORD se ainda não existir nenhum
execFileSync(process.execPath, ["docker/seed.mjs"], { cwd: "/app", stdio: "inherit" });

if (process.env.EDGE_PROXY === "true") {
  // Sem nginx: a app escuta só por dentro e o edge.mjs recebe os pedidos de fora,
  // impondo o IP real do cliente (o cliente não consegue falsificar X-Real-IP).
  const port = process.env.PORT ?? "3000";
  process.env.PORT = String(Number(port) + 1);
  process.env.HOSTNAME = "127.0.0.1";
  const { startEdge } = await import("./edge.mjs");
  startEdge(Number(port), Number(process.env.PORT));
}

await import("/app/server.js");
