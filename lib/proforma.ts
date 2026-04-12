import {
  ORDER_WORK_TYPE_LABELS,
  normalizeOrderWorkType,
} from "@/lib/order-work-types";

export type ProformaItem = {
  priority?: string | null;
  description: string;
  qty: number;
  unit_price: number;
};

const PRIORITY_LABELS: Record<string, string> = {
  urgente: "Mantenimiento necesario",
  recomendado: "Puede dañarse",
  opcional: "Recomendado",
  especial: "Servicio especializado",
};

export function buildProformaText({
  publicCode,
  workType,
  plate,
  customerName,
  diagnosisDetail,
  repairDetail,
  items,
}: {
  publicCode: string;
  workType?: string | null;
  plate?: string | null;
  customerName?: string | null;
  diagnosisDetail?: string | null;
  repairDetail?: string | null;
  items: ProformaItem[];
}) {
  const normalizedWorkType = normalizeOrderWorkType(workType);
  const title = ORDER_WORK_TYPE_LABELS[normalizedWorkType];
  const lines = [
    `PROFORMA ${publicCode}`,
    customerName ? `Cliente: ${customerName}` : null,
    plate ? `Vehículo: ${plate}` : null,
    `Tipo de trabajo: ${title}`,
    "",
    diagnosisDetail ? `Diagnóstico: ${diagnosisDetail}` : null,
    repairDetail ? `Trabajo propuesto: ${repairDetail}` : null,
    "",
    "Detalle:",
  ].filter(Boolean) as string[];

  let total = 0;

  for (const item of items) {
    const qty = Number(item.qty || 0);
    const price = Number(item.unit_price || 0);
    const rowTotal = qty * price;
    total += rowTotal;
    const priorityText = item.priority
      ? ` [${PRIORITY_LABELS[item.priority] || item.priority}]`
      : "";

    lines.push(
      `- ${qty} x ${item.description}${priorityText} — $${rowTotal.toFixed(2)}`
    );
  }

  lines.push("", `Total estimado: $${total.toFixed(2)}`);

  return lines.join("\n");
}
