import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE = "kv_admin";
const SESSION_HOURS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function login(username: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return false;

  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  await prisma.adminSession.create({ data: { id, adminId: admin.id, expiresAt } });
  (await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
  return true;
}

export async function logout() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await prisma.adminSession.deleteMany({ where: { id } });
  jar.delete(COOKIE);
}

export async function getAdmin() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const session = await prisma.adminSession.findUnique({ where: { id }, include: { admin: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return { id: session.admin.id, username: session.admin.username };
}

/** Altera a password do admin e termina as outras sessões dele (mantém a atual). */
export async function changePassword(adminId: number, current: string, next: string) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin || !(await bcrypt.compare(current, admin.passwordHash))) return false;
  const sessionId = (await cookies()).get(COOKIE)?.value;
  await prisma.$transaction([
    prisma.admin.update({ where: { id: adminId }, data: { passwordHash: await hashPassword(next) } }),
    prisma.adminSession.deleteMany({ where: { adminId, id: { not: sessionId ?? "" } } }),
  ]);
  return true;
}
