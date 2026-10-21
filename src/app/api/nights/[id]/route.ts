import { prisma } from "@/lib/db";
import { fail, handle } from "@/lib/http";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/nights/[id]">) => {
  const { id } = await ctx.params;
  const night = await prisma.night.findFirst({ where: { id: Number(id), status: "CLOSED" } });
  if (!night) fail(404, "Noite não encontrada.");
  const results = await prisma.performance.findMany({
    where: { nightId: night.id, status: { not: "SKIPPED" } },
    orderBy: [{ rank: "asc" }, { position: "asc" }],
    select: { id: true, name: true, song: true, rank: true, voteCount: true, points: true },
  });
  return { night: { id: night.id, date: night.date }, results };
});
