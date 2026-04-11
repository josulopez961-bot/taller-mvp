import { createClient } from "@supabase/supabase-js";
import ApprovalActions from "./ApprovalActions";
import MaintenanceAlert from "./MaintenanceAlert";
import {
  ORDER_WORK_TYPE_LABELS,
  getWorkTypeBadgeClass,
  normalizeOrderWorkType,
} from "@/lib/order-work-types";

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
      work_type,
      summary,
      created_at,
      estimated_delivery_date,
      intake_reason,
      customer_concern,
      diagnosis_detail,
      repair_detail,
      repair_cost,
      paint_scope,
      insurance_scope,
      insurance_company,
      insurance_claim_number,
      approval_status,
      authorized_priorities,
      vehicle_id,
      recommendations,
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

  const { data: quoteItems } = await supabase
    .from("order_quote_items")
    .select("*")
    .eq("order_id", order?.id)
    .order("id", { ascending: true });

  // Fotos del proceso
  const { data: processPhotos } = order?.id
    ? await supabase
        .from("order_photos")
        .select("id, url")
        .eq("order_id", order.id)
        .eq("photo_type", "process")
        .order("created_at", { ascending: true })
    : { data: [] };

  // Fotos de entrega (solo si está entregado)
  const { data: deliveryPhotos } = order?.id
    ? await supabase
        .from("order_photos")
        .select("id, url")
        .eq("order_id", order.id)
        .eq("photo_type", "delivery")
        .order("created_at", { ascending: true })
    : { data: [] };

  // Planes de mantenimiento para el vehículo de esta orden
  const { data: maintenancePlans } = order?.vehicle_id
    ? await supabase
        .from("maintenance_plans")
        .select(`
          id,
          service_name,
          last_service_km,
          next_service_km,
          visible_from_km,
          status,
          maintenance_plan_items (
            category,
            description,
            qty,
            unit_price
          )
        `)
        .eq("vehicle_id", (order as any).vehicle_id)
        .eq("status", "scheduled")
        .order("next_service_km", { ascending: true })
    : { data: [] };

  const urgentItems = (quoteItems || []).filter((i) => (i.priority || 'urgente') === 'urgente');
  const recommendedItems = (quoteItems || []).filter((i) => i.priority === 'recomendado');
  const optionalItems = (quoteItems || []).filter((i) => i.priority === 'opcional');
  const specialItems = (quoteItems || []).filter((i) => i.priority === 'especial');

  const calcTotal = (items: any[]) => items.reduce((a, i) => a + Number(i.qty) * Number(i.unit_price), 0);
  const urgentTotal = calcTotal(urgentItems);
  const recommendedTotal = calcTotal(recommendedItems);
  const optionalTotal = calcTotal(optionalItems);
  const total = urgentTotal + recommendedTotal + optionalTotal;

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
  const normalizedWorkType = normalizeOrderWorkType(order.work_type);
  const currentStepIndex = getStepIndex(normalizedStatus);
  const currentStatusLabel = getStatusLabel(normalizedStatus);

  const showDiagnosticSection =
    normalizedStatus === "diagnostico" ||
    normalizedStatus === "en_proceso" ||
    normalizedStatus === "pruebas" ||
    normalizedStatus === "listo";

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
          <div className="mt-4">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getWorkTypeBadgeClass(
                order.work_type
              )}`}
            >
              {ORDER_WORK_TYPE_LABELS[normalizedWorkType]}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold">Progreso del vehículo</h2>
              <p className="mt-1 text-sm text-slate-400">
                Estado actual:{" "}
                <span className={`font-semibold ${normalizedStatus === "entregado" ? "text-green-400" : "text-orange-400"}`}>
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
                  className={`absolute left-0 top-5 h-1 rounded-full transition-all ${
                    normalizedStatus === "entregado" ? "bg-green-500" : "bg-orange-500"
                  }`}
                  style={{
                    width: `${(currentStepIndex / (ORDER_STEPS.length - 1)) * 100}%`,
                  }}
                />

                {ORDER_STEPS.map((step, index) => {
                  const isCompleted = index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  const isEntregado = normalizedStatus === "entregado";

                  return (
                    <div
                      key={step.key}
                      className="relative z-10 flex w-28 flex-col items-center text-center"
                    >
                      <div
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition-all",
                          isCurrent && isEntregado
                            ? "border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/30"
                            : isCurrent
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
                            isCurrent ? "text-white" : isCompleted ? "text-slate-200" : "text-slate-500",
                          ].join(" ") || ""}
                        >
                          {step.label}
                        </p>

                        <p
                          className={[
                            "mt-1 text-xs",
                            isCurrent && isEntregado
                              ? "text-green-400"
                              : isCurrent
                              ? "text-orange-400"
                              : isCompleted
                              ? "text-slate-400"
                              : "text-slate-600",
                          ].join(" ") || ""}
                        >
                          {isCurrent && isEntregado
                            ? "Finalizado"
                            : isCurrent
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

        {normalizedStatus !== "entregado" && (
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
              {order.intake_reason && (
                <p>
                  <span className="font-semibold text-white">Ingreso:</span>{" "}
                  {order.intake_reason}
                </p>
              )}
              {order.customer_concern && (
                <p>
                  <span className="font-semibold text-white">Reporte del cliente:</span>{" "}
                  {order.customer_concern}
                </p>
              )}
              {order.paint_scope && (
                <p>
                  <span className="font-semibold text-white">Alcance de pintura:</span>{" "}
                  {order.paint_scope}
                </p>
              )}
              {order.insurance_scope && (
                <p>
                  <span className="font-semibold text-white">Alcance aseguradora:</span>{" "}
                  {order.insurance_scope}
                </p>
              )}
              {(order.insurance_company || order.insurance_claim_number) && (
                <p>
                  <span className="font-semibold text-white">Referencia:</span>{" "}
                  {[order.insurance_company, order.insurance_claim_number]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Trabajo en proceso */}
        {normalizedStatus === "en_proceso" && (
          <section className="rounded-2xl border border-blue-800/40 bg-blue-950/10 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔧</span>
              <div>
                <h2 className="text-xl font-bold text-white">En reparación</h2>
                <p className="text-sm text-blue-400">Tu vehículo está siendo trabajado</p>
              </div>
            </div>

            {/* Checklist autorizado */}
            {(() => {
              const authorized = (order as any).authorized_priorities?.split(',').filter(Boolean) || [];
              const authorizedItems = (quoteItems || []).filter((i: any) => authorized.includes(i.priority));
              const done = authorizedItems.filter((i: any) => i.completed);
              if (authorizedItems.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
                    Avance del trabajo — {done.length}/{authorizedItems.length} completados
                  </p>
                  <ul className="space-y-2">
                    {authorizedItems.map((item: any) => (
                      <li key={item.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${item.completed ? 'border-green-800/40 bg-green-950/20' : 'border-slate-700 bg-slate-900/50'}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${item.completed ? 'border-green-500 bg-green-500 text-white' : 'border-slate-600 bg-slate-800 text-slate-400'}`}>
                          {item.completed ? '✓' : ''}
                        </span>
                        <span className={`text-sm flex-1 ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {item.qty}× {item.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Fotos del proceso */}
            {processPhotos && processPhotos.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">Fotos del trabajo</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {processPhotos.map((photo: any) => (
                    <img key={photo.id} src={photo.url} alt="Foto del proceso" className="h-32 w-full rounded-xl object-cover border border-blue-800/40" />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Comprobante de entrega */}
        {normalizedStatus === "entregado" && (
          <section className="rounded-2xl border border-emerald-800/40 bg-emerald-950/10 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h2 className="text-xl font-bold text-white">Vehículo entregado</h2>
                <p className="text-sm text-emerald-400">Trabajo completado</p>
              </div>
            </div>

            {(order as any).repair_detail && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Trabajo realizado</p>
                <p className="text-slate-300 text-sm">{(order as any).repair_detail}</p>
              </div>
            )}

            {(order as any).recommendations && (
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-900/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2">Recomendaciones del taller</p>
                <p className="text-slate-300 text-sm">{(order as any).recommendations}</p>
              </div>
            )}

            {deliveryPhotos && deliveryPhotos.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Fotos de entrega</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {deliveryPhotos.map((photo: any) => (
                    <img
                      key={photo.id}
                      src={photo.url}
                      alt="Foto de entrega"
                      className="h-32 w-full rounded-xl object-cover border border-slate-700"
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {maintenancePlans && maintenancePlans.length > 0 && (
          <MaintenanceAlert
            plans={maintenancePlans.map((p: any) => ({
              id: p.id,
              service_name: p.service_name,
              last_service_km: p.last_service_km,
              next_service_km: p.next_service_km,
              visible_from_km: p.visible_from_km,
              status: p.status,
              items: (p.maintenance_plan_items || []).map((i: any) => ({
                category: i.category,
                description: i.description,
                qty: Number(i.qty),
                unit_price: Number(i.unit_price),
              })),
            }))}
            plate={vehicle?.plate || ''}
            workshopWhatsapp={process.env.NEXT_PUBLIC_WORKSHOP_WHATSAPP || ''}
          />
        )}

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

            {quoteItems && quoteItems.length > 0 && (
              <div className="mt-4 border-t border-slate-700 pt-4 space-y-4">
                <h3 className="text-lg font-semibold text-white">Desglose de cotización</h3>

                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-2 text-sm">
                  <p className="font-semibold text-slate-300 mb-2">¿Qué significa cada color?</p>
                  <div className="flex items-start gap-2"><span>🔴</span><span className="text-slate-300"><span className="text-red-400 font-semibold">Mantenimiento necesario:</span> Debe atenderse de inmediato. Afecta la seguridad o puede causar daños mayores si se ignora.</span></div>
                  <div className="flex items-start gap-2"><span>🟡</span><span className="text-slate-300"><span className="text-yellow-400 font-semibold">Puede dañarse:</span> No es urgente hoy, pero si no se atiende pronto puede convertirse en un daño mayor y más costoso.</span></div>
                  <div className="flex items-start gap-2"><span>🟢</span><span className="text-slate-300"><span className="text-green-400 font-semibold">Recomendado:</span> Mantenimiento preventivo. El vehículo funciona, pero atenderlo prolonga su vida útil.</span></div>
                  <div className="flex items-start gap-2"><span>🟣</span><span className="text-slate-300"><span className="text-purple-400 font-semibold">Servicio especializado:</span> Requiere equipos o certificaciones que no realizamos en este taller. Se indica para que lo atiendas en un taller especializado.</span></div>
                </div>

                {urgentItems.length > 0 && (
                  <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-red-400 uppercase tracking-widest">🔴 Mantenimiento necesario</span>
                      <span className="text-sm font-semibold text-red-300">${urgentTotal.toFixed(2)}</span>
                    </div>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {urgentItems.map((i: any) => (
                        <li key={i.id} className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                          <span>{i.qty}× {i.description}</span>
                          <span className="font-medium">${(Number(i.qty) * Number(i.unit_price)).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {recommendedItems.length > 0 && (
                  <div className="rounded-xl border border-yellow-800/50 bg-yellow-950/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-yellow-400 uppercase tracking-widest">🟡 Puede dañarse - no urgente</span>
                      <span className="text-sm font-semibold text-yellow-300">${recommendedTotal.toFixed(2)}</span>
                    </div>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {recommendedItems.map((i: any) => (
                        <li key={i.id} className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                          <span>{i.qty}× {i.description}</span>
                          <span className="font-medium">${(Number(i.qty) * Number(i.unit_price)).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {optionalItems.length > 0 && (
                  <div className="rounded-xl border border-green-800/50 bg-green-950/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-green-400 uppercase tracking-widest">🟢 Recomendado</span>
                      <span className="text-sm font-semibold text-green-300">${optionalTotal.toFixed(2)}</span>
                    </div>
                    <ul className="space-y-1 text-sm text-green-100/80">
                      {optionalItems.map((i: any) => (
                        <li key={i.id} className="flex justify-between items-center border-b border-slate-700/50 pb-1">
                          <span>{i.qty}× {i.description}</span>
                          <span className="font-medium">${(Number(i.qty) * Number(i.unit_price)).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {specialItems.length > 0 && (
                  <div className="rounded-xl border border-purple-800/50 bg-purple-950/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-purple-400 uppercase tracking-widest">🟣 Servicios especializados</span>
                    </div>
                    <ul className="space-y-1 text-sm text-slate-300 mb-3">
                      {specialItems.map((i: any) => (
                        <li key={i.id} className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                          <span>{i.qty}× {i.description}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-purple-300 bg-purple-900/30 rounded-lg p-3 leading-relaxed">
                      ⚠️ Estos servicios requieren equipos o certificaciones especializadas que no realizamos en este taller. Te recomendamos llevar tu vehículo a un taller especializado para atender estos puntos.
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                  <span className="font-semibold text-white">Total estimado</span>
                  <span className="text-xl font-bold text-orange-400">${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <ApprovalActions
              publicCode={order.public_code}
              approvalStatus={order.approval_status}
              orderStatus={normalizedStatus}
              authorizedPriorities={(order as any).authorized_priorities}
              groups={[
                { key: "urgente", label: "🔴 Mantenimiento necesario", color: "red", total: urgentTotal, count: urgentItems.length },
                { key: "recomendado", label: "🟡 Puede dañarse", color: "yellow", total: recommendedTotal, count: recommendedItems.length },
                { key: "opcional", label: "🟢 Recomendado", color: "green", total: optionalTotal, count: optionalItems.length },
              ]}
            />
          </section>
        )}
      </div>
    </main>
  );
}
