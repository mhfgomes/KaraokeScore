import { prisma } from "./db";

export async function getBrand() {
  const s = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { brandName: true, logoMime: true, menuEnabled: true, updatedAt: true },
  });
  return {
    name: s?.brandName ?? "Karaoke",
    // A versão no URL força o browser a recarregar o logo quando muda
    menuEnabled: s?.menuEnabled ?? true,
    logoUrl: s?.logoMime ? `/api/brand/logo?v=${s.updatedAt.getTime()}` : null,
  };
}

export type Brand = Awaited<ReturnType<typeof getBrand>>;
