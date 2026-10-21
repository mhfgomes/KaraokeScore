import { prisma } from "@/lib/db";
import { notifyUpdate } from "@/lib/events";
import { fail, handle, requireAdmin } from "@/lib/http";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 2 * 1024 * 1024;

// multipart/form-data: name (texto), logo (ficheiro, opcional), removeLogo ("true", opcional)
export const POST = handle(async (request: Request) => {
  await requireAdmin();
  const form = await request.formData().catch(() => fail(400, "Pedido inválido."));

  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) fail(400, "Indica o nome.");

  const data: { brandName: string; logo?: Uint8Array<ArrayBuffer> | null; logoMime?: string | null } = { brandName: name };

  const file = form.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED.includes(file.type)) fail(400, "Formato de imagem não suportado (PNG, JPG, WebP ou SVG).");
    if (file.size > MAX_BYTES) fail(400, "A imagem tem de ter menos de 2 MB.");
    data.logo = new Uint8Array(await file.arrayBuffer());
    data.logoMime = file.type;
  } else if (form.get("removeLogo") === "true") {
    data.logo = null;
    data.logoMime = null;
  }

  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  notifyUpdate();
});
