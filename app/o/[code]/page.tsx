import { createClient } from "@supabase/supabase-js";
import ApprovalActions from "./ApprovalActions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ORDER_STEPS = [
  { key: "recibido", label: "Recibido" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "en_proceso", label: "Reparación" },
  { key: "pruebas", label: "Pruebas" },
  { key: "listo", label: "Listo" },
  { key: "entregado", label: "Entregado" },
] as const;

function normalizeStatus(status?: string | null) {
  if (!status) return "recibido";
  if (status === "prueba") return "pruebas";
  return status;
}

function getStepIndex(status?: string | null) {
  const normalized = normalizeStatus(status);
  const index = ORDER_STEPS.findIndex((step) => step.key === normalized);
  return index === -1 ? 0 : index;
}

function getStatusLabel(status?: string | null) {
  const normalized = normalizeStatus(status);
  const found = ORDER_STEPS.find((step) => step.key === normalized);
  return found?.label || normalized;
}

function getApprovalBadge(approvalStatus?: string | null) {
  if (approvalStatus === "aprobado") {
    return (
      <span className="rounded-full border border-green-700 bg-green-900/30 px-3 py-1 text-xs font-semibold text-green-300">
        Autorizado
      </span>
    );
  }

  if (approvalStatus === "rechazado") {
    return (
      <span className="rounded-full border border-red-700 bg-red-900/30 px-3 py-1 text-xs font-semibold text-red-300">
        No autorizado
      </span>
    );
  }

  return (
    <span className="rounded-full border border-yellow-700 bg-yellow-900/30 px-3 py-1 text-xs font-semibold text-yellow-300">
      Pendiente de autorización
    </span>
  );
}

export default async function OrderPublicPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id,
      public_code,
      status,
      summary,
      created_at,
      estimated_delivery_date,
      diagnosis_detail,
      repair_detail,
      repair_cost,
      approval_status,
      vehicle:vehicles (
        plate,
        make,
        model,
        year,
        customer:customers (
          full_name,
          whatsapp
        )
      )
    `)
    .eq("public_code", code)
    .single();

  const { data: items } = await supabase
    .from("order_quote_items")
    .select("*")
    .eq("order_id", order?.id);

  const labor = (items || []).filter(i => i.category === "labor");
  const parts = (items || []).filter(i => i.category === "part");
  const supplies = (items || []).filter(i => i.category === "supply");

  if (error || !order) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-2xl font-bold">Orden no encontrada</h1>
          <p className="mt-2 text-slate-300">
            No se pudo cargar la orden solicitada.
          </p>
        </div>
      </main>
    );
  }

  const vehicle = Array.isArray(order.vehicle) ? order.vehicle[0] : order.vehicle;
  const customer =
    vehicle && "customer" in vehicle
      ? Array.isArray(vehicle.customer)
        ? vehicle.customer[0]
        : vehicle.customer
      : null;

  const normalizedStatus = normalizeStatus(order.status);
  const currentStepIndex = getStepIndex(normalizedStatus);
  const currentStatusLabel = getStatusLabel(normalizedStatus);

  const showDiagnosticSection =
    normalizedStatus === "diagnostico" ||
    normalizedStatus === "en_proceso" ||
    normalizedStatus === "pruebas" ||
    normalizedStatus === "listo" ||
    normalizedStatus === "entregado";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-3xl font-bold">Seguimiento de orden</h1>
          <p className="mt-2 text-slate-300">
            Código:{" "}
            <span className="font-semibold text-orange-400">
              {order.public_code}
            </span>
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold">Progreso del vehículo</h2>
              <p className="mt-1 text-sm text-slate-400">
                Estado actual:{" "}
                <span className="font-semibold text-orange-400">
                  {currentStatusLabel}
                </span>
              </p>
            </div>

            {normalizedStatus === "diagnostico" && (
              <div>{getApprovalBadge(order.approval_status)}</div>
            )}
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="relative flex items-center justify-between">
                <div className="absolute left-0 right-0 top-5 h-1 rounded-full bg-slate-800" />

                <div
                  className="absolute left-0 top-5 h-1 rounded-full bg-orange-500 transition-all"
                  style={{
                    width: `${(currentStepIndex / (ORDER_STEPS.length - 1)) * 100}%`,
                  }}
                />

                {ORDER_STEPS.map((step, index) => {
                  const isCompleted = index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;

                  return (
                    <div
                      key={step.key}
                      className="relative z-10 flex w-28 flex-col items-center text-center"
                    >
                      <div
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition-all",
                          isCurrent
                            ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                            : isCompleted
                            ? "border-orange-400 bg-orange-400 text-slate-950"
                            : "border-slate-700 bg-slate-900 text-slate-400",
                        ].join(" ") || ""}
                      >
                        {index + 1}
                      </div>

                      <div className="mt-3">
                        <p
                          className={[
                            "text-sm font-medium",
                            isCurrent
                              ? "text-white"
                              : isCompleted
                              ? "text-slate-200"
                              : "text-slate-500",
                          ].join(" ") || ""}
                        >
                          {step.label}
                        </p>

                        <p
                          className={[
                            "mt-1 text-xs",
                            isCurrent
                              ? "text-orange-400"
                              : isCompleted
                              ? "text-slate-400"
                              : "text-slate-600",
                          ].join(" ") || ""}
                        >
                          {isCurrent
                            ? "En curso"
                            : isCompleted
                            ? "Completado"
                            : "Pendiente"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">Vehículo</h2>
          <div className="mt-4 grid gap-3 text-slate-300 md:grid-cols-2">
            <p>
              <span className="font-semibold text-white">Placa:</span>{" "}
              {vehicle?.plate || "-"}
            </p>
            <p>
              <span className="font-semibold text-white">Marca:</span>{" "}
              {vehicle?.make || "-"}
            </p>
            <p>
              <span className="font-semibold text-white">Modelo:</span>{" "}
              {vehicle?.model || "-"}
            </p>
            <p>
              <span className="font-semibold text-white">Año:</span>{" "}
              {vehicle?.year || "-"}
            </p>
            <p>
              <span className="font-semibold text-white">Cliente:</span>{" "}
              {customer?.full_name || "-"}
            </p>
            <p>
              <span className="font-semibold text-white">WhatsApp:</span>{" "}
              {customer?.whatsapp || "-"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">Estado actual</h2>
          <div className="mt-4 space-y-3 text-slate-300">
            <p>
              <span className="font-semibold text-white">Estado:</span>{" "}
              {currentStatusLabel}
            </p>
            <p>
              <span className="font-semibold text-white">Resumen:</span>{" "}
              {order.summary || "Sin resumen"}
            </p>
          </div>
        </section>

        {showDiagnosticSection && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-bold">Diagnóstico y presupuesto</h2>
              {getApprovalBadge(order.approval_status)}
            </div>

            <div className="mt-4 space-y-3 text-slate-300">
              <p>
                <span className="font-semibold text-white">
                  Fecha estimada de entrega:
                </span>{" "}
                {order.estimated_delivery_date || "Por definir"}
              </p>
              <p>
                <span className="font-semibold text-white">Diagnóstico:</span>{" "}
                {order.diagnosis_detail || "Aún no cargado"}
              </p>
              <p>
                <span className="font-semibold text-white">
                  Reparación propuesta:
                </span>{" "}
                {order.repair_detail || "Aún no cargada"}
              </p>
              <p>
                <span className="font-semibold text-white">Costo estimado:</span>{" "}
                {order.repair_cost !== null && order.repair_cost !== undefined
                  ? `$${order.repair_cost}`
                  : "Por definir"}
              </p>
            </div>

            {items && items.length > 0 && (
              <div className="mt-4 border-t border-slate-700 pt-4">
                <h3 className="mb-2 text-lg font-semibold text-white">Desglose de Cotización</h3>
                
                {labor.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-orange-400">Mano de Obra</h4>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {labor.map((i: any) => (
                        <li key={i.id} className="flex justify-between items-center border-b border-slate-800 pb-1">
                          <span>{i.qty}x {i.description}</span>
                          <span className="font-medium">${i.unit_price * i.qty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {parts.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-orange-400">Repuestos</h4>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {parts.map((i: any) => (
                        <li key={i.id} className="flex justify-between items-center border-b border-slate-800 pb-1">
                          <span>{i.qty}x {i.description}</span>
                          <span className="font-medium">${i.unit_price * i.qty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {supplies.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-orange-400">Insumos</h4>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {supplies.map((i: any) => (
                        <li key={i.id} className="flex justify-between items-center border-b border-slate-800 pb-1">
                          <span>{i.qty}x {i.description}</span>
                          <span className="font-medium">${i.unit_price * i.qty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <ApprovalActions
              publicCode={order.public_code}
              approvalStatus={order.approval_status}
              orderStatus={normalizedStatus}
            />
          </section>
        )}
      </div>
    </main>
  );
}

