'use client'

import { useMemo, useState, Fragment, useEffect } from 'react'
import Link from 'next/link'
import OrderNotes from './order-notes'
import OrderPhotos from './order-photos'
import OrderDelivery from './order-delivery'
import { useRouter } from "next/navigation"

type DiagnosisEditorProps = {
  order: OrderItem
};

function ApprovalBadge({ status }: { status?: string | null }) {
  if (status === "aprobado") {
    return (
      <span className="rounded-full border border-green-700 bg-green-900/30 px-3 py-1 text-xs font-semibold text-green-300">
        Autorizado
      </span>
    );
  }

  if (status === "rechazado") {
    return (
      <span className="rounded-full border border-red-700 bg-red-900/30 px-3 py-1 text-xs font-semibold text-red-300">
        No autorizado
      </span>
    );
  }

  return (
    <span className="rounded-full border border-yellow-700 bg-yellow-900/30 px-3 py-1 text-xs font-semibold text-yellow-300">
      Pendiente
    </span>
  );
}

function DiagnosisEditor({ order }: DiagnosisEditorProps) {
  const router = useRouter();
  const isDiagnostic = order.status === "diagnostico";

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [generateMaintenance, setGenerateMaintenance] = useState(false);
  const [intervalKm, setIntervalKm] = useState(5000);
  const [currentKm, setCurrentKm] = useState(order.current_km || 0);
  const [items, setItems] = useState<any[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const totalFromItems = items.reduce((acc, item) => {
    const qty = Number(item.qty || 0)
    const price = Number(item.unit_price || 0)
    return acc + qty * price
  }, 0)
  const [form, setForm] = useState({
    estimated_delivery_date: order.estimated_delivery_date || "",
    diagnosis_detail: order.diagnosis_detail || "",
    repair_detail: order.repair_detail || "",
    repair_cost:
      order.repair_cost !== null && order.repair_cost !== undefined
        ? String(order.repair_cost)
        : "",
  });

  const hasContent = useMemo(() => {
    return !!(
      form.estimated_delivery_date ||
      form.diagnosis_detail ||
      form.repair_detail ||
      form.repair_cost
    );
  }, [form]);

  // Cargar items existentes de order_quote_items cuando se abre el panel
  useEffect(() => {
    if (!open || itemsLoaded) return;
    async function loadQuoteItems() {
      try {
        const res = await fetch(`/api/admin/orders/${order.id}/quote-items`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setItems(
              data.map((item: any) => ({
                category: item.category,
                priority: item.priority || 'urgente',
                description: item.description,
                qty: Number(item.qty),
                unit_price: Number(item.unit_price),
              }))
            );
          }
        }
      } catch (e) {
        console.error("Error loading quote items", e);
      } finally {
        setItemsLoaded(true);
      }
    }
    loadQuoteItems();
  }, [open, order.id, itemsLoaded]);

  if (!isDiagnostic) {
    return null;
  }

  async function handleSave() {
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/diagnosis`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          estimated_delivery_date: form.estimated_delivery_date || null,
          diagnosis_detail: form.diagnosis_detail.trim() || null,
          repair_detail: form.repair_detail.trim() || null,
          repair_cost: totalFromItems,
          current_km: currentKm,
          generate_maintenance_plan: generateMaintenance,
          service_interval_km: intervalKm,
        }),
      });

      const data = await res.json();



        if (!res.ok) {
        alert(data.error || "No se pudo guardar el diagnóstico");
        return;
      }
      
      if (items.length > 0) {
        const quoteRes = await fetch(`/api/admin/orders/${order.id}/quote-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items })
        });
        if (!quoteRes.ok) {
          alert("No se pudieron guardar los items de cotización");
        }
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Ocurrió un error al guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-white">
            Diagnóstico y presupuesto
          </p>
          <ApprovalBadge status={order.approval_status} />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {open ? "Cerrar" : hasContent ? "Editar diagnóstico" : "Completar diagnóstico"}
        </button>
      </div>

      {!open && hasContent && (
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <p>
            <span className="font-semibold text-white">Entrega estimada:</span>{" "}
            {form.estimated_delivery_date || "No definida"}
          </p>
          <p>
            <span className="font-semibold text-white">Diagnóstico:</span>{" "}
            {form.diagnosis_detail || "Sin detalle"}
          </p>
          <p>
            <span className="font-semibold text-white">Reparación:</span>{" "}
            {form.repair_detail || "Sin detalle"}
          </p>
          <p>
            <span className="font-semibold text-white">Costo:</span>{" "}
            {form.repair_cost ? `$${form.repair_cost}` : "No definido"}
          </p>
        </div>
      )}

      {open && (
        <div className="mt-4 grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Fecha estimada de entrega
            </label>
            <input
              type="date"
              value={form.estimated_delivery_date}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  estimated_delivery_date: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Diagnóstico
            </label>
            <textarea
              value={form.diagnosis_detail}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  diagnosis_detail: e.target.value,
                }))
              }
              className="min-h-[110px] w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-orange-500"
              placeholder="Qué se encontró en la revisión"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Reparación propuesta
            </label>
            <textarea
              value={form.repair_detail}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  repair_detail: e.target.value,
                }))
              }
              className="min-h-[110px] w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-orange-500"
              placeholder="Qué trabajo se va a realizar"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Costo estimado (auto-calculado)
            </label>
            <input
              type="number"
              value={totalFromItems}
              readOnly
              className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none"
            />
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px" }} className="text-sm font-medium text-slate-300">
              KM actual
            </label>
            <input
              type="number"
              placeholder="KM actual"
              value={currentKm}
              onChange={(e) => setCurrentKm(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div style={{marginTop:"20px"}}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={generateMaintenance}
                onChange={(e)=>setGenerateMaintenance(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-orange-500"
              />
              <span className="text-sm font-medium text-slate-300">Generar próximo mantenimiento</span>
            </label>
            <br/>
            <input
              type="number"
              placeholder="Intervalo mantenimiento km"
              value={intervalKm}
              onChange={(e)=>setIntervalKm(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-orange-500"
            />
          </div>
          <div className="pt-4 border-t border-slate-700">
            <h3 className="mb-3 text-sm font-semibold text-white">Desglose de Cotización (Opcional)</h3>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center flex-wrap">
                <select
                  value={item.priority || 'urgente'}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].priority = e.target.value;
                    setItems(newItems);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:border-orange-500"
                  style={{
                    color:
                      item.priority === 'urgente' ? '#f87171' :
                      item.priority === 'recomendado' ? '#fb923c' :
                      '#94a3b8'
                  }}
                >
                  <option value="urgente">🔴 Urgente</option>
                  <option value="recomendado">🟡 Recomendado</option>
                  <option value="opcional">⚪ Opcional</option>
                </select>
                <select
                  value={item.category}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].category = e.target.value;
                    setItems(newItems);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:border-orange-500"
                >
                  <option value="labor">Mano de Obra</option>
                  <option value="part">Repuesto</option>
                  <option value="supply">Insumo</option>
                </select>
                <input
                  type="text"
                  placeholder="Descripción"
                  value={item.description}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].description = e.target.value;
                    setItems(newItems);
                  }}
                  className="flex-1 min-w-[140px] rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:border-orange-500"
                />
                <input
                  type="number"
                  placeholder="Cant"
                  value={item.qty}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].qty = Number(e.target.value);
                    setItems(newItems);
                  }}
                  className="w-16 rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:border-orange-500"
                />
                <input
                  type="number"
                  placeholder="Precio"
                  value={item.unit_price}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[idx].unit_price = Number(e.target.value);
                    setItems(newItems);
                  }}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:border-orange-500"
                />
                <span className="text-xs text-slate-400 w-16 text-right">
                  ${(Number(item.qty) * Number(item.unit_price)).toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="text-red-500 hover:text-red-400 font-bold px-2"
                >
                  X
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems([...items, { category: "part", priority: "urgente", description: "", qty: 1, unit_price: 0 }])}
              className="mt-2 text-sm font-semibold text-orange-400 hover:text-orange-300"
            >
              + Agregar Item
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar diagnóstico"}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-600 px-5 py-3 font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type OrderItem = {
  id: string
  public_code: string
  status: string
  summary: string
  created_at: string
  estimated_delivery_date?: string | null
  diagnosis_detail?: string | null
  repair_detail?: string | null
  repair_cost?: number | null
  approval_status?: string | null
  plate: string
  make: string
  model: string
  customer_id?: string | null
  customer_name: string
  whatsapp: string
  vehicle_id: string
  current_km: number
  generate_maintenance_plan: boolean
  service_interval_km: number
}

const STATUS_OPTIONS = [
  'recibido',
  'diagnostico',
  'en_proceso',
  'pruebas',
  'listo',
  'entregado',
]

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'recibido':
      return 'bg-zinc-700 text-white border border-zinc-600'
    case 'diagnostico':
      return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
    case 'en_proceso':
      return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
    case 'pruebas':
      return 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
    case 'listo':
      return 'bg-green-500/20 text-green-300 border border-green-500/30'
    case 'entregado':
      return 'bg-emerald-700/30 text-emerald-300 border border-emerald-600/30'
    default:
      return 'bg-zinc-700 text-white border border-zinc-600'
  }
}

function normalizeWhatsapp(input: string) {
  const digits = input.replace(/\D/g, '')

  if (!digits) return ''

  if (digits.startsWith('593')) return digits
  if (digits.startsWith('0')) return `593${digits.slice(1)}`

  return digits
}

export default function OrdersTable({
  initialOrders,
}: {
  initialOrders: OrderItem[]
}) {
  const [orders, setOrders] = useState(initialOrders)

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])
  const [query, setQuery] = useState('')
  const [openNotesId, setOpenNotesId] = useState<string | null>(null)
  const [openPhotosId, setOpenPhotosId] = useState<string | null>(null)
  const [openDeliveryId, setOpenDeliveryId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [showNextMaintenanceModal, setShowNextMaintenanceModal] = useState(false);
  const [selectedOrderForMaintenance, setSelectedOrderForMaintenance] = useState<OrderItem | null>(null);
  const [maintenanceServiceName, setMaintenanceServiceName] = useState("Próximo mantenimiento");
  const [maintenanceItems, setMaintenanceItems] = useState([
    { category: "labor", description: "Cambio de aceite", qty: 1, unit_price: 10 },
    { category: "part", description: "Filtro de aceite", qty: 1, unit_price: 5 },
    { category: "supply", description: "Aceite 10W40", qty: 4, unit_price: 8 },
  ]);

  const nextServiceKm = selectedOrderForMaintenance?.current_km && selectedOrderForMaintenance?.service_interval_km 
    ? selectedOrderForMaintenance.current_km + selectedOrderForMaintenance.service_interval_km 
    : 0;

    const visibleFromKm = nextServiceKm ? nextServiceKm - 200 : 0;

  const maintenanceLaborTotal = maintenanceItems
    .filter((item) => item.category === "labor")
    .reduce((acc, item) => acc + Number(item.qty || 0) * Number(item.unit_price || 0), 0);

  const maintenancePartsTotal = maintenanceItems
    .filter((item) => item.category === "part")
    .reduce((acc, item) => acc + Number(item.qty || 0) * Number(item.unit_price || 0), 0);

  const maintenanceSuppliesTotal = maintenanceItems
    .filter((item) => item.category === "supply")
    .reduce((acc, item) => acc + Number(item.qty || 0) * Number(item.unit_price || 0), 0);

  const maintenanceGrandTotal =
    maintenanceLaborTotal + maintenancePartsTotal + maintenanceSuppliesTotal;

  function updateMaintenanceItem(index: number, patch: Partial<{ category: "labor" | "part" | "supply"; description: string; qty: number; unit_price: number }>) {
    setMaintenanceItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)) );
  }

  function addMaintenanceItem() {
    setMaintenanceItems((prev) => [ ...prev, { category: "labor", description: "", qty: 1, unit_price: 0 }, ]);
  }

  function removeMaintenanceItem(index: number) {
    setMaintenanceItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveNextMaintenance() {
    if (!selectedOrderForMaintenance) return;
    const res = await fetch("/api/admin/maintenance-plans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vehicle_id: selectedOrderForMaintenance.vehicle_id,
        customer_id: null, // We should ideally get this if available
        source_order_id: selectedOrderForMaintenance.id,
        service_name: maintenanceServiceName,
        last_service_km: selectedOrderForMaintenance.current_km,
        service_interval_km: selectedOrderForMaintenance.service_interval_km,
        items: maintenanceItems,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "No se pudo guardar el próximo mantenimiento");
      return;
    }

    setShowNextMaintenanceModal(false);
    setSelectedOrderForMaintenance(null);
    alert("Próximo mantenimiento guardado correctamente");
  }

  async function updateStatus(orderId: string, newStatus: string) {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    if (
      newStatus === "listo" &&
      targetOrder.generate_maintenance_plan &&
      targetOrder.current_km &&
      targetOrder.service_interval_km
    ) {
      setSelectedOrderForMaintenance(targetOrder);
      setShowNextMaintenanceModal(true);
      return;
    }

    if (newStatus === "en_proceso" && targetOrder.approval_status !== "aprobado") {
      alert("Primero debe estar autorizado por el cliente.");
      return;
    }

    const previous = orders

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    )

    setSavingId(orderId)

    try {
      const res = await fetch('/api/admin/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      })

      const data = await res.json()



        if (!res.ok) {
        setOrders(previous)
        alert(data.error || 'No se pudo actualizar el estado')
      }
    } catch {
      setOrders(previous)
      alert('Error al actualizar estado')
    } finally {
      setSavingId(null)
    }
  }

  async function copyClientLink(publicCode: string) {
    const link = `${window.location.origin}/o/${publicCode}`

    try {
      await navigator.clipboard.writeText(link)
      alert(`Link copiado:\n${link}`)
    } catch {
      alert(`No se pudo copiar automáticamente.\nLink:\n${link}`)
    }
  }

  function openWhatsApp(order: OrderItem) {
    const phone = normalizeWhatsapp(order.whatsapp)

    if (!phone) {
      alert('Esta orden no tiene WhatsApp válido')
      return
    }

    const clientLink = `https://taller-mvp.vercel.app/o/${order.public_code}`

    const text =
      `Hola, tu vehículo está siendo atendido en el taller.\n\n` +
      `Puedes ver el estado aquí:\n${clientLink}`

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) return orders

    return orders.filter((order) => {
      return (
        order.public_code.toLowerCase().includes(q) ||
        order.plate.toLowerCase().includes(q) ||
        order.customer_name.toLowerCase().includes(q) ||
        order.whatsapp.toLowerCase().includes(q) ||
        order.summary.toLowerCase().includes(q)
      )
    })
  }, [orders, query])

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Órdenes</h1>
            <p className="text-zinc-400">
              Gestiona estados, copia links y envía actualizaciones por WhatsApp.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin/new"
              className="inline-flex items-center justify-center rounded-lg bg-green-600 hover:bg-green-700 px-5 py-3 font-semibold"
            >
              + Nueva orden
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <input
            placeholder="Buscar por FIN, placa, cliente, WhatsApp o servicio..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full md:w-[420px] p-3 rounded-lg bg-zinc-900 border border-zinc-700 outline-none focus:border-green-500"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr className="text-left">
                <th className="p-4">Código</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Vehículo</th>
                <th className="p-4">Servicio</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Cambiar</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.map((order) => (
                <Fragment key={order.id}>
                  <tr className="border-t border-zinc-800 align-top">
                    <td className="p-4 font-semibold">{order.public_code}</td>

                    <td className="p-4">
                      <div>{order.customer_name || '-'}</div>
                      <div className="text-zinc-400 text-xs">{order.whatsapp || '-'}</div>
                    </td>

                    <td className="p-4">
                      <Link
                        href={`/admin/vehicles/${encodeURIComponent(order.plate)}`}
                        className="font-semibold text-orange-400 hover:underline"
                      >
                        {order.plate || '-'}
                      </Link>
                      <div className="text-zinc-400 text-xs">
                        {[order.make, order.model].filter(Boolean).join(' ')}
                      </div>
                    </td>

                    <td className="p-4 max-w-[320px]">
                      <div className="whitespace-normal break-words">
                        {order.summary || '-'}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col items-start gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${getStatusBadgeClass(
                            order.status
                          )}`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                        {order.status !== 'recibido' && (
                          <ApprovalBadge status={order.approval_status} />
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        disabled={savingId === order.id}
                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>

                      {savingId === order.id && (
                        <div className="text-xs text-zinc-400 mt-2">Guardando...</div>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-2 min-w-[160px]">
                        <a
                          href={`/o/${order.public_code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-2"
                        >
                          Ver cliente
                        </a>

                        <button
                          type="button"
                          onClick={() => copyClientLink(order.public_code)}
                          className="inline-flex justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-2"
                        >
                          Copiar link
                        </button>

                        <button
                          type="button"
                          onClick={() => openWhatsApp(order)}
                          className="inline-flex justify-center rounded-lg bg-green-600 hover:bg-green-700 px-3 py-2"
                        >
                          Enviar WhatsApp
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenNotesId((prev) => (prev === order.id ? null : order.id))
                          }
                          className="inline-flex justify-center rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-2"
                        >
                          {openNotesId === order.id ? 'Ocultar notas' : 'Notas'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenPhotosId((prev) => (prev === order.id ? null : order.id))
                          }
                          className="inline-flex justify-center rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-2"
                        >
                          {openPhotosId === order.id ? 'Ocultar fotos' : '📷 Recepción'}
                        </button>

                        {(order.status === 'listo' || order.status === 'entregado') && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDeliveryId((prev) => (prev === order.id ? null : order.id))
                            }
                            className="inline-flex justify-center rounded-lg bg-emerald-800 hover:bg-emerald-700 px-3 py-2"
                          >
                            {openDeliveryId === order.id ? 'Ocultar entrega' : '✅ Entrega'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {openNotesId === order.id && (
                    <tr className="border-t border-zinc-800 bg-zinc-950/50">
                      <td colSpan={7} className="p-4">
                        <OrderNotes orderId={order.id} />
                      </td>
                    </tr>
                  )}
                  {openPhotosId === order.id && (
                    <tr className="border-t border-zinc-800 bg-zinc-950/50">
                      <td colSpan={7} className="p-4">
                        <OrderPhotos orderId={order.id} />
                      </td>
                    </tr>
                  )}
                  {openDeliveryId === order.id && (
                    <tr className="border-t border-zinc-800 bg-zinc-950/50">
                      <td colSpan={7} className="p-4">
                        <OrderDelivery orderId={order.id} />
                      </td>
                    </tr>
                  )}
                  {order.status === 'diagnostico' && (
                    <tr className="border-t border-zinc-800">
                      <td colSpan={7} className="p-4">
                        <DiagnosisEditor order={order} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-zinc-400">
                    No hay órdenes que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      {showNextMaintenanceModal && selectedOrderForMaintenance && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#111827", color: "white", width: "90%", maxWidth: "900px", borderRadius: "12px", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 className="text-xl font-bold mb-4">Próximo mantenimiento</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
               <p>KM actual: <strong>{selectedOrderForMaintenance.current_km}</strong></p>
               <p>Intervalo: <strong>{selectedOrderForMaintenance.service_interval_km} km</strong></p>
               <p>Próximo mantenimiento: <strong>{nextServiceKm} km</strong></p>
               <p>Visible desde: <strong>{visibleFromKm} km</strong></p>
            </div>

            <label className="block text-sm font-medium mb-1">Nombre del servicio</label>
            <input 
              value={maintenanceServiceName} 
              onChange={(e) => setMaintenanceServiceName(e.target.value)} 
              placeholder="Nombre del servicio" 
              style={{ width: "100%", padding: "10px", marginTop: "4px", marginBottom: "16px", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px" }}
            />

            <div style={{ marginBottom: "16px" }}>
              <button 
                className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg font-semibold"
                onClick={addMaintenanceItem}
              >
                + Agregar item
              </button>
            </div>

                        <div className="space-y-2">
              {maintenanceItems.map((item, index) => (
                <div key={index} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 100px 40px", gap: "10px" }}>
                  <select 
                    value={item.category} 
                    onChange={(e) => updateMaintenanceItem(index, { category: e.target.value as "labor" | "part" | "supply", }) }
                    style={{ background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", padding:"8px" }}
                  >
                    <option value="labor">Mano de obra</option>
                    <option value="part">Repuesto</option>
                    <option value="supply">Insumo</option>
                  </select>
                  <input 
                    value={item.description} 
                    onChange={(e) => updateMaintenanceItem(index, { description: e.target.value })} 
                    placeholder="Descripción" 
                    style={{ background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", padding:"8px" }}
                  />
                  <input 
                    type="number" 
                    value={item.qty} 
                    onChange={(e) => updateMaintenanceItem(index, { qty: Number(e.target.value) })} 
                    placeholder="Qty" 
                    style={{ background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", padding:"8px" }}
                  />
                  <input 
                    type="number" 
                    value={item.unit_price} 
                    onChange={(e) => updateMaintenanceItem(index, { unit_price: Number(e.target.value) })} 
                    placeholder="Precio" 
                    style={{ background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", padding:"8px" }}
                  />
                  <button 
                    onClick={() => removeMaintenanceItem(index)}
                    className="text-red-500 font-bold"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: "20px",
              padding: "16px",
              border: "1px solid #334155",
              borderRadius: "10px",
              background: "#0f172a"
            }}>
              <p><strong>Mano de obra:</strong> ${maintenanceLaborTotal.toFixed(2)}</p>
              <p><strong>Repuestos:</strong> ${maintenancePartsTotal.toFixed(2)}</p>
              <p><strong>Insumos:</strong> ${maintenanceSuppliesTotal.toFixed(2)}</p>
              <p style={{ fontSize: "18px", marginTop: "10px" }}>
                <strong>Total estimado:</strong> ${maintenanceGrandTotal.toFixed(2)}
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button 
                onClick={handleSaveNextMaintenance}
                className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl font-bold flex-1"
              >
                Guardar próximo mantenimiento
              </button>
              <button 
                onClick={() => { setShowNextMaintenanceModal(false); setSelectedOrderForMaintenance(null); }}
                className="bg-zinc-700 hover:bg-zinc-600 px-6 py-3 rounded-xl font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}




