/**
 * Normaliza o telefone (identifica o concorrente): tira separadores, 00 → +,
 * tira o +351. Aceita números PT (9 dígitos, começados por 2 ou 9) ou
 * internacionais (+ e 8 a 15 dígitos). Devolve null se for inválido.
 */
export function normalizePhone(raw: string) {
  let phone = raw.replace(/[\s\-().]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (phone.startsWith("+351")) phone = phone.slice(4);
  if (/^9\d{8}$|^2\d{8}$/.test(phone)) return phone;
  if (/^\+\d{8,15}$/.test(phone)) return phone;
  return null;
}
