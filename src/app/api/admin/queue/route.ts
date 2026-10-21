import { fail, handle, requireAdmin } from "@/lib/http";
import { nextInQueue, setCurrent, setPerformanceStatus } from "@/lib/night";

export const POST = handle(async (request: Request) => {
  await requireAdmin();
  const { action, id } = await request.json().catch(() => ({}));
  switch (action) {
    case "next":
      return nextInQueue();
    case "setCurrent":
      return setCurrent(Number(id));
    case "skip":
      return setPerformanceStatus(Number(id), "SKIPPED");
    case "restore":
      return setPerformanceStatus(Number(id), "QUEUED");
    default:
      fail(400, "Ação inválida.");
  }
});
