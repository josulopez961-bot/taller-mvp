'use client'

import { useMemo, useState, Fragment, useEffect } from 'react'
import Link from 'next/link'
import OrderNotes from './order-notes'
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
          repair_cost: form.repair_cost ? Number(form.repair_cost) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "No se pudo guardar el diagnóstico");
        return;
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
              Costo estimado
            </label>
            <input
              type="number"
              step="0.01"
              value={form.repair_cost}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  repair_cost: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-orange-500"
              placeholder="0.00"
            />
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
  customer_name: string
  whatsapp: string
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
  const [savingId, setSavingId] = useState<string | null>(null)

  async function updateStatus(orderId: string, newStatus: string) {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

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
                      <div>{order.plate || '-'}</div>
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
      </div>
    </div>
  )
}









