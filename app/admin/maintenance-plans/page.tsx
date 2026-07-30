import { createClient } from "@supabase/supabase-js";
import { formatOdometer, getOdometerUnitLabel } from "@/lib/odometer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MaintenancePlanRow = {
  id: string;
  service_name: string;
  last_service_km: number | null;
  next_service_km: number | null;
  visible_from_km: number | null;
  status: string;
  vehicle?: { odometer_unit?: string | null } | { odometer_unit?: string | null }[] | null;
};

export default async function MaintenancePlansAdminPage() {
  const { data, error } = await supabase
    .from("maintenance_plans")
    .select(`
      id,
      service_name,
      last_service_km,
      next_service_km,
      visible_from_km,
      status,
      created_at,
      vehicle:vehicles (
        odometer_unit
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6 text-red-400">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="p-6 text-white min-h-screen bg-zinc-950">
      <h1 className="text-2xl font-bold mb-6">Próximos mantenimientos</h1>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm text-zinc-300">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="p-4 text-left font-medium">Servicio</th>
              <th className="p-4 text-left font-medium">Último</th>
              <th className="p-4 text-left font-medium">Próximo</th>
              <th className="p-4 text-left font-medium">Visible desde</th>
              <th className="p-4 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(data as MaintenancePlanRow[] | null)?.map((plan) => {
              const vehicle = Array.isArray(plan.vehicle) ? plan.vehicle[0] : plan.vehicle;
              const unit = getOdometerUnitLabel(vehicle?.odometer_unit);

              return (
                <tr key={plan.id} className="border-t border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                  <td className="p-4 font-medium text-white">{plan.service_name}</td>
                  <td className="p-4">{formatOdometer(plan.last_service_km, unit)}</td>
                  <td className="p-4 text-green-400 font-semibold">{formatOdometer(plan.next_service_km, unit)}</td>
                  <td className="p-4 text-zinc-400">{formatOdometer(plan.visible_from_km, unit)}</td>
                  <td className="p-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${
                      plan.status === "scheduled"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                    }`}>
                      {plan.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {(!data || data.length === 0) && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-zinc-500 italic">
                  No hay mantenimientos programados registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
