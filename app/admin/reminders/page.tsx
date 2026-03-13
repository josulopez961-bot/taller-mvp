import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

type Urgency = "vencido" | "proximo" | "ok";

type ReminderRow = {
  planId: string;
  serviceName: string;
  plate: string;
  makeModel: string;
  customerName: string;
  whatsapp: string;
  lastServiceKm: number;
  nextServiceKm: number;
  estimatedCurrentKm: number | null;
  kmRemaining: number | null;
  kmPerDay: number | null;
  estimatedDueDate: string | null;
  daysUntilDue: number | null;
  urgency: Urgency;
};

function normalizeWhatsapp(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0")) return `593${digits.slice(1)}`;
  return digits;
}

function buildWhatsAppMessage(row: ReminderRow): string {
  const lines = [
    `Hola ${row.customerName} 👋`,
    `Te contactamos del taller sobre tu vehículo *${row.plate}${row.makeModel ? ` (${row.makeModel})` : ""}*.`,
    ``,
    `Tu próximo servicio de *${row.serviceName}* está programado a los *${row.nextServiceKm.toLocaleString()} km*.`,
  ];

  if (row.kmRemaining !== null && row.kmRemaining > 0) {
    lines.push(`Te faltan aproximadamente *${row.kmRemaining.toLocaleString()} km* para llegar a esa marca.`);
  } else if (row.kmRemaining !== null && row.kmRemaining <= 0) {
    lines.push(`Ya superaste el kilometraje de mantenimiento. ¡Es momento de agendar tu cita!`);
  }

  if (row.estimatedDueDate) {
    lines.push(`Fecha estimada: *${new Date(row.estimatedDueDate).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}*`);
  }

  lines.push(``, `¿Te gustaría agendar una cita? 😊`);

  return encodeURIComponent(lines.join("\n"));
}

export default async function RemindersPage() {
  // 1. Todos los planes scheduled con vehículo y cliente
  const { data: plans } = await supabase
    .from("maintenance_plans")
    .select(`
      id, service_name, last_service_km, next_service_km,
      service_interval_km, estimated_due_date, status,
      prev_service_km, prev_service_date, source_order_id,
      vehicle:vehicles (
        id, plate, make, model,
        customer:customers ( full_name, whatsapp )
      )
    `)
    .eq("status", "scheduled")
    .order("next_service_km", { ascending: true });

  if (!plans || plans.length === 0) {
    return (
      <div className="min-h-screen bg-[#050816] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <Header />
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            No hay planes de mantenimiento programados aún.
          </div>
        </div>
      </div>
    );
  }

  // 2. Para cada vehículo único, obtener historial de km para calcular km/día
  const vehicleIds = [...new Set(plans.map((p: any) => {
    const v = Array.isArray(p.vehicle) ? p.vehicle[0] : p.vehicle;
    return v?.id;
  }).filter(Boolean))];

  const { data: ordersHistory } = await supabase
    .from("orders")
    .select("vehicle_id, current_km, created_at")
    .in("vehicle_id", vehicleIds)
    .not("current_km", "is", null)
    .order("created_at", { ascending: true });

  // Indexar historial por vehicle_id
  const kmHistoryByVehicle: Record<string, { km: number; date: Date }[]> = {};
  for (const o of ordersHistory || []) {
    if (!o.vehicle_id || !o.current_km) continue;
    if (!kmHistoryByVehicle[o.vehicle_id]) kmHistoryByVehicle[o.vehicle_id] = [];
    kmHistoryByVehicle[o.vehicle_id].push({
      km: Number(o.current_km),
      date: new Date(o.created_at),
    });
  }

  const today = new Date();

  // 3. Calcular estimaciones y urgencia
  const rows: ReminderRow[] = plans.map((plan: any) => {
    const vehicle = Array.isArray(plan.vehicle) ? plan.vehicle[0] : plan.vehicle;
    const customer = vehicle
      ? Array.isArray(vehicle.customer) ? vehicle.customer[0] : vehicle.customer
      : null;

    const history = vehicle?.id ? (kmHistoryByVehicle[vehicle.id] || []) : [];

    // Calcular km/día promedio
    let kmPerDay: number | null = null;
    let estimatedCurrentKm: number | null = null;

    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const daysDiff = (last.date.getTime() - first.date.getTime()) / 86400000;
      if (daysDiff > 0 && last.km > first.km) {
        kmPerDay = (last.km - first.km) / daysDiff;
        const daysSinceLast = (today.getTime() - last.date.getTime()) / 86400000;
        estimatedCurrentKm = Math.round(last.km + kmPerDay * daysSinceLast);
      }
    } else if (history.length === 1) {
      const lastOrder = history[0];
      // Usar km anterior del plan si está disponible para calcular km/día
      if (plan.prev_service_km && plan.prev_service_date) {
        const prevDate = new Date(plan.prev_service_date);
        const daysDiff = (lastOrder.date.getTime() - prevDate.getTime()) / 86400000;
        const kmDiff = lastOrder.km - plan.prev_service_km;
        if (daysDiff > 0 && kmDiff > 0) {
          kmPerDay = kmDiff / daysDiff;
          const daysSinceLast = (today.getTime() - lastOrder.date.getTime()) / 86400000;
          estimatedCurrentKm = Math.round(lastOrder.km + kmPerDay * daysSinceLast);
        }
      }
      if (estimatedCurrentKm === null) {
        // Sin referencia anterior — usar el km del orden como base
        estimatedCurrentKm = lastOrder.km;
      }
    }

    const kmRemaining = estimatedCurrentKm !== null
      ? plan.next_service_km - estimatedCurrentKm
      : null;

    // Días hasta la fecha estimada
    let daysUntilDue: number | null = null;
    if (plan.estimated_due_date) {
      const due = new Date(plan.estimated_due_date);
      daysUntilDue = Math.round((due.getTime() - today.getTime()) / 86400000);
    }

    // Urgencia
    let urgency: Urgency = "ok";
    const isOverdueByKm = kmRemaining !== null && kmRemaining <= 0;
    const isOverdueByDate = daysUntilDue !== null && daysUntilDue <= 0;
    const isProximoByKm = kmRemaining !== null && kmRemaining > 0 && kmRemaining <= 500;
    const isProximoByDate = daysUntilDue !== null && daysUntilDue > 0 && daysUntilDue <= 14;

    if (isOverdueByKm || isOverdueByDate) urgency = "vencido";
    else if (isProximoByKm || isProximoByDate) urgency = "proximo";

    return {
      planId: plan.id,
      serviceName: plan.service_name,
      plate: vehicle?.plate || "—",
      makeModel: [vehicle?.make, vehicle?.model].filter(Boolean).join(" "),
      customerName: customer?.full_name || "—",
      whatsapp: customer?.whatsapp || "",
      lastServiceKm: plan.last_service_km,
      nextServiceKm: plan.next_service_km,
      estimatedCurrentKm,
      kmRemaining,
      kmPerDay: kmPerDay ? Math.round(kmPerDay) : null,
      estimatedDueDate: plan.estimated_due_date,
      daysUntilDue,
      urgency,
    };
  });

  // Ordenar: vencido > proximo > ok
  const order: Record<Urgency, number> = { vencido: 0, proximo: 1, ok: 2 };
  rows.sort((a, b) => order[a.urgency] - order[b.urgency]);

  const vencidos = rows.filter((r) => r.urgency === "vencido");
  const proximos = rows.filter((r) => r.urgency === "proximo");
  const ok = rows.filter((r) => r.urgency === "ok");

  return (
    <div className="min-h-screen bg-[#050816] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <Header />

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard value={vencidos.length} label="Vencidos" color="text-red-400" />
          <StatCard value={proximos.length} label="Próximos (≤500 km / 14 días)" color="text-orange-400" />
          <StatCard value={ok.length} label="Al día" color="text-green-400" />
        </div>

        {vencidos.length > 0 && (
          <Section title="🔴 Vencidos — contactar hoy" rows={vencidos} />
        )}
        {proximos.length > 0 && (
          <Section title="🟡 Próximos — contactar esta semana" rows={proximos} />
        )}
        {ok.length > 0 && (
          <Section title="✅ Al día" rows={ok} collapsed />
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/admin/orders" className="text-slate-400 hover:text-white text-sm">
            ← Órdenes
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white">Recordatorios</h1>
        <p className="text-sm text-slate-400 mt-1">
          Clientes a contactar según uso estimado y fecha de servicio.
        </p>
      </div>
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function Section({ title, rows, collapsed = false }: { title: string; rows: ReminderRow[]; collapsed?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="text-base font-semibold text-white mb-3">{title}</h2>
      <div className="space-y-3">
        {rows.map((row) => (
          <ReminderCard key={row.planId} row={row} />
        ))}
      </div>
    </section>
  );
}

function ReminderCard({ row }: { row: ReminderRow }) {
  const wa = normalizeWhatsapp(row.whatsapp);
  const msg = buildWhatsAppMessage(row);
  const waUrl = `https://wa.me/${wa}?text=${msg}`;

  const urgencyBorder = row.urgency === "vencido"
    ? "border-red-800/50"
    : row.urgency === "proximo"
    ? "border-orange-800/50"
    : "border-slate-800";

  const urgencyBg = row.urgency === "vencido"
    ? "bg-red-950/10"
    : row.urgency === "proximo"
    ? "bg-orange-950/10"
    : "bg-slate-900";

  return (
    <div className={`rounded-xl border ${urgencyBorder} ${urgencyBg} p-4`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/admin/vehicles/${encodeURIComponent(row.plate)}`}
              className="font-bold text-orange-400 hover:underline"
            >
              {row.plate}
            </Link>
            {row.makeModel && (
              <span className="text-slate-400 text-sm">{row.makeModel}</span>
            )}
            <span className="text-xs text-slate-500">·</span>
            <span className="text-sm text-white">{row.customerName}</span>
          </div>

          <p className="text-sm text-slate-400">{row.serviceName}</p>

          <div className="flex flex-wrap gap-4 text-xs text-slate-400 mt-2">
            <span>
              Próximo: <strong className="text-white">{row.nextServiceKm.toLocaleString()} km</strong>
            </span>
            {row.estimatedCurrentKm !== null && (
              <span>
                KM estimado actual: <strong className="text-white">{row.estimatedCurrentKm.toLocaleString()} km</strong>
                {row.kmPerDay !== null && (
                  <span className="text-slate-500"> ({row.kmPerDay} km/día)</span>
                )}
              </span>
            )}
            {row.kmRemaining !== null && (
              <span className={row.kmRemaining <= 0 ? "text-red-400 font-semibold" : row.kmRemaining <= 500 ? "text-orange-400 font-semibold" : ""}>
                {row.kmRemaining <= 0
                  ? `Vencido por ${Math.abs(row.kmRemaining).toLocaleString()} km`
                  : `Faltan ${row.kmRemaining.toLocaleString()} km`}
              </span>
            )}
            {row.daysUntilDue !== null && (
              <span className={row.daysUntilDue <= 0 ? "text-red-400 font-semibold" : row.daysUntilDue <= 14 ? "text-orange-400" : ""}>
                {row.daysUntilDue <= 0
                  ? `Fecha vencida hace ${Math.abs(row.daysUntilDue)} días`
                  : `Vence en ${row.daysUntilDue} días`}
              </span>
            )}
          </div>
        </div>

        {row.whatsapp && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 px-4 py-3 text-sm font-semibold text-white whitespace-nowrap"
          >
            <span>📲</span> WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
