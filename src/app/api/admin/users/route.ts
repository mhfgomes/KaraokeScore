import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fail, handle, requireAdmin } from "@/lib/http";

export const GET = handle(async () => {
  await requireAdmin();
  const admins = await prisma.admin.findMany({ select: { id: true, username: true, createdAt: true }, orderBy: { id: "asc" } });
  return { admins };
});

export const POST = handle(async (request: Request) => {
  await requireAdmin();
  const { username, password } = await request.json().catch(() => ({}));
  const name = typeof username === "string" ? username.trim() : "";
  if (!/^[\w.-]{3,32}$/.test(name)) fail(400, "Username inválido (3-32 letras, números, . _ -).");
  if (typeof password !== "string" || password.length < 8) fail(400, "A password deve ter pelo menos 8 caracteres.");
  if (await prisma.admin.findUnique({ where: { username: name } })) fail(409, "Esse username já existe.");
  await prisma.admin.create({ data: { username: name, passwordHash: await hashPassword(password) } });
});
