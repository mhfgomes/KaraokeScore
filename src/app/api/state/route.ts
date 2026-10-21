import { getDeviceId } from "@/lib/device";
import { handle } from "@/lib/http";
import { getPublicState } from "@/lib/state";

export const GET = handle(async () => getPublicState(await getDeviceId()));
