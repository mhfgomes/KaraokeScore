import { prisma } from "./db";
import { notifyUpdate } from "./events";
import { fail } from "./http";

export async function getMenu() {
  return prisma.menuCategory.findMany({
    orderBy: { position: "asc" },
    include: { items: { orderBy: { position: "asc" } } },
  });
}

export type Menu = Awaited<ReturnType<typeof getMenu>>;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parseItem(body: Record<string, unknown>) {
  const name = text(body.name, 80);
  const description = text(body.description, 200) || null;
  const priceCents = Number(body.priceCents);
  if (!name) fail(400, "Indica o nome do artigo.");
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 1_000_000) fail(400, "Preço inválido.");
  return { name, description, priceCents };
}

/** Troca a posição com o vizinho (dir = -1 sobe, 1 desce). */
async function move(kind: "category" | "item", id: number, dir: -1 | 1) {
  const select = { id: true, position: true };
  let siblings: { id: number; position: number }[];
  if (kind === "category") {
    siblings = await prisma.menuCategory.findMany({ orderBy: { position: "asc" }, select });
  } else {
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) fail(404, "Artigo não encontrado.");
    siblings = await prisma.menuItem.findMany({ where: { categoryId: item.categoryId }, orderBy: { position: "asc" }, select });
  }
  const i = siblings.findIndex((s) => s.id === id);
  const a = siblings[i];
  const b = siblings[i + dir];
  if (!a || !b) return;
  const setPosition = (rowId: number, position: number) =>
    kind === "category"
      ? prisma.menuCategory.update({ where: { id: rowId }, data: { position } })
      : prisma.menuItem.update({ where: { id: rowId }, data: { position } });
  await prisma.$transaction([setPosition(a.id, b.position), setPosition(b.id, a.position)]);
}

export async function menuAction(body: Record<string, unknown>) {
  const id = Number(body.id);
  switch (body.action) {
    case "setEnabled": {
      const menuEnabled = body.enabled === true;
      await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, menuEnabled }, update: { menuEnabled } });
      break;
    }
    case "addCategory": {
      const name = text(body.name, 60);
      if (!name) fail(400, "Indica o nome da categoria.");
      const last = await prisma.menuCategory.aggregate({ _max: { position: true } });
      await prisma.menuCategory.create({ data: { name, position: (last._max.position ?? 0) + 1 } });
      break;
    }
    case "renameCategory": {
      const name = text(body.name, 60);
      if (!name) fail(400, "Indica o nome da categoria.");
      await prisma.menuCategory.update({ where: { id }, data: { name } });
      break;
    }
    case "deleteCategory":
      await prisma.menuCategory.delete({ where: { id } });
      break;
    case "addItem": {
      const categoryId = Number(body.categoryId);
      if (!(await prisma.menuCategory.findUnique({ where: { id: categoryId } }))) fail(404, "Categoria não encontrada.");
      const last = await prisma.menuItem.aggregate({ where: { categoryId }, _max: { position: true } });
      await prisma.menuItem.create({ data: { ...parseItem(body), categoryId, position: (last._max.position ?? 0) + 1 } });
      break;
    }
    case "updateItem":
      await prisma.menuItem.update({ where: { id }, data: parseItem(body) });
      break;
    case "setAvailable":
      await prisma.menuItem.update({ where: { id }, data: { available: body.available === true } });
      break;
    case "deleteItem":
      await prisma.menuItem.delete({ where: { id } });
      break;
    case "moveCategory":
    case "moveItem":
      await move(body.action === "moveCategory" ? "category" : "item", id, Number(body.dir) < 0 ? -1 : 1);
      break;
    default:
      fail(400, "Ação inválida.");
  }
  notifyUpdate();
}
