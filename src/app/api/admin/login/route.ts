import { login } from "@/lib/auth";
import { fail, handle } from "@/lib/http";

export const POST = handle(async (request: Request) => {
  const { username, password } = await request.json().catch(() => ({}));
  if (typeof username !== "string" || typeof password !== "string") fail(400, "Dados inválidos.");
  if (!(await login(username.trim(), password))) {
    await new Promise((r) => setTimeout(r, 500));
    fail(401, "Username ou password errados.");
  }
  return { ok: true };
});
