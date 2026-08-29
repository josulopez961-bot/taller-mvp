import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
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
  customer_id: string | null;
  plate: string | null;
  make: string | null;
  model: string | null;
};

type Order = {
  id: string;
  vehicle_id: string | null;
  created_at: string;
};

type CustomerGroup = {
  key: string;
  primary: Customer;
  customerIds: string[];
  vehicles: Vehicle[];
  orders: Order[];
};

function normalizeName(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function customerKey(customer: Customer) {
  const phone = normalizeWhatsapp(customer.whatsapp);
  if (phone) return `phone:${phone}`;

  const name = normalizeName(customer.full_name);
  return name ? `name:${name}` : `id:${customer.id}`;
}

function formatDate(value: string | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function CustomersPage() {
  const [{ data: customersData }, { data: vehiclesData }, { data: ordersData }] =
    await Promise.all([
      supabase.from("customers").select("id, full_name, whatsapp").order("full_name", { ascending: true }),
      supabase.from("vehicles").select("id, customer_id, plate, make, model"),
      supabase.from("orders").select("id, vehicle_id, created_at").order("created_at", { ascending: false }),
    ]);

  const customers = (customersData || []) as Customer[];
  const vehicles = (vehiclesData || []) as Vehicle[];
  const orders = (ordersData || []) as Order[];
  const groups = new Map<string, CustomerGroup>();

  for (const customer of customers) {
    const key = customerKey(customer);
    const existing = groups.get(key);

    if (existing) {
      existing.customerIds.push(customer.id);
      if (!existing.primary.full_name && customer.full_name) {
        existing.primary = customer;
      }
    } else {
      groups.set(key, {
        key,
        primary: customer,
        customerIds: [customer.id],
        vehicles: [],
        orders: [],
      });
    }
  }

  const groupByCustomerId = new Map<string, CustomerGroup>();
  for (const group of groups.values()) {
    for (const customerId of group.customerIds) {
      groupByCustomerId.set(customerId, group);
    }
  }

  const groupByVehicleId = new Map<string, CustomerGroup>();
  for (const vehicle of vehicles) {
    const group = vehicle.customer_id ? groupByCustomerId.get(vehicle.customer_id) : null;
    if (!group) continue;

    group.vehicles.push(vehicle);
    groupByVehicleId.set(vehicle.id, group);
  }

  for (const order of orders) {
    const group = order.vehicle_id ? groupByVehicleId.get(order.vehicle_id) : null;
    if (!group) continue;
    group.orders.push(order);
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    const aLast = a.orders[0]?.created_at || "";
    const bLast = b.orders[0]?.created_at || "";
    return bLast.localeCompare(aLast);
  });

  return (
    <div className="min-h-screen bg-[#050816] p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/admin/orders" className="text-sm text-slate-400 hover:text-white">
              ← Órdenes
            </Link>
            <h1 className="mt-3 text-3xl font-bold">Clientes</h1>
            <p className="mt-1 text-sm text-slate-400">
              Carpetas agrupadas por WhatsApp o nombre para ver historial completo.
            </p>
          </div>
          <Link
            href="/admin/new"
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Nueva orden
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Vehículos</th>
                <th className="p-4">Visitas</th>
                <th className="p-4">Última visita</th>
                <th className="p-4">Carpeta</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map((group) => (
                <tr key={group.key} className="border-t border-slate-800">
                  <td className="p-4">
                    <p className="font-semibold text-white">
                      {group.primary.full_name || "Cliente"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {group.primary.whatsapp || "-"}
                    </p>
                    {group.customerIds.length > 1 && (
                      <p className="mt-1 text-xs text-blue-300">
                        {group.customerIds.length} registros unidos
                      </p>
                    )}
                  </td>
                  <td className="p-4 text-slate-300">
                    {group.vehicles.length > 0
                      ? group.vehicles
                          .map((vehicle) =>
                            [vehicle.plate, vehicle.make, vehicle.model].filter(Boolean).join(" ")
                          )
                          .join(", ")
                      : "-"}
                  </td>
                  <td className="p-4 font-semibold text-white">{group.orders.length}</td>
                  <td className="p-4 text-slate-300">{formatDate(group.orders[0]?.created_at)}</td>
                  <td className="p-4">
                    <Link
                      href={`/admin/customers/${group.primary.id}`}
                      className="rounded-lg border border-orange-500/40 px-3 py-2 text-xs font-semibold text-orange-300 hover:bg-orange-500/10"
                    >
                      Ver carpeta
                    </Link>
                  </td>
                </tr>
              ))}
              {sortedGroups.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No hay clientes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
