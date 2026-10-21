import { handle } from "@/lib/http";
import { getMenu } from "@/lib/menu";

export const GET = handle(async () => ({ menu: await getMenu() }));
