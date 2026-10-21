import { changePassword } from "@/lib/auth";
import { fail, handle, requireAdmin } from "@/lib/http";

export const POST = handle(async (request: Request) => {
  const admin = await requireAdmin();
  const { currentPassword, newPassword } = await request.json().catch(() => ({}));
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") fail(400, "Dados inválidos.");
  if (newPassword.length < 8) fail(400, "A nova password deve ter pelo menos 8 caracteres.");
  if (newPassword === currentPassword) fail(400, "A nova password tem de ser diferente da atual.");
  if (!(await changePassword(admin.id, currentPassword, newPassword))) {
    await new Promise((r) => setTimeout(r, 500));
    fail(400, "A password atual está errada.");
  }
});
