import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);
const ALERT_KM = 500;

export async function GET(req: Request) {
  // Verificar que viene del cron o del admin
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Traer todos los planes scheduled con vehículo y cliente
  const { data: plans } = await supabase
    .from("maintenance_plans")
    .select(`
      id, service_name, last_service_km, next_service_km,
      service_interval_km, status, prev_service_km, prev_service_date,
      vehicle:vehicles (
        id, plate, make, model,
        customer:customers ( full_name, whatsapp )
      )
    `)
    .eq("status", "scheduled");

  if (!plans || plans.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Historial de km por vehículo
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

  const kmHistoryByVehicle: Record<string, { km: number; date: Date }[]> = {};
  for (const o of ordersHistory || []) {
    if (!o.vehicle_id || !o.current_km) continue;
    if (!kmHistoryByVehicle[o.vehicle_id]) kmHistoryByVehicle[o.vehicle_id] = [];
    kmHistoryByVehicle[o.vehicle_id].push({ km: Number(o.current_km), date: new Date(o.created_at) });
  }

  const today = new Date();
  const alertRows: { name: string; plate: string; makeModel: string; kmRemaining: number; nextKm: number }[] = [];

  for (const plan of plans) {
    const vehicle = Array.isArray(plan.vehicle) ? (plan.vehicle as any[])[0] : plan.vehicle as any;
    const customer = vehicle ? (Array.isArray(vehicle.customer) ? vehicle.customer[0] : vehicle.customer) : null;
    const history = vehicle?.id ? (kmHistoryByVehicle[vehicle.id] || []) : [];

    let estimatedCurrentKm: number | null = null;

    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const daysDiff = (last.date.getTime() - first.date.getTime()) / 86400000;
      if (daysDiff > 0 && last.km > first.km) {
        const kmPerDay = (last.km - first.km) / daysDiff;
        const daysSinceLast = (today.getTime() - last.date.getTime()) / 86400000;
        estimatedCurrentKm = Math.round(last.km + kmPerDay * daysSinceLast);
      }
    } else if (history.length === 1 && (plan as any).prev_service_km && (plan as any).prev_service_date) {
      const lastOrder = history[0];
      const prevDate = new Date((plan as any).prev_service_date);
      const daysDiff = (lastOrder.date.getTime() - prevDate.getTime()) / 86400000;
      const kmDiff = lastOrder.km - (plan as any).prev_service_km;
      if (daysDiff > 0 && kmDiff > 0) {
        const kmPerDay = kmDiff / daysDiff;
        const daysSinceLast = (today.getTime() - lastOrder.date.getTime()) / 86400000;
        estimatedCurrentKm = Math.round(lastOrder.km + kmPerDay * daysSinceLast);
      }
    }

    if (estimatedCurrentKm === null) continue;

    const kmRemaining = (plan as any).next_service_km - estimatedCurrentKm;
    if (kmRemaining <= ALERT_KM) {
      alertRows.push({
        name: customer?.full_name || "Cliente",
        plate: vehicle?.plate || "-",
        makeModel: [vehicle?.make, vehicle?.model].filter(Boolean).join(" "),
        kmRemaining: Math.max(0, kmRemaining),
        nextKm: (plan as any).next_service_km,
      });
    }
  }

  if (alertRows.length === 0) {
    return NextResponse.json({ sent: 0, message: "No hay clientes próximos a mantenimiento", plansCount: plans.length, vehicleIds: vehicleIds.length, historyCount: (ordersHistory || []).length });
  }

  // Construir email HTML
  const rows = alertRows.map(r => `
    <tr style="border-bottom:1px solid #333">
      <td style="padding:10px 12px;color:#fff">${r.name}</td>
      <td style="padding:10px 12px;color:#f97316;font-weight:bold">${r.plate}</td>
      <td style="padding:10px 12px;color:#aaa">${r.makeModel}</td>
      <td style="padding:10px 12px;color:${r.kmRemaining <= 0 ? '#ef4444' : '#facc15'};font-weight:bold">
        ${r.kmRemaining <= 0 ? '¡VENCIDO!' : `${r.kmRemaining.toLocaleString()} km`}
      </td>
      <td style="padding:10px 12px;color:#aaa">${r.nextKm.toLocaleString()} km</td>
    </tr>
  `).join('');

  const html = `
    <div style="background:#09090b;padding:32px;font-family:sans-serif;max-width:600px;margin:0 auto">
      <h1 style="color:#f97316;margin:0 0 8px">🔧 FINECAR — Alertas de mantenimiento</h1>
      <p style="color:#aaa;margin:0 0 24px">Clientes a ≤${ALERT_KM} km de su próximo servicio al ${today.toLocaleDateString('es-EC', { day:'numeric', month:'long', year:'numeric' })}:</p>
      <table style="width:100%;border-collapse:collapse;background:#18181b;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#27272a">
            <th style="padding:10px 12px;text-align:left;color:#f97316">Cliente</th>
            <th style="padding:10px 12px;text-align:left;color:#f97316">Placa</th>
            <th style="padding:10px 12px;text-align:left;color:#f97316">Vehículo</th>
            <th style="padding:10px 12px;text-align:left;color:#f97316">Km restantes</th>
            <th style="padding:10px 12px;text-align:left;color:#f97316">Próximo servicio</th>
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

  return NextResponse.json({ sent: alertRows.length, clients: alertRows.map(r => r.name) });
}
