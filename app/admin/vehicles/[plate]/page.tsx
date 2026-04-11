import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ORDER_WORK_TYPE_LABELS,
  getWorkTypeBadgeClass,
  normalizeOrderWorkType,
} from "@/lib/order-work-types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

const PRIORITY_CONFIG = {
  urgente: { label: "Urgente", color: "text-red-400", bg: "bg-red-950/30 border-red-800/40" },
  recomendado: { label: "Recomendado", color: "text-orange-400", bg: "bg-orange-950/30 border-orange-800/40" },
  opcional: { label: "Opcional", color: "text-slate-400", bg: "bg-slate-800/30 border-slate-700/40" },
};

const STATUS_LABELS: Record<string, string> = {
  recibido: "Recibido",
  diagnostico: "Diagnóstico",
  en_proceso: "En proceso",
  pruebas: "Pruebas",
  listo: "Listo",
  entregado: "Entregado",
};

export default async function VehicleHistoryPage({
  params,
}: {
  params: Promise<{ plate: string }>;
}) {
  const { plate } = await params;
  const decodedPlate = decodeURIComponent(plate).toUpperCase();

  // Obtener vehículo con cliente
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select(`
      id, plate, make, model, year, engine,
      customer:customers ( full_name, whatsapp )
    `)
    .eq("plate", decodedPlate)
    .single();

  if (!vehicle) notFound();

  const customer = Array.isArray(vehicle.customer)
    ? vehicle.customer[0]
    : vehicle.customer;

  // Obtener todas las órdenes del vehículo con sus items
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id, public_code, status, created_at, service_date, current_km,
      work_type, intake_reason, customer_concern, paint_scope,
      insurance_scope, insurance_company, insurance_claim_number,
      diagnosis_detail, repair_detail,
      reception_notes, repair_cost,
      order_quote_items ( id, priority, category, description, qty, unit_price )
    `)
    .eq("vehicle_id", vehicle.id)
    .order("created_at", { ascending: false });

  // Obtener planes de mantenimiento
  const { data: plans } = await supabase
    .from("maintenance_plans")
    .select("id, service_name, last_service_km, next_service_km, status, created_at")
    .eq("vehicle_id", vehicle.id)
    .order("created_at", { ascending: false });

  const totalVisits = orders?.length || 0;
  const lastKm = orders?.[0]?.current_km;

  return (
    <div className="min-h-screen bg-[#050816] text-white p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/admin/orders" className="text-slate-400 hover:text-white text-sm">
            ← Órdenes
          </Link>
          <Link
            href={`/admin/history/new?plate=${encodeURIComponent(vehicle.plate)}&make=${encodeURIComponent(vehicle.make || '')}&model=${encodeURIComponent(vehicle.model || '')}`}
            className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-semibold text-white"
          >
            + Registrar servicio anterior
          </Link>
        </div>

        {/* Ficha del vehículo */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-orange-400">{vehicle.plate}</h1>
              <p className="mt-1 text-lg text-white">
                {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" · ")}
              </p>
              {vehicle.engine && (
                <p className="text-sm text-slate-400 mt-1">Motor: {vehicle.engine}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-white font-semibold">{customer?.full_name || "—"}</p>
              <p className="text-slate-400 text-sm">{customer?.whatsapp || "—"}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-800 pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{totalVisits}</p>
              <p className="text-xs text-slate-400 mt-1">Visitas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {lastKm ? `${lastKm.toLocaleString()} km` : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">Último KM registrado</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{plans?.length || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Planes de mantenimiento</p>
            </div>
          </div>
        </section>

        {/* Timeline de visitas */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Historial de visitas</h2>

          {(!orders || orders.length === 0) ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
              Sin visitas registradas.
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order, idx) => {
                const items = (order.order_quote_items as any[]) || [];
                const totalOrder = items.reduce(
                  (a: number, i: any) => a + Number(i.qty) * Number(i.unit_price), 0
                );

                const byPriority: Record<string, any[]> = { urgente: [], recomendado: [], opcional: [] };
                items.forEach((i) => {
                  const p = i.priority || "urgente";
                  if (byPriority[p]) byPriority[p].push(i);
                });

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden"
                  >
                    {/* Cabecera de la visita */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-4 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                          {totalVisits - idx}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {new Date((order as any).service_date || order.created_at).toLocaleDateString("es-EC", {
                              day: "numeric", month: "long", year: "numeric"
                            })}
                            {(order as any).service_date && (
                              <span className="ml-2 text-xs text-slate-500 font-normal">(historial)</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            Orden{" "}
                            <Link
                              href={`/o/${order.public_code}`}
                              target="_blank"
                              className="text-orange-400 hover:underline"
                            >
                              {order.public_code}
                            </Link>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getWorkTypeBadgeClass(
                          order.work_type
                        )}`}>
                          {ORDER_WORK_TYPE_LABELS[normalizeOrderWorkType(order.work_type)]}
                        </span>
                        {order.current_km && (
                          <span className="text-sm text-slate-300">
                            {order.current_km.toLocaleString()} km
                          </span>
                        )}
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                          order.status === "entregado"
                            ? "bg-emerald-900/30 border-emerald-700 text-emerald-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-300"
                        }`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                        {totalOrder > 0 && (
                          <span className="text-sm font-bold text-orange-400">
                            ${totalOrder.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cuerpo de la visita */}
                    <div className="p-4 space-y-3 text-sm text-slate-300">
                      {order.intake_reason && (
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            Motivo
                          </span>
                          <p className="mt-1">{order.intake_reason}</p>
                        </div>
                      )}

                      {(order as any).customer_concern && (
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            Reporte del cliente
                          </span>
                          <p className="mt-1">{(order as any).customer_concern}</p>
                        </div>
                      )}

                      {(order as any).paint_scope && (
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            Alcance de pintura
                          </span>
                          <p className="mt-1">{(order as any).paint_scope}</p>
                        </div>
                      )}

                      {(order as any).insurance_scope && (
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            Alcance de aseguradora
                          </span>
                          <p className="mt-1">{(order as any).insurance_scope}</p>
                          {(((order as any).insurance_company) || ((order as any).insurance_claim_number)) && (
                            <p className="mt-1 text-xs text-sky-300">
                              {[(order as any).insurance_company, (order as any).insurance_claim_number]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                      )}

                      {order.diagnosis_detail && (
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            Diagnóstico
                          </span>
                          <p className="mt-1">{order.diagnosis_detail}</p>
                        </div>
                      )}

                      {order.repair_detail && (
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            Trabajo realizado
                          </span>
                          <p className="mt-1">{order.repair_detail}</p>
                        </div>
                      )}

                      {order.reception_notes && (
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            Observaciones de recepción
                          </span>
                          <p className="mt-1 text-slate-400">{order.reception_notes}</p>
                        </div>
                      )}

                      {/* Items por prioridad */}
                      {items.length > 0 && (
                        <div className="pt-2 space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            Piezas y trabajos
                          </span>
                          {(["urgente", "recomendado", "opcional"] as const).map((p) => {
                            const group = byPriority[p];
                            if (!group.length) return null;
                            const cfg = PRIORITY_CONFIG[p];
                            return (
                              <div key={p} className={`rounded-lg border p-3 ${cfg.bg}`}>
                                <p className={`text-xs font-bold mb-2 ${cfg.color}`}>
                                  {cfg.label}
                                </p>
                                <ul className="space-y-1">
                                  {group.map((i: any) => (
                                    <li key={i.id} className="flex justify-between text-xs text-slate-300">
                                      <span>{i.qty}× {i.description}</span>
                                      <span>${(Number(i.qty) * Number(i.unit_price)).toFixed(2)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Planes de mantenimiento */}
        {plans && plans.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-4">Planes de mantenimiento</h2>
            <div className="space-y-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div>
                    <p className="font-semibold text-white">{plan.service_name}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Desde {plan.last_service_km?.toLocaleString()} km →{" "}
                      Próximo a {plan.next_service_km?.toLocaleString()} km
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                    plan.status === "scheduled"
                      ? "bg-blue-900/30 border-blue-700 text-blue-300"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}>
                    {plan.status === "scheduled" ? "Programado" : plan.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
