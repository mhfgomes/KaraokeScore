import { getAdmin } from "@/lib/auth";
import { handle } from "@/lib/http";

export const GET = handle(async () => ({ admin: await getAdmin() }));
