import { handle } from "@/lib/http";
import { monthlyRanking, today } from "@/lib/night";

export const GET = handle(async (request: Request) => {
  const param = new URL(request.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(param) ? param : today().slice(0, 7);
  return { month, ranking: await monthlyRanking(month) };
});
