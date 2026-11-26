import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";

export const GET = handle(async () => {
  const nights = await prisma.night.findMany({
    where: { status: "CLOSED" },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: { id: true, date: true },
  });
  return { nights };
});
