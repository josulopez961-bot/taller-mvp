import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);
const ALERT_KM = 500;
const ALERT_DUE_DAYS = 14;
const ALERT_COOLDOWN_DAYS = 14;
const ALERT_EXPIRATION_DAYS = 30;

type SupabaseRelation<T> = T | T[] | null;

type Customer = {
  full_name: string | null;
  whatsapp: string | null;
};

type Vehicle = {
  id: string | null;
  plate: string | null;
  make: string | null;
  model: string | null;
  customer: SupabaseRelation<Customer>;
};

type MaintenancePlan = {
  id: string;
  service_name: string | null;
  last_service_km: number | null;
  next_service_km: number | null;
  service_interval_km: number | null;
  estimated_due_date: string | null;
  status: string | null;
  prev_service_km: number | null;
  prev_service_date: string | null;
  visible_from_km: number | null;
  created_at: string;
  alert_last_sent_at: string | null;
  alert_sent_count: number | null;
  alert_expires_at: string | null;
  expired_at: string | null;
  vehicle: SupabaseRelation<Vehicle>;
};

type OrderHistoryRow = {
  vehicle_id: string | null;
  current_km: number | null;
  created_at: string;
};

type AlertRow = {
  name: string;
  plate: string;
  makeModel: string;
  kmRemaining: number | null;
  nextKm: number;
  daysUntilDue: number | null;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / 86400000;
}

function singleRelation<T>(relation: SupabaseRelation<T>) {
  return Array.isArray(relation) ? relation[0] : relation;
}

export async function GET(req: Request) {
  // Verificar que viene del cron o del admin
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Traer todos los planes scheduled con vehículo y cliente
  const { data: plans, error: plansError } = await supabase
    .from("maintenance_plans")
    .select(`
      id, service_name, last_service_km, next_service_km,
      service_interval_km, estimated_due_date, status, prev_service_km, prev_service_date,
      visible_from_km, created_at, alert_last_sent_at, alert_sent_count,
      alert_expires_at, expired_at,
      vehicle:vehicles (
        id, plate, make, model,
        customer:customers ( full_name, whatsapp )
      )
    `)
    .eq("status", "scheduled");

  if (!plans || plans.length === 0) {
    return NextResponse.json({ sent: 0, error: plansError?.message, plansRaw: plans });
  }

  const scheduledPlans = plans as MaintenancePlan[];

  // Historial de km por vehículo
  const vehicleIds = [...new Set(scheduledPlans.map((p) => {
    const v = singleRelation(p.vehicle);
    return v?.id;
  }).filter(Boolean))];

  const { data: ordersHistory } = await supabase
    .from("orders")
    .select("vehicle_id, current_km, created_at")
    .in("vehicle_id", vehicleIds)
    .not("current_km", "is", null)
    .order("created_at", { ascending: true });

  const kmHistoryByVehicle: Record<string, { km: number; date: Date }[]> = {};
  for (const o of (ordersHistory || []) as OrderHistoryRow[]) {
    if (!o.vehicle_id || !o.current_km) continue;
    if (!kmHistoryByVehicle[o.vehicle_id]) kmHistoryByVehicle[o.vehicle_id] = [];
    kmHistoryByVehicle[o.vehicle_id].push({ km: Number(o.current_km), date: new Date(o.created_at) });
  }

  const today = new Date();
  const alertRows: AlertRow[] = [];
  const usedPlanIds: string[] = [];
  const expiredPlanIds: string[] = [];
  const alertUpdates: { id: string; alertSentCount: number; alertExpiresAt: string }[] = [];

  for (const plan of scheduledPlans) {
    const vehicle = singleRelation(plan.vehicle);
    const customer = vehicle ? singleRelation(vehicle.customer) : null;
    const history = vehicle?.id ? (kmHistoryByVehicle[vehicle.id] || []) : [];

    const planCreatedAt = new Date(plan.created_at);
    const visibleFromKm = Number(plan.visible_from_km || plan.next_service_km || 0);
    const wasAlreadyServiced = history.some((entry) => {
      return entry.date > planCreatedAt && entry.km >= visibleFromKm;
    });

    if (wasAlreadyServiced) {
      usedPlanIds.push(plan.id);
      continue;
    }

    let estimatedCurrentKm: number | null = null;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const daysDiff = daysBetween(first.date, last.date);
      if (daysDiff > 0 && last.km > first.km) {
        const kmPerDay = (last.km - first.km) / daysDiff;
        const daysSinceLast = daysBetween(last.date, today);
        estimatedCurrentKm = Math.round(last.km + kmPerDay * daysSinceLast);
      }
    } else if (history.length === 1 && plan.prev_service_km && plan.prev_service_date) {
      const lastOrder = history[0];
      const prevDate = new Date(plan.prev_service_date);
      const daysDiff = daysBetween(prevDate, lastOrder.date);
      const kmDiff = lastOrder.km - plan.prev_service_km;
      if (daysDiff > 0 && kmDiff > 0) {
        const kmPerDay = kmDiff / daysDiff;
        const daysSinceLast = daysBetween(lastOrder.date, today);
        estimatedCurrentKm = Math.round(lastOrder.km + kmPerDay * daysSinceLast);
      }
    }

    if (plan.next_service_km === null) continue;

    const kmRemaining = estimatedCurrentKm !== null
      ? plan.next_service_km - estimatedCurrentKm
      : null;
    const daysUntilDue = plan.estimated_due_date
      ? Math.ceil(daysBetween(today, new Date(plan.estimated_due_date)))
      : null;
    const isNearByKm = kmRemaining !== null && kmRemaining <= ALERT_KM;
    const isNearByDate = daysUntilDue !== null && daysUntilDue <= ALERT_DUE_DAYS;

    if (!isNearByKm && !isNearByDate) continue;

    const alertExpiresAt = plan.alert_expires_at
      ? new Date(plan.alert_expires_at)
      : addDays(today, ALERT_EXPIRATION_DAYS);

    if (alertExpiresAt <= today) {
      expiredPlanIds.push(plan.id);
      continue;
    }

    const lastSentAt = plan.alert_last_sent_at
      ? new Date(plan.alert_last_sent_at)
      : null;
    const recentlySent = lastSentAt
      ? daysBetween(lastSentAt, today) < ALERT_COOLDOWN_DAYS
      : false;

    if (!recentlySent) {
      alertRows.push({
        name: customer?.full_name || "Cliente",
        plate: vehicle?.plate || "-",
        makeModel: [vehicle?.make, vehicle?.model].filter(Boolean).join(" "),
        kmRemaining: kmRemaining !== null ? Math.max(0, kmRemaining) : null,
        nextKm: plan.next_service_km,
        daysUntilDue,
      });
      alertUpdates.push({
        id: plan.id,
        alertSentCount: Number(plan.alert_sent_count || 0) + 1,
        alertExpiresAt: alertExpiresAt.toISOString(),
      });
    }
  }

  await Promise.all([
    usedPlanIds.length > 0
      ? supabase
          .from("maintenance_plans")
          .update({ status: "used" })
          .in("id", usedPlanIds)
      : Promise.resolve(),
    expiredPlanIds.length > 0
      ? supabase
          .from("maintenance_plans")
          .update({ status: "cancelled", expired_at: today.toISOString() })
          .in("id", expiredPlanIds)
      : Promise.resolve(),
  ]);

  if (alertRows.length === 0) {
    return NextResponse.json({ sent: 0, message: "No hay clientes próximos a mantenimiento", plansCount: plans.length, vehicleIds: vehicleIds.length, historyCount: (ordersHistory || []).length });
  }

  // Construir email HTML
  const rows = alertRows.map(r => `
    <tr style="border-bottom:1px solid #333">
      <td style="padding:10px 12px;color:#fff">${r.name}</td>
      <td style="padding:10px 12px;color:#f97316;font-weight:bold">${r.plate}</td>
      <td style="padding:10px 12px;color:#aaa">${r.makeModel}</td>
      <td style="padding:10px 12px;color:${r.kmRemaining !== null && r.kmRemaining <= 0 ? '#ef4444' : '#facc15'};font-weight:bold">
        ${r.kmRemaining === null ? 'Sin estimación' : r.kmRemaining <= 0 ? '¡VENCIDO!' : `${r.kmRemaining.toLocaleString()} km`}
      </td>
      <td style="padding:10px 12px;color:#aaa">${r.nextKm.toLocaleString()} km</td>
      <td style="padding:10px 12px;color:${r.daysUntilDue !== null && r.daysUntilDue <= 0 ? '#ef4444' : '#aaa'}">
        ${r.daysUntilDue === null ? '-' : r.daysUntilDue <= 0 ? 'Fecha vencida' : `${r.daysUntilDue} dias`}
      </td>
    </tr>
  `).join('');

  const html = `
    <div style="background:#09090b;padding:32px;font-family:sans-serif;max-width:600px;margin:0 auto">
      <h1 style="color:#f97316;margin:0 0 8px">🔧 FINECAR — Alertas de mantenimiento</h1>
      <p style="color:#aaa;margin:0 0 24px">Clientes a ≤${ALERT_KM} km o ≤${ALERT_DUE_DAYS} dias de su próximo servicio al ${today.toLocaleDateString('es-EC', { day:'numeric', month:'long', year:'numeric' })}:</p>
      <table style="width:100%;border-collapse:collapse;background:#18181b;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#27272a">
            <th style="padding:10px 12px;text-align:left;color:#f97316">Cliente</th>
            <th style="padding:10px 12px;text-align:left;color:#f97316">Placa</th>
            <th style="padding:10px 12px;text-align:left;color:#f97316">Vehículo</th>
            <th style="padding:10px 12px;text-align:left;color:#f97316">Km restantes</th>
            <th style="padding:10px 12px;text-align:left;color:#f97316">Próximo servicio</th>
            <th style="padding:10px 12px;text-align:left;color:#f97316">Fecha</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#555;margin:24px 0 0;font-size:12px">Este correo fue generado automáticamente por FINECAR Taller Mecánico.</p>
    </div>
  `;

  await resend.emails.send({
    from: "FINECAR Taller <onboarding@resend.dev>",
    to: process.env.ALERT_EMAIL!,
    subject: `🔧 FINECAR — ${alertRows.length} cliente${alertRows.length > 1 ? 's' : ''} próximo${alertRows.length > 1 ? 's' : ''} a mantenimiento`,
    html,
  });

  await Promise.all(
    alertUpdates.map((update) =>
      supabase
        .from("maintenance_plans")
        .update({
          alert_last_sent_at: today.toISOString(),
          alert_sent_count: update.alertSentCount,
          alert_expires_at: update.alertExpiresAt,
        })
        .eq("id", update.id)
    )
  );

  return NextResponse.json({ sent: alertRows.length, clients: alertRows.map(r => r.name) });
}
