const EUR = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

export const formatPrice = (cents: number) => EUR.format(cents / 100);

/** "2,50" / "2.5" / "3" → cêntimos; null se inválido. */
export function parsePrice(input: string): number | null {
  const n = Number(input.trim().replace(",", "."));
  return input.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
