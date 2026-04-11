export const ORDER_WORK_TYPES = [
  "mantenimiento",
  "pintura",
  "falla_puntual",
  "aseguradora",
] as const;

export type OrderWorkType = (typeof ORDER_WORK_TYPES)[number];

export const ORDER_WORK_TYPE_LABELS: Record<OrderWorkType, string> = {
  mantenimiento: "Mantenimiento",
  pintura: "Pintura",
  falla_puntual: "Falla puntual",
  aseguradora: "Aseguradora / choque",
};

export function normalizeOrderWorkType(value?: string | null): OrderWorkType {
  if (value && ORDER_WORK_TYPES.includes(value as OrderWorkType)) {
    return value as OrderWorkType;
  }

  return "mantenimiento";
}

export function getOrderSummary(
  workType: string | null | undefined,
  intakeReason: string | null | undefined
) {
  const normalized = normalizeOrderWorkType(workType);
  const reason = intakeReason?.trim();

  if (reason) {
    return reason;
  }

  return ORDER_WORK_TYPE_LABELS[normalized];
}

export function getWorkTypeBadgeClass(workType?: string | null) {
  switch (normalizeOrderWorkType(workType)) {
    case "mantenimiento":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
    case "pintura":
      return "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30";
    case "falla_puntual":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
    case "aseguradora":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/30";
    default:
      return "bg-zinc-700 text-white border border-zinc-600";
  }
}
