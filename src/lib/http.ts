import { connection, NextResponse } from "next/server";
import { getAdmin } from "./auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) fail(401, "Sessão de admin inválida.");
  return admin;
}

// Envolve um handler: converte HttpError em JSON { error }.
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    await connection(); // sempre dinâmico (nunca pré-renderizado)
    try {
      const result = await fn(...args);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      // Prisma: registo a alterar/apagar não existe
      if ((e as { code?: string }).code === "P2025") return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
      console.error(e);
      return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    }
  };
}
