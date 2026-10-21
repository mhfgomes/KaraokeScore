import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });

async function main() {
  if ((await prisma.admin.count()) > 0) return console.log("Já existe admin — nada a fazer.");
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("Define ADMIN_PASSWORD no .env");
  await prisma.admin.create({ data: { username, passwordHash: await bcrypt.hash(password, 10) } });
  console.log(`Admin "${username}" criado.`);
}

main().finally(() => prisma.$disconnect());
