export type OdometerUnit = "km" | "mi";

export function normalizeOdometerUnit(value?: string | null): OdometerUnit {
  return value === "mi" ? "mi" : "km";
}

export function getOdometerUnitLabel(value?: string | null) {
  return normalizeOdometerUnit(value);
}

export function getOdometerReadingLabel(value?: string | null) {
  return normalizeOdometerUnit(value) === "mi" ? "millaje" : "kilometraje";
}

export function formatOdometer(value: number | null | undefined, unit?: string | null) {
  if (value === null || value === undefined) return "-";

  return `${value.toLocaleString()} ${getOdometerUnitLabel(unit)}`;
}

export function maintenanceItemTotal(item: {
  category?: string | null;
  qty?: number | "" | null;
  unit_price?: number | "" | null;
}) {
  const price = Number(item.unit_price || 0);

  if (item.category === "supply") return price;

  return Number(item.qty || 0) * price;
}
