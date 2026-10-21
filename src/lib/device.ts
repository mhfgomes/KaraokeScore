import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "kv_device";

export async function getDeviceId() {
  return (await cookies()).get(COOKIE)?.value;
}

export async function ensureDeviceId() {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  if (!id) {
    id = randomUUID();
    jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return id;
}
