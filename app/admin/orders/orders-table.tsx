'use client'

import { useState } from 'react'

type OrderItem = {
  id: string
  public_code: string
  status: string
  summary: string
  created_at: string
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

export default function OrdersTable({
  initialOrders,
}: {
  initialOrders: OrderItem[]
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function updateStatus(orderId: string, newStatus: string) {
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Órdenes</h1>
        <p className="text-zinc-400 mb-6">
          Gestiona estados sin entrar a Supabase.
        </p>

        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr className="text-left">
                <th className="p-4">Código</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Vehículo</th>
                <th className="p-4">Servicio</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Link</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-zinc-800">
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
                    <div className="truncate">{order.summary || '-'}</div>
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
                    <a
                      href={`/o/${order.public_code}`}
                      target="_blank"
                      className="inline-flex rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-2"
                    >
                      Ver cliente
                    </a>
                  </td>
                </tr>
              ))}

              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-zinc-400">
                    No hay órdenes registradas.
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
