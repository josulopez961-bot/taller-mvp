export function normalizeWhatsapp(raw: unknown) {
  const digits = String(raw || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0")) return `593${digits.slice(1)}`;

  return digits;
}

export function normalizePlate(raw: unknown) {
  return String(raw || "").replace(/\s+/g, "").trim().toUpperCase();
}
