import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatOdometer, getOdometerUnitLabel } from "@/lib/odometer";
import { normalizeWhatsapp } from "@/lib/customer-identity";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
};

type Vehicle = {
  id: string;
  plate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  odometer_unit: string | null;
};

type QuoteItem = {
  qty: number | null;
  unit_price: number | null;
};

type Order = {
  id: string;
  public_code: string | null;
  vehicle_id: string | null;
  status: string | null;
  work_type: string | null;
  created_at: string;
  current_km: number | null;
  intake_reason: string | null;
  diagnosis_detail: string | null;
  repair_detail: string | null;
  order_quote_items: QuoteItem[] | null;
};

type MaintenancePlan = {
  id: string;
  vehicle_id: string | null;
  service_name: string | null;
  next_service_km: number | null;
  estimated_due_date: string | null;
  status: string | null;
};

function orderTotal(order: Order) {
  return (order.order_quote_items || []).reduce(
    (total, item) => total + Number(item.qty || 0) * Number(item.unit_price || 0),
    0
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function normalizeCustomerName(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export default async function CustomerFolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, whatsapp")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const currentCustomer = customer as Customer;
  const customerNameKey = normalizeCustomerName(currentCustomer.full_name);
  const customerWhatsappKey = normalizeWhatsapp(currentCustomer.whatsapp);

  const { data: allCustomersData } = await supabase
    .from("customers")
    .select("id, full_name, whatsapp");

  const relatedCustomerIds = ((allCustomersData || []) as Customer[])
    .filter((item) => {
      const sameWhatsapp =
        customerWhatsappKey &&
        normalizeWhatsapp(item.whatsapp) === customerWhatsappKey;
      const sameName =
        customerNameKey &&
        normalizeCustomerName(item.full_name) === customerNameKey;

      return item.id === id || sameWhatsapp || sameName;
    })
    .map((item) => item.id);

  const { data: vehiclesData } = await supabase
    .from("vehicles")
    .select("id, plate, make, model, year, engine, odometer_unit")
    .in("customer_id", relatedCustomerIds)
    .order("plate", { ascending: true });

  const vehicles = (vehiclesData || []) as Vehicle[];
  const vehicleIds = vehicles.map((vehicle) => vehicle.id);

  const { data: ordersData } = vehicleIds.length
    ? await supabase
        .from("orders")
        .select(`
          id, public_code, vehicle_id, status, work_type, created_at, current_km,
          intake_reason, diagnosis_detail, repair_detail,
          order_quote_items ( qty, unit_price )
        `)
        .in("vehicle_id", vehicleIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: plansData } = vehicleIds.length
    ? await supabase
        .from("maintenance_plans")
        .select("id, vehicle_id, service_name, next_service_km, estimated_due_date, status")
        .in("vehicle_id", vehicleIds)
        .eq("status", "scheduled")
        .order("next_service_km", { ascending: true })
    : { data: [] };

  const orders = (ordersData || []) as Order[];
  const plans = (plansData || []) as MaintenancePlan[];
  const lifetimeValue = orders.reduce((total, order) => total + orderTotal(order), 0);
  const lastVisit = orders[0];
  const activePlans = plans.filter((plan) => plan.status === "scheduled");

  return (
    <div className="min-h-screen bg-[#050816] p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin/orders" className="text-sm text-slate-400 hover:text-white">
            ← Órdenes
          </Link>
          <Link
            href="/admin/new"
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Nueva orden
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
                Carpeta del cliente
              </p>
              <h1 className="mt-2 text-3xl font-bold text-white">
                {currentCustomer.full_name || "Cliente"}
              </h1>
              <p className="mt-1 text-slate-400">{currentCustomer.whatsapp || "-"}</p>
              {relatedCustomerIds.length > 1 && (
                <p className="mt-2 text-xs text-blue-300">
                  Mostrando historial unido de {relatedCustomerIds.length} registros relacionados.
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-2xl font-bold text-white">{vehicles.length}</p>
                <p className="text-xs text-slate-400">Vehículos</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-2xl font-bold text-white">{orders.length}</p>
                <p className="text-xs text-slate-400">Visitas</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-2xl font-bold text-orange-400">${lifetimeValue.toFixed(2)}</p>
                <p className="text-xs text-slate-400">Histórico</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-slate-800 pt-5 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Última visita</p>
              <p className="mt-1 font-semibold text-white">{formatDate(lastVisit?.created_at)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Mantenimientos activos</p>
              <p className="mt-1 font-semibold text-white">{activePlans.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Estado comercial</p>
              <p className="mt-1 font-semibold text-green-300">
                {orders.length > 0 ? "Cliente con historial" : "Cliente nuevo"}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Vehículos</h2>
          {vehicles.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
              Sin vehículos registrados.
            </div>
          ) : (
            vehicles.map((vehicle) => {
              const vehicleOrders = orders.filter((order) => order.vehicle_id === vehicle.id);
              const vehiclePlans = activePlans.filter((plan) => plan.vehicle_id === vehicle.id);
              const unit = getOdometerUnitLabel(vehicle.odometer_unit);
              const lastKm = vehicleOrders.find((order) => order.current_km !== null)?.current_km;

              return (
                <div key={vehicle.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <Link
                        href={`/admin/vehicles/${encodeURIComponent(vehicle.plate || "")}`}
                        className="text-xl font-bold text-orange-400 hover:underline"
                      >
                        {vehicle.plate || "Sin placa"}
                      </Link>
                      <p className="mt-1 text-slate-300">
                        {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ")}
                      </p>
                      {vehicle.engine && (
                        <p className="mt-1 text-sm text-slate-500">Motor: {vehicle.engine}</p>
                      )}
                    </div>
                    <div className="text-sm text-slate-400 md:text-right">
                      <p>{vehicleOrders.length} visita(s)</p>
                      <p>Último registro: {formatOdometer(lastKm, unit)}</p>
                    </div>
                  </div>

                  {vehiclePlans.length > 0 && (
                    <div className="mt-4 rounded-xl border border-blue-800/40 bg-blue-950/20 p-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                        Próximo mantenimiento
                      </p>
                      {vehiclePlans.map((plan) => (
                        <p key={plan.id} className="mt-2 text-sm text-slate-300">
                          {plan.service_name || "Mantenimiento"} a{" "}
                          <span className="font-semibold text-white">
                            {formatOdometer(plan.next_service_km, unit)}
                          </span>
                          {plan.estimated_due_date ? ` · ${formatDate(plan.estimated_due_date)}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Historial completo</h2>
          {orders.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
              Sin visitas todavía.
            </div>
          ) : (
            orders.map((order) => {
              const vehicle = vehicles.find((item) => item.id === order.vehicle_id);
              const unit = getOdometerUnitLabel(vehicle?.odometer_unit);
              const total = orderTotal(order);

              return (
                <article key={order.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm text-slate-400">{formatDate(order.created_at)}</p>
                      <h3 className="mt-1 font-bold text-white">
                        {vehicle?.plate || "-"} · {order.public_code || "Sin código"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {order.intake_reason || order.diagnosis_detail || order.repair_detail || "Sin detalle"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      {order.current_km !== null && (
                        <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                          {formatOdometer(order.current_km, unit)}
                        </span>
                      )}
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                        {order.status || "-"}
                      </span>
                      {total > 0 && (
                        <span className="rounded-full border border-orange-700 bg-orange-950/30 px-3 py-1 text-xs font-semibold text-orange-300">
                          ${total.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
