import { handle, requireAdmin } from "@/lib/http";
import { menuAction } from "@/lib/menu";

export const POST = handle(async (request: Request) => {
  await requireAdmin();
  await menuAction(await request.json().catch(() => ({})));
});
